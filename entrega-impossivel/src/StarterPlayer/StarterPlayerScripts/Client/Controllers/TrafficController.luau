--!strict
-- Trânsito simples (veja TrafficConfig). Os carros são objetos locais e ancorados que
-- andam pela faixa da direita e freiam quando há um veículo ou pessoa logo à frente.
-- Como partem do relógio do servidor, todos os jogadores veem o trânsito quase igual.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local Workspace = game:GetService("Workspace")

local TrafficConfig = require(ReplicatedStorage.Shared.Config.TrafficConfig)
local MapLayout = require(ReplicatedStorage.Shared.Map.MapLayout)

type LoopPath = {
	Points: { Vector3 },
	Cumulative: { number },
	Length: number,
}

type TrafficCar = {
	Model: Model,
	Path: LoopPath,
	Distance: number,
	Speed: number,
	CruiseSpeed: number,
	Position: Vector3,
	Forward: Vector3,
	Visible: boolean,
	-- Evita dois carros de trânsito travarem um esperando o outro para sempre.
	StoppedFor: number,
	GhostUntil: number,
}

local TrafficController = {}

local CAR_HEIGHT_OFFSET = MapLayout.Heights.Road
local LOOKAHEAD = 6

local cars: { TrafficCar } = {}
local folder: Folder

local function rightOf(direction: Vector3): Vector3
	return Vector3.new(-direction.Z, 0, direction.X)
end

-- Transforma a lista de cruzamentos em um caminho deslocado para a faixa da direita.
local function buildPath(loop: TrafficConfig.Loop): LoopPath
	local count = #loop.Points
	local centers: { Vector3 } = {}
	for _, point in loop.Points do
		table.insert(centers, Vector3.new(point.X, 0, point.Y))
	end
	local points: { Vector3 } = {}
	for index = 1, count do
		local previous = centers[((index - 2) % count) + 1]
		local current = centers[index]
		local nextPoint = centers[(index % count) + 1]
		local rightIn = rightOf((current - previous).Unit)
		local rightOut = rightOf((nextPoint - current).Unit)
		local miter = (rightIn + rightOut) * (loop.LaneOffset / (1 + rightIn:Dot(rightOut)))
		table.insert(points, current + miter)
	end
	local cumulative = { 0 }
	local length = 0
	for index = 1, count do
		local a = points[index]
		local b = points[(index % count) + 1]
		length += (b - a).Magnitude
		table.insert(cumulative, length)
	end
	return { Points = points, Cumulative = cumulative, Length = length }
end

local function sample(path: LoopPath, distance: number): Vector3
	local d = distance % path.Length
	local count = #path.Points
	for index = 1, count do
		if d <= path.Cumulative[index + 1] then
			local a = path.Points[index]
			local b = path.Points[(index % count) + 1]
			local segmentLength = path.Cumulative[index + 1] - path.Cumulative[index]
			local t = if segmentLength > 0 then (d - path.Cumulative[index]) / segmentLength else 0
			return a:Lerp(b, t)
		end
	end
	return path.Points[1]
end

local function buildCar(color: Color3): Model
	local model = Instance.new("Model")
	model.Name = "TrafficCar"
	local function part(
		name: string,
		size: Vector3,
		offset: Vector3,
		partColor: Color3,
		collide: boolean,
		shape: Enum.PartType?
	): Part
		local p = Instance.new("Part")
		p.Name = name
		p.Anchored = true
		p.CanCollide = collide
		p.CanTouch = false
		p.CanQuery = collide
		p.Size = size
		p.CFrame = CFrame.new(offset)
		p.Color = partColor
		p.Material = Enum.Material.SmoothPlastic
		p.TopSurface = Enum.SurfaceType.Smooth
		p.BottomSurface = Enum.SurfaceType.Smooth
		if shape then
			p.Shape = shape
		end
		p.Parent = model
		return p
	end
	local body = part("Body", Vector3.new(6.4, 2.4, 11), Vector3.new(0, 2, 0), color, true)
	part("Cabin", Vector3.new(5.8, 2, 5.6), Vector3.new(0, 4.2, 0.6), Color3.fromRGB(60, 90, 130), true)
	for _, offset in
		{ Vector3.new(3, 1.2, -3.6), Vector3.new(-3, 1.2, -3.6), Vector3.new(3, 1.2, 3.6), Vector3.new(-3, 1.2, 3.6) }
	do
		part("Wheel", Vector3.new(1, 2.4, 2.4), offset, Color3.fromRGB(35, 35, 40), false, Enum.PartType.Cylinder)
	end
	for _, x in { -2.2, 2.2 } do
		local light =
			part("Light", Vector3.new(1.2, 0.6, 0.2), Vector3.new(x, 2.4, -5.55), Color3.fromRGB(255, 250, 220), false)
		light.Material = Enum.Material.Neon
	end
	model.PrimaryPart = body
	model.WorldPivot = CFrame.identity
	return model
