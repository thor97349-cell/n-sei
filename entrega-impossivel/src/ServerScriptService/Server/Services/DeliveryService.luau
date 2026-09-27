--!strict
-- Loop principal: OFERTAS → ACEITAR → COLETA → ENTREGA → PAGAMENTO → novas ofertas.
--
-- Tudo é decidido no servidor. O cliente só pode:
--   • aceitar uma oferta que o próprio servidor mostrou para ele;
--   • cancelar a entrega atual;
--   • pedir novas ofertas (com cooldown).
-- A coleta e a entrega acontecem quando o SERVIDOR vê o personagem do jogador dentro do
-- raio do local certo. Cada jogador tem seu próprio estado, então ninguém completa o
-- pedido de outra pessoa. O pagamento acontece uma única vez porque o estado muda para
-- "Result" antes de o dinheiro ser creditado.

local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local GameConfig = require(ReplicatedStorage.Shared.Config.GameConfig)
local OrderConfig = require(ReplicatedStorage.Shared.Config.OrderConfig)
local VehicleConfig = require(ReplicatedStorage.Shared.Config.VehicleConfig)
local MapLayout = require(ReplicatedStorage.Shared.Map.MapLayout)
local DeliveryRules = require(ReplicatedStorage.Shared.DeliveryRules)
local Remotes = require(ReplicatedStorage.Shared.Util.Remotes)
local RateLimiter = require(ReplicatedStorage.Shared.Util.RateLimiter)

local DataService = require(script.Parent.DataService)
local EconomyService = require(script.Parent.EconomyService)
local NotificationService = require(script.Parent.NotificationService)

type Offer = DeliveryRules.Offer

-- "Idle" = procurando entrega | "ToPickup" = indo coletar | "ToDropoff" = levando |
-- "Result" = mostrando o resultado por alguns segundos
type Status = string

type ActiveOrder = {
	Offer: Offer,
	AcceptedAt: number,
	PickedUpAt: number?,
	Deadline: number?,
	GraceEndsAt: number?,
	MinimumTime: number,
	LateNotified: boolean,
}

type ResultInfo = {
	Success: boolean,
	Late: boolean,
	Reward: number,
	Bonus: number,
	BonusLabel: string?,
	Total: number,
	TypeId: string,
	DropoffId: string,
}

type PlayerState = {
	Status: Status,
	Offers: { Offer },
	Order: ActiveOrder?,
	Result: ResultInfo?,
	ResultUntil: number,
	AcceptAvailableAt: number,
	RerollAvailableAt: number,
}

local DeliveryService = {}

local CONFIG = GameConfig.Delivery
local VERTICAL_TOLERANCE = 15

local states: { [Player]: PlayerState } = {}
local rng = Random.new()
local stateRemote: RemoteEvent
local acceptLimiter = RateLimiter.new(0.3)
local cancelLimiter = RateLimiter.new(1)
local syncLimiter = RateLimiter.new(0.5)
local rerollLimiter = RateLimiter.new(0.5)
local fastestSpeed = VehicleConfig.GetFastestSpeed()

local function now(): number
	return Workspace:GetServerTimeNow()
end

local function newId(): string
	return HttpService:GenerateGUID(false)
end

local function generateOffers(): { Offer }
	return DeliveryRules.GenerateOffers(rng, CONFIG.OffersPerBoard, newId)
end

-- Estado completo enviado ao cliente (ele não guarda nada que importe para as regras).
local function snapshot(player: Player, state: PlayerState?): { [string]: any }
	if not state then
		return { Status = "Loading", ServerTime = now() }
	end
	local order = state.Order
	return {
		Status = state.Status,
		Offers = if state.Status == "Idle" then state.Offers else {},
		Order = if order
			then {
				Offer = order.Offer,
				PickedUpAt = order.PickedUpAt,
				Deadline = order.Deadline,
				GraceEndsAt = order.GraceEndsAt,
			}
			else nil,
		Result = state.Result,
		ResultUntil = state.ResultUntil,
		AcceptAvailableAt = state.AcceptAvailableAt,
		RerollAvailableAt = state.RerollAvailableAt,
		ServerTime = now(),
		DataPersistent = DataService.IsPersistent(player),
	}
end

local function push(player: Player)
	if player.Parent == Players then
		stateRemote:FireClient(player, snapshot(player, states[player]))
	end
end

