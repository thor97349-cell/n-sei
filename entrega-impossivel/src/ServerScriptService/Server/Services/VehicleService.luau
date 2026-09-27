--!strict
-- Um veículo por jogador: cria, estaciona, entrega a direção ao dono, resgata quando
-- vira/cai e remove quando o jogador sai. Só o dono pode dirigir o próprio veículo.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local Workspace = game:GetService("Workspace")

local GameConfig = require(ReplicatedStorage.Shared.Config.GameConfig)
local VehicleConfig = require(ReplicatedStorage.Shared.Config.VehicleConfig)
local MapLayout = require(ReplicatedStorage.Shared.Map.MapLayout)
local RoadNetwork = require(ReplicatedStorage.Shared.Map.RoadNetwork)
local Remotes = require(ReplicatedStorage.Shared.Util.Remotes)
local RateLimiter = require(ReplicatedStorage.Shared.Util.RateLimiter)

local VehicleBuilder = require(script.Parent.Parent.Vehicles.VehicleBuilder)
local DataService = require(script.Parent.DataService)
local EventService = require(script.Parent.EventService)
local NotificationService = require(script.Parent.NotificationService)

type VehicleRecord = {
	Owner: Player,
	VehicleId: string,
	Model: Model,
	Chassis: BasePart,
	Seat: VehicleSeat,
	Drive: LinearVelocity,
	Align: AlignOrientation,
	Driver: Player?,
	Connections: { RBXScriptConnection },
}

local VehicleService = {}

local CONFIG = GameConfig.Vehicle
local PARKED_FORCE_PER_MASS = 60

local records: { [Player]: VehicleRecord } = {}
local vehiclesFolder: Folder
local spawnLimiter = RateLimiter.new(CONFIG.SpawnCooldown)
local resetLimiter = RateLimiter.new(CONFIG.ResetCooldown)
local resetRemote: RemoteEvent

local function getCharacterParts(player: Player): (Model?, Humanoid?, BasePart?)
	local character = player.Character
	if not character then
		return nil, nil, nil
	end
	local humanoid = character:FindFirstChildOfClass("Humanoid")
	local root = character:FindFirstChild("HumanoidRootPart")
	if not humanoid or humanoid.Health <= 0 or not root or not root:IsA("BasePart") then
		return nil, nil, nil
	end
	return character, humanoid, root
end

local function flatYaw(cframe: CFrame): CFrame
	local look = cframe.LookVector
	local flat = Vector3.new(look.X, 0, look.Z)
	if flat.Magnitude < 0.1 then
		flat = Vector3.new(0, 0, -1)
	end
	return CFrame.lookAt(Vector3.zero, flat.Unit)
end

local function setNetworkOwner(record: VehicleRecord, owner: Player?)
	if record.Chassis.Parent == nil then
		return
	end
	local ok, err = pcall(function()
		record.Chassis:SetNetworkOwner(owner)
	end)
	if not ok then
		warn("[VehicleService] SetNetworkOwner falhou:", err)
	end
end

-- Carro sem motorista: freia, fica em pé e passa a ser simulado pelo servidor.
local function park(record: VehicleRecord)
	record.Drive.PlaneVelocity = Vector2.zero
	record.Drive.MaxForce = record.Chassis.AssemblyMass * PARKED_FORCE_PER_MASS
	record.Align.CFrame = flatYaw(record.Chassis.CFrame)
	setNetworkOwner(record, nil)
end

local function eject(seat: VehicleSeat, humanoid: Humanoid)
	local seatWeld = seat:FindFirstChild("SeatWeld")
	if seatWeld then
		seatWeld:Destroy()
	end
	humanoid.Sit = false
end

local function destroyRecord(player: Player)
	local record = records[player]
	if not record then
		return
	end
	records[player] = nil
	for _, connection in record.Connections do
		connection:Disconnect()
	end
	if record.Model.Parent then
		record.Model:Destroy()
	end
end

-- Existe outro veículo (ou pessoa) ocupando este ponto?
local function isSpotOccupied(position: Vector3, ignorePlayer: Player?): boolean
	for owner, record in records do
		if owner ~= ignorePlayer and record.Chassis.Parent then
			local p = record.Chassis.Position
			if Vector2.new(p.X - position.X, p.Z - position.Z).Magnitude < 12 then
				return true
			end
		end
	end
	for _, other in Players:GetPlayers() do
		if other ~= ignorePlayer then
			local _, _, root = getCharacterParts(other)
			if root and (root.Position - position).Magnitude < 7 then
				return true
			end
		end
	end
	return false
