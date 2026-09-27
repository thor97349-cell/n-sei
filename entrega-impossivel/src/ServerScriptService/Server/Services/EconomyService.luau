--!strict
-- Única porta de entrada para mexer no dinheiro dos jogadores. Só roda no servidor e
-- nenhum RemoteEvent chama estas funções diretamente: o dinheiro só muda por causa de
-- regras validadas no servidor (ex.: DeliveryService ao concluir uma entrega).

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local GameConfig = require(ReplicatedStorage.Shared.Config.GameConfig)
local DataService = require(script.Parent.DataService)

local EconomyService = {}

local MAX_MONEY = GameConfig.Economy.MaxMoney

local function isValidAmount(amount: number): boolean
	return type(amount) == "number" and amount == amount and amount > 0 and amount < math.huge
end

-- Atualiza o que o cliente vê: atributo "Money" (HUD) e o placar (leaderstats).
local function publish(player: Player, money: number)
	player:SetAttribute("Money", money)
	local leaderstats = player:FindFirstChild("leaderstats")
	local value = leaderstats and leaderstats:FindFirstChild(GameConfig.Economy.LeaderstatName)
	if value and value:IsA("IntValue") then
		value.Value = money
	end
end

local function setupLeaderstats(player: Player, data: DataService.PlayerData)
	local leaderstats = player:FindFirstChild("leaderstats")
	if not leaderstats then
		local folder = Instance.new("Folder")
		folder.Name = "leaderstats"
		folder.Parent = player
		leaderstats = folder
	end
	assert(leaderstats, "leaderstats")
	if not leaderstats:FindFirstChild(GameConfig.Economy.LeaderstatName) then
		local value = Instance.new("IntValue")
		value.Name = GameConfig.Economy.LeaderstatName
		value.Parent = leaderstats
	end
	player:SetAttribute("DataPersistent", DataService.IsPersistent(player))
	publish(player, data.Money)
end

function EconomyService.GetMoney(player: Player): number
	local data = DataService.GetData(player)
	return if data then data.Money else 0
end

-- Dá dinheiro ao jogador. Retorna false se os dados não estão carregados ou o valor é inválido.
function EconomyService.AddMoney(player: Player, amount: number, reason: string): boolean
	if not isValidAmount(amount) then
		warn("[EconomyService] Valor inválido recusado:", amount, reason)
		return false
	end
	local data = DataService.GetData(player)
	if not data then
		return false
	end
	local rounded = math.floor(amount)
	data.Money = math.min(data.Money + rounded, MAX_MONEY)
	data.Stats.TotalEarned = math.min(data.Stats.TotalEarned + rounded, MAX_MONEY)
	publish(player, data.Money)
	return true
end

function EconomyService.CanAfford(player: Player, amount: number): boolean
	return isValidAmount(amount) and EconomyService.GetMoney(player) >= amount
end

-- Para a futura loja/garagem. Só desconta se houver saldo suficiente.
function EconomyService.SpendMoney(player: Player, amount: number, reason: string): boolean
	if not isValidAmount(amount) then
		warn("[EconomyService] Gasto inválido recusado:", amount, reason)
		return false
	end
	local data = DataService.GetData(player)
	if not data or data.Money < amount then
		return false
	end
	data.Money -= math.floor(amount)
	publish(player, data.Money)
	return true
end

function EconomyService.Init() end

function EconomyService.Start()
	DataService.ObserveProfiles(function(player: Player, data: DataService.PlayerData)
		if player.Parent == Players then
			setupLeaderstats(player, data)
		end
	end)
end

return EconomyService
