--!strict
-- Marcadores só do jogador local: coluna de luz no destino, anel no chão, placa com a
-- distância e uma seta 3D flutuando acima do carro apontando para o objetivo.
-- (Objetos criados no cliente não aparecem para os outros jogadores.)

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local Workspace = game:GetService("Workspace")

local GameConfig = require(ReplicatedStorage.Shared.Config.GameConfig)
local Format = require(ReplicatedStorage.Shared.Util.Format)
local Theme = require(script.Parent.Parent.UI.Theme)
local DeliveryClient = require(script.Parent.DeliveryClient)
local VehicleController = require(script.Parent.VehicleController)

local MarkerController = {}

local player = Players.LocalPlayer

local effects: Folder
local beacon: Part
local ring: Part
local billboardLabel: TextLabel
local billboard: BillboardGui
local arrow: Model

local function localPart(name: string, size: Vector3, color: Color3, parent: Instance): Part
	local part = Instance.new("Part")
	part.Name = name
	part.Anchored = true
	part.CanCollide = false
	part.CanQuery = false
	part.CanTouch = false
	part.CastShadow = false
	part.Material = Enum.Material.Neon
	part.Size = size
	part.Color = color
	part.Parent = parent
	return part
end

local function buildArrow(): Model
	local model = Instance.new("Model")
	model.Name = "GuideArrow"
	local shaft = localPart("Shaft", Vector3.new(1.3, 0.5, 5), Theme.Colors.Brand, model)
	shaft.CFrame = CFrame.new(0, 0, 0.5)
	for _, side in { -1, 1 } do
		local head = localPart("Head", Vector3.new(1.3, 0.5, 3.4), Theme.Colors.Brand, model)
		head.CFrame = CFrame.new(side * 1.05, 0, -2.2) * CFrame.Angles(0, side * math.rad(40), 0)
	end
	model.PrimaryPart = shaft
	model.WorldPivot = CFrame.identity
	model.Parent = effects
	return model
end

local function setColor(color: Color3)
	beacon.Color = color
	ring.Color = color
	for _, part in arrow:GetChildren() do
		if part:IsA("BasePart") then
			part.Color = color
		end
	end
	billboardLabel.BackgroundColor3 = color
end

local function setVisible(visible: boolean)
	beacon.Transparency = if visible then 0.55 else 1
	ring.Transparency = if visible then 0.45 else 1
	billboard.Enabled = visible
	for _, part in arrow:GetChildren() do
		if part:IsA("BasePart") then
			part.Transparency = if visible then 0.05 else 1
		end
	end
end

local function getAnchor(): (Vector3?, number)
	local vehicle = VehicleController.GetVehicleModel()
	if vehicle and vehicle.PrimaryPart then
		return vehicle.PrimaryPart.Position, 11
	end
	local character = player.Character
	local root = character and character:FindFirstChild("HumanoidRootPart")
	if root and root:IsA("BasePart") then
		return root.Position, 5
	end
	return nil, 0
end

local function update()
	local target, kind = DeliveryClient.GetTarget()
	if not target then
		setVisible(false)
		return
	end
	local color = if kind == "pickup" then Theme.Colors.Pickup else Theme.Colors.Dropoff
	if DeliveryClient.IsLate() then
		color = Theme.Colors.Danger
	end
	setColor(color)

	local position = target.Position
	beacon.CFrame = CFrame.new(position + Vector3.new(0, 150, 0)) * CFrame.Angles(0, 0, math.pi / 2)
	local pulse = 1 + math.sin(os.clock() * 4) * 0.04
	local diameter = GameConfig.Delivery.PickupRadius * 2 * pulse
	ring.Size = Vector3.new(0.2, diameter, diameter)
	ring.CFrame = CFrame.new(position + Vector3.new(0, 0.25, 0)) * CFrame.Angles(0, 0, math.pi / 2)

	local anchor, height = getAnchor()
	local distance = 0
	if anchor then
		local flat = Vector3.new(position.X - anchor.X, 0, position.Z - anchor.Z)
		distance = flat.Magnitude
		local arrowPosition = anchor + Vector3.new(0, height + math.sin(os.clock() * 3) * 0.4, 0)
		if distance > 28 then
			arrow:PivotTo(CFrame.lookAt(arrowPosition, arrowPosition + flat.Unit))
		end
	end
	local verb = if kind == "pickup" then "COLETA" else "ENTREGA"
	billboardLabel.Text = string.format("%s %s\n%s • %s", target.Icon, target.Name, verb, Format.Distance(distance))
	setVisible(true)
	-- A seta some quando já chegou perto.
	if distance <= 28 then
		for _, part in arrow:GetChildren() do
			if part:IsA("BasePart") then
				part.Transparency = 1
			end
		end
	end
end

function MarkerController.Init()
	local existing = Workspace:FindFirstChild("LocalEffects")
	if existing and existing:IsA("Folder") then
		effects = existing
	else
		effects = Instance.new("Folder")
		effects.Name = "LocalEffects"
		effects.Parent = Workspace
	end

	beacon = localPart("Beacon", Vector3.new(300, 7, 7), Theme.Colors.Brand, effects)
	beacon.Shape = Enum.PartType.Cylinder
	ring = localPart("Ring", Vector3.new(0.2, 40, 40), Theme.Colors.Brand, effects)
	ring.Shape = Enum.PartType.Cylinder

	billboard = Instance.new("BillboardGui")
	billboard.Name = "TargetLabel"
	billboard.Adornee = ring
	billboard.Size = UDim2.fromOffset(230, 58)
	billboard.StudsOffsetWorldSpace = Vector3.new(0, 16, 0)
	billboard.AlwaysOnTop = true
	billboard.LightInfluence = 0
	billboard.MaxDistance = 5000
	billboard.Parent = effects

	billboardLabel = Instance.new("TextLabel")
	billboardLabel.Size = UDim2.fromScale(1, 1)
	billboardLabel.BackgroundColor3 = Theme.Colors.Brand
	billboardLabel.BackgroundTransparency = 0.1
	billboardLabel.TextColor3 = Theme.Colors.TextDark
	billboardLabel.TextScaled = true
	billboardLabel.FontFace = Theme.Fonts.Title
	billboardLabel.Text = ""
	billboardLabel.Parent = billboard
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 12)
	corner.Parent = billboardLabel
	local padding = Instance.new("UIPadding")
	padding.PaddingLeft = UDim.new(0, 8)
	padding.PaddingRight = UDim.new(0, 8)
	padding.PaddingTop = UDim.new(0, 4)
	padding.PaddingBottom = UDim.new(0, 4)
	padding.Parent = billboardLabel

	arrow = buildArrow()
	setVisible(false)
end

function MarkerController.Start()
	RunService.RenderStepped:Connect(update)
end

return MarkerController