local function setIdle(player: Player, state: PlayerState)
	state.Status = "Idle"
	state.Order = nil
	state.Result = nil
	state.Offers = generateOffers()
	push(player)
end

local function getRoot(player: Player): BasePart?
	local character = player.Character
	if not character then
		return nil
	end
	local humanoid = character:FindFirstChildOfClass("Humanoid")
	local root = character:FindFirstChild("HumanoidRootPart")
	if humanoid and humanoid.Health > 0 and root and root:IsA("BasePart") then
		return root
	end
	return nil
end

local function isInside(root: BasePart, location: MapLayout.Location, radius: number): boolean
	local position = root.Position
	local target = location.Position
	local flat = Vector2.new(position.X - target.X, position.Z - target.Z).Magnitude
	return flat <= radius and math.abs(position.Y - target.Y) <= VERTICAL_TOLERANCE
end

local function incrementStat(player: Player, key: string)
	local data = DataService.GetData(player)
	if data then
		local stats = data.Stats :: any
		stats[key] = (stats[key] or 0) + 1
	end
end

--------------------------------------------------------------------------------
-- Transições de estado
--------------------------------------------------------------------------------

local function pickUp(player: Player, state: PlayerState, order: ActiveOrder, time: number)
	order.PickedUpAt = time
	order.Deadline = time + order.Offer.TimeLimit
	order.GraceEndsAt = time + order.Offer.TimeLimit + CONFIG.LateGracePeriod
	order.MinimumTime = DeliveryRules.MinimumPlausibleTime(order.Offer.PickupId, order.Offer.DropoffId, fastestSpeed)
	state.Status = "ToDropoff"
	push(player)
end

local function finish(state: PlayerState, result: ResultInfo, time: number)
	-- A mudança de estado vem ANTES do pagamento: nunca paga duas vezes.
	state.Order = nil
	state.Status = "Result"
	state.Result = result
	state.ResultUntil = time + CONFIG.ResultDuration
end

local function complete(player: Player, state: PlayerState, order: ActiveOrder, time: number)
	local deadline = order.Deadline :: number
	local payout = DeliveryRules.ComputePayout(order.Offer, deadline - time)
	finish(state, {
		Success = true,
		Late = payout.Late,
		Reward = payout.Base,
		Bonus = payout.Bonus,
		BonusLabel = payout.BonusLabel,
		Total = payout.Total,
		TypeId = order.Offer.TypeId,
		DropoffId = order.Offer.DropoffId,
	}, time)

	if payout.Total > 0 and not EconomyService.AddMoney(player, payout.Total, "delivery") then
		warn("[DeliveryService] Não foi possível pagar", player.Name, payout.Total)
	end
	incrementStat(player, "DeliveriesCompleted")
	if payout.Late then
		incrementStat(player, "DeliveriesLate")
	elseif payout.Bonus > 0 then
		incrementStat(player, "FastDeliveries")
	end
	push(player)
end

local function fail(player: Player, state: PlayerState, order: ActiveOrder, time: number)
	finish(state, {
		Success = false,
		Late = true,
		Reward = 0,
		Bonus = 0,
		BonusLabel = nil,
		Total = 0,
		TypeId = order.Offer.TypeId,
		DropoffId = order.Offer.DropoffId,
	}, time)
	incrementStat(player, "DeliveriesFailed")
	push(player)
end

-- Verifica todos os jogadores algumas vezes por segundo.
local function monitor()
	local time = now()
	for player, state in states do
		local order = state.Order
		if state.Status == "ToPickup" and order then
			local root = getRoot(player)
			local pickup = MapLayout.GetLocation(order.Offer.PickupId)
			if root and pickup and isInside(root, pickup, CONFIG.PickupRadius) then
				pickUp(player, state, order, time)
			end
		elseif state.Status == "ToDropoff" and order then
			local root = getRoot(player)
			local dropoff = MapLayout.GetLocation(order.Offer.DropoffId)
			local deadline = order.Deadline :: number
			local graceEnds = order.GraceEndsAt :: number
			local pickedUpAt = order.PickedUpAt :: number
			local arrived = root ~= nil and dropoff ~= nil and isInside(root, dropoff, CONFIG.DropoffRadius)
			if arrived and time > graceEnds then
				fail(player, state, order, time)
			elseif arrived and time - pickedUpAt >= order.MinimumTime then
				complete(player, state, order, time)
			elseif arrived then
				-- Rápido demais para ser verdade (teleporte): ignora até o tempo mínimo.
				continue
			elseif time > graceEnds then
				fail(player, state, order, time)
			elseif not order.LateNotified and time > deadline then
				order.LateNotified = true
				push(player)
			end
		elseif state.Status == "Result" and time >= state.ResultUntil then
			setIdle(player, state)
		end
	end
