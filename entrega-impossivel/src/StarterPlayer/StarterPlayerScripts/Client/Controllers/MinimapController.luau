--!strict
-- Minimapa (norte para cima) desenhado a partir do MapLayout: ruas, canal, pontes,
-- o objetivo atual e acidentes em andamento. Ajuda a escolher a rota.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local Workspace = game:GetService("Workspace")

local MapLayout = require(ReplicatedStorage.Shared.Map.MapLayout)
local RoadNetwork = require(ReplicatedStorage.Shared.Map.RoadNetwork)
local Theme = require(script.Parent.Parent.UI.Theme)
local UIUtil = require(script.Parent.Parent.UI.UIUtil)
local DeliveryClient = require(script.Parent.DeliveryClient)
local VehicleController = require(script.Parent.VehicleController)

local MinimapController = {}

local VIEW_SIZE = 190
local PIXELS_PER_STUD = 0.26
local HALF_WORLD = MapLayout.PlayableHalfSize

local player = Players.LocalPlayer
local viewport: Frame
local world: Frame
local playerArrow: TextLabel
local targetDot: Frame
local eventIcons: { [Instance]: TextLabel } = {}
local shortcutFrames: { [string]: Frame } = {}

local function toWorldPixels(x: number, z: number): Vector2
	return Vector2.new((x + HALF_WORLD) * PIXELS_PER_STUD, (z + HALF_WORLD) * PIXELS_PER_STUD)
end

local function rect(
	parent: Instance,
	name: string,
	xMin: number,
	zMin: number,
	xMax: number,
	zMax: number,
	color: Color3,
	zIndex: number
): Frame
	local topLeft = toWorldPixels(xMin, zMin)
	local frame = Instance.new("Frame")
	frame.Name = name
	frame.BorderSizePixel = 0
	frame.BackgroundColor3 = color
	frame.Position = UDim2.fromOffset(topLeft.X, topLeft.Y)
	frame.Size =
		UDim2.fromOffset(math.max(1, (xMax - xMin) * PIXELS_PER_STUD), math.max(1, (zMax - zMin) * PIXELS_PER_STUD))
	frame.ZIndex = zIndex
	frame.Parent = parent
	return frame
end

local function drawWorld()
	local size = HALF_WORLD * 2 * PIXELS_PER_STUD
	world.Size = UDim2.fromOffset(size, size)
	local P = MapLayout.Palette
	local canal = MapLayout.Canal

	rect(world, "Ground", -HALF_WORLD, -HALF_WORLD, HALF_WORLD, HALF_WORLD, P.GrassDark, 1)
	for _, block in MapLayout.GetBlocks() do
		rect(world, "Block", block.XMin, block.ZMin, block.XMax, block.ZMax, Color3.fromRGB(150, 160, 150), 2)
	end
	rect(world, "Canal", canal.XMin, canal.ZMin, canal.XMax, canal.ZMax, P.Water, 3)

	for _, edge in RoadNetwork.GetEdges() do
		local a, b = edge.From, edge.To
		local half = edge.Width / 2
		local xMin, xMax = math.min(a.X, b.X) - half, math.max(a.X, b.X) + half
		local zMin, zMax = math.min(a.Z, b.Z) - half, math.max(a.Z, b.Z) + half
		if edge.Crossing == "Narrow" or edge.Crossing == "Closed" then
			-- Desenha os dois lados até o canal; a travessia é desenhada à parte.
			rect(world, "Road", xMin, zMin, xMax, canal.ZMin, P.Road, 4)
			rect(world, "Road", xMin, canal.ZMax, xMax, zMax, P.Road, 4)
			if edge.Crossing == "Narrow" then
				local plank = MapLayout.NarrowBridgeWidth / 2
				rect(world, "Pinguela", a.X - plank, canal.ZMin, a.X + plank, canal.ZMax, P.Wood, 5)
			else
				local bridge = rect(world, "PonteObra", xMin, canal.ZMin, xMax, canal.ZMax, Theme.Colors.Success, 5)
				bridge.Visible = false
				shortcutFrames.PonteObra = bridge
			end
		else
			rect(world, "Road", xMin, zMin, xMax, zMax, P.Road, 4)
		end
	end

	local lot = MapLayout.ShoppingLot
	local gate =
		rect(world, "PortaoShopping", lot.Area.XMin, lot.GateZMin, lot.Area.XMax, lot.GateZMax, Theme.Colors.Success, 5)
	gate.Visible = false
	shortcutFrames.PortaoShopping = gate

	-- Becos e trilha como linhas finas (atalhos permanentes).
	for _, alley in MapLayout.Alleys do
		rect(world, "Alley", alley.Area.XMin, alley.Area.ZMin, alley.Area.XMax, alley.Area.ZMax, P.Asphalt, 4)
	end
	local trail = MapLayout.ParkTrail
	local steps = 12
	for index = 0, steps do
		local p = trail.From:Lerp(trail.To, index / steps)
		rect(world, "Trail", p.X - 7, p.Z - 7, p.X + 7, p.Z + 7, P.Dirt, 4)
	end
end

local function updateShortcuts()
	local open = ReplicatedStorage:GetAttribute("OpenShortcut")
	for id, frame in shortcutFrames do
		frame.Visible = open == id
	end
end

