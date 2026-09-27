--!strict
-- Interface principal (sem ocupar a tela toda):
--   • esquerda: 💰 dinheiro e o cartão da entrega atual (item, destino, ⏱️ tempo, 🛣️ distância)
--   • topo: status ("📦 PROCURAR ENTREGA" / "📦 ENTREGA ATIVA" / "✅ ..." / "❌ ...")
--   • centro: resultado da entrega com o bônus
--   • direita: botões do veículo; embaixo: velocímetro quando está dirigindo

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")

local GameConfig = require(ReplicatedStorage.Shared.Config.GameConfig)
local OrderConfig = require(ReplicatedStorage.Shared.Config.OrderConfig)
local MapLayout = require(ReplicatedStorage.Shared.Map.MapLayout)
local DeliveryRules = require(ReplicatedStorage.Shared.DeliveryRules)
local Format = require(ReplicatedStorage.Shared.Util.Format)
local Theme = require(script.Parent.Parent.UI.Theme)
local UIUtil = require(script.Parent.Parent.UI.UIUtil)
local DeliveryClient = require(script.Parent.DeliveryClient)
local OrderBoardController = require(script.Parent.OrderBoardController)
local VehicleController = require(script.Parent.VehicleController)
local SoundController = require(script.Parent.SoundController)

local HUDController = {}

local player = Players.LocalPlayer

-- Elementos
local moneyLabel: TextLabel
local moneyPill: Frame
local moneyScale: UIScale
local statusButton: TextButton
local statusScale: UIScale
local orderCard: Frame
local orderHeader: TextLabel
local orderItem: TextLabel
local orderTarget: TextLabel
local orderTimer: TextLabel
local orderTimerScale: UIScale
local orderTimerHint: TextLabel
local orderDistance: TextLabel
local orderReward: TextLabel
local resultCard: Frame
local resultScale: UIScale
local resultTitle: TextLabel
local resultAmount: TextLabel
local resultDetail: TextLabel
local speedPanel: Frame
local speedLabel: TextLabel
local controlsHint: TextLabel
local dataWarning: TextLabel

local displayedMoney = 0
local moneyAnimation = 0
local lastTickSecond = -1

--------------------------------------------------------------------------------
-- Construção
--------------------------------------------------------------------------------

