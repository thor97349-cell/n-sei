--!strict
-- Guarda o último estado de entrega enviado pelo servidor e avisa quem precisar.
-- O cliente nunca decide nada: só mostra o estado e envia pedidos (aceitar/cancelar).

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local DeliveryRules = require(ReplicatedStorage.Shared.DeliveryRules)
local MapLayout = require(ReplicatedStorage.Shared.Map.MapLayout)
local Remotes = require(ReplicatedStorage.Shared.Util.Remotes)
local Signal = require(ReplicatedStorage.Shared.Util.Signal)

export type Offer = DeliveryRules.Offer

export type OrderInfo = {
	Offer: Offer,
	PickedUpAt: number?,
	Deadline: number?,
	GraceEndsAt: number?,
}

export type ResultInfo = {
	Success: boolean,
	Late: boolean,
	Reward: number,
	Bonus: number,
	BonusLabel: string?,
	Total: number,
	TypeId: string,
	DropoffId: string,
}

export type Snapshot = {
	Status: string,
	Offers: { Offer }?,
	Order: OrderInfo?,
	Result: ResultInfo?,
	ResultUntil: number?,
	AcceptAvailableAt: number?,
	RerollAvailableAt: number?,
	ServerTime: number,
	DataPersistent: boolean?,
}

local DeliveryClient = {}

-- Disparado a cada novo estado: (novo, anterior)
DeliveryClient.Changed = Signal.new()

local state: Snapshot = { Status = "Loading", ServerTime = 0 }

local remotes: { [string]: RemoteEvent } = {}

function DeliveryClient.Now(): number
	return Workspace:GetServerTimeNow()
end

function DeliveryClient.GetState(): Snapshot
	return state
end

function DeliveryClient.Accept(offerId: string)
	remotes.AcceptOrder:FireServer(offerId)
end

function DeliveryClient.Cancel()
	remotes.CancelOrder:FireServer()
end

function DeliveryClient.Reroll()
	remotes.RerollOffers:FireServer()
end

-- Local para onde o jogador precisa ir agora, e se é "pickup" ou "dropoff".
function DeliveryClient.GetTarget(): (MapLayout.Location?, string?)
	local order = state.Order
	if not order then
		return nil, nil
	end
	if state.Status == "ToPickup" then
		return MapLayout.GetLocation(order.Offer.PickupId), "pickup"
	elseif state.Status == "ToDropoff" then
		return MapLayout.GetLocation(order.Offer.DropoffId), "dropoff"
	end
	return nil, nil
end

-- Segundos restantes no timer (negativo = atrasado). nil se o timer não começou.
function DeliveryClient.GetRemaining(): number?
	local order = state.Order
	if state.Status ~= "ToDropoff" or not order or not order.Deadline then
		return nil
	end
	return order.Deadline - DeliveryClient.Now()
end

function DeliveryClient.IsLate(): boolean
	local remaining = DeliveryClient.GetRemaining()
	return remaining ~= nil and remaining < 0
end

function DeliveryClient.Init()
	for _, name in { "AcceptOrder", "CancelOrder", "RerollOffers", "RequestSync", "DeliveryState" } do
		remotes[name] = Remotes.Get(name)
	end
end

function DeliveryClient.Start()
	remotes.DeliveryState.OnClientEvent:Connect(function(snapshot: Snapshot)
		if type(snapshot) ~= "table" or type(snapshot.Status) ~= "string" then
			return
		end
		local previous = state
		state = snapshot
		DeliveryClient.Changed:Fire(state, previous)
	end)

	-- Pede o estado até recebê-lo (o servidor pode ter enviado antes deste script carregar).
	task.spawn(function()
		while state.Status == "Loading" do
			remotes.RequestSync:FireServer()
			task.wait(2)
		end
	end)
end

return DeliveryClient
