--!strict
-- Painel "NOVAS ENTREGAS": mostra as ofertas do servidor lado a lado para o jogador
-- escolher. Teclas 1, 2 e 3 aceitam direto; G abre/fecha.

local ContextActionService = game:GetService("ContextActionService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local OrderConfig = require(ReplicatedStorage.Shared.Config.OrderConfig)
local MapLayout = require(ReplicatedStorage.Shared.Map.MapLayout)
local Format = require(ReplicatedStorage.Shared.Util.Format)
local Signal = require(ReplicatedStorage.Shared.Util.Signal)
local Theme = require(script.Parent.Parent.UI.Theme)
local UIUtil = require(script.Parent.Parent.UI.UIUtil)
local DeliveryClient = require(script.Parent.DeliveryClient)
local SoundController = require(script.Parent.SoundController)

type Card = {
	Frame: Frame,
	PickupLabel: TextLabel,
	OfferId: string?,
	PickupPosition: Vector3?,
}

local OrderBoardController = {}

-- (aberto: boolean)
OrderBoardController.VisibilityChanged = Signal.new()

local player = Players.LocalPlayer
local panel: Frame
local panelScale: UIScale
local cardsHolder: Frame
local rerollButton: TextButton
local cards: { Card } = {}
local isOpen = false
local shownOffersKey = ""

local function offersKey(offers: { DeliveryClient.Offer }?): string
	local ids = {}
	local list: { DeliveryClient.Offer } = offers or {}
	for _, offer in list do
		table.insert(ids, offer.Id)
	end
	return table.concat(ids, ",")
end

local function infoLine(parent: Instance, name: string, text: string, order: number, color: Color3?): TextLabel
	local label = UIUtil.Label(parent, name, text, 15, Theme.Fonts.Medium, color or Theme.Colors.TextDim)
	label.LayoutOrder = order
	label.TextWrapped = true
	label.TextTruncate = Enum.TextTruncate.None
	label.Size = UDim2.new(1, 0, 0, 38)
	label.TextYAlignment = Enum.TextYAlignment.Top
	return label
end

local function buildCard(offer: DeliveryClient.Offer, index: number): Card
	local orderType = OrderConfig.Get(offer.TypeId)
	local pickup = MapLayout.GetLocation(offer.PickupId)
	local dropoff = MapLayout.GetLocation(offer.DropoffId)
	local tagColor = if orderType then orderType.TagColor else Theme.Colors.Info

	local frame = Instance.new("Frame")
	frame.Name = "Offer" .. index
	frame.LayoutOrder = index
	frame.Size = UDim2.fromOffset(236, 318)
	frame.BackgroundColor3 = Theme.Colors.PanelLight
	frame.BorderSizePixel = 0
	frame.Parent = cardsHolder
	UIUtil.Corner(frame, 14)
	UIUtil.Stroke(frame, tagColor, 2, 0.35)

	local tag = Instance.new("TextLabel")
	tag.Name = "Tag"
	tag.Size = UDim2.new(1, 0, 0, 28)
	tag.BackgroundColor3 = tagColor
	tag.BorderSizePixel = 0
	tag.Text = if orderType then orderType.Tag else ""
	tag.TextSize = 15
	tag.FontFace = Theme.Fonts.Title
	tag.TextColor3 = Theme.Colors.TextDark
	tag.Parent = frame
	UIUtil.Corner(tag, 14)

	local body = Instance.new("Frame")
	body.Name = "Body"
	body.BackgroundTransparency = 1
	body.Position = UDim2.fromOffset(12, 34)
	body.Size = UDim2.new(1, -24, 1, -90)
	body.Parent = frame
	UIUtil.List(body, Enum.FillDirection.Vertical, 2)

	local title = UIUtil.Label(
		body,
		"Title",
		string.format(
			"%s %s",
			if orderType then orderType.Icon else "📦",
			if orderType then orderType.DisplayName else offer.TypeId
		),
		24,
		Theme.Fonts.Title
	)
	title.LayoutOrder = 1
	title.Size = UDim2.new(1, 0, 0, 34)

	local pickupLabel = infoLine(body, "Pickup", "", 2)
	infoLine(
		body,
		"Dropoff",
		string.format("🏁 Destino: %s", if dropoff then dropoff.Name else "?"),
		3,
		Theme.Colors.Text
	)
	local stats = UIUtil.Label(
		body,
		"Stats",
		string.format("⏱️ %s     🛣️ %s", Format.Time(offer.TimeLimit), Format.Distance(offer.RouteDistance)),
		17,
		Theme.Fonts.Bold
	)
	stats.LayoutOrder = 4
	local reward =
		UIUtil.Label(body, "Reward", "💰 " .. Format.Money(offer.Reward), 30, Theme.Fonts.Title, Theme.Colors.Success)
	reward.LayoutOrder = 5
	reward.Size = UDim2.new(1, 0, 0, 40)

	local accept = UIUtil.Button(
		frame,
		"Accept",
		string.format("ACEITAR  [%d]", index),
		UDim2.new(1, -24, 0, 44),
		Theme.Colors.Brand
	)
	accept.AnchorPoint = Vector2.new(0.5, 1)
	accept.Position = UDim2.new(0.5, 0, 1, -12)
	accept.TextSize = 20
	accept.Activated:Connect(function()
		SoundController.Play("Accept")
		DeliveryClient.Accept(offer.Id)
	end)

	return {
		Frame = frame,
		PickupLabel = pickupLabel,
		OfferId = offer.Id,
		PickupPosition = if pickup then pickup.Position else nil,
	}
end

local function rebuildCards(offers: { DeliveryClient.Offer }?)
	for _, card in cards do
		card.Frame:Destroy()
	end
	table.clear(cards)
	local list: { DeliveryClient.Offer } = offers or {}
	for index, offer in list do
		table.insert(cards, buildCard(offer, index))
	end
	shownOffersKey = offersKey(offers)
end

-- Distância do jogador até cada coleta (atualiza enquanto o painel está aberto).
local function refreshDistances()
	local character = player.Character
	local root = character and character:FindFirstChild("HumanoidRootPart")
	local state = DeliveryClient.GetState()
	for index, card in cards do
		local offer = state.Offers and state.Offers[index]
		local pickup = offer and MapLayout.GetLocation(offer.PickupId)
		if pickup then
			local distanceText = ""
			if root and root:IsA("BasePart") and card.PickupPosition then
				local delta = card.PickupPosition - root.Position
				distanceText = " • " .. Format.Distance(Vector3.new(delta.X, 0, delta.Z).Magnitude) .. " daqui"
			end
			card.PickupLabel.Text = string.format("📍 Coleta: %s%s", pickup.Name, distanceText)
		end
	end
	local rerollAt = state.RerollAvailableAt or 0
	local wait = math.ceil(rerollAt - DeliveryClient.Now())
	if wait > 0 then
		rerollButton.Text = string.format("🔄 Outras ofertas (%ds)", wait)
		rerollButton.BackgroundColor3 = Theme.Colors.PanelLight
	else
		rerollButton.Text = "🔄 Outras ofertas"
		rerollButton.BackgroundColor3 = Theme.Colors.Info
	end
end

function OrderBoardController.IsOpen(): boolean
	return isOpen
end

function OrderBoardController.CanOpen(): boolean
	return DeliveryClient.GetState().Status == "Idle"
end

function OrderBoardController.Open()
	if isOpen or not OrderBoardController.CanOpen() then
		return
	end
	local state = DeliveryClient.GetState()
	if offersKey(state.Offers) ~= shownOffersKey then
		rebuildCards(state.Offers)
	end
	isOpen = true
	panel.Visible = true
	UIUtil.Pop(panelScale, 0.85)
	refreshDistances()
	OrderBoardController.VisibilityChanged:Fire(true)
end

function OrderBoardController.Close()
	if not isOpen then
		return
	end
	isOpen = false
	panel.Visible = false
	OrderBoardController.VisibilityChanged:Fire(false)
end

function OrderBoardController.Toggle()
	if isOpen then
		OrderBoardController.Close()
	else
		OrderBoardController.Open()
	end
end

local function acceptIndex(index: number)
	local card = cards[index]
	if isOpen and card and card.OfferId then
		SoundController.Play("Accept")
		DeliveryClient.Accept(card.OfferId)
	end
end

function OrderBoardController.Init()
	local rootGui = UIUtil.GetRoot()
	panel = UIUtil.Panel(
		rootGui,
		"OrderBoard",
		UDim2.fromOffset(780, 440),
		UDim2.new(0.5, 0, 0.55, 0),
		Vector2.new(0.5, 0.5)
	)
	panel.Visible = false
	panel.ZIndex = 5
	panelScale = Instance.new("UIScale")
	panelScale.Parent = panel

	local title = UIUtil.Label(panel, "Title", "📦 NOVAS ENTREGAS", 30, Theme.Fonts.Title, Theme.Colors.Brand)
	title.Position = UDim2.fromOffset(22, 14)
	title.Size = UDim2.new(1, -80, 0, 36)
	local subtitle = UIUtil.Label(
		panel,
		"Subtitle",
		"Escolha um pedido. O tempo só começa a contar quando você coletar a encomenda.",
		15,
		Theme.Fonts.Medium,
		Theme.Colors.TextDim
	)
	subtitle.Position = UDim2.fromOffset(22, 50)
	subtitle.Size = UDim2.new(1, -44, 0, 20)

	local close =
		UIUtil.Button(panel, "Close", "✕", UDim2.fromOffset(40, 40), Theme.Colors.PanelLight, Theme.Colors.Text)
	close.AnchorPoint = Vector2.new(1, 0)
	close.Position = UDim2.new(1, -14, 0, 14)
	close.Activated:Connect(OrderBoardController.Close)

	cardsHolder = Instance.new("Frame")
	cardsHolder.Name = "Cards"
	cardsHolder.BackgroundTransparency = 1
	cardsHolder.Position = UDim2.fromOffset(22, 80)
	cardsHolder.Size = UDim2.new(1, -44, 0, 318)
	cardsHolder.Parent = panel
	local layout = UIUtil.List(cardsHolder, Enum.FillDirection.Horizontal, 14)
	layout.HorizontalAlignment = Enum.HorizontalAlignment.Center

	rerollButton = UIUtil.Button(
		panel,
		"Reroll",
		"🔄 Outras ofertas",
		UDim2.fromOffset(240, 32),
		Theme.Colors.Info,
		Theme.Colors.Text
	)
	rerollButton.AnchorPoint = Vector2.new(0, 1)
	rerollButton.Position = UDim2.new(0, 22, 1, -10)
	rerollButton.TextSize = 16
	rerollButton.Activated:Connect(function()
		SoundController.Play("Click")
		DeliveryClient.Reroll()
	end)

	local hint = UIUtil.Label(
		panel,
		"Hint",
		"Teclas 1, 2, 3 aceitam • G abre/fecha",
		14,
		Theme.Fonts.Medium,
		Theme.Colors.TextDim
	)
	hint.AnchorPoint = Vector2.new(1, 1)
	hint.Position = UDim2.new(1, -22, 1, -14)
	hint.Size = UDim2.fromOffset(320, 20)
	hint.TextXAlignment = Enum.TextXAlignment.Right
end

function OrderBoardController.Start()
	DeliveryClient.Changed:Connect(function(state: DeliveryClient.Snapshot, previous: DeliveryClient.Snapshot)
		if state.Status ~= "Idle" then
			OrderBoardController.Close()
			return
		end
		if isOpen and offersKey(state.Offers) ~= shownOffersKey then
			rebuildCards(state.Offers)
			refreshDistances()
		end
		-- Abre sozinho ao entrar no jogo e depois de cada entrega.
		if previous.Status == "Loading" or previous.Status == "Result" then
			task.delay(if previous.Status == "Result" then 0.3 else 1.5, function()
				if DeliveryClient.GetState().Status == "Idle" then
					OrderBoardController.Open()
				end
			end)
		end
	end)

	local elapsed = 0
	RunService.Heartbeat:Connect(function(dt: number)
		elapsed += dt
		if isOpen and elapsed >= 0.25 then
			elapsed = 0
			refreshDistances()
		end
	end)

	ContextActionService:BindAction(
		"EntregaToggleBoard",
		function(_name: string, inputState: Enum.UserInputState): Enum.ContextActionResult
			if inputState == Enum.UserInputState.Begin then
				OrderBoardController.Toggle()
			end
			return Enum.ContextActionResult.Pass
		end,
		false,
		Enum.KeyCode.G,
		Enum.KeyCode.ButtonY
	)

	local keys = {
		{ Enum.KeyCode.One, Enum.KeyCode.KeypadOne, Enum.KeyCode.DPadLeft },
		{ Enum.KeyCode.Two, Enum.KeyCode.KeypadTwo, Enum.KeyCode.DPadUp },
		{ Enum.KeyCode.Three, Enum.KeyCode.KeypadThree, Enum.KeyCode.DPadRight },
	}
	for index, keyCodes in keys do
		ContextActionService:BindAction(
			"EntregaAccept" .. index,
			function(_name: string, inputState: Enum.UserInputState): Enum.ContextActionResult
				if inputState == Enum.UserInputState.Begin and isOpen then
					acceptIndex(index)
					return Enum.ContextActionResult.Sink
				end
				return Enum.ContextActionResult.Pass
			end,
			false,
			table.unpack(keyCodes)
		)
	end
end

return OrderBoardController