local function buildMoney(rootGui: ScreenGui)
	local touch = UIUtil.IsTouchLayout()
	local column = Instance.new("Frame")
	column.Name = "LeftColumn"
	column.BackgroundTransparency = 1
	column.Size = UDim2.fromOffset(320, 370)
	-- PC: canto inferior esquerdo (o chat fica em cima). Celular: topo (o analógico fica embaixo).
	column.AnchorPoint = if touch then Vector2.new(0, 0) else Vector2.new(0, 1)
	column.Position = if touch then UDim2.new(0, 16, 0, 8) else UDim2.new(0, 16, 1, -36)
	column.Parent = rootGui
	local columnLayout = UIUtil.List(column, Enum.FillDirection.Vertical, 10)
	columnLayout.VerticalAlignment = if touch then Enum.VerticalAlignment.Top else Enum.VerticalAlignment.Bottom

	moneyPill = UIUtil.Panel(column, "Money", UDim2.fromOffset(230, 54), UDim2.new(), nil)
	moneyPill.LayoutOrder = 1
	UIUtil.Corner(moneyPill, 27)
	moneyScale = Instance.new("UIScale")
	moneyScale.Parent = moneyPill
	moneyLabel =
		UIUtil.Label(moneyPill, "Amount", "💰 " .. Format.Money(0), 28, Theme.Fonts.Title, Theme.Colors.Brand)
	moneyLabel.Position = UDim2.fromOffset(18, 0)
	moneyLabel.Size = UDim2.new(1, -24, 1, 0)

	orderCard = UIUtil.Panel(column, "OrderCard", UDim2.fromOffset(320, 300), UDim2.new(), nil)
	orderCard.LayoutOrder = 2
	orderCard.Visible = false
	UIUtil.Padding(orderCard, 14)
	UIUtil.List(orderCard, Enum.FillDirection.Vertical, 4)

	orderHeader = UIUtil.Label(orderCard, "Header", "📦 ENTREGA ATIVA", 15, Theme.Fonts.Title, Theme.Colors.Success)
	orderHeader.LayoutOrder = 1
	orderItem = UIUtil.Label(orderCard, "Item", "", 24, Theme.Fonts.Title)
	orderItem.LayoutOrder = 2
	orderTarget = UIUtil.Label(orderCard, "Target", "", 16, Theme.Fonts.Bold)
	orderTarget.LayoutOrder = 3
	orderTarget.TextWrapped = true
	orderTarget.TextTruncate = Enum.TextTruncate.None
	orderTarget.Size = UDim2.new(1, 0, 0, 40)
	orderTarget.TextYAlignment = Enum.TextYAlignment.Top

	orderTimer = UIUtil.Label(orderCard, "Timer", "⏱️ 00:00", 40, Theme.Fonts.Title)
	orderTimer.LayoutOrder = 4
	orderTimerScale = Instance.new("UIScale")
	orderTimerScale.Parent = orderTimer
	orderTimerHint = UIUtil.Label(orderCard, "TimerHint", "", 13, Theme.Fonts.Medium, Theme.Colors.TextDim)
	orderTimerHint.LayoutOrder = 5
	orderDistance = UIUtil.Label(orderCard, "Distance", "🛣️ 0 m", 18, Theme.Fonts.Bold)
	orderDistance.LayoutOrder = 6
	orderReward = UIUtil.Label(orderCard, "Reward", "💰 $ 0", 18, Theme.Fonts.Bold, Theme.Colors.Success)
	orderReward.LayoutOrder = 7

	local cancel = UIUtil.Button(
		orderCard,
		"Cancel",
		"✖ Cancelar entrega",
		UDim2.fromOffset(170, 28),
		Theme.Colors.PanelLight,
		Theme.Colors.TextDim
	)
	cancel.LayoutOrder = 8
	cancel.TextSize = 14
	cancel.Activated:Connect(function()
		SoundController.Play("Click")
		DeliveryClient.Cancel()
	end)
end

local function buildStatus(rootGui: ScreenGui)
	statusButton = UIUtil.Button(
		rootGui,
		"Status",
		"⏳ Carregando...",
		UDim2.fromOffset(380, 52),
		Theme.Colors.Panel,
		Theme.Colors.Text
	)
	statusButton.AnchorPoint = Vector2.new(0.5, 0)
	statusButton.Position = UDim2.new(0.5, 0, 0, 12)
	statusButton.TextSize = 24
	UIUtil.Corner(statusButton, 26)
	UIUtil.Stroke(statusButton, Theme.Colors.Stroke, 2, 0.7)
	-- O botão já tem um UIScale (efeito de clique); reaproveita para as animações.
	statusScale = statusButton:FindFirstChildOfClass("UIScale") or Instance.new("UIScale")
	statusScale.Parent = statusButton
	statusButton.Activated:Connect(function()
		if OrderBoardController.CanOpen() then
			SoundController.Play("Click")
			OrderBoardController.Toggle()
		end
	end)
end

local function buildResult(rootGui: ScreenGui)
	resultCard =
		UIUtil.Panel(rootGui, "Result", UDim2.fromOffset(460, 190), UDim2.new(0.5, 0, 0.3, 0), Vector2.new(0.5, 0.5))
	resultCard.Visible = false
	resultCard.ZIndex = 4
	resultScale = Instance.new("UIScale")
	resultScale.Parent = resultCard
	UIUtil.Padding(resultCard, 16)
	local layout = UIUtil.List(resultCard, Enum.FillDirection.Vertical, 6)
	layout.HorizontalAlignment = Enum.HorizontalAlignment.Center

	resultTitle = UIUtil.Label(resultCard, "Title", "", 32, Theme.Fonts.Title, Theme.Colors.Success)
	resultTitle.LayoutOrder = 1
	resultTitle.TextXAlignment = Enum.TextXAlignment.Center
	resultAmount = UIUtil.Label(resultCard, "Amount", "", 46, Theme.Fonts.Title, Theme.Colors.Brand)
	resultAmount.LayoutOrder = 2
	resultAmount.TextXAlignment = Enum.TextXAlignment.Center
	resultDetail = UIUtil.Label(resultCard, "Detail", "", 17, Theme.Fonts.Bold, Theme.Colors.TextDim)
	resultDetail.LayoutOrder = 3
	resultDetail.TextXAlignment = Enum.TextXAlignment.Center
	resultDetail.TextWrapped = true
	resultDetail.TextTruncate = Enum.TextTruncate.None
	resultDetail.Size = UDim2.new(1, 0, 0, 44)
