--!strict
-- Monta o modelo de um veículo a partir do VehicleConfig.
--
-- Física (estilo arcade, controle responsivo):
--   • "Chassis" é a única peça com massa. Quatro esferas invisíveis sem atrito ("Skid")
--     encostam no chão e passam suaves por lombadas e degraus.
--   • LinearVelocity ("Drive") controla só a velocidade horizontal; a gravidade continua
--     agindo normalmente (rampas, quedas, canal).
--   • AlignOrientation ("Align") mantém o carro na direção desejada e alinhado ao chão —
--     ele não capota.
--   • O motorista controla esses dois objetos pelo cliente (VehicleController), porque o
--     servidor entrega a "posse física" (network ownership) do carro para ele.
--
-- Para usar um modelo feito à mão: coloque em ServerStorage.VehicleTemplates um Model com o
-- nome do Id do veículo, contendo uma Part "Chassis" e um VehicleSeat "DriverSeat".
-- O restante (constraints, prompt, placa) é adicionado automaticamente.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerStorage = game:GetService("ServerStorage")

local VehicleConfig = require(ReplicatedStorage.Shared.Config.VehicleConfig)

export type BuiltVehicle = {
	Model: Model,
	Chassis: BasePart,
	Seat: VehicleSeat,
	Drive: LinearVelocity,
	Align: AlignOrientation,
	Prompt: ProximityPrompt,
	Nameplate: TextLabel,
}

local VehicleBuilder = {}

local DARK = Color3.fromRGB(40, 42, 52)
local GLASS = Color3.fromRGB(60, 90, 130)

local function newPart(model: Model, name: string, size: Vector3, offset: CFrame, color: Color3, collide: boolean): Part
	local part = Instance.new("Part")
	part.Name = name
	part.Size = size
	part.CFrame = offset
	part.Color = color
	part.Material = Enum.Material.SmoothPlastic
	part.TopSurface = Enum.SurfaceType.Smooth
	part.BottomSurface = Enum.SurfaceType.Smooth
	part.CanCollide = collide
	if not collide then
		part.CanTouch = false
		part.CanQuery = false
	end
	part.Massless = true
	part.Parent = model
	return part
end

local function weld(part0: BasePart, part1: BasePart)
	local constraint = Instance.new("WeldConstraint")
	constraint.Part0 = part0
	constraint.Part1 = part1
	constraint.Parent = part1
end

local function addText(part: BasePart, face: Enum.NormalId, text: string, color: Color3)
	local gui = Instance.new("SurfaceGui")
	gui.Face = face
	gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	gui.PixelsPerStud = 30
	gui.LightInfluence = 0
	gui.Parent = part
	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 1
	label.Text = text
	label.TextScaled = true
	label.TextColor3 = color
	label.FontFace = Font.fromEnum(Enum.Font.FredokaOne)
	label.Parent = gui
	local padding = Instance.new("UIPadding")
	padding.PaddingLeft = UDim.new(0.06, 0)
	padding.PaddingRight = UDim.new(0.06, 0)
	padding.PaddingTop = UDim.new(0.2, 0)
	padding.PaddingBottom = UDim.new(0.2, 0)
	padding.Parent = label
end

