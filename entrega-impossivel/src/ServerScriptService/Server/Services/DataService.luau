--!strict
-- Salva e carrega os dados dos jogadores com DataStoreService.
--
-- Proteções contra perda de dinheiro:
--   • Várias tentativas com espera crescente quando o Roblox falha temporariamente.
--   • Se não der para carregar, o jogador é desconectado com uma mensagem — nunca
--     jogamos com dados zerados que depois sobrescreveriam o save verdadeiro.
--   • "Trava de sessão": só o servidor que carregou os dados pode salvá-los. Se o jogador
--     trocar de servidor rápido, o novo espera o antigo terminar de salvar.
--   • Salva ao sair, a cada AutosaveInterval segundos e quando o servidor fecha.
--   • Dados inválidos (ex.: dinheiro negativo/NaN) nunca são gravados.
--   • No Studio sem acesso às APIs, o jogo funciona normalmente sem salvar (com aviso).

local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local GameConfig = require(ReplicatedStorage.Shared.Config.GameConfig)
local Signal = require(ReplicatedStorage.Shared.Util.Signal)

export type Stats = {
	DeliveriesCompleted: number,
	DeliveriesLate: number,
	DeliveriesFailed: number,
	FastDeliveries: number,
	TotalEarned: number,
}

export type PlayerData = {
	SchemaVersion: number,
	Money: number,
	Stats: Stats,
	-- Preparado para a futura garagem/loja de veículos.
	Vehicles: { Owned: { [string]: boolean }, Equipped: string },
	-- Preparado para futuros upgrades e personalização.
	Upgrades: { [string]: any },
	Customization: { [string]: any },
}

type Profile = {
	Data: PlayerData,
	-- false quando o jogo roda sem DataStore (Studio) ou perdeu a trava da sessão.
	CanSave: boolean,
}

local SCHEMA_VERSION = 1
local CONFIG = GameConfig.Data

local DataService = {}

-- Disparado quando os dados de um jogador ficam prontos: (player, data)
DataService.ProfileLoaded = Signal.new()
-- Disparado logo antes de os dados de um jogador saírem da memória: (player)
DataService.ProfileReleasing = Signal.new()

local profiles: { [Player]: Profile } = {}
local pendingSaves: { [number]: number } = {}
local store: DataStore? = nil
local offlineMode = false
local offlineWarned = false

--------------------------------------------------------------------------------
-- Dados padrão e validação
--------------------------------------------------------------------------------

local function defaultData(): PlayerData
	return {
		SchemaVersion = SCHEMA_VERSION,
		Money = 0,
		Stats = {
			DeliveriesCompleted = 0,
			DeliveriesLate = 0,
			DeliveriesFailed = 0,
			FastDeliveries = 0,
			TotalEarned = 0,
		},
		Vehicles = {
			Owned = { [GameConfig.Vehicle.DefaultVehicleId] = true },
			Equipped = GameConfig.Vehicle.DefaultVehicleId,
		},
		Upgrades = {},
		Customization = {},
	}
end

local function deepCopy(value: any): any
	if type(value) ~= "table" then
		return value
	end
	local copy = {}
	for key, inner in value do
		copy[key] = deepCopy(inner)
	end
	return copy
end

local function isValidNumber(value: any): boolean
	return type(value) == "number" and value == value and value ~= math.huge and value ~= -math.huge
end

local function sanitizeCount(value: any): number
	if not isValidNumber(value) or value < 0 then
		return 0
	end
	return math.floor(value)
end

-- Aceita qualquer coisa vinda do DataStore e devolve dados no formato atual.
local function sanitize(raw: any): PlayerData
	local data = defaultData()
	if type(raw) ~= "table" then
		return data
	end

	if isValidNumber(raw.Money) and raw.Money >= 0 then
		data.Money = math.min(math.floor(raw.Money), GameConfig.Economy.MaxMoney)
	elseif raw.Money ~= nil then
		warn("[DataService] Valor de dinheiro inválido encontrado no save:", raw.Money)
	end

	if type(raw.Stats) == "table" then
		for key in data.Stats do
			(data.Stats :: any)[key] = sanitizeCount(raw.Stats[key])
		end
	end

	if type(raw.Vehicles) == "table" then
		if type(raw.Vehicles.Owned) == "table" then
			for vehicleId, owned in raw.Vehicles.Owned do
				if type(vehicleId) == "string" and owned == true then
					data.Vehicles.Owned[vehicleId] = true
				end
			end
		end
		if type(raw.Vehicles.Equipped) == "string" and data.Vehicles.Owned[raw.Vehicles.Equipped] then
			data.Vehicles.Equipped = raw.Vehicles.Equipped
		end
	end

	if type(raw.Upgrades) == "table" then
		data.Upgrades = deepCopy(raw.Upgrades)
	end
	if type(raw.Customization) == "table" then
		data.Customization = deepCopy(raw.Customization)
	end

	-- Futuras migrações de formato entram aqui (ex.: if raw.SchemaVersion < 2 then ...).
	data.SchemaVersion = SCHEMA_VERSION
	return data
