--!strict
-- Direção do veículo, calculada no computador de quem dirige (resposta instantânea).
-- O servidor passa a "posse física" do carro para o motorista; aqui ajustamos a
-- velocidade (LinearVelocity "Drive") e a direção (AlignOrientation "Align").
--
-- Controles (padrão do Roblox para VehicleSeat, funcionam no PC, celular e controle):
--   W/S ou ↑/↓  acelerar / frear e dar ré     A/D ou ←/→  virar
--   Shift       freio de mão (derrapagem)     Espaço      sair do veículo
--   R           resgatar o veículo

local ContextActionService = game:GetService("ContextActionService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local Workspace = game:GetService("Workspace")

local VehicleConfig = require(ReplicatedStorage.Shared.Config.VehicleConfig)
local Remotes = require(ReplicatedStorage.Shared.Util.Remotes)
local Signal = require(ReplicatedStorage.Shared.Util.Signal)

type WheelInfo = {
	Weld: Weld,
	Base: CFrame,
	Front: boolean,
}

type DriveState = {
	Model: Model,
	Chassis: BasePart,
	Seat: VehicleSeat,
	Humanoid: Humanoid,
	Drive: LinearVelocity,
	Align: AlignOrientation,
	Handling: VehicleConfig.Handling,
	GroundOffset: number,
	Speed: number,
	Heading: number,
	GroundNormal: Vector3,
	WheelSpin: number,
	Wheels: { WheelInfo },
	RayParams: RaycastParams,
	ResyncFrames: number,
}

local VehicleController = {}

-- (dirigindo: boolean)
VehicleController.DrivingChanged = Signal.new()

local player = Players.LocalPlayer
local current: DriveState? = nil
local handbrake = false
local steerSmoothed = 0

local GROUNDED_FORCE_PER_MASS = 220
local AIR_FORCE_PER_MASS = 8
local MAX_HEADING_DRIFT = math.rad(40)

local function yawOf(cframe: CFrame): number
	local look = cframe.LookVector
	return math.atan2(-look.X, -look.Z)
end

local function forwardOf(heading: number): Vector3
	return Vector3.new(-math.sin(heading), 0, -math.cos(heading))
end

local function angleDifference(a: number, b: number): number
	return (a - b + math.pi) % (2 * math.pi) - math.pi
end

local function moveToward(value: number, target: number, delta: number): number
	if value < target then
		return math.min(target, value + delta)
	end
	return math.max(target, value - delta)
end

local function isOwnVehicle(model: Instance): boolean
	return model:GetAttribute("OwnerUserId") == player.UserId
end

local function levelOrientation(heading: number): CFrame
	local forward = forwardOf(heading)
	return CFrame.lookAt(Vector3.zero, forward)
end

--------------------------------------------------------------------------------
-- Entrar / sair
--------------------------------------------------------------------------------

local function stopDriving()
	local state = current
	if not state then
		return
	end
	current = nil
	-- Ainda somos donos da física por um instante: freia antes de devolver ao servidor.
	state.Drive.PlaneVelocity = Vector2.zero
	state.Align.CFrame = levelOrientation(yawOf(state.Chassis.CFrame))
	VehicleController.DrivingChanged:Fire(false)
end

local function startDriving(seat: VehicleSeat, humanoid: Humanoid)
	local model = seat.Parent
	if not model or not model:IsA("Model") or not isOwnVehicle(model) then
		return
	end
	local chassis = model:FindFirstChild("Chassis")
	if not chassis or not chassis:IsA("BasePart") then
		return
	end
	local drive = chassis:FindFirstChild("Drive")
	local align = chassis:FindFirstChild("Align")
	if not drive or not drive:IsA("LinearVelocity") or not align or not align:IsA("AlignOrientation") then
		return
	end
	local vehicleId = model:GetAttribute("VehicleId")
	local definition = VehicleConfig.Get(if type(vehicleId) == "string" then vehicleId else "Starter")
		or VehicleConfig.Get("Starter")
	assert(definition, "VehicleConfig sem veículo inicial")

	local wheels: { WheelInfo } = {}
	for _, descendant in model:GetDescendants() do
		if descendant:IsA("Weld") and descendant.Name == "WheelWeld" and descendant.Part1 then
			table.insert(wheels, {
				Weld = descendant,
				Base = descendant.C0,
				Front = descendant.C0.Position.Z < 0,
			})
		end
	end

	local params = RaycastParams.new()
	params.FilterType = Enum.RaycastFilterType.Exclude
	local ignore: { Instance } = { model }
	if player.Character then
		table.insert(ignore, player.Character)
	end
	local localEffects = Workspace:FindFirstChild("LocalEffects")
	if localEffects then
		table.insert(ignore, localEffects)
	end
	params.FilterDescendantsInstances = ignore
	params.IgnoreWater = true

	local cframe = chassis.CFrame
	local look = cframe.LookVector
	local flatVelocity = chassis.AssemblyLinearVelocity * Vector3.new(1, 0, 1)
	current = {
		Model = model,
		Chassis = chassis,
		Seat = seat,
		Humanoid = humanoid,
		Drive = drive,
		Align = align,
		Handling = definition.Handling,
		GroundOffset = definition.Body.GroundOffset,
		Speed = flatVelocity:Dot(Vector3.new(look.X, 0, look.Z)),
		Heading = yawOf(cframe),
		GroundNormal = Vector3.yAxis,
		WheelSpin = 0,
		Wheels = wheels,
		RayParams = params,
		ResyncFrames = 0,
	}
	VehicleController.DrivingChanged:Fire(true)
end

--------------------------------------------------------------------------------
-- Física (a cada quadro, antes da simulação)
--------------------------------------------------------------------------------

local function step(dt: number)
	local state = current
	if not state then
		return
	end
	local chassis = state.Chassis
	-- Usa o SeatPart do humanoide local (o Occupant do banco chega com atraso pela rede).
	if chassis.Parent == nil or state.Humanoid.SeatPart ~= state.Seat then
		stopDriving()
		return
	end
	dt = math.min(dt, 1 / 20)
	local h = state.Handling
	local seat = state.Seat
	local throttle = seat.ThrottleFloat
	local steerInput = seat.SteerFloat
	-- Suaviza a direção do teclado (que é 0 ou 1) para curvas menos bruscas.
	steerSmoothed = moveToward(steerSmoothed, steerInput, dt * 6)

	local cframe = chassis.CFrame
	local velocity = chassis.AssemblyLinearVelocity
	local flatVelocity = Vector3.new(velocity.X, 0, velocity.Z)

	-- Se o carro foi girado por fora (resgate/colisão forte), adota a direção real.
	local actualYaw = yawOf(cframe)
	if state.ResyncFrames > 0 then
		state.ResyncFrames -= 1
		state.Heading = actualYaw
		state.Speed = 0
	elseif math.abs(angleDifference(actualYaw, state.Heading)) > MAX_HEADING_DRIFT then
		state.Heading = actualYaw
	end

	local result = Workspace:Raycast(cframe.Position, Vector3.new(0, -(state.GroundOffset + 2.5), 0), state.RayParams)
	local grounded = result ~= nil
	local targetNormal = if result then result.Normal else Vector3.yAxis
	if targetNormal.Y < 0.5 then
		targetNormal = Vector3.yAxis -- parede ou algo muito inclinado: ignora
	end
	state.GroundNormal = state.GroundNormal:Lerp(targetNormal, math.min(1, dt * 10)).Unit

	local forward = forwardOf(state.Heading)
	local forwardSpeed = flatVelocity:Dot(forward)
	-- Não acumula velocidade "imaginária" quando está preso numa parede.
	if math.abs(state.Speed - forwardSpeed) > 12 then
		state.Speed = forwardSpeed + math.sign(state.Speed - forwardSpeed) * 12
	end

	local wet = ReplicatedStorage:GetAttribute("Weather") == "Storm"
	if grounded then
		if throttle > 0.05 then
			if state.Speed < -0.5 then
				state.Speed = math.min(0, state.Speed + h.BrakeDeceleration * throttle * dt)
			else
				local cap = h.MaxSpeed * throttle
				if state.Speed < cap then
					local boost = 1.25 - 0.75 * math.clamp(state.Speed / h.MaxSpeed, 0, 1)
					state.Speed = math.min(cap, state.Speed + h.Acceleration * boost * throttle * dt)
				else
					state.Speed = math.max(cap, state.Speed - h.CoastDeceleration * dt)
				end
			end
		elseif throttle < -0.05 then
			local amount = -throttle
			if state.Speed > 0.5 then
				state.Speed = math.max(0, state.Speed - h.BrakeDeceleration * amount * dt)
			else
				state.Speed = math.max(-h.ReverseSpeed * amount, state.Speed - h.ReverseAcceleration * amount * dt)
			end
		else
			state.Speed = moveToward(state.Speed, 0, h.CoastDeceleration * dt)
		end
		if handbrake then
			state.Speed = moveToward(state.Speed, 0, h.BrakeDeceleration * 0.3 * dt)
		end

		-- Curva: não gira parado; gira um pouco menos em alta velocidade.
		local speedFactor = math.clamp(math.abs(state.Speed) / h.TurnSpeedReference, 0, 1)
		local highSpeedDamp = 1 - 0.3 * math.clamp(math.abs(state.Speed) / h.MaxSpeed, 0, 1)
		local turnRate = h.TurnRate * speedFactor * highSpeedDamp * (if handbrake then 1.35 else 1)
		local direction = if state.Speed >= 0 then 1 else -1
		state.Heading -= steerSmoothed * turnRate * direction * dt
	end

	forward = forwardOf(state.Heading)
	local right = Vector3.new(-forward.Z, 0, forward.X)
	local mass = chassis.AssemblyMass

	if grounded then
		local grip = h.Grip * (if wet then h.WetGripMultiplier else 1)
		if handbrake then
			grip = h.HandbrakeGrip
		end
		local lateral = flatVelocity:Dot(right) * math.exp(-grip * dt)
		local target = forward * state.Speed + right * lateral
		state.Drive.PlaneVelocity = Vector2.new(target.X, target.Z)
		state.Drive.MaxForce = mass * GROUNDED_FORCE_PER_MASS
	else
		-- No ar: mantém o embalo, quase sem controle.
		state.Drive.PlaneVelocity = Vector2.new(flatVelocity.X, flatVelocity.Z)
		state.Drive.MaxForce = mass * AIR_FORCE_PER_MASS
		state.GroundNormal = state.GroundNormal:Lerp(Vector3.yAxis, math.min(1, dt * 2)).Unit
	end

	local up = state.GroundNormal
	local forwardOnGround = (forward - up * forward:Dot(up)).Unit
	local rightOnGround = forwardOnGround:Cross(up)
	state.Align.CFrame = CFrame.fromMatrix(Vector3.zero, rightOnGround, up, -forwardOnGround)

	-- Rodas: giram com a velocidade; as da frente esterçam.
	state.WheelSpin = (state.WheelSpin + state.Speed / 1.4 * dt) % (2 * math.pi)
	for _, wheel in state.Wheels do
		local steerAngle = if wheel.Front then -steerSmoothed * 0.45 else 0
		wheel.Weld.C0 = wheel.Base * CFrame.Angles(0, steerAngle, 0) * CFrame.Angles(-state.WheelSpin, 0, 0)
	end
end

--------------------------------------------------------------------------------
-- Prompts "Dirigir": só aparecem no veículo do próprio jogador
--------------------------------------------------------------------------------

local function updatePrompt(model: Instance)
	local prompt = model:FindFirstChild("EnterPrompt", true)
	if not prompt or not prompt:IsA("ProximityPrompt") then
		return
	end
	local seated = current ~= nil and current.Model == model
	prompt.Enabled = isOwnVehicle(model) and not seated
end

local function watchVehicles()
	local folder = Workspace:WaitForChild("Vehicles", 30)
	if not folder then
		return
	end
	local function track(model: Instance)
		-- O prompt pode chegar um instante depois do modelo.
		task.defer(updatePrompt, model)
		model.DescendantAdded:Connect(function(descendant: Instance)
			if descendant:IsA("ProximityPrompt") then
				updatePrompt(model)
				descendant:GetPropertyChangedSignal("Enabled"):Connect(function()
					local shouldBeEnabled = isOwnVehicle(model) and not (current ~= nil and current.Model == model)
					if descendant.Enabled ~= shouldBeEnabled then
						descendant.Enabled = shouldBeEnabled
					end
				end)
			end
		end)
		local existing = model:FindFirstChild("EnterPrompt", true)
		if existing and existing:IsA("ProximityPrompt") then
			existing:GetPropertyChangedSignal("Enabled"):Connect(function()
				local shouldBeEnabled = isOwnVehicle(model) and not (current ~= nil and current.Model == model)
				if existing.Enabled ~= shouldBeEnabled then
					existing.Enabled = shouldBeEnabled
				end
			end)
		end
	end
	for _, model in folder:GetChildren() do
		track(model)
	end
	folder.ChildAdded:Connect(track)
	VehicleController.DrivingChanged:Connect(function()
		for _, model in folder:GetChildren() do
			updatePrompt(model)
		end
	end)
end

--------------------------------------------------------------------------------
-- API pública
--------------------------------------------------------------------------------

function VehicleController.IsDriving(): boolean
	return current ~= nil
end

function VehicleController.GetSpeed(): number
	local state = current
	if not state then
		return 0
	end
	return state.Chassis.AssemblyLinearVelocity.Magnitude
end

function VehicleController.GetVehicleModel(): Model?
	local state = current
	return state and state.Model
end

function VehicleController.RequestSpawn()
	Remotes.Get("SpawnVehicle"):FireServer()
end

function VehicleController.RequestReset()
	Remotes.Get("ResetVehicle"):FireServer()
end

function VehicleController.Init() end

function VehicleController.Start()
	local function hookCharacter(character: Model)
		stopDriving()
		local humanoid = character:WaitForChild("Humanoid", 10)
		if not humanoid or not humanoid:IsA("Humanoid") then
			return
		end
		humanoid:GetPropertyChangedSignal("SeatPart"):Connect(function()
			local seatPart = humanoid.SeatPart
			if seatPart and seatPart:IsA("VehicleSeat") then
				startDriving(seatPart, humanoid)
			else
				stopDriving()
			end
		end)
		humanoid.Died:Connect(stopDriving)
	end
	if player.Character then
		task.spawn(hookCharacter, player.Character)
	end
	player.CharacterAdded:Connect(hookCharacter)

	Remotes.Get("VehicleReset").OnClientEvent:Connect(function()
		local state = current
		if state then
			state.ResyncFrames = 10
		end
	end)

	ContextActionService:BindAction(
		"EntregaHandbrake",
		function(_name: string, inputState: Enum.UserInputState): Enum.ContextActionResult
			handbrake = inputState == Enum.UserInputState.Begin
			return Enum.ContextActionResult.Pass
		end,
		false,
		Enum.KeyCode.LeftShift,
		Enum.KeyCode.ButtonB
	)

	ContextActionService:BindAction(
		"EntregaResetVehicle",
		function(_name: string, inputState: Enum.UserInputState): Enum.ContextActionResult
			if inputState == Enum.UserInputState.Begin then
				VehicleController.RequestReset()
			end
			return Enum.ContextActionResult.Pass
		end,
		false,
		Enum.KeyCode.R
	)

	RunService.PreSimulation:Connect(step)
	task.spawn(watchVehicles)
end

return VehicleController