end

--------------------------------------------------------------------------------
-- Pedidos vindos do cliente (sempre validados)
--------------------------------------------------------------------------------

local function onAccept(player: Player, offerId: unknown)
	if type(offerId) ~= "string" or #offerId > 64 or not acceptLimiter:Check(player) then
		return
	end
	local state = states[player]
	if not state or state.Status ~= "Idle" then
		return
	end
	if now() < state.AcceptAvailableAt then
		NotificationService.Send(player, "⏳ Aguarde um instante para aceitar outra entrega.", "warning", 2)
		return
	end
	local chosen: Offer? = nil
	for _, offer in state.Offers do
		if offer.Id == offerId then
			chosen = offer
			break
		end
	end
	if not chosen then
		push(player) -- oferta velha: manda a lista atual
		return
	end
	state.Order = {
		Offer = chosen,
		AcceptedAt = now(),
		PickedUpAt = nil,
		Deadline = nil,
		GraceEndsAt = nil,
		MinimumTime = 0,
		LateNotified = false,
	}
	state.Offers = {}
	state.Status = "ToPickup"
	push(player)
end

local function onCancel(player: Player)
	if not cancelLimiter:Check(player) then
		return
	end
	local state = states[player]
	if not state or (state.Status ~= "ToPickup" and state.Status ~= "ToDropoff") then
		return
	end
	state.AcceptAvailableAt = now() + CONFIG.CancelCooldown
	NotificationService.Send(player, "Entrega cancelada. Escolha outra quando quiser!", "info", 3)
	setIdle(player, state)
end

local function onReroll(player: Player)
	if not rerollLimiter:Check(player) then
		return
	end
	local state = states[player]
	if not state or state.Status ~= "Idle" then
		return
	end
	local time = now()
	if time < state.RerollAvailableAt then
		push(player)
		return
	end
	state.RerollAvailableAt = time + CONFIG.RerollCooldown
	state.Offers = generateOffers()
	push(player)
end

local function onSync(player: Player)
	if syncLimiter:Check(player) then
		push(player)
	end
end

--------------------------------------------------------------------------------
-- API pública
--------------------------------------------------------------------------------

-- Uma rodada de verificação (o servidor chama sozinho a cada MonitorInterval; os testes
-- automatizados chamam direto).
function DeliveryService.Tick()
	monitor()
end

function DeliveryService.GetStatus(player: Player): string?
	local state = states[player]
	return state and state.Status
end

function DeliveryService.Init()
	stateRemote = Remotes.Get("DeliveryState")
	-- Confere a configuração cedo, para erros aparecerem ao ligar o servidor.
	for _, typeId in OrderConfig.TypeOrder do
		assert(OrderConfig.Types[typeId], "Tipo de pedido ausente: " .. typeId)
	end
end

function DeliveryService.Start()
	Remotes.Get("AcceptOrder").OnServerEvent:Connect(onAccept)
	Remotes.Get("CancelOrder").OnServerEvent:Connect(onCancel)
	Remotes.Get("RerollOffers").OnServerEvent:Connect(onReroll)
	Remotes.Get("RequestSync").OnServerEvent:Connect(onSync)

	DataService.ObserveProfiles(function(player: Player)
		if player.Parent ~= Players or states[player] then
			return
		end
		local state: PlayerState = {
			Status = "Idle",
			Offers = {},
			Order = nil,
			Result = nil,
			ResultUntil = 0,
			AcceptAvailableAt = 0,
			RerollAvailableAt = 0,
		}
		states[player] = state
		setIdle(player, state)
	end)

	Players.PlayerRemoving:Connect(function(player: Player)
		states[player] = nil
	end)

	task.spawn(function()
		while true do
			task.wait(CONFIG.MonitorInterval)
			local ok, err = pcall(DeliveryService.Tick :: any)
			if not ok then
				warn("[DeliveryService] Erro no monitor:", err)
			end
		end
	end)
end

return DeliveryService