local function syncEventIcons()
	local folder = Workspace:FindFirstChild("WorldEvents")
	local seen: { [Instance]: boolean } = {}
	if folder then
		for _, model in folder:GetChildren() do
			local icon = model:GetAttribute("MapIcon")
			if model:IsA("Model") and model.PrimaryPart and type(icon) == "string" then
				seen[model] = true
				local label = eventIcons[model]
				if not label then
					local newLabel = Instance.new("TextLabel")
					newLabel.Name = "EventIcon"
					newLabel.BackgroundTransparency = 1
					newLabel.Size = UDim2.fromOffset(22, 22)
					newLabel.AnchorPoint = Vector2.new(0.5, 0.5)
					newLabel.TextScaled = true
					newLabel.Text = icon
					newLabel.ZIndex = 8
					newLabel.Parent = world
					eventIcons[model] = newLabel
					label = newLabel
				end
				local position = model.PrimaryPart.Position
				local pixels = toWorldPixels(position.X, position.Z)
				label.Position = UDim2.fromOffset(pixels.X, pixels.Y)
			end
		end
	end
	for model, label in eventIcons do
		if not seen[model] then
			label:Destroy()
			eventIcons[model] = nil
		end
	end
end

local function update()
	local character = player.Character
	local root = character and character:FindFirstChild("HumanoidRootPart")
	if not root or not root:IsA("BasePart") then
		return
	end
	local vehicle = VehicleController.GetVehicleModel()
	local reference = if vehicle and vehicle.PrimaryPart then vehicle.PrimaryPart else root
	local position = reference.Position
	local center = toWorldPixels(position.X, position.Z)
	world.Position = UDim2.fromOffset(VIEW_SIZE / 2 - center.X, VIEW_SIZE / 2 - center.Y)

	local look = reference.CFrame.LookVector
	playerArrow.Rotation = math.deg(math.atan2(look.X, -look.Z))

	local target, kind = DeliveryClient.GetTarget()
	if target then
		local offset = Vector2.new(target.Position.X - position.X, target.Position.Z - position.Z) * PIXELS_PER_STUD
		local limit = VIEW_SIZE / 2 - 8
		local largest = math.max(math.abs(offset.X), math.abs(offset.Y))
		if largest > limit then
			offset = offset * (limit / largest)
		end
		targetDot.Position = UDim2.fromOffset(VIEW_SIZE / 2 + offset.X, VIEW_SIZE / 2 + offset.Y)
		targetDot.BackgroundColor3 = if DeliveryClient.IsLate()
			then Theme.Colors.Danger
			elseif kind == "pickup" then Theme.Colors.Pickup
			else Theme.Colors.Dropoff
		targetDot.Visible = true
	else
		targetDot.Visible = false
	end
end

function MinimapController.Init()
	local rootGui = UIUtil.GetRoot()
	local touch = UIUtil.IsTouchLayout()
	viewport = UIUtil.Panel(
		rootGui,
		"Minimap",
		UDim2.fromOffset(VIEW_SIZE, VIEW_SIZE),
		if touch then UDim2.new(1, -16, 0, 8) else UDim2.new(1, -16, 1, -18),
		if touch then Vector2.new(1, 0) else Vector2.new(1, 1)
	)
	viewport.ClipsDescendants = true
	viewport.BackgroundColor3 = MapLayout.Palette.GrassDark

	world = Instance.new("Frame")
	world.Name = "World"
	world.BackgroundTransparency = 1
	world.Parent = viewport
	drawWorld()

	targetDot = Instance.new("Frame")
	targetDot.Name = "Target"
	targetDot.AnchorPoint = Vector2.new(0.5, 0.5)
	targetDot.Size = UDim2.fromOffset(14, 14)
	targetDot.BorderSizePixel = 0
	targetDot.ZIndex = 9
	targetDot.Visible = false
	targetDot.Parent = viewport
	UIUtil.Corner(targetDot, 7)
	UIUtil.Stroke(targetDot, Color3.new(1, 1, 1), 2, 0)

	playerArrow = Instance.new("TextLabel")
	playerArrow.Name = "Player"
	playerArrow.AnchorPoint = Vector2.new(0.5, 0.5)
	playerArrow.Position = UDim2.fromScale(0.5, 0.5)
	playerArrow.Size = UDim2.fromOffset(20, 20)
	playerArrow.BackgroundTransparency = 1
	playerArrow.Text = "▲"
	playerArrow.TextScaled = true
	playerArrow.TextColor3 = Theme.Colors.Brand
	playerArrow.TextStrokeTransparency = 0
	playerArrow.ZIndex = 10
	playerArrow.Parent = viewport

	local north = UIUtil.Label(viewport, "North", "N", 14, Theme.Fonts.Title)
	north.AnchorPoint = Vector2.new(0.5, 0)
	north.Position = UDim2.new(0.5, 0, 0, 2)
	north.Size = UDim2.fromOffset(20, 16)
	north.TextXAlignment = Enum.TextXAlignment.Center
	north.TextStrokeTransparency = 0.3
	north.ZIndex = 10
end

function MinimapController.Start()
	updateShortcuts()
	ReplicatedStorage:GetAttributeChangedSignal("OpenShortcut"):Connect(updateShortcuts)
	RunService.RenderStepped:Connect(update)
	task.spawn(function()
		while true do
			syncEventIcons()
			task.wait(1)
		end
	end)
end

return MinimapController