end

local function onOccupantChanged(record: VehicleRecord)
	local humanoid = record.Seat.Occupant
	if humanoid then
		local occupant = Players:GetPlayerFromCharacter(humanoid.Parent)
		if occupant ~= record.Owner then
			eject(record.Seat, humanoid)
			if occupant then
				NotificationService.Send(occupant, "🚫 Esse veículo é de outro entregador.", "warning", 3)
			end
			return
		end
		record.Driver = occupant
		setNetworkOwner(record, occupant)
	else
		record.Driver = nil
		park(record)
	end
end

local function spawnVehicle(player: Player, surfaceCFrame: CFrame): VehicleRecord?
	destroyRecord(player)

	local data = DataService.GetData(player)
	local vehicleId = if data then data.Vehicles.Equipped else CONFIG.DefaultVehicleId
	local definition = VehicleConfig.Get(vehicleId)
	if not definition then
		vehicleId = CONFIG.DefaultVehicleId
		definition = VehicleConfig.Get(vehicleId)
	end
	assert(definition, "Veículo padrão ausente no VehicleConfig")

	local built = VehicleBuilder.Build(vehicleId)
	local model = built.Model
	model.Name = player.Name .. " - " .. definition.DisplayName
	model:SetAttribute("OwnerUserId", player.UserId)
	model:SetAttribute("VehicleId", vehicleId)
	built.Nameplate.Text = "🚚 " .. player.DisplayName
	built.Prompt.ObjectText = definition.DisplayName

	model:PivotTo(surfaceCFrame * CFrame.new(0, definition.Body.GroundOffset + 0.4, 0))
	model.Parent = vehiclesFolder

	local record: VehicleRecord = {
		Owner = player,
		VehicleId = vehicleId,
		Model = model,
		Chassis = built.Chassis,
		Seat = built.Seat,
		Drive = built.Drive,
		Align = built.Align,
		Driver = nil,
		Connections = {},
	}
	records[player] = record

	table.insert(
		record.Connections,
		built.Seat:GetPropertyChangedSignal("Occupant"):Connect(function()
			onOccupantChanged(record)
		end)
	)
	table.insert(
		record.Connections,
		built.Prompt.Triggered:Connect(function(triggeringPlayer: Player)
			if triggeringPlayer ~= record.Owner then
				NotificationService.Send(triggeringPlayer, "🚫 Esse veículo é de outro entregador.", "warning", 3)
				return
			end
			local _, humanoid, root = getCharacterParts(triggeringPlayer)
			if not humanoid or not root or humanoid.SeatPart or record.Seat.Occupant then
				return
			end
			if (root.Position - record.Seat.Position).Magnitude > CONFIG.EnterDistance then
				return
			end
			record.Seat:Sit(humanoid)
		end)
	)

	park(record)
	return record
end

local function seatOwner(record: VehicleRecord)
	local _, humanoid = getCharacterParts(record.Owner)
	if humanoid and not record.Seat.Occupant and records[record.Owner] == record then
		humanoid.Sit = false
		record.Seat:Sit(humanoid)
	end
end

-- Primeiro veículo: numa vaga livre do estacionamento da Central de Entregas.
local function spawnAtParking(player: Player)
	for _, slot in MapLayout.ParkingSlots do
		if not isSpotOccupied(slot.Position, player) then
			spawnVehicle(player, slot)
			return
		end
	end
	local lane = RoadNetwork.NearestLanePoint(MapLayout.HQ.Center, {
		Exclude = function(position: Vector3): boolean
			return EventService.IsBlocked(position) or isSpotOccupied(position, player)
		end,
	})
	if lane then
		spawnVehicle(player, lane)
	end
end