-- Furgãozinho de entrega com baú (estilo "Van"). O chassi fica na origem, frente = -Z.
local function buildVan(definition: VehicleConfig.VehicleDefinition): Model
	local body = definition.Body
	local primary, secondary = body.PrimaryColor, body.SecondaryColor
	local model = Instance.new("Model")
	model.Name = definition.Id

	local chassis = Instance.new("Part")
	chassis.Name = "Chassis"
	chassis.Size = Vector3.new(6.4, 1.2, 11)
	chassis.CFrame = CFrame.identity
	chassis.Color = DARK
	chassis.Material = Enum.Material.SmoothPlastic
	chassis.TopSurface = Enum.SurfaceType.Smooth
	chassis.BottomSurface = Enum.SurfaceType.Smooth
	chassis.Parent = model
	model.PrimaryPart = chassis

	local function part(name: string, size: Vector3, position: Vector3, color: Color3, collide: boolean): Part
		local p = newPart(model, name, size, CFrame.new(position), color, collide)
		weld(chassis, p)
		return p
	end

	part("BodyLower", Vector3.new(7, 1.8, 12.4), Vector3.new(0, 1.3, 0), primary, true)
	part("Hood", Vector3.new(6.8, 1, 3), Vector3.new(0, 2.7, -4.7), primary, true)
	local cabin = part("Cabin", Vector3.new(6.6, 3.6, 4.2), Vector3.new(0, 4, -1.1), GLASS, true)
	cabin.Transparency = 0.35
	cabin.Reflectance = 0.2
	part("CabinRoof", Vector3.new(6.8, 0.4, 4.4), Vector3.new(0, 6, -1.1), primary, false)
	local cargo = part("CargoBox", Vector3.new(6.8, 4.4, 5.2), Vector3.new(0, 4.4, 3.6), secondary, true)
	part("CargoStripe", Vector3.new(6.9, 0.8, 5.3), Vector3.new(0, 2.6, 3.6), primary, false)
	addText(cargo, Enum.NormalId.Left, "📦 ENTREGA IMPOSSÍVEL", DARK)
	addText(cargo, Enum.NormalId.Right, "📦 ENTREGA IMPOSSÍVEL", DARK)
	addText(cargo, Enum.NormalId.Back, "📦", DARK)
	part("BumperFront", Vector3.new(7.2, 0.8, 0.6), Vector3.new(0, 0.9, -6.4), DARK, true)
	part("BumperRear", Vector3.new(7.2, 0.8, 0.6), Vector3.new(0, 0.9, 6.4), DARK, true)
	for _, x in { -2.4, 2.4 } do
		local head = part(
			"Headlight",
			Vector3.new(1.4, 0.7, 0.2),
			Vector3.new(x, 2.1, -6.25),
			Color3.fromRGB(255, 250, 220),
			false
		)
		head.Material = Enum.Material.Neon
		local tail = part(
			"Taillight",
			Vector3.new(1.2, 0.7, 0.2),
			Vector3.new(x * 1.08, 2.1, 6.25),
			Color3.fromRGB(230, 40, 40),
			false
		)
		tail.Material = Enum.Material.Neon
	end

	-- Rodas visuais (o cliente gira e esterça usando o C0 destes Welds).
	local wheels: { { Name: string, Position: Vector3 } } = {
		{ Name = "WheelFL", Position = Vector3.new(-3.35, -0.3, -4) },
		{ Name = "WheelFR", Position = Vector3.new(3.35, -0.3, -4) },
		{ Name = "WheelRL", Position = Vector3.new(-3.35, -0.3, 4) },
		{ Name = "WheelRR", Position = Vector3.new(3.35, -0.3, 4) },
	}
	for _, spec in wheels do
		local name, position = spec.Name, spec.Position
		local wheel = newPart(model, name, Vector3.new(1.2, 2.8, 2.8), CFrame.new(position), DARK, false)
		wheel.Shape = Enum.PartType.Cylinder
		local rim = newPart(
			model,
			name .. "Rim",
			Vector3.new(1.3, 1.6, 1.6),
			CFrame.new(position),
			Color3.fromRGB(210, 214, 222),
			false
		)
		rim.Shape = Enum.PartType.Cylinder
		local spoke = newPart(
			model,
			name .. "Spoke",
			Vector3.new(1.32, 2.1, 0.4),
			CFrame.new(position),
			Color3.fromRGB(150, 155, 165),
			false
		)
		weld(wheel, rim)
		weld(wheel, spoke)
		local wheelWeld = Instance.new("Weld")
		wheelWeld.Name = "WheelWeld"
		wheelWeld.Part0 = chassis
		wheelWeld.Part1 = wheel
		wheelWeld.C0 = CFrame.new(position)
		wheelWeld.C1 = CFrame.identity
		wheelWeld.Parent = wheel
	end

	-- Esferas de apoio, sem atrito (o deslizamento é controlado pelo script).
	local frictionless = PhysicalProperties.new(0.7, 0, 0, 100, 100)
	for _, position in
		{
			Vector3.new(-2.6, -0.5, -4),
			Vector3.new(2.6, -0.5, -4),
			Vector3.new(-2.6, -0.5, 4),
			Vector3.new(2.6, -0.5, 4),
		}
	do
		local skid = part("Skid", Vector3.new(2.4, 2.4, 2.4), position, DARK, true)
		skid.Shape = Enum.PartType.Ball
		skid.Transparency = 1
		skid.CustomPhysicalProperties = frictionless
	end

	local seat = Instance.new("VehicleSeat")
	seat.Name = "DriverSeat"
	seat.Size = Vector3.new(2.2, 0.8, 2.2)
	seat.CFrame = CFrame.new(-1.4, 2, -1)
	seat.Transparency = 1
	seat.CanCollide = false
	seat.Massless = true
	seat.HeadsUpDisplay = false
	seat.Parent = model
	weld(chassis, seat)

	return model
end

local BUILDERS: { [string]: (VehicleConfig.VehicleDefinition) -> Model } = {
	Van = buildVan,
}

