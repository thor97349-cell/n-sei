--!strict
-- EVENTO: ACIDENTE — um trecho de rua fica bloqueado por carros batidos, barreiras e fumaça.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local MapLayout = require(ReplicatedStorage.Shared.Map.MapLayout)

type Context = any
type Handle = { Model: Model, Spot: MapLayout.AccidentSpot }

local P = MapLayout.Palette
local H = MapLayout.Heights
local BLOCK_RADIUS = 40

local Accident = {}

local function part(
	parent: Instance,
	name: string,
	size: Vector3,
	cframe: CFrame,
	color: Color3,
	material: Enum.Material?
): Part
	local p = Instance.new("Part")
	p.Name = name
	p.Anchored = true
	p.Size = size
	p.CFrame = cframe
	p.Color = color
	p.Material = material or Enum.Material.SmoothPlastic
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Parent = parent
	return p
end

local function wreck(parent: Instance, cframe: CFrame, color: Color3, onFire: boolean)
	local body = part(
		parent,
		"WreckBody",
		Vector3.new(6.6, 2.8, 11.5),
		cframe * CFrame.new(0, 2, 0),
		color,
		Enum.Material.CorrodedMetal
	)
	part(
		parent,
		"WreckCabin",
		Vector3.new(6, 2, 5.5),
		cframe * CFrame.new(0, 4.3, 0.8) * CFrame.Angles(0.15, 0, 0.1),
		P.Glass
	)
	local smoke = Instance.new("Smoke")
	smoke.Color = Color3.fromRGB(90, 90, 95)
	smoke.Opacity = 0.35
	smoke.RiseVelocity = 7
	smoke.Size = 6
	smoke.Parent = body
	if onFire then
		local fire = Instance.new("Fire")
		fire.Size = 5
		fire.Heat = 8
		fire.Parent = body
	end
end

local function buildBlockade(spot: MapLayout.AccidentSpot): Model
	local model = Instance.new("Model")
	model.Name = "Acidente_" .. spot.Id
	model:SetAttribute("MapIcon", "🚧")
	model:SetAttribute("Label", "Acidente — " .. spot.Road)

	local p = spot.Position
	local roadWidth = if spot.Axis == "X" then MapLayout.RoadWidth(p.Z) else MapLayout.RoadWidth(p.X)
	-- Frame local: X local = atravessando a rua; Z local = ao longo da rua.
	local yaw = if spot.Axis == "X" then math.pi / 2 else 0
	local frame = CFrame.new(p.X, H.Road, p.Z) * CFrame.Angles(0, yaw, 0)
	local span = roadWidth + MapLayout.SidewalkWidth * 2

	-- Duas fileiras de barreiras listradas cobrindo rua + calçadas.
	for _, rowZ in { -9, 9 } do
		local segments = math.floor(span / 7)
		local segmentWidth = span / segments
		for index = 0, segments - 1 do
			local x = -span / 2 + segmentWidth * (index + 0.5)
			local color = if index % 2 == 0 then P.Orange else P.White
			part(model, "Barrier", Vector3.new(segmentWidth, 4, 1.4), frame * CFrame.new(x, 2.4, rowZ), color)
		end
	end
	wreck(model, frame * CFrame.new(-roadWidth / 5, 0, 0) * CFrame.Angles(0, math.rad(35), 0), P.Coral, true)
	wreck(model, frame * CFrame.new(roadWidth / 5, 0, 1) * CFrame.Angles(0, math.rad(-60), 0.08), P.Sky, false)
	for index = -2, 2 do
		part(
			model,
			"Cone",
			Vector3.new(1.2, 2.6, 1.2),
			frame * CFrame.new(index * 5, 1.3, -13),
			Color3.fromRGB(255, 120, 30)
		)
		part(
			model,
			"Cone",
			Vector3.new(1.2, 2.6, 1.2),
			frame * CFrame.new(index * 5, 1.3, 13),
			Color3.fromRGB(255, 120, 30)
		)
	end

	-- Aviso visível de longe para os jogadores trocarem de rota.
	local marker = part(model, "Marker", Vector3.new(1, 1, 1), frame * CFrame.new(0, 14, 0), P.Orange)
	marker.Transparency = 1
	marker.CanCollide = false
	marker.CanQuery = false
	marker.CanTouch = false
	local billboard = Instance.new("BillboardGui")
	billboard.Size = UDim2.fromOffset(170, 54)
	billboard.AlwaysOnTop = true
	billboard.MaxDistance = 900
	billboard.LightInfluence = 0
	billboard.Parent = marker
	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundColor3 = Color3.fromRGB(255, 120, 30)
	label.BackgroundTransparency = 0.1
	label.TextColor3 = Color3.new(1, 1, 1)
	label.TextScaled = true
	label.FontFace = Font.fromEnum(Enum.Font.FredokaOne)
	label.Text = "🚧 ACIDENTE"
	label.Parent = billboard
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 12)
	corner.Parent = label

	model.PrimaryPart = marker
	return model
end

function Accident.CanStart(_context: Context): boolean
	return #MapLayout.AccidentSpots > 0
end

function Accident.Start(context: Context, _duration: number): Handle?
	local spots = table.clone(MapLayout.AccidentSpots)
	-- Embaralha para não repetir sempre o mesmo lugar.
	for index = #spots, 2, -1 do
		local swap = context.Random:NextInteger(1, index)
		spots[index], spots[swap] = spots[swap], spots[index]
	end
	for _, spot in spots do
		if not context.IsAreaOccupied(spot.Position, BLOCK_RADIUS) then
			local model = buildBlockade(spot)
			model.Parent = context.EventsFolder
			context.AddBlockedZone("Accident", spot.Position, BLOCK_RADIUS)
			context.Notify("🚧 ACIDENTE na " .. spot.Road .. "! Rua bloqueada — procure outro caminho.", "event", 7)
			return { Model = model, Spot = spot }
		end
	end
	return nil
end

function Accident.Stop(context: Context, handle: Handle)
	if handle.Model then
		handle.Model:Destroy()
	end
	context.RemoveBlockedZone("Accident")
	context.Notify("✅ " .. handle.Spot.Road .. " foi liberada.", "success", 4)
end

return Accident