end

local function buildVehicleUI(rootGui: ScreenGui)
	local touch = UIUtil.IsTouchLayout()
	local column = Instance.new("Frame")
	column.Name = "RightButtons"
	column.BackgroundTransparency = 1
	column.Size = UDim2.fromOffset(150, 136)
	-- PC: acima do minimapa (canto inferior direito). Celular: meio da tela, à direita.
	column.AnchorPoint = if touch then Vector2.new(1, 0.5) else Vector2.new(1, 1)
	column.Position = if touch then UDim2.new(1, -16, 0.5, 30) else UDim2.new(1, -16, 1, -226)
	column.Parent = rootGui
	local layout = UIUtil.List(column, Enum.FillDirection.Vertical, 8)
	layout.HorizontalAlignment = Enum.HorizontalAlignment.Right

	local spawnButton =
		UIUtil.Button(column, "SpawnVehicle", "🚗 Chamar veículo", UDim2.fromOffset(150, 40), Theme.Colors.Brand)
	spawnButton.LayoutOrder = 1
	spawnButton.TextSize = 16
	spawnButton.Activated:Connect(function()
		SoundController.Play("Click")
		VehicleController.RequestSpawn()
	end)
	local resetButton = UIUtil.Button(
		column,
		"ResetVehicle",
		"🔄 Resgatar [R]",
		UDim2.fromOffset(150, 40),
		Theme.Colors.PanelLight,
		Theme.Colors.Text
	)
	resetButton.LayoutOrder = 2
	resetButton.TextSize = 16
	resetButton.Activated:Connect(function()
		SoundController.Play("Click")
		VehicleController.RequestReset()
	end)
	local boardButton = UIUtil.Button(
		column,
		"Orders",
		"📦 Pedidos [G]",
		UDim2.fromOffset(150, 40),
		Theme.Colors.PanelLight,
		Theme.Colors.Text
	)
	boardButton.LayoutOrder = 3
	boardButton.TextSize = 16
	boardButton.Activated:Connect(function()
		SoundController.Play("Click")
		OrderBoardController.Toggle()
	end)

	speedPanel =
		UIUtil.Panel(rootGui, "Speedometer", UDim2.fromOffset(190, 62), UDim2.new(0.5, 0, 1, -18), Vector2.new(0.5, 1))
	speedPanel.Visible = false
	speedLabel = UIUtil.Label(speedPanel, "Speed", "0 km/h", 34, Theme.Fonts.Title)
	speedLabel.Size = UDim2.fromScale(1, 1)
	speedLabel.TextXAlignment = Enum.TextXAlignment.Center

	controlsHint = UIUtil.Label(
		rootGui,
		"ControlsHint",
		"W/S acelerar e frear • A/D virar • Shift freio de mão • Espaço sair • R resgatar",
		14,
		Theme.Fonts.Medium,
		Theme.Colors.Text
	)
	controlsHint.AnchorPoint = Vector2.new(0.5, 1)
	controlsHint.Position = UDim2.new(0.5, 0, 1, -86)
	controlsHint.Size = UDim2.fromOffset(700, 20)
	controlsHint.TextXAlignment = Enum.TextXAlignment.Center
	controlsHint.TextStrokeTransparency = 0.5
	controlsHint.Visible = false

	dataWarning = UIUtil.Label(
		rootGui,
		"DataWarning",
		"⚠️ Teste no Studio sem acesso às APIs: o dinheiro NÃO está sendo salvo.",
		13,
		Theme.Fonts.Bold,
		Theme.Colors.Warning
	)
	dataWarning.AnchorPoint = Vector2.new(0, 1)
	dataWarning.Position = UDim2.new(0, 16, 1, -12)
	dataWarning.Size = UDim2.fromOffset(560, 18)
	dataWarning.TextStrokeTransparency = 0.4
	dataWarning.Visible = false
