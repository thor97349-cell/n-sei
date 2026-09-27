--!strict
-- Regras puras das entregas: sorteio de ofertas, prazo, recompensa e pagamento final.
-- Não tem estado nem acessa jogadores, por isso é fácil de testar (tools/tests).

local GameConfig = require(script.Parent.Config.GameConfig)
local OrderConfig = require(script.Parent.Config.OrderConfig)
local MapLayout = require(script.Parent.Map.MapLayout)
local RoadNetwork = require(script.Parent.Map.RoadNetwork)

export type Offer = {
	Id: string,
	TypeId: string,
	PickupId: string,
	DropoffId: string,
	Reward: number,
	TimeLimit: number,
	RouteDistance: number,
}

export type Payout = {
	Base: number,
	Bonus: number,
	BonusLabel: string?,
	Total: number,
	Late: boolean,
}

-- Qualquer objeto com NextInteger/NextNumber (Random do Roblox ou um gerador de teste).
type Rng = any

local DeliveryRules = {}

local config = GameConfig.Delivery
local routeCache: { [string]: number } = {}

local dropoffIds: { string } = {}
for _, loc in MapLayout.Locations do
	if loc.Dropoff then
		table.insert(dropoffIds, loc.Id)
	end
end

function DeliveryRules.GetRouteDistance(pickupId: string, dropoffId: string): number
	local key = pickupId .. ">" .. dropoffId
	local cached = routeCache[key]
	if cached then
		return cached
	end
	local pickup = MapLayout.GetLocation(pickupId)
	local dropoff = MapLayout.GetLocation(dropoffId)
	assert(pickup and dropoff, "Local inválido na rota " .. key)
	local distance = RoadNetwork.RouteDistance(pickup.Position, dropoff.Position)
	routeCache[key] = distance
	return distance
end

function DeliveryRules.ComputeReward(orderType: OrderConfig.OrderType, routeDistance: number): number
	local raw = orderType.BaseReward + routeDistance * orderType.RewardPerStud
	return math.max(5, math.floor(raw / 5 + 0.5) * 5)
end

function DeliveryRules.ComputeTimeLimit(orderType: OrderConfig.OrderType, routeDistance: number): number
	local ideal = routeDistance / config.ReferenceSpeed
	local limit = ideal * orderType.TimeFactor + orderType.TimeBuffer
	return math.max(orderType.MinTime, math.floor(limit + 0.5))
end

local function pickWeighted(rng: Rng, typeIds: { string }): string
	local total = 0
	for _, id in typeIds do
		total += (OrderConfig.Types[id] :: OrderConfig.OrderType).Weight
	end
	local roll = rng:NextNumber() * total
	for _, id in typeIds do
		roll -= (OrderConfig.Types[id] :: OrderConfig.OrderType).Weight
		if roll <= 0 then
			return id
		end
	end
	return typeIds[#typeIds]
end

-- Cria uma oferta de um tipo específico. Retorna nil se não achar uma rota válida.
function DeliveryRules.CreateOffer(rng: Rng, typeId: string, offerId: string): Offer?
	local orderType = OrderConfig.Get(typeId)
	if not orderType then
		return nil
	end
	local destinations = orderType.Destinations or dropoffIds
	for _ = 1, 25 do
		local pickupId = orderType.Pickups[rng:NextInteger(1, #orderType.Pickups)]
		local dropoffId = destinations[rng:NextInteger(1, #destinations)]
		local dropoff = MapLayout.GetLocation(dropoffId)
		if pickupId ~= dropoffId and dropoff and dropoff.Dropoff then
			local distance = DeliveryRules.GetRouteDistance(pickupId, dropoffId)
			if distance >= config.MinRouteDistance then
				return {
					Id = offerId,
					TypeId = typeId,
					PickupId = pickupId,
					DropoffId = dropoffId,
					Reward = DeliveryRules.ComputeReward(orderType, distance),
					TimeLimit = DeliveryRules.ComputeTimeLimit(orderType, distance),
					RouteDistance = math.floor(distance + 0.5),
				}
			end
		end
	end
	return nil
end

-- Sorteia `count` ofertas, evitando repetir o mesmo tipo quando possível.
function DeliveryRules.GenerateOffers(rng: Rng, count: number, nextId: () -> string): { Offer }
	local offers: { Offer } = {}
	local available = table.clone(OrderConfig.TypeOrder)
	local attempts = 0
	while #offers < count and attempts < count * 10 do
		attempts += 1
		if #available == 0 then
			available = table.clone(OrderConfig.TypeOrder)
		end
		local typeId = pickWeighted(rng, available)
		local offer = DeliveryRules.CreateOffer(rng, typeId, nextId())
		if offer then
			table.insert(offers, offer)
		end
		local index = table.find(available, typeId)
		if index then
			table.remove(available, index)
		end
	end
	return offers
end

-- Menor tempo (s) aceitável para uma entrega — qualquer coisa abaixo disso é teleporte.
function DeliveryRules.MinimumPlausibleTime(pickupId: string, dropoffId: string, fastestSpeed: number): number
	local pickup = MapLayout.GetLocation(pickupId)
	local dropoff = MapLayout.GetLocation(dropoffId)
	if not pickup or not dropoff then
		return 0
	end
	local straight = (Vector3.new(dropoff.Position.X, 0, dropoff.Position.Z) - Vector3.new(
		pickup.Position.X,
		0,
		pickup.Position.Z
	)).Magnitude
	local usable = math.max(0, straight - config.PickupRadius - config.DropoffRadius)
	return usable / (fastestSpeed * config.MaxPlausibleSpeedMultiplier)
end

-- Quanto o jogador recebe ao entregar. `remaining` = segundos que sobravam no timer
-- (negativo se atrasou).
function DeliveryRules.ComputePayout(offer: Offer, remaining: number): Payout
	if remaining < 0 then
		local total = math.floor(offer.Reward * config.LateRewardMultiplier)
		return { Base = total, Bonus = 0, BonusLabel = nil, Total = total, Late = true }
	end
	local fraction = remaining / math.max(1, offer.TimeLimit)
	for _, tier in config.BonusTiers do
		if fraction >= tier.MinRemainingFraction then
			local bonus = math.floor(offer.Reward * tier.Multiplier)
			return {
				Base = offer.Reward,
				Bonus = bonus,
				BonusLabel = tier.Label,
				Total = offer.Reward + bonus,
				Late = false,
			}
		end
	end
	return { Base = offer.Reward, Bonus = 0, BonusLabel = nil, Total = offer.Reward, Late = false }
end

return DeliveryRules
