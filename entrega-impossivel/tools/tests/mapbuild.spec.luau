-- Executa o MapBuilder num DataModel de teste e confere o resultado.

local TestKit = require("../lib/TestKit")
local RobloxEnv = require("../lib/RobloxEnv")
local roblox = require("@lune/roblox")

return function(game: any, env: any)
	local MapBuilder = env.require(RobloxEnv.find(game, "ServerScriptService.Server.Map.MapBuilder"))
	local MapLayout = env.require(RobloxEnv.find(game, "ReplicatedStorage.Shared.Map.MapLayout"))
	local test, expect, equal = TestKit.test, TestKit.expect, TestKit.equal

	local container = roblox.Instance.new("Folder")
	local map

	TestKit.group("Construção do mapa", function()
		test("MapBuilder.Build roda sem erros", function()
			map = MapBuilder.Build(container)
			expect(map and map.Name == "Map")
			equal(map:GetAttribute("LayoutVersion"), MapLayout.Version)
		end)

		if not map then
			return
		end

		local parts = {}
		for _, descendant in map:GetDescendants() do
			if descendant:IsA("BasePart") then
				table.insert(parts, descendant)
			end
		end

		test("quantidade de partes é razoável", function()
			print("      partes: " .. #parts)
			expect(#parts > 1500 and #parts < 9000, "partes: " .. #parts)
		end)

		test("tamanhos válidos (0.05 a 2048) e alturas plausíveis", function()
			for _, part in parts do
				local size = part.Size
				for _, axis in { size.X, size.Y, size.Z } do
					expect(axis >= 0.05 and axis <= 2048, part:GetFullName() .. " tamanho inválido " .. tostring(size))
				end
				local y = part.CFrame.Position.Y
				expect(y > -60 and y < 200, part:GetFullName() .. " altura estranha " .. y)
			end
		end)

		test("tudo ancorado, exceto obstáculos derrubáveis com posição de origem", function()
			local knockables = 0
			for _, part in parts do
				if not part.Anchored then
					expect(part:HasTag(MapBuilder.KnockableTag), part:GetFullName() .. " solto sem tag")
					expect(part:GetAttribute("HomeCFrame") ~= nil, part:GetFullName() .. " sem HomeCFrame")
					knockables += 1
				end
			end
			print("      obstáculos derrubáveis: " .. knockables)
			expect(knockables >= 15)
		end)

		test("cada local tem seu ponto marcado e seu prédio", function()
			for _, loc in MapLayout.Locations do
				local pad = map.Locations:FindFirstChild(loc.Id)
				expect(pad, "sem marca: " .. loc.Id)
				equal(pad:GetAttribute("LocationId"), loc.Id)
				expect(map.Buildings:FindFirstChild(loc.Id), "sem prédio: " .. loc.Id)
			end
		end)

		test("existe um SpawnLocation neutro sem campo de força", function()
			local spawn = map:FindFirstChild("SpawnLocation")
			expect(spawn and spawn.ClassName == "SpawnLocation")
			expect(spawn.Neutral)
			equal(spawn.Duration, 0)
		end)

		test("atalhos começam fechados e abrem/fecham corretamente", function()
			for _, spec in MapLayout.Shortcuts do
				local shortcut = map.Shortcuts:FindFirstChild(spec.Id)
				expect(shortcut, "atalho ausente: " .. spec.Id)
				equal(shortcut:GetAttribute("IsOpen"), false)
				local closedSolid, openSolid = 0, 0
				for _, part in shortcut.ClosedParts:GetDescendants() do
					if part:IsA("BasePart") and part.CanCollide then
						closedSolid += 1
					end
				end
				for _, part in shortcut.OpenParts:GetDescendants() do
					if part:IsA("BasePart") then
						expect(part.Transparency == 1 and not part.CanCollide, "parte aberta visível: " .. part.Name)
					end
				end
				expect(closedSolid > 0, spec.Id .. " fechado não bloqueia nada")

				MapBuilder.SetShortcutOpen(shortcut, true)
				for _, part in shortcut.ClosedParts:GetDescendants() do
					if part:IsA("BasePart") then
						expect(not part.CanCollide and part.Transparency == 1, "barreira continua sólida ao abrir")
					elseif part:IsA("SurfaceGui") then
						expect(not part.Enabled, "placa de fechado continua visível")
					end
				end
				for _, part in shortcut.OpenParts:GetDescendants() do
					if part:IsA("BasePart") and part.CanCollide then
						openSolid += 1
					end
				end
				MapBuilder.SetShortcutOpen(shortcut, false)
				equal(shortcut:GetAttribute("IsOpen"), false)
				if spec.Id == "PonteObra" then
					expect(openSolid > 0, "ponte aberta não tem piso sólido")
				end
			end
		end)

		test("pontes normais têm piso sobre o canal; a Av. Aurora não", function()
			local canal = MapLayout.Canal
			local midZ = (canal.ZMin + canal.ZMax) / 2
			local function hasRoadOver(x: number): boolean
				for _, part in map.Roads:GetChildren() do
					if part.Name == "Road" and part.CanCollide then
						local cf, size = part.CFrame.Position, part.Size
						if math.abs(cf.X - x) < size.X / 2 and math.abs(cf.Z - midZ) < size.Z / 2 then
							return true
						end
					end
				end
				return false
			end
			for x, crossing in MapLayout.CanalCrossings do
				if crossing == "Full" then
					expect(hasRoadOver(x), "sem ponte em x=" .. x)
				else
					expect(not hasRoadOver(x), "rua atravessa o canal em x=" .. x .. " (" .. crossing .. ")")
				end
			end
		end)
	end)
end
