-- Testa a montagem do veículo e os eventos aleatórios (acidente, tempestade, atalho).

local roblox = require("@lune/roblox")

local TestKit = require("../lib/TestKit")
local RobloxEnv = require("../lib/RobloxEnv")
local Mocks = require("../lib/Mocks")

local Instance = roblox.Instance

local SERVICES = "ServerScriptService.Server.Services."

return function(game: any, env: any)
	local test, expect, equal = TestKit.test, TestKit.expect, TestKit.equal

	TestKit.group("Veículo", function()
		local VehicleBuilder = env.require(RobloxEnv.find(game, "ServerScriptService.Server.Vehicles.VehicleBuilder"))
		local built

		test("VehicleBuilder monta o Pé-de-Boi com todas as peças", function()
			built = VehicleBuilder.Build("Starter")
			expect(built.Model.PrimaryPart == built.Chassis, "PrimaryPart deveria ser o chassi")
			equal(built.Seat.ClassName, "VehicleSeat")
			equal(built.Drive.VelocityConstraintMode, roblox.Enum.VelocityConstraintMode.Plane)
			equal(built.Align.Mode, roblox.Enum.OrientationAlignmentMode.OneAttachment)
			equal(built.Prompt.ActionText, "Dirigir")
		end)

		if not built then
			return
		end

		test("só o chassi tem massa e nada está ancorado", function()
			for _, part in built.Model:GetDescendants() do
				if part:IsA("BasePart") then
					expect(not part.Anchored, part.Name .. " ancorado")
					if part ~= built.Chassis then
						expect(part.Massless, part.Name .. " com massa")
					end
				end
			end
			expect(not built.Chassis.Massless)
		end)

		test("4 rodas com Weld animável e 4 esferas de apoio sem atrito", function()
			local wheels, skids = 0, 0
			for _, descendant in built.Model:GetDescendants() do
				if descendant.ClassName == "Weld" and descendant.Name == "WheelWeld" then
					wheels += 1
				elseif descendant.Name == "Skid" then
					skids += 1
					equal(descendant.CustomPhysicalProperties.Friction, 0)
					expect(descendant.CanCollide, "apoio sem colisão")
				end
			end
			equal(wheels, 4)
			equal(skids, 4)
		end)
	end)

	TestKit.group("Eventos aleatórios", function()
		-- Mapa real no workspace (o evento ATALHO usa workspace.Map.Shortcuts).
		local MapBuilder = env.require(RobloxEnv.find(game, "ServerScriptService.Server.Map.MapBuilder"))
		local realWorkspace = game:GetService("Workspace")
		if not realWorkspace:FindFirstChild("Map") then
			MapBuilder.Build(realWorkspace)
		end

		local clock = Mocks.clock(100)
		local players = Mocks.players()
		local worldEvents = Instance.new("Folder")
		worldEvents.Name = "WorldEvents"
		local workspaceMock = Mocks.workspace(clock)
		function workspaceMock:FindFirstChild(name: string)
			if name == "WorldEvents" then
				return worldEvents
			elseif name == "Map" then
				return realWorkspace:FindFirstChild("Map")
			end
			return nil
		end
		local broadcasts = {}
		local eventsEnv = RobloxEnv.new(game, {
			Services = {
				Players = players,
				Workspace = workspaceMock,
				RunService = Mocks.runService(false),
			},
			Overrides = {
				[RobloxEnv.find(game, SERVICES .. "NotificationService"):GetFullName()] = {
					Send = function() end,
					Broadcast = function(text)
						table.insert(broadcasts, text)
					end,
				},
			},
			Globals = { Random = Mocks.randomClass(TestKit.rng) },
		})
		local EventService = eventsEnv.require(RobloxEnv.find(game, SERVICES .. "EventService"))
		local ReplicatedStorage = game:GetService("ReplicatedStorage")
		local MapLayout = eventsEnv.require(RobloxEnv.find(game, "ReplicatedStorage.Shared.Map.MapLayout"))

		test("EventService carrega os 3 eventos", function()
			EventService.Init()
			equal(ReplicatedStorage:GetAttribute("Weather"), "Clear")
		end)

		test("TEMPESTADE muda o clima para todos e volta ao normal", function()
			EventService.TriggerEvent("Storm")
			equal(ReplicatedStorage:GetAttribute("Weather"), "Storm")
			equal(ReplicatedStorage:GetAttribute("ActiveEvent"), "Storm")
			EventService.StopActiveEvent()
			equal(ReplicatedStorage:GetAttribute("Weather"), "Clear")
			equal(ReplicatedStorage:GetAttribute("ActiveEvent"), "")
		end)

		test("ACIDENTE bloqueia uma rua (e a libera ao terminar)", function()
			EventService.TriggerEvent("Accident")
			local blockade = worldEvents:GetChildren()[1]
			expect(blockade, "nenhum bloqueio criado")
			equal(blockade:GetAttribute("MapIcon"), "🚧")
			local blockedSomewhere = false
			for _, spot in MapLayout.AccidentSpots do
				if EventService.IsBlocked(spot.Position) then
					blockedSomewhere = true
				end
			end
			expect(blockedSomewhere, "nenhuma zona bloqueada")
			for _, part in blockade:GetDescendants() do
				if part:IsA("BasePart") then
					expect(part.Anchored, "peça do acidente solta: " .. part.Name)
				end
			end
			EventService.StopActiveEvent()
			equal(#worldEvents:GetChildren(), 0)
			for _, spot in MapLayout.AccidentSpots do
				expect(not EventService.IsBlocked(spot.Position), "zona continuou bloqueada")
			end
		end)

		test("ACIDENTE não nasce em cima de um jogador", function()
			-- Um jogador em cada ponto possível: o evento deve desistir.
			for index, spot in MapLayout.AccidentSpots do
				local player = players:Add(100 + index)
				player.Character:MoveTo(spot.Position)
			end
			EventService.TriggerEvent("Accident")
			equal(#worldEvents:GetChildren(), 0)
			equal(EventService.GetActiveEventId(), nil)
			for _, player in players:GetPlayers() do
				players:Remove(player)
			end
		end)

		test("ATALHO abre uma rota e fecha depois", function()
			EventService.TriggerEvent("Shortcut")
			local openId = ReplicatedStorage:GetAttribute("OpenShortcut")
			expect(openId ~= "", "nenhum atalho aberto")
			local shortcut = realWorkspace.Map.Shortcuts:FindFirstChild(openId)
			equal(shortcut:GetAttribute("IsOpen"), true)
			EventService.StopActiveEvent()
			equal(shortcut:GetAttribute("IsOpen"), false)
			equal(ReplicatedStorage:GetAttribute("OpenShortcut"), "")
		end)

		test("todos os eventos avisam os jogadores", function()
			expect(#broadcasts >= 5, "avisos: " .. #broadcasts)
		end)
	end)
end
