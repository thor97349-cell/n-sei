--!strict
-- Eventos aleatórios do servidor (afetam TODOS os jogadores).
--
-- Cada evento é um ModuleScript em ServerScriptService.Server.Events com:
--   Start(context, duração) -> handle?   (retorne nil se não deu para começar)
--   Stop(context, handle)
--   CanStart(context) -> boolean         (opcional)
-- O estado visível para os clientes fica em atributos do ReplicatedStorage
-- (ex.: "Weather", "ActiveEvent"), então quem entra no meio do evento já recebe tudo.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local Workspace = game:GetService("Workspace")

local EventConfig = require(ReplicatedStorage.Shared.Config.EventConfig)
local GameConfig = require(ReplicatedStorage.Shared.Config.GameConfig)
local NotificationService = require(script.Parent.NotificationService)

export type Context = {
	Random: Random,
	EventsFolder: Folder,
	Notify: (text: string, style: string?, duration: number?) -> (),
	SetWorldState: (key: string, value: any) -> (),
	AddBlockedZone: (id: string, position: Vector3, radius: number) -> (),
	RemoveBlockedZone: (id: string) -> (),
	IsAreaOccupied: (position: Vector3, radius: number) -> boolean,
	IsBoxOccupied: (center: Vector3, size: Vector3) -> boolean,
}

export type EventModule = {
	Start: (context: Context, duration: number) -> any,
	Stop: (context: Context, handle: any) -> (),
	CanStart: ((context: Context) -> boolean)?,
}

type ActiveEvent = {
	Id: string,
	Handle: any,
	Token: {},
}

local EventService = {}

local eventModules: { [string]: EventModule } = {}
local blockedZones: { [string]: { Position: Vector3, Radius: number } } = {}
local active: ActiveEvent? = nil
local lastEventId: string? = nil
local rng = Random.new()
local context: Context

-- Posições de todos os veículos e personagens (para não prender ninguém num evento).
local function occupantPositions(): { Vector3 }
	local positions: { Vector3 } = {}
	local vehicles = Workspace:FindFirstChild("Vehicles")
	if vehicles then
		for _, model in vehicles:GetChildren() do
			if model:IsA("Model") and model.PrimaryPart then
				table.insert(positions, model.PrimaryPart.Position)
			end
		end
	end
	for _, player in Players:GetPlayers() do
		local character = player.Character
		local root = character and character:FindFirstChild("HumanoidRootPart")
		if root and root:IsA("BasePart") then
			table.insert(positions, root.Position)
		end
	end
	return positions
end

local function buildContext(eventsFolder: Folder): Context
	return {
		Random = rng,
		EventsFolder = eventsFolder,
		Notify = function(text: string, style: string?, duration: number?)
			NotificationService.Broadcast(text, style, duration)
		end,
		SetWorldState = function(key: string, value: any)
			ReplicatedStorage:SetAttribute(key, value)
		end,
		AddBlockedZone = function(id: string, position: Vector3, radius: number)
			blockedZones[id] = { Position = position, Radius = radius }
		end,
		RemoveBlockedZone = function(id: string)
			blockedZones[id] = nil
		end,
		IsAreaOccupied = function(position: Vector3, radius: number): boolean
			for _, p in occupantPositions() do
				if Vector2.new(p.X - position.X, p.Z - position.Z).Magnitude < radius then
					return true
				end
			end
			return false
		end,
		IsBoxOccupied = function(center: Vector3, size: Vector3): boolean
			local half = size / 2 + Vector3.new(6, 6, 6)
			for _, p in occupantPositions() do
				local d = p - center
				if math.abs(d.X) < half.X and math.abs(d.Y) < half.Y and math.abs(d.Z) < half.Z then
					return true
				end
			end
			return false
		end,
	}
end