end

--------------------------------------------------------------------------------
-- Atualização
--------------------------------------------------------------------------------

local function setStatus(text: string, background: Color3, textColor: Color3, clickable: boolean)
	statusButton.Text = text
	statusButton.BackgroundColor3 = background
	statusButton.TextColor3 = textColor
	statusButton.AutoButtonColor = clickable
end

local function showResult(result: DeliveryClient.ResultInfo)
	local dropoff = MapLayout.GetLocation(result.DropoffId)
	if result.Success then
		resultTitle.Text = if result.Late then "✅ ENTREGA CONCLUÍDA (com atraso)" else "✅ ENTREGA CONCLUÍDA!"
		resultTitle.TextColor3 = Theme.Colors.Success
		resultAmount.Text = "+ " .. Format.Money(result.Total)
		if result.Bonus > 0 and result.BonusLabel then
			resultDetail.Text = string.format(
				"%s: +%s (entrega %s + bônus)",
				result.BonusLabel,
				Format.Money(result.Bonus),
				Format.Money(result.Reward)
			)
		elseif result.Late then
			resultDetail.Text = "Recompensa reduzida pelo atraso. Acelera na próxima!"
		else
			resultDetail.Text = string.format(
				"Entregue em %s. Seja mais rápido para ganhar bônus!",
				if dropoff then dropoff.Name else "destino"
			)
		end
		SoundController.Play("Success")
	else
		resultTitle.Text = "❌ ENTREGA ATRASADA"
		resultTitle.TextColor3 = Theme.Colors.Danger
		resultAmount.Text = "$ 0"
		resultDetail.Text = "O prazo acabou e o pedido foi cancelado. Você não perdeu dinheiro — bora pra próxima!"
		SoundController.Play("Fail")
	end
	resultCard.Visible = true
	UIUtil.Pop(resultScale, 0.5)
	task.delay(GameConfig.Delivery.ResultDuration - 0.3, function()
		if DeliveryClient.GetState().Status ~= "Result" then
			resultCard.Visible = false
		end
	end)
end

local function refreshOrderCard(state: DeliveryClient.Snapshot)
	local order = state.Order
	if not order or (state.Status ~= "ToPickup" and state.Status ~= "ToDropoff") then
		orderCard.Visible = false
		return
	end
	local offer = order.Offer
	local orderType = OrderConfig.Get(offer.TypeId)
	local pickup = MapLayout.GetLocation(offer.PickupId)
	local dropoff = MapLayout.GetLocation(offer.DropoffId)
	orderItem.Text = string.format(
		"%s %s",
		if orderType then orderType.Icon else "📦",
		if orderType then orderType.DisplayName else offer.TypeId
	)
	orderReward.Text = "💰 " .. Format.Money(offer.Reward)
	if state.Status == "ToPickup" then
		orderTarget.Text = string.format(
			"📍 Coleta: %s\n🏁 Destino: %s",
			if pickup then pickup.Name else "?",
			if dropoff then dropoff.Name else "?"
		)
	else
		orderTarget.Text = string.format("🏁 Destino: %s", if dropoff then dropoff.Name else "?")
	end
	orderCard.Visible = true
end