local function handleSpawnRequest(player: Player)
	if not DataService.IsLoaded(player) then
		return
	end
	local _, humanoid, root = getCharacterParts(player)
	if not humanoid or not root then
		return
	end
	local current = records[player]
	if current and humanoid.SeatPart == current.Seat then
		NotificationService.Send(
			player,
			"Você já está no seu veículo. Use 🔄 Resgatar se ele estiver preso.",
			"info",
			3
		)
		return
	end
	if not spawnLimiter:Check(player) then
		NotificationService.Send(
			player,
			string.format("⏳ Aguarde %ds para chamar o veículo de novo.", math.ceil(spawnLimiter:Remaining(player))),
			"warning",
			2
		)
		return
	end
	local lane = RoadNetwork.NearestLanePoint(root.Position, {
		Exclude = function(position: Vector3): boolean
			return EventService.IsBlocked(position) or isSpotOccupied(position, player)
		end,
		PreferredDirection = root.CFrame.LookVector,
	})
	if not lane then
		NotificationService.Send(player, "Não achei uma rua livre por perto. Tente de novo.", "warning", 3)
		return
	end
	local record = spawnVehicle(player, lane)
	if record then
		NotificationService.Send(player, "🚗 Seu veículo chegou!", "success", 2)
		task.delay(0.15, seatOwner, record)
	end
end

local function resetVehicle(record: VehicleRecord): boolean
	local chassis = record.Chassis
	if chassis.Parent == nil then
		return false
	end
	local lane = RoadNetwork.NearestLanePoint(chassis.Position, {
		Exclude = function(position: Vector3): boolean
			return EventService.IsBlocked(position) or isSpotOccupied(position, record.Owner)
		end,
		PreferredDirection = chassis.CFrame.LookVector,
	})
	if not lane then
		return false
	end
	local definition = VehicleConfig.Get(record.VehicleId)
	local groundOffset = if definition then definition.Body.GroundOffset else 1.7

	setNetworkOwner(record, nil)
	record.Drive.PlaneVelocity = Vector2.zero
	record.Model:PivotTo(lane * CFrame.new(0, groundOffset + 0.4, 0))
	chassis.AssemblyLinearVelocity = Vector3.zero
	chassis.AssemblyAngularVelocity = Vector3.zero
	record.Align.CFrame = lane.Rotation

	local driver = record.Driver
	if driver then
		resetRemote:FireClient(driver)
		task.delay(0.2, function()
			if records[record.Owner] == record and record.Driver == driver then
				setNetworkOwner(record, driver)
			end
		end)
	end
	return true
end

local function handleResetRequest(player: Player)
	local record = records[player]
	if not record then
		NotificationService.Send(player, "Você não tem veículo. Use 🚗 Chamar Veículo.", "info", 3)
		return
	end
	if not resetLimiter:Check(player) then
		NotificationService.Send(
			player,
			string.format("⏳ Aguarde %ds para resgatar de novo.", math.ceil(resetLimiter:Remaining(player))),
			"warning",
			2
		)
		return
	end
	if resetVehicle(record) then
		NotificationService.Send(player, "🔄 Veículo resgatado!", "success", 2)
	end
end

--------------------------------------------------------------------------------
-- API pública
--------------------------------------------------------------------------------

function VehicleService.GetVehicleModel(player: Player): Model?
	local record = records[player]
	return record and record.Model
end

function VehicleService.Init()
	local existing = Workspace:FindFirstChild("Vehicles")
	if existing and existing:IsA("Folder") then
		vehiclesFolder = existing
	else
		vehiclesFolder = Instance.new("Folder")
		vehiclesFolder.Name = "Vehicles"
		vehiclesFolder.Parent = Workspace
	end
	resetRemote = Remotes.Get("VehicleReset")
end

function VehicleService.Start()
	Remotes.Get("SpawnVehicle").OnServerEvent:Connect(handleSpawnRequest)
	Remotes.Get("ResetVehicle").OnServerEvent:Connect(handleResetRequest)

	-- Veículo inicial assim que os dados e o personagem estiverem prontos.
	DataService.ObserveProfiles(function(player: Player)
		if not player.Character then
			player.CharacterAdded:Wait()
		end
		task.wait(0.5)
		if player.Parent == Players and not records[player] then
			spawnAtParking(player)
		end
	end)

	Players.PlayerRemoving:Connect(destroyRecord)

	-- Veículos perdidos (caíram do mapa ou foram destruídos).
	local elapsed = 0
	RunService.Heartbeat:Connect(function(dt: number)
		elapsed += dt
		if elapsed < 1 then
			return
		end
		elapsed = 0
		for player, record in records do
			local lost = record.Chassis.Parent == nil
				or record.Model.Parent == nil
				or record.Chassis.Position.Y < CONFIG.LostHeight
			if lost then
				destroyRecord(player)
				NotificationService.Send(player, "💥 Seu veículo se perdeu! Use 🚗 Chamar Veículo.", "danger", 5)
			end
		end
	end)
end

return VehicleService