end

local function obstaclePositions(): { Vector3 }
	local positions: { Vector3 } = {}
	local vehicles = Workspace:FindFirstChild("Vehicles")
	if vehicles then
		for _, model in vehicles:GetChildren() do
			if model:IsA("Model") and model.PrimaryPart then
				table.insert(positions, model.PrimaryPart.Position)
			end
		end
	end
	for _, player in Players:GetPlayers() do
		local character = player.Character
		local root = character and character:FindFirstChild("HumanoidRootPart")
		if root and root:IsA("BasePart") then
			table.insert(positions, root.Position)
		end
	end
	return positions
end

local function isBlocked(car: TrafficCar, obstacles: { Vector3 }, ignoreTraffic: boolean): boolean
	local position, forward = car.Position, car.Forward
	local right = rightOf(forward)
	local function inFront(point: Vector3): boolean
		local delta = Vector3.new(point.X - position.X, 0, point.Z - position.Z)
		local ahead = delta:Dot(forward)
		return ahead > 3 and ahead < TrafficConfig.BrakeDistance and math.abs(delta:Dot(right)) < 5.5
	end
	for _, point in obstacles do
		if inFront(point) then
			return true
		end
	end
	if ignoreTraffic then
		return false
	end
	for _, other in cars do
		if other ~= car and other.Path == car.Path then
			local gap = (other.Distance - car.Distance) % car.Path.Length
			if gap > 0 and gap < 15 then
				return true
			end
		elseif other ~= car and inFront(other.Position) then
			return true
		end
	end
	return false
end

local function step(dt: number)
	local camera = Workspace.CurrentCamera
	local cameraPosition = if camera then camera.CFrame.Position else Vector3.zero
	local obstacles = obstaclePositions()
	local clock = os.clock()
	for _, car in cars do
		local blocked = isBlocked(car, obstacles, clock < car.GhostUntil)
		if blocked and car.Speed < 0.5 then
			car.StoppedFor += dt
			if car.StoppedFor > 6 then
				car.StoppedFor = 0
				car.GhostUntil = clock + 2
			end
		else
			car.StoppedFor = 0
		end
		local targetSpeed = if blocked then 0 else car.CruiseSpeed
		local rate = TrafficConfig.Acceleration * (if blocked then 2.5 else 1)
		if car.Speed < targetSpeed then
			car.Speed = math.min(targetSpeed, car.Speed + rate * dt)
		else
			car.Speed = math.max(targetSpeed, car.Speed - rate * dt)
		end
		car.Distance = (car.Distance + car.Speed * dt) % car.Path.Length

		local position = sample(car.Path, car.Distance)
		local ahead = sample(car.Path, car.Distance + LOOKAHEAD)
		local forward = Vector3.new(ahead.X - position.X, 0, ahead.Z - position.Z)
		if forward.Magnitude > 0.01 then
			car.Forward = forward.Unit
		end
		car.Position = position + Vector3.new(0, CAR_HEIGHT_OFFSET, 0)

		local visible = (car.Position - cameraPosition).Magnitude < TrafficConfig.RenderDistance
		if visible ~= car.Visible then
			car.Visible = visible
			car.Model.Parent = if visible then folder else nil
		end
		if visible then
			car.Model:PivotTo(CFrame.lookAt(car.Position, car.Position + car.Forward))
		end
	end
end

function TrafficController.Init()
	if not TrafficConfig.Enabled then
		return
	end
	local effects = Workspace:FindFirstChild("LocalEffects")
	folder = Instance.new("Folder")
	folder.Name = "Traffic"
	folder.Parent = effects or Workspace
end

function TrafficController.Start()
	if not TrafficConfig.Enabled then
		return
	end
	local now = Workspace:GetServerTimeNow()
	local colorIndex = 0
	for _, loop in TrafficConfig.Loops do
		local path = buildPath(loop)
		for carIndex = 0, loop.Cars - 1 do
			colorIndex += 1
			local color = TrafficConfig.CarColors[(colorIndex % #TrafficConfig.CarColors) + 1]
			local startDistance = (now * loop.Speed + carIndex * path.Length / loop.Cars) % path.Length
			local model = buildCar(color)
			table.insert(cars, {
				Model = model,
				Path = path,
				Distance = startDistance,
				Speed = loop.Speed,
				CruiseSpeed = loop.Speed,
				Position = sample(path, startDistance),
				Forward = Vector3.new(0, 0, -1),
				Visible = false,
				StoppedFor = 0,
				GhostUntil = 0,
			})
		end
	end
	RunService.Heartbeat:Connect(step)
end

return TrafficController