local function updateTimer()
	local state = DeliveryClient.GetState()
	local order = state.Order
	if not order or not orderCard.Visible then
		return
	end
	local remaining = DeliveryClient.GetRemaining()
	if state.Status == "ToPickup" or remaining == nil then
		orderHeader.Text = "📦 VÁ ATÉ A COLETA"
		orderHeader.TextColor3 = Theme.Colors.Pickup
		orderTimer.Text = "⏱️ " .. Format.Time(order.Offer.TimeLimit)
		orderTimer.TextColor3 = Theme.Colors.Text
		orderTimerHint.Text = "O tempo começa quando você coletar"
		orderTimerScale.Scale = 1
		return
	end

	local limit = order.Offer.TimeLimit
	if remaining >= 0 then
		orderHeader.Text = "📦 ENTREGA ATIVA"
		orderHeader.TextColor3 = Theme.Colors.Success
		orderTimer.Text = "⏱️ " .. Format.Time(remaining)
		local danger = remaining <= math.max(15, limit * 0.25)
		local fraction = remaining / math.max(1, limit)
		if fraction >= GameConfig.Delivery.BonusTiers[1].MinRemainingFraction then
			orderTimerHint.Text = "⚡ No ritmo do bônus relâmpago!"
		elseif fraction >= GameConfig.Delivery.BonusTiers[2].MinRemainingFraction then
			orderTimerHint.Text = "🚀 Ainda dá bônus rápido!"
		else
			orderTimerHint.Text = "Corre!"
		end
		if danger then
			orderTimer.TextColor3 = Theme.Colors.Danger
			orderTimerScale.Scale = 1 + math.abs(math.sin(os.clock() * 6)) * 0.08
			local second = math.ceil(remaining)
			if second ~= lastTickSecond and second <= 10 then
				lastTickSecond = second
				SoundController.Play("Tick")
			end
		else
			orderTimer.TextColor3 = Theme.Colors.Text
			orderTimerScale.Scale = 1
		end
	else
		local graceLeft = (order.GraceEndsAt or 0) - DeliveryClient.Now()
		local lateValue = DeliveryRules.ComputePayout(order.Offer, -1).Total
		orderHeader.Text = "❌ ENTREGA ATRASADA"
		orderHeader.TextColor3 = Theme.Colors.Danger
		orderTimer.Text = "⏱️ -" .. Format.Time(-remaining)
		orderTimer.TextColor3 = Theme.Colors.Danger
		orderTimerScale.Scale = 1
		orderTimerHint.Text =
			string.format("Entregue em %s para ganhar %s", Format.Time(graceLeft), Format.Money(lateValue))
	end
end

local function updateDistance()
	local target = DeliveryClient.GetTarget()
	if not target or not orderCard.Visible then
		return
	end
	local character = player.Character
	local root = character and character:FindFirstChild("HumanoidRootPart")
	if root and root:IsA("BasePart") then
		local delta = target.Position - root.Position
		orderDistance.Text = "🛣️ " .. Format.Distance(Vector3.new(delta.X, 0, delta.Z).Magnitude)
	end
end

local function onStateChanged(state: DeliveryClient.Snapshot, previous: DeliveryClient.Snapshot)
	refreshOrderCard(state)
	dataWarning.Visible = state.DataPersistent == false

	if state.Status == "Idle" then
		setStatus("📦 PROCURAR ENTREGA", Theme.Colors.Brand, Theme.Colors.TextDark, true)
		resultCard.Visible = false
	elseif state.Status == "ToPickup" then
		setStatus("📦 ENTREGA ATIVA", Theme.Colors.Success, Theme.Colors.TextDark, false)
		if previous.Status == "Idle" then
			SoundController.Play("Accept")
		end
	elseif state.Status == "ToDropoff" then
		if DeliveryClient.IsLate() then
			setStatus("❌ ENTREGA ATRASADA", Theme.Colors.Danger, Theme.Colors.Text, false)
		else
			setStatus("📦 ENTREGA ATIVA", Theme.Colors.Success, Theme.Colors.TextDark, false)
		end
		if previous.Status == "ToPickup" then
			SoundController.Play("Pickup")
			UIUtil.Pop(statusScale, 0.8)
		end
	elseif state.Status == "Result" then
		local result = state.Result
		if result and result.Success then
			setStatus("✅ ENTREGA CONCLUÍDA", Theme.Colors.Success, Theme.Colors.TextDark, false)
		else
			setStatus("❌ ENTREGA ATRASADA", Theme.Colors.Danger, Theme.Colors.Text, false)
		end
		if result and previous.Status ~= "Result" then
			showResult(result)
		end
	else
		setStatus("⏳ Carregando...", Theme.Colors.Panel, Theme.Colors.Text, false)
	end
	if state.Status ~= previous.Status then
		UIUtil.Pop(statusScale, 0.9)
	end
