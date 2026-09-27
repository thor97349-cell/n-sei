--!strict
-- Constrói a cidade inteira (Parts ancoradas) a partir do MapLayout.
--
-- Este módulo roda em dois lugares:
--   • no build do projeto (tools/bake_map.luau), para o mapa já vir pronto no arquivo
--     .rbxl e aparecer no Studio em modo de edição;
--   • no servidor, como plano B, se workspace.Map não existir (ex.: sincronizando com Rojo
--     num lugar vazio).
-- Por isso ele só usa APIs básicas de Instance (sem PivotTo, sem ler Part.Position etc.).

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local MapLayout = require(ReplicatedStorage.Shared.Map.MapLayout)

type Rect = MapLayout.Rect

local P = MapLayout.Palette
local H = MapLayout.Heights

local MapBuilder = {}

local YAW: { [string]: number } = {
	N = 0,
	S = math.pi,
	E = -math.pi / 2,
	W = math.pi / 2,
}

local KNOCKABLE_TAG = "Knockable"
MapBuilder.KnockableTag = KNOCKABLE_TAG

--------------------------------------------------------------------------------
-- Utilidades
--------------------------------------------------------------------------------

type PartOptions = {
	Material: Enum.Material?,
	Transparency: number?,
	CanCollide: boolean?,
	CastShadow: boolean?,
	Reflectance: number?,
}

local function applyOptions(part: BasePart, options: PartOptions?)
	part.Anchored = true
	part.TopSurface = Enum.SurfaceType.Smooth
	part.BottomSurface = Enum.SurfaceType.Smooth
	part.Material = if options and options.Material then options.Material else Enum.Material.SmoothPlastic
	if options then
		if options.Transparency then
			part.Transparency = options.Transparency
		end
		if options.CanCollide == false then
			part.CanCollide = false
			part.CanTouch = false
			part.CanQuery = false
		end
		if options.CastShadow == false then
			part.CastShadow = false
		end
		if options.Reflectance then
			part.Reflectance = options.Reflectance
		end
	end
end

local function box(
	parent: Instance,
	name: string,
	size: Vector3,
	cframe: CFrame,
	color: Color3,
	options: PartOptions?
): Part
	local part = Instance.new("Part")
	part.Name = name
	part.Size = size
	part.CFrame = cframe
	part.Color = color
	applyOptions(part, options)
	part.Parent = parent
	return part
end

local function wedge(
	parent: Instance,
	name: string,
	size: Vector3,
	cframe: CFrame,
	color: Color3,
	options: PartOptions?
): WedgePart
	local part = Instance.new("WedgePart")
	part.Name = name
	part.Size = size
	part.CFrame = cframe
	part.Color = color
	applyOptions(part, options)
	part.Parent = parent
	return part
end

-- Cilindro em pé (o eixo do cilindro do Roblox é o X; giramos para ficar vertical).
local function cylinder(
	parent: Instance,
	name: string,
	height: number,
	diameter: number,
	position: Vector3,
	color: Color3,
	options: PartOptions?
): Part
	local part = Instance.new("Part")
	part.Name = name
	part.Shape = Enum.PartType.Cylinder
	part.Size = Vector3.new(height, diameter, diameter)
	part.CFrame = CFrame.new(position) * CFrame.Angles(0, 0, math.pi / 2)
	part.Color = color
	applyOptions(part, options)
	part.Parent = parent
	return part
end

local function ball(
	parent: Instance,
	name: string,
	diameter: number,
	position: Vector3,
	color: Color3,
	options: PartOptions?
): Part
	local part = Instance.new("Part")
	part.Name = name
	part.Shape = Enum.PartType.Ball
	part.Size = Vector3.new(diameter, diameter, diameter)
	part.CFrame = CFrame.new(position)
	part.Color = color
	applyOptions(part, options)
	part.Parent = parent
	return part
end

local function newFolder(parent: Instance, name: string): Folder
	local folder = Instance.new("Folder")
	folder.Name = name
	folder.Parent = parent
	return folder
end

local function newModel(parent: Instance, name: string): Model
	local model = Instance.new("Model")
	model.Name = name
	model.Parent = parent
	return model
end

local function luminance(color: Color3): number
	return color.R * 0.299 + color.G * 0.587 + color.B * 0.114
end

local function contrastText(background: Color3): Color3
	if luminance(background) > 0.62 then
		return P.Dark
	end
	return Color3.new(1, 1, 1)
end

local function addSurfaceText(part: BasePart, face: Enum.NormalId, text: string, textColor: Color3)
	local gui = Instance.new("SurfaceGui")
	gui.Name = "Text" .. face.Name
	gui.Face = face
	gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	gui.PixelsPerStud = 24
	gui.LightInfluence = 0
	gui.Parent = part

	local label = Instance.new("TextLabel")
	label.Name = "Label"
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 1
	label.Text = text
	label.TextScaled = true
	label.TextColor3 = textColor
	label.FontFace = Font.fromEnum(Enum.Font.FredokaOne)
	label.TextStrokeTransparency = 0.8
	label.Parent = gui

	local padding = Instance.new("UIPadding")
	padding.PaddingLeft = UDim.new(0.05, 0)
	padding.PaddingRight = UDim.new(0.05, 0)
	padding.PaddingTop = UDim.new(0.12, 0)
	padding.PaddingBottom = UDim.new(0.12, 0)
	padding.Parent = label
end

-- Gerador pseudo-aleatório determinístico (o mapa sai sempre igual).
local function makeRandom(seed: number): (number?, number?) -> number
	local state = seed
	return function(min: number?, max: number?): number
		state = (state * 1103515245 + 12345) % 2147483648
		local value = state / 2147483648
		if min and max then
			return min + value * (max - min)
		end
		return value
	end
end

local function flatDistance(a: Vector3, b: Vector3): number
	return Vector2.new(a.X - b.X, a.Z - b.Z).Magnitude
end

local function inRect(x: number, z: number, rect: Rect, margin: number): boolean
	return x >= rect.XMin - margin and x <= rect.XMax + margin and z >= rect.ZMin - margin and z <= rect.ZMax + margin
end

-- Transforma uma Part em obstáculo solto (pode ser derrubado e volta ao lugar sozinho).
local function makeKnockable(part: BasePart)
	part.Anchored = false
	part.CustomPhysicalProperties = PhysicalProperties.new(0.35, 0.5, 0.2, 1, 1)
	part:SetAttribute("HomeCFrame", part.CFrame)
	part:AddTag(KNOCKABLE_TAG)
end

--------------------------------------------------------------------------------
-- Objetos reutilizáveis (árvores, postes, barris, placas)
--------------------------------------------------------------------------------

local TREE_GREENS = {
	Color3.fromRGB(86, 176, 72),
	Color3.fromRGB(64, 156, 76),
	Color3.fromRGB(118, 190, 64),
	Color3.fromRGB(52, 140, 90),
}