end

local function isSaveable(data: PlayerData): boolean
	return isValidNumber(data.Money) and data.Money >= 0 and data.Money <= GameConfig.Economy.MaxMoney
end

--------------------------------------------------------------------------------
-- DataStore
--------------------------------------------------------------------------------

local function keyFor(userId: number): string
	return "Player_" .. userId
end

local function isStudioApiError(message: string): boolean
	local lowered = string.lower(message)
	return string.find(lowered, "studioaccesstoapisnotallowed", 1, true) ~= nil
		or string.find(lowered, "publish", 1, true) ~= nil
		or string.find(lowered, "api services", 1, true) ~= nil
		or string.find(lowered, "403", 1, true) ~= nil
end

local function enterOfflineMode(reason: string)
	offlineMode = true
	if not offlineWarned then
		offlineWarned = true
		warn(
			"[DataService] Rodando SEM salvar dados: "
				.. reason
				.. "\nPara testar o salvamento no Studio: publique o jogo e ative "
				.. "Game Settings → Security → Enable Studio Access to API Services."
		)
	end
end

type LockInfo = { JobId: string, Time: number }

local function lockOwnedByOtherServer(raw: any, requireFresh: boolean): boolean
	if type(raw) ~= "table" or type(raw.SessionLock) ~= "table" then
		return false
	end
	local lock = raw.SessionLock :: LockInfo
	if lock.JobId == game.JobId then
		return false
	end
	if requireFresh then
		return type(lock.Time) == "number" and os.time() - lock.Time < CONFIG.SessionLockTimeout
	end
	return true
end

-- Carrega os dados e assume a trava da sessão. Retorna (dados, podeSalvar) ou nil em falha.
local function loadData(userId: number): (PlayerData?, boolean)
	if offlineMode or not store then
		return defaultData(), false
	end
	local dataStore = store :: DataStore
	local key = keyFor(userId)
	local lockWaitStarted = os.clock()
	local failures = 0

	while true do
		local loaded: PlayerData? = nil
		local lockedByOther = false

		local ok, err = pcall(function()
			dataStore:UpdateAsync(key, function(raw: any): any
				loaded = nil
				lockedByOther = false
				local stillWaiting = os.clock() - lockWaitStarted < CONFIG.SessionLockWait
				if lockOwnedByOtherServer(raw, true) and stillWaiting then
					lockedByOther = true
					return nil -- não grava nada; tentamos de novo daqui a pouco
				end
				local data = sanitize(raw)
				loaded = data
				local stored = deepCopy(data)
				stored.SessionLock = { JobId = game.JobId, Time = os.time() }
				return stored
			end)
		end)

		if ok then
			if loaded then
				return loaded, true
			end
			if lockedByOther then
				task.wait(CONFIG.SessionLockRetryDelay)
			else
				failures += 1
			end
		else
			failures += 1
			local message = tostring(err)
			warn(string.format("[DataService] Falha ao carregar %s (tentativa %d): %s", key, failures, message))
			if RunService:IsStudio() and isStudioApiError(message) then
				enterOfflineMode(message)
				return defaultData(), false
			end
			if failures >= CONFIG.MaxLoadAttempts then
				if RunService:IsStudio() then
					enterOfflineMode(message)
					return defaultData(), false
				end
				return nil, false
			end
			task.wait(CONFIG.RetryBaseDelay * 2 ^ (failures - 1))
		end
	end
end

-- Grava os dados. `release` = libera a trava (jogador saiu / servidor fechando).
local function saveProfile(userId: number, profile: Profile, release: boolean): boolean
	if not profile.CanSave or offlineMode or not store then
		return true
	end
	if not isSaveable(profile.Data) then
		warn("[DataService] Dados inválidos, salvamento cancelado para", userId)
		return false
	end
	local dataStore = store :: DataStore
	local key = keyFor(userId)
	-- Cópia feita ANTES de qualquer espera: salva exatamente o estado deste momento.
	local snapshot = deepCopy(profile.Data)

	pendingSaves[userId] = (pendingSaves[userId] or 0) + 1
	local success = false
	for attempt = 1, CONFIG.MaxSaveAttempts do
		local lostLock = false
		local ok, err = pcall(function()
			dataStore:UpdateAsync(key, function(raw: any): any
				lostLock = false
				if lockOwnedByOtherServer(raw, false) then
					-- Outro servidor assumiu estes dados: não podemos sobrescrever.
					lostLock = true
					return nil
				end
				local stored = deepCopy(snapshot)
				if not release then
					stored.SessionLock = { JobId = game.JobId, Time = os.time() }
				end
				return stored
			end)
		end)
		if ok then
			if lostLock then
				warn("[DataService] Outro servidor assumiu os dados de", userId, "- este servidor não salva mais.")
				profile.CanSave = false
			end
			success = true
			break
		end
		warn(string.format("[DataService] Falha ao salvar %s (tentativa %d): %s", key, attempt, tostring(err)))
		if attempt < CONFIG.MaxSaveAttempts then
			task.wait(CONFIG.RetryBaseDelay * 2 ^ (attempt - 1))
		end
	end
	pendingSaves[userId] = (pendingSaves[userId] or 1) - 1
	if pendingSaves[userId] <= 0 then
		pendingSaves[userId] = nil
	end
	return success