end

local function animateMoney(target: number)
	local start = displayedMoney
	local difference = target - start
	if difference == 0 then
		return
	end
	if difference > 0 then
		UIUtil.Pop(moneyScale, 1.15)
		-- "+$350" subindo e sumindo ao lado do dinheiro.
		local popup = UIUtil.Label(
			moneyPill,
			"Gain",
			"+" .. Format.Money(difference),
			24,
			Theme.Fonts.Title,
			Theme.Colors.Success
		)
		popup.AnchorPoint = Vector2.new(0, 0.5)
		popup.Position = UDim2.new(1, 10, 0.5, 0)
		popup.Size = UDim2.fromOffset(160, 30)
		popup.TextStrokeTransparency = 0.4
		UIUtil.Tween(
			popup,
			1.4,
			{ Position = UDim2.new(1, 10, 0.5, -40), TextTransparency = 1, TextStrokeTransparency = 1 }
		)
		task.delay(1.5, function()
			popup:Destroy()
		end)
	end
	local duration = 0.8
	local started = os.clock()
	moneyAnimation += 1
	local token = moneyAnimation
	task.spawn(function()
		while token == moneyAnimation do
			local alpha = math.min(1, (os.clock() - started) / duration)
			displayedMoney = math.floor(start + difference * (1 - (1 - alpha) ^ 3))
			moneyLabel.Text = "💰 " .. Format.Money(displayedMoney)
			if alpha >= 1 then
				break
			end
			task.wait()
		end
		if token == moneyAnimation then
			displayedMoney = target
			moneyLabel.Text = "💰 " .. Format.Money(target)
		end
	end)
end

--------------------------------------------------------------------------------

function HUDController.Init()
	local rootGui = UIUtil.GetRoot()
	buildMoney(rootGui)
	buildStatus(rootGui)
	buildResult(rootGui)
	buildVehicleUI(rootGui)
end

function HUDController.Start()
	local initialMoney = player:GetAttribute("Money")
	if type(initialMoney) == "number" then
		displayedMoney = initialMoney
		moneyLabel.Text = "💰 " .. Format.Money(initialMoney)
	end
	player:GetAttributeChangedSignal("Money"):Connect(function()
		local money = player:GetAttribute("Money")
		if type(money) == "number" then
			animateMoney(money)
		end
	end)

	DeliveryClient.Changed:Connect(onStateChanged)
	onStateChanged(DeliveryClient.GetState(), DeliveryClient.GetState())

	VehicleController.DrivingChanged:Connect(function(driving: boolean)
		speedPanel.Visible = driving
		controlsHint.Visible = driving and UserInputService.KeyboardEnabled and not UserInputService.TouchEnabled
	end)

	local elapsed = 0
	local lateShown = false
	RunService.RenderStepped:Connect(function(dt: number)
		updateTimer()
		if speedPanel.Visible then
			speedLabel.Text = Format.Speed(VehicleController.GetSpeed())
		end
		elapsed += dt
		if elapsed >= 0.2 then
			elapsed = 0
			updateDistance()
			-- O status muda para "atrasada" sozinho quando o timer zera.
			local late = DeliveryClient.GetState().Status == "ToDropoff" and DeliveryClient.IsLate()
			if late ~= lateShown then
				lateShown = late
				if late then
					setStatus("❌ ENTREGA ATRASADA", Theme.Colors.Danger, Theme.Colors.Text, false)
					UIUtil.Pop(statusScale, 0.8)
					SoundController.Play("Fail")
				end
			end
		end
	end)
end

return HUDController