local function tree(parent: Instance, position: Vector3, scale: number, colorIndex: number)
	local trunkHeight = 7 * scale
	cylinder(parent, "Trunk", trunkHeight, 1.6 * scale, position + Vector3.new(0, trunkHeight / 2, 0), P.Wood, {
		Material = Enum.Material.Wood,
	})
	local green = TREE_GREENS[(colorIndex % #TREE_GREENS) + 1]
	ball(parent, "Leaves", 10 * scale, position + Vector3.new(0, trunkHeight + 3 * scale, 0), green, {
		Material = Enum.Material.Grass,
		CanCollide = false,
	})
end

local function lamp(parent: Instance, position: Vector3, towardRoad: Vector3)
	local pole =
		box(parent, "LampPole", Vector3.new(0.7, 15, 0.7), CFrame.new(position + Vector3.new(0, 7.5, 0)), P.Dark, {
			Material = Enum.Material.Metal,
		})
	pole.CastShadow = false
	local head = position + Vector3.new(0, 14.6, 0) + towardRoad * 2
	box(
		parent,
		"LampHead",
		Vector3.new(1.4, 0.6, 1.4) + Vector3.new(math.abs(towardRoad.X), 0, math.abs(towardRoad.Z)) * 3,
		CFrame.new(head),
		Color3.fromRGB(255, 240, 200),
		{
			Material = Enum.Material.Neon,
			CanCollide = false,
			CastShadow = false,
		}
	)
end

local function barrel(parent: Instance, position: Vector3, knockable: boolean): Part
	local part = cylinder(parent, "Barrel", 3.2, 2.4, position + Vector3.new(0, 1.6, 0), P.Orange, {
		Material = Enum.Material.SmoothPlastic,
	})
	if knockable then
		makeKnockable(part)
	end
	return part
end

local function cone(parent: Instance, position: Vector3): Part
	-- "Cone" estilizado: coluna laranja fina (é leve e cai quando atingida).
	local part = cylinder(parent, "Cone", 2.6, 1.2, position + Vector3.new(0, 1.3, 0), Color3.fromRGB(255, 120, 30), {
		Material = Enum.Material.SmoothPlastic,
	})
	makeKnockable(part)
	return part
end

-- Placa em um poste, com texto dos dois lados.
local function signPost(
	parent: Instance,
	position: Vector3,
	facing: Vector3,
	text: string,
	color: Color3,
	width: number?
)
	local boardWidth = width or 12
	box(parent, "SignPole", Vector3.new(0.6, 9, 0.6), CFrame.new(position + Vector3.new(0, 4.5, 0)), P.Slate, {
		Material = Enum.Material.Metal,
	})
	local center = position + Vector3.new(0, 9, 0)
	local board =
		box(parent, "SignBoard", Vector3.new(boardWidth, 3.2, 0.4), CFrame.lookAt(center, center + facing), color)
	addSurfaceText(board, Enum.NormalId.Front, text, contrastText(color))
	addSurfaceText(board, Enum.NormalId.Back, text, contrastText(color))
end

local function simpleCar(parent: Instance, cframe: CFrame, color: Color3)
	local model = newModel(parent, "ParkedCar")
	box(model, "Body", Vector3.new(6.6, 2.6, 11.5), cframe * CFrame.new(0, 1.9, 0), color)
	box(model, "Cabin", Vector3.new(6, 2.2, 6), cframe * CFrame.new(0, 4.3, 0.5), P.Glass, { Reflectance = 0.2 })
	for _, offset in
		{
			Vector3.new(3.1, 1.2, -3.8),
			Vector3.new(-3.1, 1.2, -3.8),
			Vector3.new(3.1, 1.2, 3.8),
			Vector3.new(-3.1, 1.2, 3.8),
		}
	do
		local wheel = Instance.new("Part")
		wheel.Name = "Wheel"
		wheel.Shape = Enum.PartType.Cylinder
		wheel.Size = Vector3.new(1, 2.4, 2.4)
		wheel.CFrame = cframe * CFrame.new(offset)
		wheel.Color = P.Dark
		applyOptions(wheel, { CanCollide = false })
		wheel.Parent = model
	end
end

--------------------------------------------------------------------------------
-- Estilos de prédio. Cada função recebe um CFrame no chão, no centro do prédio,
-- com a FACHADA virada para -Z local (a direção da rua).
--------------------------------------------------------------------------------

type Spec = {
	Width: number,
	Depth: number,
	Height: number,
	Color: Color3,
	Accent: Color3,
	Sign: string?,
	Setback: number,
}

local function at(base: CFrame, x: number, y: number, z: number): CFrame
	return base * CFrame.new(x, y, z)
end

local function body(model: Model, base: CFrame, s: Spec, height: number?): Part
	local h = height or s.Height
	return box(model, "Body", Vector3.new(s.Width, h, s.Depth), at(base, 0, h / 2, 0), s.Color)
end

local function windowBands(model: Model, base: CFrame, s: Spec, fromY: number, toY: number, spacing: number)
	local y = fromY
	while y + 2.4 <= toY do
		box(model, "Windows", Vector3.new(s.Width + 0.3, 2.4, s.Depth + 0.3), at(base, 0, y + 1.2, 0), P.Glass, {
			Reflectance = 0.18,
			CastShadow = false,
		})
		y += spacing
	end
end

local function roofTrim(model: Model, base: CFrame, s: Spec, height: number?)
	local h = height or s.Height
	box(model, "RoofTrim", Vector3.new(s.Width + 1, 1, s.Depth + 1), at(base, 0, h + 0.5, 0), s.Accent)
end

local function door(model: Model, base: CFrame, s: Spec, x: number?, width: number?, height: number?)
	local w, h = width or 6, height or 8
	box(
		model,
		"Door",
		Vector3.new(w, h, 0.4),
		at(base, x or 0, h / 2, -s.Depth / 2 - 0.15),
		P.Dark,
		{ CastShadow = false }
	)
end

local function facadeSign(model: Model, base: CFrame, s: Spec, y: number, heightOverride: number?)
	local text = s.Sign
	if not text then
		return
	end
	local width = math.clamp(s.Width * 0.8, 14, 64)
	local height = heightOverride or 4.5
	local sign = box(model, "Sign", Vector3.new(width, height, 0.6), at(base, 0, y, -s.Depth / 2 - 0.45), s.Accent)
	addSurfaceText(sign, Enum.NormalId.Front, text, contrastText(s.Accent))
end

local function rooftopUnits(model: Model, base: CFrame, s: Spec)
	for _, x in { -s.Width / 4, s.Width / 4 } do
		box(model, "RoofUnit", Vector3.new(4, 2.5, 4), at(base, x, s.Height + 2.25, s.Depth / 6), P.Slate)
	end
end

local Styles: { [string]: (Model, CFrame, Spec) -> () } = {}

function Styles.Office(model, base, s)
	body(model, base, s)
	windowBands(model, base, s, 4, s.Height - 2, 6)
	roofTrim(model, base, s)
	door(model, base, s)
	rooftopUnits(model, base, s)
	facadeSign(model, base, s, 10.5)
end

function Styles.Apartment(model, base, s)
	body(model, base, s)
	windowBands(model, base, s, 3, s.Height - 2, 5)
	local y = 5.5
	while y < s.Height - 3 do
		box(model, "Balcony", Vector3.new(s.Width * 0.7, 0.5, 2.2), at(base, 0, y, -s.Depth / 2 - 1.1), s.Accent)
		y += 5
	end
	roofTrim(model, base, s)
	door(model, base, s, s.Width * 0.3)
	facadeSign(model, base, s, 3, 3.5)
end

function Styles.Tower(model, base, s)
	body(model, base, s)
	windowBands(model, base, s, 12, s.Height - 4, 5)
	box(model, "Crown", Vector3.new(s.Width + 2, 4, s.Depth + 2), at(base, 0, s.Height + 2, 0), s.Accent)
	box(
		model,
		"Antenna",
		Vector3.new(1, 22, 1),
		at(base, 0, s.Height + 15, 0),
		P.Slate,
		{ Material = Enum.Material.Metal }
	)
	box(model, "AntennaLight", Vector3.new(1.6, 1.6, 1.6), at(base, 0, s.Height + 26.5, 0), P.Red, {
		Material = Enum.Material.Neon,
		CanCollide = false,
	})
	box(model, "Canopy", Vector3.new(s.Width * 0.6, 0.8, 6), at(base, 0, 9, -s.Depth / 2 - 3), s.Accent)
	door(model, base, s, 0, 10, 8)
	facadeSign(model, base, s, 11.5, 3)
end

local function awning(model: Model, base: CFrame, s: Spec, y: number)
	local total = s.Width - 2
	local segments = math.max(3, math.floor(total / 5))
	local segmentWidth = total / segments
	for index = 0, segments - 1 do
		local x = -total / 2 + segmentWidth * (index + 0.5)
		local color = if index % 2 == 0 then s.Accent else P.White
		box(
			model,
			"Awning",
			Vector3.new(segmentWidth, 0.4, 5),
			at(base, x, y, -s.Depth / 2 - 2.3) * CFrame.Angles(math.rad(-16), 0, 0),
			color,
			{
				CastShadow = true,
			}
		)
	end
end

function Styles.Shop(model, base, s)
	body(model, base, s)
	box(
		model,
		"Storefront",
		Vector3.new(s.Width - 4, 6, 0.4),
		at(base, 0, 3.5, -s.Depth / 2 - 0.1),
		P.Glass,
		{ Reflectance = 0.25 }
	)
	door(model, base, s, 0, 5, 7)
	awning(model, base, s, 8)
	roofTrim(model, base, s)
	if s.Height >= 12 then
		facadeSign(model, base, s, s.Height - 2.8, 3.6)
	end
end

function Styles.Warehouse(model, base, s)
	body(model, base, s)
	local doors = math.max(1, math.floor(s.Width / 26))
	local spacing = s.Width / doors
	for index = 0, doors - 1 do
		local x = -s.Width / 2 + spacing * (index + 0.5)
		box(
			model,
			"RollDoor",
			Vector3.new(10, 11, 0.4),
			at(base, x, 5.5, -s.Depth / 2 - 0.15),
			P.Slate,
			{ Material = Enum.Material.DiamondPlate }
		)
	end
	box(model, "Stripe", Vector3.new(s.Width + 0.3, 2, s.Depth + 0.3), at(base, 0, s.Height - 5, 0), s.Accent)
	roofTrim(model, base, s)
	facadeSign(model, base, s, 15, 5)
end

function Styles.GasStation(model, base, s)
	body(model, base, s)
	box(
		model,
		"Storefront",
		Vector3.new(s.Width - 6, 6, 0.4),
		at(base, 0, 3.5, -s.Depth / 2 - 0.1),
		P.Glass,
		{ Reflectance = 0.25 }
	)
	door(model, base, s, 0, 5, 7)
	roofTrim(model, base, s)
	-- Cobertura sobre as bombas, entre a loja e a rua.
	local canopyDepth = s.Setback * 0.72
	local canopyZ = -(s.Depth / 2 + s.Setback / 2)
	box(model, "Canopy", Vector3.new(s.Width, 1.4, canopyDepth), at(base, 0, 12.7, canopyZ), P.White)
	box(model, "CanopyStripe", Vector3.new(s.Width + 0.3, 1, canopyDepth + 0.3), at(base, 0, 11.6, canopyZ), s.Accent)
	for _, cx in { -s.Width / 2 + 3, s.Width / 2 - 3 } do
		for _, cz in { -canopyDepth / 2 + 3, canopyDepth / 2 - 3 } do
			box(model, "Pillar", Vector3.new(1.4, 11.2, 1.4), at(base, cx, 5.6, canopyZ + cz), P.White)
		end
	end
	for _, px in { -s.Width / 4, s.Width / 4 } do
		box(model, "Island", Vector3.new(3.4, 0.6, 9), at(base, px, 0.3, canopyZ), P.Curb)
		box(model, "Pump", Vector3.new(2, 4.6, 1.6), at(base, px, 2.9, canopyZ), s.Accent)
	end
	if s.Sign then
		local pole = at(base, s.Width / 2 - 2, 0, canopyZ - canopyDepth / 2 + 1)
		box(
			model,
			"PricePole",
			Vector3.new(1, 16, 1),
			pole * CFrame.new(0, 8, 0),
			P.Slate,
			{ Material = Enum.Material.Metal }
		)
		local board = box(model, "PriceBoard", Vector3.new(9, 6, 1), pole * CFrame.new(0, 17, 0), s.Accent)
		addSurfaceText(board, Enum.NormalId.Front, s.Sign .. "\n$ 5,99", contrastText(s.Accent))
		addSurfaceText(board, Enum.NormalId.Back, s.Sign .. "\n$ 5,99", contrastText(s.Accent))
	end
end

function Styles.School(model, base, s)
	body(model, base, s)
	windowBands(model, base, s, 4, s.Height - 2, 7)
	box(model, "Stripe", Vector3.new(s.Width + 0.3, 1.6, s.Depth + 0.3), at(base, 0, 1.2, 0), s.Accent)
	roofTrim(model, base, s)
	box(model, "Portico", Vector3.new(18, 1, 7), at(base, 0, 9.5, -s.Depth / 2 - 3.5), s.Accent)
	for _, x in { -8, 8 } do
		box(model, "PorticoPillar", Vector3.new(1.2, 9, 1.2), at(base, x, 4.5, -s.Depth / 2 - 6.5), P.White)
	end
	door(model, base, s, 0, 8, 8)
	facadeSign(model, base, s, 13, 4)
	local flagBase = at(base, -s.Width / 2 + 6, 0, -s.Depth / 2 - 10)
	box(
		model,
		"FlagPole",
		Vector3.new(0.5, 22, 0.5),
		flagBase * CFrame.new(0, 11, 0),
		P.White,
		{ Material = Enum.Material.Metal }
	)
	box(model, "Flag", Vector3.new(0.2, 3.6, 6), flagBase * CFrame.new(0, 19.5, 3.2), Color3.fromRGB(0, 156, 59))
	box(model, "FlagDiamond", Vector3.new(0.3, 2, 3), flagBase * CFrame.new(0, 19.5, 3.2), Color3.fromRGB(255, 223, 0))
end

function Styles.Hospital(model, base, s)
	body(model, base, s)
	windowBands(model, base, s, 5, s.Height - 2, 6)
	box(model, "Stripe", Vector3.new(s.Width + 0.3, 2, s.Depth + 0.3), at(base, 0, 1, 0), s.Accent)
	roofTrim(model, base, s)
	local crossY = s.Height - 8
	box(
		model,
		"CrossV",
		Vector3.new(2.6, 9, 0.4),
		at(base, 0, crossY, -s.Depth / 2 - 0.4),
		P.Red,
		{ Material = Enum.Material.Neon }
	)
	box(
		model,
		"CrossH",
		Vector3.new(9, 2.6, 0.4),
		at(base, 0, crossY, -s.Depth / 2 - 0.4),
		P.Red,
		{ Material = Enum.Material.Neon }
	)
	box(model, "Canopy", Vector3.new(26, 0.8, 10), at(base, 0, 9.4, -s.Depth / 2 - 5), s.Accent)
	for _, x in { -11, 11 } do
		box(model, "CanopyPillar", Vector3.new(1, 9, 1), at(base, x, 4.5, -s.Depth / 2 - 9.4), P.White)
	end
	door(model, base, s, 0, 10, 8)
	facadeSign(model, base, s, 13.5, 4)
	local helipad = box(model, "Helipad", Vector3.new(26, 0.4, 26), at(base, 0, s.Height + 1.2, s.Depth / 6), P.Dark)
	addSurfaceText(helipad, Enum.NormalId.Top, "H", P.Sunny)
end

function Styles.Mall(model, base, s)
	body(model, base, s)
	box(
		model,
		"GlassFront",
		Vector3.new(s.Width - 10, s.Height - 9, 0.4),
		at(base, 0, (s.Height - 9) / 2 + 1, -s.Depth / 2 - 0.1),
		P.Glass,
		{
			Reflectance = 0.3,
		}
	)
	box(model, "Stripe", Vector3.new(s.Width + 0.3, 3, s.Depth + 0.3), at(base, 0, s.Height - 1.5, 0), s.Accent)
	box(model, "Atrium", Vector3.new(s.Width * 0.4, 8, s.Depth * 0.4), at(base, 0, s.Height + 4, 0), P.Glass, {
		Transparency = 0.35,
		Reflectance = 0.2,
	})
	door(model, base, s, 0, 12, 9)
	facadeSign(model, base, s, s.Height - 5.5, 6)
end

function Styles.Civic(model, base, s)
	body(model, base, s)
	windowBands(model, base, s, 5, s.Height - 4, 8)
	roofTrim(model, base, s)
	local columns = 6
	for index = 0, columns - 1 do
		local x = -s.Width * 0.35 + (s.Width * 0.7) * index / (columns - 1)
		local p = at(base, x, (s.Height - 6) / 2, -s.Depth / 2 - 5).Position
		cylinder(model, "Column", s.Height - 6, 2.6, p, P.White)
	end
	box(model, "Portico", Vector3.new(s.Width * 0.8, 1.6, 10), at(base, 0, s.Height - 5.2, -s.Depth / 2 - 4.5), s.Color)
	for step = 1, 3 do
		box(
			model,
			"Step",
			Vector3.new(s.Width * 0.7, 0.4 * step, 2),
			at(base, 0, 0.2 * step, -s.Depth / 2 - 10 + step * 2),
			P.Sidewalk
		)
	end
	ball(model, "Dome", 22, at(base, 0, s.Height + 1, 0).Position, s.Accent)
	door(model, base, s, 0, 8, 10)
	facadeSign(model, base, s, s.Height - 2, 4)
end

function Styles.Kiosk(model, base, s)
	body(model, base, s, s.Height - 3)
	box(model, "Roof", Vector3.new(s.Width + 5, 0.8, s.Depth + 5), at(base, 0, s.Height - 2.6, 0), s.Accent)
	box(model, "Counter", Vector3.new(s.Width - 4, 3, 0.4), at(base, 0, 4.5, -s.Depth / 2 - 0.1), P.Glass)
	facadeSign(model, base, s, s.Height - 1, 2.4)
end

function Styles.FireStation(model, base, s)
	body(model, base, s)
	for _, x in { -s.Width / 3, 0, s.Width / 3 } do
		box(
			model,
			"GarageDoor",
			Vector3.new(s.Width / 3 - 5, 11, 0.4),
			at(base, x, 5.5, -s.Depth / 2 - 0.15),
			P.White,
			{
				Material = Enum.Material.DiamondPlate,
			}
		)
	end
	roofTrim(model, base, s)
	box(
		model,
		"HoseTower",
		Vector3.new(8, s.Height + 14, 8),
		at(base, s.Width / 2 - 4, (s.Height + 14) / 2, s.Depth / 2 - 4),
		s.Color
	)
	box(model, "Siren", Vector3.new(2, 2, 2), at(base, s.Width / 2 - 4, s.Height + 15, s.Depth / 2 - 4), P.Red, {
		Material = Enum.Material.Neon,
		CanCollide = false,
	})
	facadeSign(model, base, s, 14.2, 3.4)
end

function Styles.Shed(model, base, s)
	body(model, base, s)
	box(model, "Roof", Vector3.new(s.Width + 2, 1.2, s.Depth + 2), at(base, 0, s.Height + 0.6, 0), s.Accent, {
		Material = Enum.Material.CorrodedMetal,
	})
	box(model, "GarageDoor", Vector3.new(s.Width * 0.5, 9, 0.4), at(base, 0, 4.5, -s.Depth / 2 - 0.15), P.Dark, {
		Material = Enum.Material.DiamondPlate,
	})
	facadeSign(model, base, s, 10.8, 2.6)
end

local function gableRoof(
	model: Model,
	base: CFrame,
	width: number,
	depth: number,
	wallHeight: number,
	roofHeight: number,
	color: Color3
)
	local size = Vector3.new(width + 1.5, roofHeight, depth / 2 + 0.75)
	local y = wallHeight + roofHeight / 2
	wedge(model, "RoofFront", size, at(base, 0, y, -depth / 4 - 0.375), color)
	wedge(model, "RoofBack", size, at(base, 0, y, depth / 4 + 0.375) * CFrame.Angles(0, math.pi, 0), color)
end

function Styles.House(model, base, s)
	local wallHeight = s.Height - 5
	body(model, base, s, wallHeight)
	local roofColor = if luminance(s.Color) > 0.7 then P.Brick else P.Dark
	gableRoof(model, base, s.Width, s.Depth, wallHeight, 5, roofColor)
	door(model, base, s, s.Width / 4, 4, 7)
	for _, x in { -s.Width / 4 } do
		box(model, "WindowFrame", Vector3.new(7, 5, 0.3), at(base, x, 4.6, -s.Depth / 2 - 0.1), s.Accent)
		box(
			model,
			"Window",
			Vector3.new(6, 4, 0.4),
			at(base, x, 4.6, -s.Depth / 2 - 0.15),
			P.Glass,
			{ Reflectance = 0.2 }
		)
	end
	box(model, "Chimney", Vector3.new(3, 5, 3), at(base, -s.Width / 3, wallHeight + 3.5, s.Depth / 4), P.Brick)
	box(model, "Porch", Vector3.new(s.Width * 0.6, 0.4, 4), at(base, 0, 0.2, -s.Depth / 2 - 2), P.Sidewalk)
end

function Styles.Farm(model, base, s)
	Styles.House(model, base, s)
	box(model, "PorchRoof", Vector3.new(s.Width * 0.8, 0.6, 6), at(base, 0, s.Height - 5.5, -s.Depth / 2 - 3), s.Accent)
	for _, x in { -s.Width * 0.38, s.Width * 0.38 } do
		box(
			model,
			"PorchPost",
			Vector3.new(0.8, s.Height - 5.8, 0.8),
			at(base, x, (s.Height - 5.8) / 2, -s.Depth / 2 - 5.6),
			P.Wood,
			{
				Material = Enum.Material.Wood,
			}
		)
	end
end

function Styles.Stadium(model, base, s)
	local standDepth = 30
	local gap = 36
	-- Arquibancada dos fundos (parte alta encostada no muro externo).
	wedge(
		model,
		"StandBack",
		Vector3.new(s.Width, s.Height, standDepth),
		at(base, 0, s.Height / 2, s.Depth / 2 - standDepth / 2),
		s.Color
	)
	-- Arquibancadas da frente, com o portão no meio.
	local frontWidth = (s.Width - gap) / 2
	for _, sign in { -1, 1 } do
		wedge(
			model,
			"StandFront",
			Vector3.new(frontWidth, s.Height, standDepth),
			at(base, sign * (gap / 2 + frontWidth / 2), s.Height / 2, -s.Depth / 2 + standDepth / 2)
				* CFrame.Angles(0, math.pi, 0),
			s.Color
		)
	end
	-- Laterais.
	local sideLength = s.Depth - standDepth * 2
	wedge(
		model,
		"StandRight",
		Vector3.new(sideLength, s.Height, standDepth),
		at(base, s.Width / 2 - standDepth / 2, s.Height / 2, 0) * CFrame.Angles(0, math.pi / 2, 0),
		s.Accent
	)
	wedge(
		model,
		"StandLeft",
		Vector3.new(sideLength, s.Height, standDepth),
		at(base, -s.Width / 2 + standDepth / 2, s.Height / 2, 0) * CFrame.Angles(0, -math.pi / 2, 0),
		s.Accent
	)
	box(
		model,
		"Pitch",
		Vector3.new(s.Width - standDepth * 2, 0.2, s.Depth - standDepth * 2),
		at(base, 0, 0.2, 0),
		Color3.fromRGB(70, 175, 80),
		{
			Material = Enum.Material.Grass,
		}
	)
	box(
		model,
		"PitchLine",
		Vector3.new(s.Width - standDepth * 2, 0.22, 0.8),
		at(base, 0, 0.21, 0),
		P.White,
		{ CastShadow = false }
	)
	for _, cx in { -1, 1 } do
		for _, cz in { -1, 1 } do
			local pole = at(base, cx * (s.Width / 2 - 4), 0, cz * (s.Depth / 2 - 4))
			box(
				model,
				"LightPole",
				Vector3.new(1.6, 42, 1.6),
				pole * CFrame.new(0, 21, 0),
				P.Slate,
				{ Material = Enum.Material.Metal }
			)
			box(model, "LightBank", Vector3.new(8, 4, 2), pole * CFrame.new(0, 42, 0), Color3.fromRGB(255, 250, 230), {
				Material = Enum.Material.Neon,
				CanCollide = false,
			})
		end
	end
	for _, x in { -gap / 2 - 1, gap / 2 + 1 } do
		box(model, "GatePillar", Vector3.new(2, 16, 2), at(base, x, 8, -s.Depth / 2 - 1), s.Accent)
	end
	local arch = box(model, "GateArch", Vector3.new(gap + 4, 4, 2), at(base, 0, 17, -s.Depth / 2 - 1), s.Accent)
	if s.Sign then
		addSurfaceText(arch, Enum.NormalId.Front, s.Sign, contrastText(s.Accent))
	end
end

function Styles.Supermarket(model, base, s)
	body(model, base, s)
	box(
		model,
		"GlassFront",
		Vector3.new(s.Width - 8, 7, 0.4),
		at(base, 0, 4, -s.Depth / 2 - 0.1),
		P.Glass,
		{ Reflectance = 0.25 }
	)
	box(model, "Stripe", Vector3.new(s.Width + 0.3, 3, s.Depth + 0.3), at(base, 0, s.Height - 1.5, 0), s.Accent)
	door(model, base, s, 0, 10, 8)
	facadeSign(model, base, s, s.Height - 5, 4.5)
	-- Estacionamento na frente (entre a fachada e a rua).
	local lotDepth = s.Setback - 8
	if lotDepth > 10 then
		local lotZ = -(s.Depth / 2 + 2 + lotDepth / 2)
		box(
			model,
			"Lot",
			Vector3.new(s.Width, 0.1, lotDepth),
			at(base, 0, 0.15, lotZ),
			P.Asphalt,
			{ Material = Enum.Material.Asphalt }
		)
		local slots = math.floor(s.Width / 10)
		for index = 0, slots do
			local x = -s.Width / 2 + index * (s.Width / slots)
			box(
				model,
				"LotLine",
				Vector3.new(0.35, 0.05, lotDepth * 0.6),
				at(base, x, 0.22, lotZ + lotDepth * 0.2),
				P.LaneWhite,
				{
					CanCollide = false,
					CastShadow = false,
				}
			)
		end
	end
end

function Styles.Containers(model, base, s)
	local rows = math.max(1, math.floor(s.Depth / 10))
	local colors = { s.Color, s.Accent, P.Navy, P.Sunny }
	for row = 0, rows - 1 do
		local z = -s.Depth / 2 + 5 + row * (s.Depth - 10) / math.max(1, rows - 1)
		local stack = if row % 2 == 0 then 2 else 1
		for level = 0, stack - 1 do
			box(
				model,
				"Container",
				Vector3.new(s.Width - 2, 8, 9),
				at(base, 0, 4 + level * 8, z),
				colors[((row + level) % #colors) + 1],
				{
					Material = Enum.Material.CorrodedMetal,
				}
			)
		end
	end
end

function Styles.JunkPile(model, base, s)
	local random = makeRandom(math.floor(s.Width * 7 + s.Height * 13))
	for index = 1, 5 do
		local x = random(-s.Width / 3, s.Width / 3)
		local z = random(-s.Depth / 3, s.Depth / 3)
		local color = if index % 2 == 0 then s.Color else s.Accent
		box(
			model,
			"Wreck",
			Vector3.new(6.5, 3, 11),
			at(base, x, 1.5 + (index % 3) * 2.2, z)
				* CFrame.Angles(random(-0.4, 0.4), random(0, math.pi), random(-0.5, 0.5)),
			color,
			{ Material = Enum.Material.CorrodedMetal }
		)
	end
	for index = 1, 4 do
		local position =
			at(base, random(-s.Width / 2.5, s.Width / 2.5), 0, random(-s.Depth / 2.5, s.Depth / 2.5)).Position
		cylinder(model, "Tire", 1.2, 3.2, position + Vector3.new(0, 1.6 * index / 2, 0), P.Dark)
	end
end

local function buildStyled(parent: Instance, name: string, style: string, base: CFrame, spec: Spec): Model
	local model = newModel(parent, name)
	model:SetAttribute("Style", style)
	local builder = Styles[style] or Styles.Office
	builder(model, base, spec)
	return model
end

--------------------------------------------------------------------------------
-- Terreno, canal e limites
--------------------------------------------------------------------------------

local function buildGround(folder: Folder)
	local half = MapLayout.GroundHalfSize
	local canal = MapLayout.Canal
	local thickness = 16

	local northDepth = canal.ZMin + half
	box(
		folder,
		"GroundNorth",
		Vector3.new(half * 2, thickness, northDepth),
		CFrame.new(0, -thickness / 2, -half + northDepth / 2),
		P.Grass,
		{
			Material = Enum.Material.Grass,
		}
	)
	local southDepth = half - canal.ZMax
	box(
		folder,
		"GroundSouth",
		Vector3.new(half * 2, thickness, southDepth),
		CFrame.new(0, -thickness / 2, canal.ZMax + southDepth / 2),
		P.Grass,
		{
			Material = Enum.Material.Grass,
		}
	)

	local canalWidth = canal.ZMax - canal.ZMin
	local canalCenterZ = (canal.ZMin + canal.ZMax) / 2
	box(
		folder,
		"CanalFloor",
		Vector3.new(half * 2, 2, canalWidth),
		CFrame.new(0, canal.FloorY - 1, canalCenterZ),
		P.CanalFloor,
		{
			Material = Enum.Material.Slate,
		}
	)
	for _, z in { canal.ZMin + 0.5, canal.ZMax - 0.5 } do
		box(
			folder,
			"CanalWall",
			Vector3.new(half * 2, -canal.FloorY, 1),
			CFrame.new(0, canal.FloorY / 2, z),
			P.CanalWall,
			{
				Material = Enum.Material.Cobblestone,
			}
		)
	end
	box(
		folder,
		"CanalWater",
		Vector3.new(canal.XMax - canal.XMin, 0.4, canalWidth - 2),
		CFrame.new(0, canal.WaterY - 0.2, canalCenterZ),
		P.Water,
		{
			Transparency = 0.35,
			Reflectance = 0.15,
			CanCollide = false,
			CastShadow = false,
		}
	)
	-- Escadas (TrussPart) para quem cair a pé no canal conseguir subir.
	for x = -900, 900, 300 do
		for _, z in { canal.ZMin + 2, canal.ZMax - 2 } do
			local truss = Instance.new("TrussPart")
			truss.Name = "CanalLadder"
			truss.Size = Vector3.new(2, 12, 2)
			truss.CFrame = CFrame.new(x, canal.FloorY + 6, z)
			truss.Color = P.Sunny
			applyOptions(truss, { Material = Enum.Material.Metal })
			truss.Parent = folder
		end
	end
end

local function buildBoundaries(folder: Folder)
	local half = MapLayout.PlayableHalfSize + 1
	local height = 120
	for _, spec in
		{
			{ Vector3.new(2, height, half * 2 + 4), Vector3.new(half, height / 2 - 20, 0) },
			{ Vector3.new(2, height, half * 2 + 4), Vector3.new(-half, height / 2 - 20, 0) },
			{ Vector3.new(half * 2 + 4, height, 2), Vector3.new(0, height / 2 - 20, half) },
			{ Vector3.new(half * 2 + 4, height, 2), Vector3.new(0, height / 2 - 20, -half) },
		}
	do
		local wall = box(
			folder,
			"InvisibleWall",
			spec[1],
			CFrame.new(spec[2]),
			P.White,
			{ Transparency = 1, CastShadow = false }
		)
		wall.CanQuery = false
	end
end

--------------------------------------------------------------------------------
-- Ruas
--------------------------------------------------------------------------------

local function marking(folder: Instance, size: Vector3, position: Vector3, color: Color3)
	box(folder, "Marking", size, CFrame.new(position), color, { CanCollide = false, CastShadow = false })
end

-- Faixas pintadas ao longo de um trecho reto de rua.
local function addRoadMarkings(folder: Instance, from: Vector3, to: Vector3, width: number, isHighway: boolean)
	local delta = to - from
	local length = delta.Magnitude
	if length < 1 then
		return
	end
	local direction = delta / length
	local alongX = math.abs(direction.X) > 0.5
	local right = Vector3.new(-direction.Z, 0, direction.X)
	local y = H.Road + 0.025

	local function sizeAlong(len: number, thickness: number): Vector3
		if alongX then
			return Vector3.new(len, 0.05, thickness)
		end
		return Vector3.new(thickness, 0.05, len)
	end

	if isHighway then
		for _, offset in { -0.5, 0.5 } do
			local center = (from + to) / 2 + right * offset
			marking(folder, sizeAlong(length, 0.45), Vector3.new(center.X, y, center.Z), P.LaneYellow)
		end
	end

	local dash, gap = 10, 12
	local lanes: { number } = if isHighway then { -width / 4, width / 4 } else { 0 }
	local color = if isHighway then P.LaneWhite else P.LaneYellow
	for _, offset in lanes do
		local t = gap / 2
		while t + dash <= length do
			local center = from + direction * (t + dash / 2) + right * offset
			marking(folder, sizeAlong(dash, 0.6), Vector3.new(center.X, y, center.Z), color)
			t += dash + gap
		end
	end
end

local function roadSegment(
	folder: Instance,
	name: string,
	from: Vector3,
	to: Vector3,
	width: number,
	isHighway: boolean
)
	local delta = to - from
	local length = delta.Magnitude
	if length < 0.5 then
		return
	end
	local center = (from + to) / 2
	local alongX = math.abs(delta.X) > math.abs(delta.Z)
	local size = if alongX then Vector3.new(length, H.Road, width) else Vector3.new(width, H.Road, length)
	box(folder, name, size, CFrame.new(center.X, H.Road / 2, center.Z), if isHighway then P.Highway else P.Road, {
		Material = Enum.Material.Asphalt,
	})
	addRoadMarkings(folder, from, to, width, isHighway)
end

local function railing(folder: Instance, from: Vector3, to: Vector3, baseY: number)
	local delta = to - from
	local length = delta.Magnitude
	local center = (from + to) / 2
	local alongX = math.abs(delta.X) > math.abs(delta.Z)
	local size = if alongX then Vector3.new(length, 3, 0.8) else Vector3.new(0.8, 3, length)
	box(
		folder,
		"Railing",
		size,
		CFrame.new(center.X, baseY + 1.5, center.Z),
		P.White,
		{ Material = Enum.Material.Metal }
	)
end

local function buildRoads(folder: Folder, props: Folder)
	local xs, zs = MapLayout.Grid.Xs, MapLayout.Grid.Zs
	local canal = MapLayout.Canal
	local ring = MapLayout.RingCoordinate

	-- Cruzamentos
	for _, x in xs do
		for _, z in zs do
			local isHighway = math.abs(x) == ring or math.abs(z) == ring
			local size = Vector3.new(MapLayout.RoadWidth(x), H.Road, MapLayout.RoadWidth(z))
			box(folder, "Intersection", size, CFrame.new(x, H.Road / 2, z), if isHighway then P.Highway else P.Road, {
				Material = Enum.Material.Asphalt,
			})
		end
	end

	-- Trechos leste-oeste
	for _, z in zs do
		local width = MapLayout.RoadWidth(z)
		local isHighway = math.abs(z) == ring
		for i = 1, #xs - 1 do
			local fromX = xs[i] + MapLayout.RoadWidth(xs[i]) / 2
			local toX = xs[i + 1] - MapLayout.RoadWidth(xs[i + 1]) / 2
			roadSegment(folder, "Road", Vector3.new(fromX, H.Road, z), Vector3.new(toX, H.Road, z), width, isHighway)
		end
	end

	-- Trechos norte-sul (alguns atravessam o canal)
	for _, x in xs do
		local width = MapLayout.RoadWidth(x)
		local isHighway = math.abs(x) == ring
		for j = 1, #zs - 1 do
			local fromZ = zs[j] + MapLayout.RoadWidth(zs[j]) / 2
			local toZ = zs[j + 1] - MapLayout.RoadWidth(zs[j + 1]) / 2
			local crossing: string? = nil
			if zs[j] == MapLayout.CanalCrossingFrom and zs[j + 1] == MapLayout.CanalCrossingTo then
				crossing = MapLayout.CanalCrossings[x] or "Full"
			end
			if crossing == nil or crossing == "Full" then
				roadSegment(
					folder,
					"Road",
					Vector3.new(x, H.Road, fromZ),
					Vector3.new(x, H.Road, toZ),
					width,
					isHighway
				)
			else
				roadSegment(
					folder,
					"Road",
					Vector3.new(x, H.Road, fromZ),
					Vector3.new(x, H.Road, canal.ZMin),
					width,
					isHighway
				)
				roadSegment(
					folder,
					"Road",
					Vector3.new(x, H.Road, canal.ZMax),
					Vector3.new(x, H.Road, toZ),
					width,
					isHighway
				)
			end

			local canalWidth = canal.ZMax - canal.ZMin
			local canalCenter = (canal.ZMin + canal.ZMax) / 2
			if crossing == "Full" then
				box(
					props,
					"BridgeDeck",
					Vector3.new(width, 1.6, canalWidth),
					CFrame.new(x, -0.8, canalCenter),
					P.CanalWall,
					{
						Material = Enum.Material.Concrete,
					}
				)
				for _, side in { -1, 1 } do
					local railX = x + side * (width / 2 - 0.4)
					railing(props, Vector3.new(railX, 0, canal.ZMin - 2), Vector3.new(railX, 0, canal.ZMax + 2), H.Road)
					box(
						props,
						"BridgePillar",
						Vector3.new(3, -canal.FloorY - 1.6, 3),
						CFrame.new(x + side * width / 3, (canal.FloorY - 1.6) / 2, canalCenter),
						P.CanalWall,
						{
							Material = Enum.Material.Concrete,
						}
					)
				end
			elseif crossing == "Narrow" then
				-- Pinguela: estreita e sem grade. Quem errar cai no canal.
				local plankWidth = MapLayout.NarrowBridgeWidth
				box(
					props,
					"Pinguela",
					Vector3.new(plankWidth, H.Road, canalWidth + 2),
					CFrame.new(x, H.Road / 2, canalCenter),
					P.Wood,
					{
						Material = Enum.Material.WoodPlanks,
					}
				)
				box(
					props,
					"PinguelaBeam",
					Vector3.new(plankWidth - 2, 1.2, canalWidth + 2),
					CFrame.new(x, -0.6, canalCenter),
					P.Wood,
					{
						Material = Enum.Material.Wood,
					}
				)
				for _, entry in { { canal.ZMin - 14, -1 }, { canal.ZMax + 14, 1 } } do
					local z, dir = entry[1], entry[2]
					signPost(
						props,
						Vector3.new(x + width / 2 - 3, H.Road, z),
						Vector3.new(0, 0, dir),
						"⚠️ PINGUELA ESTREITA",
						P.Sunny,
						14
					)
					cone(props, Vector3.new(x - plankWidth / 2 - 4, H.Road, z + dir * 8))
					cone(props, Vector3.new(x + plankWidth / 2 + 4, H.Road, z + dir * 8))
				end
			end
		end
	end

	-- Faixas de pedestre em volta da praça central
	for _, node in { Vector2.new(-160, -160), Vector2.new(160, -160), Vector2.new(160, 160), Vector2.new(-160, 160) } do
		local halfX = MapLayout.RoadWidth(node.X) / 2
		local halfZ = MapLayout.RoadWidth(node.Y) / 2
		for _, dir in { Vector2.new(1, 0), Vector2.new(-1, 0), Vector2.new(0, 1), Vector2.new(0, -1) } do
			local alongX = dir.X ~= 0
			local roadWidth = if alongX then MapLayout.RoadWidth(node.Y) else MapLayout.RoadWidth(node.X)
			local distance = (if alongX then halfX else halfZ) + 4
			local center = Vector2.new(node.X, node.Y) + dir * distance
			local stripes = math.floor(roadWidth / 4)
			for index = 0, stripes - 1 do
				local offset = -roadWidth / 2 + 2 + index * 4
				local position = if alongX
					then Vector3.new(center.X, H.Road + 0.03, center.Y + offset)
					else Vector3.new(center.X + offset, H.Road + 0.03, center.Y)
				local size = if alongX then Vector3.new(5, 0.06, 1.8) else Vector3.new(1.8, 0.06, 5)
				marking(folder, size, position, P.LaneWhite)
			end
		end
	end
end

--------------------------------------------------------------------------------
-- Quarteirões
--------------------------------------------------------------------------------

local THEMES: { [string]: { Color: Color3, Material: Enum.Material } } = {
	Grass = { Color = P.Grass, Material = Enum.Material.Grass },
	Plaza = { Color = P.Plaza, Material = Enum.Material.Pavement },
	Asphalt = { Color = P.Asphalt, Material = Enum.Material.Asphalt },
	Dirt = { Color = P.Dirt, Material = Enum.Material.Ground },
}

local function buildBlocks(folder: Folder, props: Folder)
	local sidewalk = MapLayout.SidewalkWidth
	local canal = MapLayout.Canal
	for _, block in MapLayout.GetBlocks() do
		local width = block.XMax - block.XMin
		local depth = block.ZMax - block.ZMin
		local centerX = (block.XMin + block.XMax) / 2
		local centerZ = (block.ZMin + block.ZMax) / 2
		local base = box(
			folder,
			"Block_" .. block.Key,
			Vector3.new(width, H.Block, depth),
			CFrame.new(centerX, H.Block / 2, centerZ),
			P.Sidewalk,
			{
				Material = Enum.Material.Concrete,
			}
		)
		base:SetAttribute("Theme", block.Theme)

		local theme = THEMES[block.Theme]
		if theme then
			box(
				folder,
				"Lot_" .. block.Key,
				Vector3.new(width - sidewalk * 2, H.Lot - H.Block, depth - sidewalk * 2),
				CFrame.new(centerX, (H.Block + H.Lot) / 2, centerZ),
				theme.Color,
				{
					Material = theme.Material,
				}
			)
		end

		-- Grade na beira do canal.
		if block.ZMax == canal.ZMin then
			railing(
				props,
				Vector3.new(block.XMin, 0, block.ZMax - 0.5),
				Vector3.new(block.XMax, 0, block.ZMax - 0.5),
				H.Block
			)
		elseif block.ZMin == canal.ZMax then
			railing(
				props,
				Vector3.new(block.XMin, 0, block.ZMin + 0.5),
				Vector3.new(block.XMax, 0, block.ZMin + 0.5),
				H.Block
			)
		end
	end

	-- Grade do canal fora do anel rodoviário (campo).
	local ringOuter = MapLayout.RingCoordinate + MapLayout.RingWidth / 2
	for _, side in { -1, 1 } do
		local fromX = side * ringOuter
		local toX = side * MapLayout.PlayableHalfSize
		for _, z in { canal.ZMin - 0.5, canal.ZMax + 0.5 } do
			railing(props, Vector3.new(fromX, 0, z), Vector3.new(toX, 0, z), H.Ground)
		end
	end
end

--------------------------------------------------------------------------------
-- Locais de entrega e prédios
--------------------------------------------------------------------------------

local function buildLocations(locationsFolder: Folder, buildingsFolder: Folder, props: Folder)
	for _, loc in MapLayout.Locations do
		local center = MapLayout.GetBuildingCenter(loc)
		local base = CFrame.new(center.X, loc.Position.Y, center.Z) * CFrame.Angles(0, YAW[loc.Facing], 0)
		local spec: Spec = {
			Width = loc.Building.Width,
			Depth = loc.Building.Depth,
			Height = loc.Building.Height,
			Color = loc.Building.Color,
			Accent = loc.Building.Accent,
			Sign = loc.Building.Sign,
			Setback = loc.Building.Setback,
		}
		local model = buildStyled(buildingsFolder, loc.Id, loc.Building.Style, base, spec)
		model:SetAttribute("LocationId", loc.Id)

		-- Marca no chão do ponto de coleta/entrega (visível para todos).
		local color = if loc.Pickup then P.Sunny else P.Sky
		local pad = Instance.new("Part")
		pad.Name = loc.Id
		pad.Shape = Enum.PartType.Cylinder
		pad.Size = Vector3.new(0.12, 22, 22)
		pad.CFrame = CFrame.new(loc.Position.X, loc.Position.Y + 0.08, loc.Position.Z)
			* CFrame.Angles(0, 0, math.pi / 2)
		pad.Color = color
		applyOptions(pad, { Material = Enum.Material.Neon, Transparency = 0.6, CanCollide = false, CastShadow = false })
		pad:SetAttribute("LocationId", loc.Id)
		pad:SetAttribute("DisplayName", loc.Name)
		pad:SetAttribute("Icon", loc.Icon)
		pad.Parent = locationsFolder

		-- Placa com o nome (para quem não tem letreiro na fachada).
		if not loc.Building.Sign then
			local facing = MapLayout.FacingVectors[loc.Facing]
			local side = Vector3.new(-facing.Z, 0, facing.X)
			signPost(props, loc.Position + side * 9 - facing * 1, facing, loc.Icon .. " " .. loc.Name, P.White, 12)
		end
	end

	for index, filler in MapLayout.Fillers do
		local base = CFrame.new(filler.Center.X, H.Block, filler.Center.Y) * CFrame.Angles(0, YAW[filler.Facing], 0)
		buildStyled(buildingsFolder, "Filler_" .. index, filler.Style, base, {
			Width = filler.Width,
			Depth = filler.Depth,
			Height = filler.Height,
			Color = filler.Color,
			Accent = filler.Accent,
			Sign = nil,
			Setback = 0,
		})
	end
end

--------------------------------------------------------------------------------
-- Áreas especiais
--------------------------------------------------------------------------------

local function buildHQ(buildingsFolder: Folder, props: Folder, map: Folder)
	local hq = MapLayout.HQ
	local base = CFrame.new(hq.Center) * CFrame.Angles(0, YAW[hq.Facing], 0)
	local spec: Spec = {
		Width = hq.Width,
		Depth = hq.Depth,
		Height = hq.Height,
		Color = P.Navy,
		Accent = P.Sunny,
		Sign = "📦 CENTRAL DE ENTREGAS",
		Setback = 0,
	}
	local model = buildStyled(buildingsFolder, "CentralDeEntregas", "Office", base, spec)
	-- Caixa gigante no telhado: a marca da firma.
	box(model, "GiantBox", Vector3.new(16, 11, 16), at(base, 0, hq.Height + 6.5, 0), Color3.fromRGB(196, 146, 92))
	box(model, "GiantBoxTape", Vector3.new(16.3, 11.3, 2.4), at(base, 0, hq.Height + 6.5, 0), P.Sunny)

	local area = hq.ParkingArea
	local lotCenter = Vector3.new((area.XMin + area.XMax) / 2, (H.Block + H.Lot) / 2, (area.ZMin + area.ZMax) / 2)
	box(
		props,
		"ParkingLot",
		Vector3.new(area.XMax - area.XMin, H.Lot - H.Block, area.ZMax - area.ZMin),
		CFrame.new(lotCenter),
		P.Asphalt,
		{
			Material = Enum.Material.Asphalt,
		}
	)
	for index = -4, 5 do
		local x = index * 24 - 12
		marking(props, Vector3.new(0.4, 0.05, 12), Vector3.new(x, H.Lot + 0.03, 110), P.LaneWhite)
	end
	local logo = box(props, "LotLogo", Vector3.new(44, 0.05, 7), CFrame.new(0, H.Lot + 0.03, 124), P.Asphalt, {
		CanCollide = false,
		CastShadow = false,
	})
	addSurfaceText(logo, Enum.NormalId.Top, "ENTREGA IMPOSSÍVEL", P.Sunny)

	local spawnInfo = MapLayout.Spawn
	local spawnLocation = Instance.new("SpawnLocation")
	spawnLocation.Name = "SpawnLocation"
	spawnLocation.Size = spawnInfo.Size
	spawnLocation.CFrame = CFrame.new(spawnInfo.Position + Vector3.new(0, spawnInfo.Size.Y / 2, 0))
	spawnLocation.Color = P.Sunny
	spawnLocation.Neutral = true
	spawnLocation.Duration = 0
	applyOptions(spawnLocation, { Material = Enum.Material.SmoothPlastic })
	spawnLocation.Parent = map
end

local function buildPlaza(props: Folder)
	local plaza = MapLayout.Plaza
	local c = plaza.FountainCenter
	local r = plaza.FountainRadius
	cylinder(
		props,
		"FountainBase",
		1.6,
		r * 2,
		c + Vector3.new(0, 0.8, 0),
		P.CanalWall,
		{ Material = Enum.Material.Cobblestone }
	)
	cylinder(props, "FountainWater", 0.3, r * 2 - 3, c + Vector3.new(0, 1.55, 0), P.Water, {
		Material = Enum.Material.Neon,
		Transparency = 0.3,
		CanCollide = false,
	})
	cylinder(props, "FountainColumn", 7, 2.5, c + Vector3.new(0, 3.5, 0), P.Cream)
	local bowl = cylinder(props, "FountainBowl", 0.8, 10, c + Vector3.new(0, 7.2, 0), P.Cream)
	local jet = Instance.new("ParticleEmitter")
	jet.Name = "WaterJet"
	jet.Color = ColorSequence.new(Color3.fromRGB(170, 225, 255))
	jet.LightEmission = 0.3
	jet.Size = NumberSequence.new(0.5, 0.2)
	jet.Transparency = NumberSequence.new(0.2, 1)
	jet.Lifetime = NumberRange.new(1, 1.4)
	jet.Rate = 35
	jet.Speed = NumberRange.new(14, 18)
	jet.SpreadAngle = Vector2.new(10, 10)
	jet.Acceleration = Vector3.new(0, -30, 0)
	jet.EmissionDirection = Enum.NormalId.Right -- o eixo X local do cilindro aponta para cima
	jet.Parent = bowl

	local random = makeRandom(77)
	for index = 0, 3 do
		local angle = index * math.pi / 2 + math.pi / 4
		local position = c + Vector3.new(math.cos(angle) * (r + 10), 0, math.sin(angle) * (r + 10))
		box(
			props,
			"Bench",
			Vector3.new(6, 1.6, 2),
			CFrame.lookAt(position + Vector3.new(0, 0.8, 0), c + Vector3.new(0, 0.8, 0)),
			P.Wood,
			{
				Material = Enum.Material.Wood,
			}
		)
	end
	for index = 0, 7 do
		local angle = index * math.pi / 4
		local position = c + Vector3.new(math.cos(angle) * (r + 24), 0, math.sin(angle) * (r + 18))
		tree(props, Vector3.new(position.X, H.Lot, position.Z), 1.1, index)
	end
	for _, x in { -58, 58 } do
		for index = 0, 2 do
			local flowerBed = Vector3.new(x, H.Lot, -40 + index * 22)
			box(
				props,
				"FlowerBed",
				Vector3.new(8, 1, 4),
				CFrame.new(flowerBed + Vector3.new(0, 0.5, 0)),
				P.Dirt,
				{ Material = Enum.Material.Ground }
			)
			for flower = -1, 1 do
				local color = TREE_GREENS[1]:Lerp(P.Pink, random(0.4, 1))
				ball(props, "Flower", 1.6, flowerBed + Vector3.new(flower * 2.4, 1.6, 0), color, { CanCollide = false })
			end
		end
	end
end

-- Mirante do Canal: pracinha à beira d'água com bancos virados para o canal.
local function buildMirante(props: Folder, nature: Folder)
	local canal = MapLayout.Canal
	for index = 0, 5 do
		local x = -110 + index * 44
		tree(nature, Vector3.new(x, H.Lot, 205), 1.2, index + 3)
		local bench = Vector3.new(x + 22, H.Lot + 0.8, canal.ZMin - 8)
		box(props, "Bench", Vector3.new(6, 1.6, 2), CFrame.lookAt(bench, bench + Vector3.new(0, 0, 1)), P.Wood, {
			Material = Enum.Material.Wood,
		})
	end
	local deck =
		box(props, "LookoutDeck", Vector3.new(30, 0.4, 14), CFrame.new(0, H.Lot + 0.2, canal.ZMin - 16), P.Wood, {
			Material = Enum.Material.WoodPlanks,
		})
	deck.CastShadow = false
	signPost(props, Vector3.new(-20, H.Block, 188), Vector3.new(0, 0, -1), "🌅 MIRANTE DO CANAL", P.Teal, 14)
end

local function dumpster(parent: Instance, position: Vector3)
	box(
		parent,
		"Dumpster",
		Vector3.new(7, 5, 4.5),
		CFrame.new(position + Vector3.new(0, 2.5, 0)),
		Color3.fromRGB(40, 120, 70),
		{
			Material = Enum.Material.Metal,
		}
	)
	box(
		parent,
		"DumpsterLid",
		Vector3.new(7.3, 0.5, 4.8),
		CFrame.new(position + Vector3.new(0, 5.25, 0)),
		Color3.fromRGB(30, 90, 55)
	)
end

local function buildAlleys(props: Folder, obstacles: Folder)
	for _, alley in MapLayout.Alleys do
		for index, position in alley.Obstacles do
			dumpster(props, position)
			barrel(
				obstacles,
				position + Vector3.new(if index % 2 == 0 then 5 else -5, 0, if index % 2 == 0 then -5 else 5),
				true
			)
		end
		local area = alley.Area
		local alongX = (area.XMax - area.XMin) > (area.ZMax - area.ZMin)
		if alongX then
			local z = (area.ZMin + area.ZMax) / 2
			signPost(
				props,
				Vector3.new(area.XMin + 3, H.Block, area.ZMin - 3),
				Vector3.new(-1, 0, 0),
				"↔ " .. alley.Name,
				P.Orange,
				12
			)
			signPost(
				props,
				Vector3.new(area.XMax - 3, H.Block, area.ZMax + 3),
				Vector3.new(1, 0, 0),
				"↔ " .. alley.Name,
				P.Orange,
				12
			)
			box(
				props,
				"AlleyFloor",
				Vector3.new(area.XMax - area.XMin, 0.1, area.ZMax - area.ZMin),
				CFrame.new((area.XMin + area.XMax) / 2, H.Lot - 0.05, z),
				P.Asphalt,
				{
					Material = Enum.Material.Asphalt,
				}
			)
		else
			local x = (area.XMin + area.XMax) / 2
			signPost(
				props,
				Vector3.new(area.XMax + 3, H.Block, area.ZMin + 3),
				Vector3.new(0, 0, -1),
				"↕ " .. alley.Name,
				P.Orange,
				12
			)
			signPost(
				props,
				Vector3.new(area.XMin - 3, H.Block, area.ZMax - 3),
				Vector3.new(0, 0, 1),
				"↕ " .. alley.Name,
				P.Orange,
				12
			)
			box(
				props,
				"AlleyFloor",
				Vector3.new(area.XMax - area.XMin, 0.1, area.ZMax - area.ZMin),
				CFrame.new(x, H.Lot - 0.05, (area.ZMin + area.ZMax) / 2),
				P.Asphalt,
				{
					Material = Enum.Material.Asphalt,
				}
			)
		end
	end
end

local function speedBump(parent: Instance, position: Vector3, axis: string, width: number)
	local size = Vector3.new(width, 0.5, 2.5)
	local y = position.Y + 0.25
	if axis == "X" then
		wedge(
			parent,
			"SpeedBump",
			size,
			CFrame.new(position.X - 1.25, y, position.Z) * CFrame.Angles(0, math.pi / 2, 0),
			P.Sunny
		)
		wedge(
			parent,
			"SpeedBump",
			size,
			CFrame.new(position.X + 1.25, y, position.Z) * CFrame.Angles(0, -math.pi / 2, 0),
			P.Sunny
		)
	else
		wedge(parent, "SpeedBump", size, CFrame.new(position.X, y, position.Z - 1.25), P.Sunny)
		wedge(
			parent,
			"SpeedBump",
			size,
			CFrame.new(position.X, y, position.Z + 1.25) * CFrame.Angles(0, math.pi, 0),
			P.Sunny
		)
	end
end

local function buildPark(props: Folder, obstacles: Folder)
	local trail = MapLayout.ParkTrail
	local from, to = trail.From, trail.To
	local delta = to - from
	local length = delta.Magnitude
	local direction = delta.Unit
	local center = (from + to) / 2
	box(
		props,
		"ParkTrail",
		Vector3.new(trail.Width, 0.12, length),
		CFrame.lookAt(center, center + direction) + Vector3.new(0, 0.05, 0),
		P.Dirt,
		{
			Material = Enum.Material.Ground,
		}
	)
	local trailYaw = math.atan2(-direction.X, -direction.Z)
	for _, t in { 0.3, 0.55, 0.8 } do
		local p = from + direction * (length * t)
		local frame = CFrame.new(p.X, H.Lot + 0.1, p.Z) * CFrame.Angles(0, trailYaw, 0)
		local size = Vector3.new(trail.Width, 0.8, 2.2)
		wedge(props, "TrailBump", size, frame * CFrame.new(0, 0.4, 1.1), P.Dirt, { Material = Enum.Material.Ground })
		wedge(props, "TrailBump", size, frame * CFrame.new(0, 0.4, -1.1) * CFrame.Angles(0, math.pi, 0), P.Dirt, {
			Material = Enum.Material.Ground,
		})
	end
	local right = Vector3.new(-direction.Z, 0, direction.X)
	for _, entry in { { 0.42, 3.5 }, { 0.68, -3.5 } } do
		local p = from + direction * (length * entry[1]) + right * entry[2]
		box(
			props,
			"Rock",
			Vector3.new(5, 3.2, 4.5),
			CFrame.new(p.X, H.Lot + 1.4, p.Z) * CFrame.Angles(0.2, entry[1] * 9, 0.15),
			P.Slate,
			{
				Material = Enum.Material.Slate,
			}
		)
	end
	for _, t in { 0.2, 0.62 } do
		barrel(obstacles, from + direction * (length * t) + right * -2, true)
	end

	local pondCenter = Vector3.new(650, H.Lot, -50)
	cylinder(
		props,
		"PondRim",
		1.2,
		44,
		pondCenter + Vector3.new(0, 0.6, 0),
		P.CanalWall,
		{ Material = Enum.Material.Cobblestone }
	)
	cylinder(props, "PondWater", 0.3, 40, pondCenter + Vector3.new(0, 1.1, 0), P.Water, {
		Transparency = 0.25,
		Reflectance = 0.2,
		CanCollide = false,
	})

	-- Árvores espalhadas, longe da trilha, do lago e do quiosque.
	local random = makeRandom(1234)
	local kiosk = MapLayout.GetLocation("Parque")
	local blockMin = Vector2.new(512, -128)
	local blockMax = Vector2.new(720, 128)
	local index = 0
	for x = blockMin.X, blockMax.X, 26 do
		for z = blockMin.Y, blockMax.Y, 26 do
			local px = x + random(-6, 6)
			local pz = z + random(-6, 6)
			local point = Vector3.new(px, H.Lot, pz)
			local along = math.clamp((point - from):Dot(direction), 0, length)
			local distanceToTrail = flatDistance(point, from + direction * along)
			local nearKiosk = kiosk and flatDistance(point, kiosk.Position) < 26
			if distanceToTrail > 14 and flatDistance(point, pondCenter) > 30 and not nearKiosk then
				index += 1
				tree(props, point, random(0.9, 1.4), index)
			end
		end
	end
	for _, t in { 0.25, 0.5, 0.75 } do
		local p = from + direction * (length * t) + right * 11
		box(
			props,
			"Bench",
			Vector3.new(6, 1.6, 2),
			CFrame.lookAt(p + Vector3.new(0, 0.8, 0), p + Vector3.new(0, 0.8, 0) - right) + Vector3.new(0, 0.1, 0),
			P.Wood,
			{
				Material = Enum.Material.Wood,
			}
		)
	end
end

local function buildConstruction(props: Folder, obstacles: Folder)
	local zone = MapLayout.ConstructionZone
	local craneBase = Vector3.new(420, H.Lot, 245)
	box(
		props,
		"CraneBase",
		Vector3.new(8, 2, 8),
		CFrame.new(craneBase + Vector3.new(0, 1, 0)),
		P.Slate,
		{ Material = Enum.Material.Concrete }
	)
	local mast = Instance.new("TrussPart")
	mast.Name = "CraneMast"
	mast.Size = Vector3.new(2, 60, 2)
	mast.CFrame = CFrame.new(craneBase + Vector3.new(0, 32, 0))
	mast.Color = P.Sunny
	applyOptions(mast, { Material = Enum.Material.Metal })
	mast.Parent = props
	box(
		props,
		"CraneJib",
		Vector3.new(76, 2, 2),
		CFrame.new(craneBase + Vector3.new(-26, 63, 0)),
		P.Sunny,
		{ Material = Enum.Material.Metal }
	)
	box(props, "CraneWeight", Vector3.new(6, 4, 4), CFrame.new(craneBase + Vector3.new(10, 61, 0)), P.Slate)
	box(
		props,
		"CraneCable",
		Vector3.new(0.3, 24, 0.3),
		CFrame.new(craneBase + Vector3.new(-56, 50, 0)),
		P.Dark,
		{ CanCollide = false }
	)
	box(props, "CraneLoad", Vector3.new(10, 1.2, 1.6), CFrame.new(craneBase + Vector3.new(-56, 37.4, 0)), P.Orange)

	for _, pile in { Vector3.new(300, H.Lot, 255), Vector3.new(340, H.Lot, 212) } do
		wedge(
			props,
			"SandPile",
			Vector3.new(14, 6, 7),
			CFrame.new(pile + Vector3.new(0, 3, -3.5)) * CFrame.Angles(0, math.pi, 0),
			P.Sunny:Lerp(P.Dirt, 0.4),
			{
				Material = Enum.Material.Sand,
			}
		)
		wedge(
			props,
			"SandPile",
			Vector3.new(14, 6, 7),
			CFrame.new(pile + Vector3.new(0, 3, 3.5)),
			P.Sunny:Lerp(P.Dirt, 0.4),
			{
				Material = Enum.Material.Sand,
			}
		)
	end
	for level = 0, 2 do
		box(
			props,
			"SteelBeam",
			Vector3.new(22, 1, 1.6),
			CFrame.new(240, H.Lot + 0.5 + level, 262 + (level % 2) * 0.6),
			P.Coral,
			{ Material = Enum.Material.Metal }
		)
	end
	box(props, "SiteOffice", Vector3.new(20, 8, 8), CFrame.new(380, H.Lot + 4, 200), P.Sunny)
	signPost(
		props,
		Vector3.new(zone.XMin + 6, H.Block, zone.ZMin + 6),
		Vector3.new(-1, 0, 0),
		"🚧 OBRA — CUIDADO",
		P.Orange,
		14
	)

	for _, p in
		{
			Vector3.new(222, H.Lot, 196),
			Vector3.new(262, H.Lot, 206),
			Vector3.new(318, H.Lot, 232),
			Vector3.new(352, H.Lot, 268),
			Vector3.new(272, H.Lot, 280),
			Vector3.new(446, H.Lot, 212),
		}
	do
		barrel(obstacles, p, true)
	end
	for z = zone.ZMin + 10, zone.ZMax - 10, 16 do
		cone(obstacles, Vector3.new(zone.XMin + 4, H.Block, z))
	end
end

-- Liga/desliga um atalho: partes "Closed" somem e partes "Open" aparecem (e vice-versa).
function MapBuilder.SetShortcutOpen(shortcut: Instance, open: boolean)
	local closedFolder = shortcut:FindFirstChild("ClosedParts")
	local openFolder = shortcut:FindFirstChild("OpenParts")
	local function apply(folder: Instance?, visible: boolean)
		if not folder then
			return
		end
		for _, descendant in folder:GetDescendants() do
			if descendant:IsA("BasePart") then
				local visibleTransparency = descendant:GetAttribute("VisibleTransparency")
				local visibleCanCollide = descendant:GetAttribute("VisibleCanCollide")
				descendant.Transparency = if visible
					then (if type(visibleTransparency) == "number" then visibleTransparency else 0)
					else 1
				local collide = visible and visibleCanCollide == true
				descendant.CanCollide = collide
				descendant.CanQuery = collide
				descendant.CanTouch = collide
			elseif descendant:IsA("SurfaceGui") then
				descendant.Enabled = visible
			elseif descendant:IsA("BillboardGui") then
				descendant.Enabled = visible
			end
		end
	end
	apply(closedFolder, not open)
	apply(openFolder, open)
	shortcut:SetAttribute("IsOpen", open)
end

local function registerToggle(part: BasePart)
	part:SetAttribute("VisibleTransparency", part.Transparency)
	part:SetAttribute("VisibleCanCollide", part.CanCollide)
end

local function stripedBarrier(parent: Instance, center: Vector3, length: number, alongX: boolean, height: number)
	local segments = math.max(2, math.floor(length / 8))
	local segmentLength = length / segments
	for index = 0, segments - 1 do
		local offset = -length / 2 + segmentLength * (index + 0.5)
		local position = if alongX then center + Vector3.new(offset, 0, 0) else center + Vector3.new(0, 0, offset)
		local size = if alongX then Vector3.new(segmentLength, height, 1.2) else Vector3.new(1.2, height, segmentLength)
		local part = box(parent, "Barrier", size, CFrame.new(position), if index % 2 == 0 then P.Orange else P.White)
		registerToggle(part)
	end
end

local function buildShortcuts(folder: Folder, props: Folder)
	local canal = MapLayout.Canal
	for _, spec in MapLayout.Shortcuts do
		local model = newModel(folder, spec.Id)
		model:SetAttribute("DisplayName", spec.DisplayName)
		local closed = newFolder(model, "ClosedParts")
		local open = newFolder(model, "OpenParts")

		if spec.Id == "PonteObra" then
			local x = spec.Center.X
			local width = MapLayout.RoadWidth(x)
			for _, entry in { { canal.ZMin - 4, -1 }, { canal.ZMax + 4, 1 } } do
				local z, dir = entry[1], entry[2]
				stripedBarrier(closed, Vector3.new(x, H.Road + 2, z), width, true, 4)
				local signCenter = Vector3.new(x, H.Road + 8, z)
				local board = box(
					closed,
					"ClosedSign",
					Vector3.new(20, 4, 0.5),
					CFrame.lookAt(signCenter, signCenter + Vector3.new(0, 0, dir)),
					P.Orange
				)
				addSurfaceText(board, Enum.NormalId.Front, "🚧 PONTE EM OBRAS", P.Dark)
				addSurfaceText(board, Enum.NormalId.Back, "🚧 PONTE EM OBRAS", P.Dark)
				registerToggle(board)
				for _, side in { -1, 1 } do
					local post = box(
						closed,
						"ClosedSignPost",
						Vector3.new(0.6, 8, 0.6),
						CFrame.new(x + side * 9, H.Road + 4, z),
						P.Slate
					)
					registerToggle(post)
				end
			end
			local canalWidth = canal.ZMax - canal.ZMin
			local canalCenter = (canal.ZMin + canal.ZMax) / 2
			local deck = box(
				open,
				"BridgeDeck",
				Vector3.new(width, 0.8, canalWidth),
				CFrame.new(x, H.Road - 0.4, canalCenter),
				Color3.fromRGB(96, 100, 112),
				{
					Material = Enum.Material.DiamondPlate,
				}
			)
			registerToggle(deck)
			for _, side in { -1, 1 } do
				local rail = box(
					open,
					"BridgeRail",
					Vector3.new(0.8, 3, canalWidth),
					CFrame.new(x + side * (width / 2 - 0.4), H.Road + 1.5, canalCenter),
					P.Sunny,
					{
						Material = Enum.Material.Metal,
					}
				)
				registerToggle(rail)
				local glow = box(
					open,
					"BridgeGlow",
					Vector3.new(0.6, 0.1, canalWidth),
					CFrame.new(x + side * (width / 2 - 3), H.Road + 0.05, canalCenter),
					P.Mint,
					{
						Material = Enum.Material.Neon,
						CanCollide = false,
						CastShadow = false,
					}
				)
				registerToggle(glow)
			end
		elseif spec.Id == "PortaoShopping" then
			local lot = MapLayout.ShoppingLot
			local area = lot.Area
			local gateLength = lot.GateZMax - lot.GateZMin
			local gateCenterZ = (lot.GateZMin + lot.GateZMax) / 2
			for _, x in { area.XMin + 1, area.XMax - 1 } do
				stripedBarrier(closed, Vector3.new(x, H.Block + 2.5, gateCenterZ), gateLength, false, 5)
				local center = Vector3.new(x, H.Block + 6.5, gateCenterZ)
				local board = box(closed, "GateSign", Vector3.new(0.5, 3, 16), CFrame.new(center), P.Dark)
				addSurfaceText(board, Enum.NormalId.Left, "🔒 PORTÃO FECHADO", P.Sunny)
				addSurfaceText(board, Enum.NormalId.Right, "🔒 PORTÃO FECHADO", P.Sunny)
				registerToggle(board)
			end
			for _, offset in { -6, 6 } do
				local glow = box(
					open,
					"GateGlow",
					Vector3.new(area.XMax - area.XMin - 6, 0.1, 0.8),
					CFrame.new((area.XMin + area.XMax) / 2, H.Lot + 0.05, gateCenterZ + offset),
					P.Mint,
					{
						Material = Enum.Material.Neon,
						CanCollide = false,
						CastShadow = false,
					}
				)
				registerToggle(glow)
			end
		end

		MapBuilder.SetShortcutOpen(model, false)
	end

	-- Muros e carros estacionados do estacionamento do shopping (fixos).
	local lot = MapLayout.ShoppingLot
	local area = lot.Area
	local wallHeight = 5
	local wallY = H.Block + wallHeight / 2
	for _, z in { area.ZMin + 0.6, area.ZMax - 0.6 } do
		box(
			props,
			"LotWall",
			Vector3.new(area.XMax - area.XMin, wallHeight, 1.2),
			CFrame.new((area.XMin + area.XMax) / 2, wallY, z),
			P.Pink
		)
	end
	for _, x in { area.XMin + 1, area.XMax - 1 } do
		local northLength = lot.GateZMin - area.ZMin
		local southLength = area.ZMax - lot.GateZMax
		box(
			props,
			"LotWall",
			Vector3.new(1.2, wallHeight, northLength),
			CFrame.new(x, wallY, area.ZMin + northLength / 2),
			P.Pink
		)
		box(
			props,
			"LotWall",
			Vector3.new(1.2, wallHeight, southLength),
			CFrame.new(x, wallY, lot.GateZMax + southLength / 2),
			P.Pink
		)
	end
	box(
		props,
		"LotFloor",
		Vector3.new(area.XMax - area.XMin - 2.4, 0.1, area.ZMax - area.ZMin - 2.4),
		CFrame.new((area.XMin + area.XMax) / 2, H.Lot - 0.05, (area.ZMin + area.ZMax) / 2),
		P.Asphalt,
		{
			Material = Enum.Material.Asphalt,
		}
	)
	local colors = { P.Coral, P.Sky, P.Mint, P.White, P.Lilac, P.Sunny }
	local carIndex = 0
	for _, z in { area.ZMin + 14, area.ZMax - 14 } do
		for x = area.XMin + 30, area.XMax - 30, 36 do
			carIndex += 1
			if carIndex % 3 ~= 0 then
				simpleCar(props, CFrame.new(x, H.Lot, z), colors[(carIndex % #colors) + 1])
			end
		end
	end
end

--------------------------------------------------------------------------------
-- Árvores e postes nas calçadas
--------------------------------------------------------------------------------

type Footprint = Rect

local function collectFootprints(): { Footprint }
	local result: { Footprint } = {}
	local function add(center: Vector3, footprint: Vector2)
		table.insert(result, {
			XMin = center.X - footprint.X / 2,
			XMax = center.X + footprint.X / 2,
			ZMin = center.Z - footprint.Y / 2,
			ZMax = center.Z + footprint.Y / 2,
		})
	end
	for _, loc in MapLayout.Locations do
		add(
			MapLayout.GetBuildingCenter(loc),
			MapLayout.GetFootprint(loc.Facing, loc.Building.Width, loc.Building.Depth)
		)
	end
	for _, filler in MapLayout.Fillers do
		add(
			Vector3.new(filler.Center.X, 0, filler.Center.Y),
			MapLayout.GetFootprint(filler.Facing, filler.Width, filler.Depth)
		)
	end
	local hq = MapLayout.HQ
	add(hq.Center, MapLayout.GetFootprint(hq.Facing, hq.Width, hq.Depth))
	return result
end

local function buildStreetFurniture(nature: Folder, props: Folder)
	local footprints = collectFootprints()
	local canal = MapLayout.Canal
	local inset = 4

	local function blocked(x: number, z: number): boolean
		for _, zone in MapLayout.ClearZones do
			if inRect(x, z, zone, 0) then
				return true
			end
		end
		for _, footprint in footprints do
			if inRect(x, z, footprint, 5) then
				return true
			end
		end
		for _, loc in MapLayout.Locations do
			if flatDistance(Vector3.new(x, 0, z), loc.Position) < 20 then
				return true
			end
		end
		for _, spot in MapLayout.AccidentSpots do
			if flatDistance(Vector3.new(x, 0, z), spot.Position) < 36 then
				return true
			end
		end
		for _, alley in MapLayout.Alleys do
			if inRect(x, z, alley.Area, 6) then
				return true
			end
		end
		return false
	end

	local treeCount = 0
	for _, block in MapLayout.GetBlocks() do
		local sides = {
			{
				From = Vector3.new(block.XMin, 0, block.ZMin + inset),
				To = Vector3.new(block.XMax, 0, block.ZMin + inset),
				Road = Vector3.new(0, 0, -1),
				Canal = block.ZMin == canal.ZMax,
			},
			{
				From = Vector3.new(block.XMin, 0, block.ZMax - inset),
				To = Vector3.new(block.XMax, 0, block.ZMax - inset),
				Road = Vector3.new(0, 0, 1),
				Canal = block.ZMax == canal.ZMin,
			},
			{
				From = Vector3.new(block.XMin + inset, 0, block.ZMin),
				To = Vector3.new(block.XMin + inset, 0, block.ZMax),
				Road = Vector3.new(-1, 0, 0),
				Canal = false,
			},
			{
				From = Vector3.new(block.XMax - inset, 0, block.ZMin),
				To = Vector3.new(block.XMax - inset, 0, block.ZMax),
				Road = Vector3.new(1, 0, 0),
				Canal = false,
			},
		}
		for _, side in sides do
			if not side.Canal then
				local delta = side.To - side.From
				local length = delta.Magnitude
				local direction = delta.Unit
				local slot = 0
				local t = 20
				while t <= length - 20 do
					local p = side.From + direction * t
					if not blocked(p.X, p.Z) then
						slot += 1
						local position = Vector3.new(p.X, H.Block, p.Z)
						if slot % 3 == 0 then
							lamp(props, position, side.Road)
						else
							treeCount += 1
							tree(nature, position, 0.9 + (treeCount % 3) * 0.12, treeCount)
						end
					end
					t += 44
				end
			end
		end
	end
end

--------------------------------------------------------------------------------
-- Campo (fora do anel rodoviário)
--------------------------------------------------------------------------------

local function buildCountryside(nature: Folder, props: Folder)
	local canal = MapLayout.Canal
	local farmArea = { XMin = -990, XMax = -790, ZMin = 500, ZMax = 700 }
	local ringOuter = MapLayout.RingCoordinate + MapLayout.RingWidth / 2

	-- Morros nos cantos.
	for _, corner in
		{ Vector3.new(-935, 0, -935), Vector3.new(935, 0, -935), Vector3.new(935, 0, 935), Vector3.new(-935, 0, 935) }
	do
		ball(nature, "Hill", 150, corner + Vector3.new(0, -52, 0), P.GrassDark, { Material = Enum.Material.Grass })
	end

	local random = makeRandom(4242)
	local planted = 0
	for _ = 1, 600 do
		if planted >= 150 then
			break
		end
		local x = random(-985, 985)
		local z = random(-985, 985)
		local outside = math.max(math.abs(x), math.abs(z)) > ringOuter + 14
		local nearCanal = z > canal.ZMin - 16 and z < canal.ZMax + 16
		local nearFarm = inRect(x, z, farmArea, 0)
		local nearHill = math.abs(math.abs(x) - 935) < 60 and math.abs(math.abs(z) - 935) < 60
		if outside and not nearCanal and not nearFarm and not nearHill then
			planted += 1
			tree(nature, Vector3.new(x, H.Ground, z), random(1.1, 1.8), planted)
		end
	end

	-- Chácara: celeiro, cerca, fardos de feno e vaquinhas.
	local barnBase = CFrame.new(-905, H.Ground, 540) * CFrame.Angles(0, YAW.E, 0)
	local barn = newModel(props, "Barn")
	box(barn, "Walls", Vector3.new(36, 13, 30), barnBase * CFrame.new(0, 6.5, 0), P.Red)
	gableRoof(barn, barnBase, 36, 30, 13, 7, P.White)
	box(barn, "BarnDoor", Vector3.new(12, 10, 0.4), barnBase * CFrame.new(0, 5, -15.2), P.White)

	local pasture = { XMin = -965, XMax = -875, ZMin = 612, ZMax = 690 }
	for _, rail in
		{
			{ Vector3.new(pasture.XMin, 0, pasture.ZMin), Vector3.new(pasture.XMax, 0, pasture.ZMin) },
			{ Vector3.new(pasture.XMin, 0, pasture.ZMax), Vector3.new(pasture.XMax, 0, pasture.ZMax) },
			{ Vector3.new(pasture.XMin, 0, pasture.ZMin), Vector3.new(pasture.XMin, 0, pasture.ZMax) },
			{ Vector3.new(pasture.XMax, 0, pasture.ZMin), Vector3.new(pasture.XMax, 0, pasture.ZMax) },
		}
	do
		local from, to = rail[1], rail[2]
		local delta = to - from
		local alongX = math.abs(delta.X) > math.abs(delta.Z)
		local length = delta.Magnitude
		local center = (from + to) / 2
		for _, y in { 1.4, 3 } do
			local size = if alongX then Vector3.new(length, 0.4, 0.4) else Vector3.new(0.4, 0.4, length)
			box(props, "FenceRail", size, CFrame.new(center.X, y, center.Z), P.Wood, { Material = Enum.Material.Wood })
		end
	end
	for index = 0, 3 do
		local p = Vector3.new(-860 - index * 7, H.Ground, 530 + (index % 2) * 6)
		local bale = Instance.new("Part")
		bale.Name = "HayBale"
		bale.Shape = Enum.PartType.Cylinder
		bale.Size = Vector3.new(4, 4, 4)
		bale.CFrame = CFrame.new(p + Vector3.new(0, 2, 0))
		bale.Color = Color3.fromRGB(230, 190, 90)
		applyOptions(bale, { Material = Enum.Material.Fabric })
		bale.Parent = props
	end
	for index, p in { Vector3.new(-930, H.Ground, 640), Vector3.new(-900, H.Ground, 665) } do
		local cow = newModel(props, "Cow")
		local frame = CFrame.new(p) * CFrame.Angles(0, index * 1.3, 0)
		box(cow, "Body", Vector3.new(3, 3, 6), frame * CFrame.new(0, 3.4, 0), P.White)
		box(cow, "Spot", Vector3.new(3.1, 1.6, 2), frame * CFrame.new(0, 3.9, 0.8), P.Dark)
		box(cow, "Head", Vector3.new(2.2, 2.2, 2.4), frame * CFrame.new(0, 4.4, -3.8), P.White)
		box(cow, "Snout", Vector3.new(1.6, 1, 0.8), frame * CFrame.new(0, 3.8, -5.2), P.Pink)
		for _, leg in
			{
				Vector3.new(1, 0.95, 2.2),
				Vector3.new(-1, 0.95, 2.2),
				Vector3.new(1, 0.95, -2.2),
				Vector3.new(-1, 0.95, -2.2),
			}
		do
			box(cow, "Leg", Vector3.new(0.8, 1.9, 0.8), frame * CFrame.new(leg), P.White)
		end
	end
	-- Estradinha de terra da rodovia até a casa.
	local chacara = MapLayout.GetLocation("Chacara")
	if chacara then
		local roadEdge = -ringOuter
		local houseFront = MapLayout.GetBuildingCenter(chacara).X + chacara.Building.Depth / 2
		local length = roadEdge - houseFront
		box(
			props,
			"DirtRoad",
			Vector3.new(length, 0.1, 14),
			CFrame.new(houseFront + length / 2, H.Ground + 0.05, chacara.Position.Z),
			P.Dirt,
			{
				Material = Enum.Material.Ground,
			}
		)
	end
end

local function buildSpeedBumps(props: Folder)
	for _, bump in MapLayout.SpeedBumps do
		local width = if bump.Axis == "X"
			then MapLayout.RoadWidth(bump.Position.Z)
			else MapLayout.RoadWidth(bump.Position.X)
		speedBump(props, bump.Position, bump.Axis, width)
	end
end

--------------------------------------------------------------------------------
-- API
--------------------------------------------------------------------------------

-- Constrói (ou reconstrói) workspace.Map e retorna a pasta criada.
function MapBuilder.Build(parent: Instance): Folder
	local existing = parent:FindFirstChild("Map")
	if existing then
		existing:Destroy()
	end

	local map = Instance.new("Folder")
	map.Name = "Map"
	map:SetAttribute("LayoutVersion", MapLayout.Version)

	local ground = newFolder(map, "Ground")
	local roads = newFolder(map, "Roads")
	local blocks = newFolder(map, "Blocks")
	local buildings = newFolder(map, "Buildings")
	local locations = newFolder(map, "Locations")
	local props = newFolder(map, "Props")
	local nature = newFolder(map, "Nature")
	local obstacles = newFolder(map, "Obstacles")
	local shortcuts = newFolder(map, "Shortcuts")
	local boundaries = newFolder(map, "Boundaries")

	buildGround(ground)
	buildBoundaries(boundaries)
	buildRoads(roads, props)
	buildBlocks(blocks, props)
	buildLocations(locations, buildings, props)
	buildHQ(buildings, props, map)
	buildPlaza(props)
	buildMirante(props, nature)
	buildAlleys(props, obstacles)
	buildPark(props, obstacles)
	buildConstruction(props, obstacles)
	buildShortcuts(shortcuts, props)
	buildSpeedBumps(props)
	buildStreetFurniture(nature, props)
	buildCountryside(nature, props)

	map.Parent = parent
	return map
end

return MapBuilder