end

--------------------------------------------------------------------------------
-- Ciclo de vida dos jogadores
--------------------------------------------------------------------------------

local function onPlayerAdded(player: Player)
	local userId = player.UserId
	-- Se este mesmo servidor ainda está salvando uma sessão anterior, espera terminar.
	local waited = 0
	while pendingSaves[userId] and waited < 15 do
		task.wait(0.25)
		waited += 0.25
	end

	local data, canSave = loadData(userId)

	if player.Parent ~= Players then
		-- Saiu enquanto carregava: devolve a trava sem alterar nada.
		if data and canSave then
			saveProfile(userId, { Data = data, CanSave = true }, true)
		end
		return
	end

	if not data then
		player:Kick(
			"Não foi possível carregar seus dados agora. Seu progresso está seguro — entre novamente em instantes."
		)
		return
	end

	local profile: Profile = { Data = data, CanSave = canSave }
	profiles[player] = profile
	DataService.ProfileLoaded:Fire(player, data)
end

local function onPlayerRemoving(player: Player)
	local profile = profiles[player]
	if not profile then
		return
	end
	DataService.ProfileReleasing:Fire(player)
	profiles[player] = nil
	saveProfile(player.UserId, profile, true)
end

--------------------------------------------------------------------------------
-- API pública
--------------------------------------------------------------------------------

function DataService.GetData(player: Player): PlayerData?
	local profile = profiles[player]
	return profile and profile.Data
end

function DataService.IsLoaded(player: Player): boolean
	return profiles[player] ~= nil
end

-- true se o progresso deste jogador está sendo salvo de verdade.
function DataService.IsPersistent(player: Player): boolean
	local profile = profiles[player]
	return profile ~= nil and profile.CanSave and not offlineMode
end

-- Chama `callback` para todos os jogadores já carregados E para os que carregarem depois.
-- Use isto em vez de ProfileLoaded:Connect para não perder quem carregou antes.
function DataService.ObserveProfiles(callback: (Player, PlayerData) -> ()): Signal.Connection
	for player, profile in profiles do
		task.spawn(callback, player, profile.Data)
	end
	return DataService.ProfileLoaded:Connect(callback)
end

-- Espera os dados carregarem (útil para outros serviços). Retorna nil se o jogador sair.
function DataService.WaitForData(player: Player, timeout: number?): PlayerData?
	local limit = timeout or 60
	local started = os.clock()
	while player.Parent == Players and os.clock() - started < limit do
		local data = DataService.GetData(player)
		if data then
			return data
		end
		task.wait(0.1)
	end
	return DataService.GetData(player)
end

function DataService.Init()
	local ok, result = pcall(function()
		return DataStoreService:GetDataStore(CONFIG.StoreName)
	end)
	if ok then
		store = result
	elseif RunService:IsStudio() then
		enterOfflineMode(tostring(result))
	else
		warn("[DataService] Não foi possível abrir o DataStore:", result)
		enterOfflineMode(tostring(result))
	end
end

function DataService.Start()
	Players.PlayerAdded:Connect(onPlayerAdded)
	Players.PlayerRemoving:Connect(onPlayerRemoving)
	-- Jogadores que entraram antes deste script rodar (comum no Play Solo do Studio).
	-- task.defer: deixa os outros serviços terminarem o Start antes de carregar.
	for _, player in Players:GetPlayers() do
		task.defer(onPlayerAdded, player)
	end

	-- Salvamento automático (também renova a trava da sessão).
	task.spawn(function()
		while true do
			task.wait(CONFIG.AutosaveInterval)
			for player, profile in profiles do
				task.spawn(saveProfile, player.UserId, profile, false)
				task.wait(0.5)
			end
		end
	end)

	game:BindToClose(function()
		if offlineMode then
			return
		end
		local running = 0
		for player, profile in profiles do
			running += 1
			profiles[player] = nil
			task.spawn(function()
				saveProfile(player.UserId, profile, true)
				running -= 1
			end)
		end
		local started = os.clock()
		while (running > 0 or next(pendingSaves) ~= nil) and os.clock() - started < CONFIG.ShutdownTimeout do
			task.wait(0.2)
		end
	end)
end

return DataService