local function pickEventId(): string?
	local candidates: { string } = {}
	local total = 0
	for _, id in EventConfig.EventOrder do
		local definition = EventConfig.Events[id]
		local module = eventModules[id]
		local canStart = module and (module.CanStart == nil or (module.CanStart :: (Context) -> boolean)(context))
		if definition and module and canStart and (id ~= lastEventId or #EventConfig.EventOrder == 1) then
			table.insert(candidates, id)
			total += definition.Weight
		end
	end
	if #candidates == 0 then
		return nil
	end
	local roll = rng:NextNumber() * total
	for _, id in candidates do
		roll -= EventConfig.Events[id].Weight
		if roll <= 0 then
			return id
		end
	end
	return candidates[#candidates]
end

local function stopActive()
	local current = active
	if not current then
		return
	end
	active = nil
	ReplicatedStorage:SetAttribute("ActiveEvent", "")
	ReplicatedStorage:SetAttribute("ActiveEventEndsAt", 0)
	local module = eventModules[current.Id]
	if module then
		local ok, err = pcall(module.Stop :: any, context, current.Handle)
		if not ok then
			warn("[EventService] Erro ao encerrar", current.Id, err)
		end
	end
end

local function runEvent(id: string)
	local definition = EventConfig.Events[id]
	local module = eventModules[id]
	if not definition or not module or active then
		return
	end
	local duration = rng:NextInteger(definition.Duration[1], definition.Duration[2])
	local ok, handle = pcall(module.Start, context, duration)
	if not ok then
		warn("[EventService] Erro ao iniciar", id, handle)
		return
	end
	if handle == nil then
		return -- o evento decidiu não acontecer agora (ex.: sem lugar livre)
	end
	local token = {}
	active = { Id = id, Handle = handle, Token = token }
	lastEventId = id
	ReplicatedStorage:SetAttribute("ActiveEvent", id)
	ReplicatedStorage:SetAttribute("ActiveEventEndsAt", Workspace:GetServerTimeNow() + duration)

	local finishAt = os.clock() + duration
	while os.clock() < finishAt do
		task.wait(0.5)
		local current = active
		if not current or current.Token ~= token then
			return -- encerrado antes (ex.: comando de teste)
		end
	end
	local current = active
	if current and current.Token == token then
		stopActive()
	end
end

local function range(values: { number }): number
	return rng:NextNumber(values[1], values[2])
end

--------------------------------------------------------------------------------
-- API pública
--------------------------------------------------------------------------------

-- true se a posição está dentro de uma área bloqueada por evento (ex.: acidente).
function EventService.IsBlocked(position: Vector3): boolean
	for _, zone in blockedZones do
		if Vector2.new(position.X - zone.Position.X, position.Z - zone.Position.Z).Magnitude < zone.Radius then
			return true
		end
	end
	return false
end

function EventService.GetActiveEventId(): string?
	local current = active
	return current and current.Id
end

-- Força um evento agora (usado pelos comandos de teste do Studio).
function EventService.TriggerEvent(id: string): boolean
	if not eventModules[id] then
		return false
	end
	stopActive()
	task.spawn(runEvent, id)
	return true
end

function EventService.StopActiveEvent()
	stopActive()
end

function EventService.Init()
	local folder = Workspace:FindFirstChild("WorldEvents")
	if not folder then
		local newFolder = Instance.new("Folder")
		newFolder.Name = "WorldEvents"
		newFolder.Parent = Workspace
		folder = newFolder
	end
	context = buildContext(folder :: Folder)

	ReplicatedStorage:SetAttribute("Weather", "Clear")
	ReplicatedStorage:SetAttribute("ActiveEvent", "")
	ReplicatedStorage:SetAttribute("ActiveEventEndsAt", 0)
	ReplicatedStorage:SetAttribute("OpenShortcut", "")

	local eventsFolder = script.Parent.Parent:FindFirstChild("Events")
	assert(eventsFolder, "ServerScriptService.Server.Events não encontrado")
	for _, id in EventConfig.EventOrder do
		local moduleScript = eventsFolder:FindFirstChild(id)
		if moduleScript and moduleScript:IsA("ModuleScript") then
			eventModules[id] = (require :: any)(moduleScript) :: EventModule
		else
			warn("[EventService] Módulo do evento não encontrado:", id)
		end
	end
end

function EventService.Start()
	local scheduler = EventConfig.Scheduler
	local fast = RunService:IsStudio() and GameConfig.Debug.StudioFastEvents
	local firstDelay = if fast then scheduler.StudioFirstDelay else scheduler.FirstDelay
	local interval = if fast then scheduler.StudioInterval else scheduler.Interval

	task.spawn(function()
		task.wait(range(firstDelay))
		while true do
			if not active and #Players:GetPlayers() > 0 then
				local id = pickEventId()
				if id then
					runEvent(id)
				end
			end
			task.wait(range(interval))
		end
	end)
end

return EventService