-- Adiciona física, prompt e placa (vale para modelos gerados e templates).
local function prepare(model: Model): BuiltVehicle
	local chassis = model:FindFirstChild("Chassis")
	local seat = model:FindFirstChild("DriverSeat")
	assert(chassis and chassis:IsA("BasePart"), "Veículo sem Part 'Chassis': " .. model.Name)
	assert(seat and seat:IsA("VehicleSeat"), "Veículo sem VehicleSeat 'DriverSeat': " .. model.Name)
	model.PrimaryPart = chassis
	model.ModelStreamingMode = Enum.ModelStreamingMode.Atomic

	for _, descendant in model:GetDescendants() do
		if descendant:IsA("BasePart") then
			descendant.Anchored = false
			if descendant ~= chassis then
				descendant.Massless = true
			end
		end
	end
	chassis.Massless = false
	chassis.RootPriority = 127
	chassis.CustomPhysicalProperties = PhysicalProperties.new(2, 0, 0, 100, 100)

	local attachment = Instance.new("Attachment")
	attachment.Name = "DriveAttachment"
	attachment.Parent = chassis

	local drive = Instance.new("LinearVelocity")
	drive.Name = "Drive"
	drive.Attachment0 = attachment
	drive.RelativeTo = Enum.ActuatorRelativeTo.World
	drive.VelocityConstraintMode = Enum.VelocityConstraintMode.Plane
	drive.PrimaryTangentAxis = Vector3.new(1, 0, 0)
	drive.SecondaryTangentAxis = Vector3.new(0, 0, 1)
	drive.PlaneVelocity = Vector2.zero
	drive.MaxForce = 0
	drive.Parent = chassis

	local align = Instance.new("AlignOrientation")
	align.Name = "Align"
	align.Mode = Enum.OrientationAlignmentMode.OneAttachment
	align.AlignType = Enum.AlignType.AllAxes
	align.Attachment0 = attachment
	align.RigidityEnabled = false
	align.Responsiveness = 25
	align.MaxTorque = math.huge
	align.CFrame = CFrame.identity
	align.Parent = chassis

	local doorPoint = Instance.new("Part")
	doorPoint.Name = "DoorPoint"
	doorPoint.Size = Vector3.new(1, 1, 1)
	doorPoint.CFrame = seat.CFrame * CFrame.new(-2.6, 0.6, 0)
	doorPoint.Transparency = 1
	doorPoint.CanCollide = false
	doorPoint.CanTouch = false
	doorPoint.CanQuery = false
	doorPoint.Massless = true
	doorPoint.Anchored = false
	doorPoint.Parent = model
	weld(chassis, doorPoint)

	local prompt = Instance.new("ProximityPrompt")
	prompt.Name = "EnterPrompt"
	prompt.ActionText = "Dirigir"
	prompt.ObjectText = model.Name
	prompt.KeyboardKeyCode = Enum.KeyCode.E
	prompt.GamepadKeyCode = Enum.KeyCode.ButtonX
	prompt.HoldDuration = 0
	prompt.MaxActivationDistance = 12
	prompt.RequiresLineOfSight = false
	prompt.Parent = doorPoint

	local billboard = Instance.new("BillboardGui")
	billboard.Name = "Nameplate"
	billboard.Size = UDim2.fromOffset(220, 36)
	billboard.StudsOffsetWorldSpace = Vector3.new(0, 10, 0)
	billboard.MaxDistance = 160
	billboard.LightInfluence = 0
	billboard.Adornee = chassis
	billboard.Parent = chassis
	local nameLabel = Instance.new("TextLabel")
	nameLabel.Name = "Label"
	nameLabel.Size = UDim2.fromScale(1, 1)
	nameLabel.BackgroundTransparency = 1
	nameLabel.TextScaled = true
	nameLabel.TextColor3 = Color3.new(1, 1, 1)
	nameLabel.TextStrokeTransparency = 0.4
	nameLabel.FontFace = Font.fromEnum(Enum.Font.FredokaOne)
	nameLabel.Text = ""
	nameLabel.Parent = billboard

	return {
		Model = model,
		Chassis = chassis,
		Seat = seat,
		Drive = drive,
		Align = align,
		Prompt = prompt,
		Nameplate = nameLabel,
	}
end

function VehicleBuilder.Build(vehicleId: string): BuiltVehicle
	local definition = VehicleConfig.Get(vehicleId)
	assert(definition, "Veículo desconhecido: " .. vehicleId)

	local templates = ServerStorage:FindFirstChild("VehicleTemplates")
	local template = templates and templates:FindFirstChild(vehicleId)
	local model: Model
	if template and template:IsA("Model") then
		model = template:Clone()
		model:PivotTo(CFrame.identity)
	else
		local builder: (VehicleConfig.VehicleDefinition) -> Model = BUILDERS[definition.Body.Style] or buildVan
		model = builder(definition)
	end
	model.Name = definition.DisplayName
	return prepare(model)
end

return VehicleBuilder
