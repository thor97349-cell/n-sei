--!strict
-- Desenha a tempestade no cliente quando o servidor muda ReplicatedStorage.Weather:
-- céu escuro, neblina, nuvens, chuva ao redor da câmera e relâmpagos de vez em quando.

local Lighting = game:GetService("Lighting")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local Workspace = game:GetService("Workspace")

local UIUtil = require(script.Parent.Parent.UI.UIUtil)

local WeatherController = {}

type Saved = {
	Brightness: number,
	OutdoorAmbient: Color3,
	AtmosphereDensity: number?,
	AtmosphereHaze: number?,
	AtmosphereColor: Color3?,
	TintColor: Color3?,
	Saturation: number?,
}

local saved: Saved? = nil
local raining = false
local rainPart: Part? = nil
local clouds: Clouds? = nil
local stormToken = 0

local TRANSITION = 3

local function atmosphere(): Atmosphere?
	return Lighting:FindFirstChildOfClass("Atmosphere")
end

local function colorCorrection(): ColorCorrectionEffect?
	return Lighting:FindFirstChildOfClass("ColorCorrectionEffect")
end

local function save(): Saved
	local atmo = atmosphere()
	local correction = colorCorrection()
	return {
		Brightness = Lighting.Brightness,
		OutdoorAmbient = Lighting.OutdoorAmbient,
		AtmosphereDensity = atmo and atmo.Density,
		AtmosphereHaze = atmo and atmo.Haze,
		AtmosphereColor = atmo and atmo.Color,
		TintColor = correction and correction.TintColor,
		Saturation = correction and correction.Saturation,
	}
end

local function createRain(): Part
	local part = Instance.new("Part")
	part.Name = "RainEmitter"
	part.Anchored = true
	part.CanCollide = false
	part.CanQuery = false
	part.CanTouch = false
	part.Transparency = 1
	part.Size = Vector3.new(140, 1, 140)
	local emitter = Instance.new("ParticleEmitter")
	emitter.Name = "Rain"
	emitter.EmissionDirection = Enum.NormalId.Bottom
	emitter.Rate = 700
	emitter.Lifetime = NumberRange.new(0.8, 1)
	emitter.Speed = NumberRange.new(110, 130)
	emitter.SpreadAngle = Vector2.new(4, 4)
	emitter.Size = NumberSequence.new(0.14)
	emitter.Squash = NumberSequence.new(2.5)
	emitter.Orientation = Enum.ParticleOrientation.VelocityParallel
	emitter.Color = ColorSequence.new(Color3.fromRGB(200, 220, 255))
	emitter.Transparency = NumberSequence.new(0.35)
	emitter.LightEmission = 0.2
	emitter.Parent = part
	local effects = Workspace:FindFirstChild("LocalEffects") or Workspace
	part.Parent = effects
	return part
end

local function startStorm()
	if raining then
		return
	end
	raining = true
	stormToken += 1
	local token = stormToken
	if not saved then
		saved = save()
	end
	UIUtil.Tween(Lighting, TRANSITION, {
		Brightness = 1.1,
		OutdoorAmbient = Color3.fromRGB(95, 100, 115),
	})
	local atmo = atmosphere()
	if atmo then
		UIUtil.Tween(atmo, TRANSITION, { Density = 0.6, Haze = 3, Color = Color3.fromRGB(150, 158, 170) })
	end
	local correction = colorCorrection()
	if correction then
		UIUtil.Tween(correction, TRANSITION, { TintColor = Color3.fromRGB(205, 215, 235), Saturation = -0.05 })
	end
	local terrain = Workspace:FindFirstChildOfClass("Terrain")
	if terrain then
		local newClouds = terrain:FindFirstChildOfClass("Clouds") or Instance.new("Clouds")
		newClouds.Cover = 0.3
		newClouds.Density = 0.8
		newClouds.Color = Color3.fromRGB(110, 115, 125)
		newClouds.Parent = terrain
		clouds = newClouds
		UIUtil.Tween(newClouds, TRANSITION, { Cover = 0.9 })
	end
	rainPart = createRain()

	-- Relâmpagos ocasionais.
	task.spawn(function()
		while raining and token == stormToken do
			task.wait(math.random(7, 15))
			if not raining or token ~= stormToken then
				break
			end
			local original = Lighting.Brightness
			Lighting.Brightness = 4
			task.wait(0.08)
			Lighting.Brightness = original
			task.wait(0.12)
			Lighting.Brightness = 3.2
			task.wait(0.06)
			Lighting.Brightness = original
		end
	end)
end

local function stopStorm()
	if not raining then
		return
	end
	raining = false
	stormToken += 1
	local restore = saved
	if restore then
		UIUtil.Tween(Lighting, TRANSITION, { Brightness = restore.Brightness, OutdoorAmbient = restore.OutdoorAmbient })
		local atmo = atmosphere()
		if atmo and restore.AtmosphereDensity and restore.AtmosphereHaze and restore.AtmosphereColor then
			UIUtil.Tween(atmo, TRANSITION, {
				Density = restore.AtmosphereDensity,
				Haze = restore.AtmosphereHaze,
				Color = restore.AtmosphereColor,
			})
		end
		local correction = colorCorrection()
		if correction and restore.TintColor and restore.Saturation then
			UIUtil.Tween(correction, TRANSITION, { TintColor = restore.TintColor, Saturation = restore.Saturation })
		end
	end
	local currentClouds = clouds
	if currentClouds then
		UIUtil.Tween(currentClouds, TRANSITION, { Cover = 0.3 })
	end
	local rain = rainPart
	rainPart = nil
	if rain then
		local emitter = rain:FindFirstChildOfClass("ParticleEmitter")
		if emitter then
			emitter.Enabled = false
		end
		task.delay(1.5, function()
			rain:Destroy()
		end)
	end
end

local function apply()
	if ReplicatedStorage:GetAttribute("Weather") == "Storm" then
		startStorm()
	else
		stopStorm()
	end
end

function WeatherController.Init() end

function WeatherController.Start()
	ReplicatedStorage:GetAttributeChangedSignal("Weather"):Connect(apply)
	apply()
	RunService.RenderStepped:Connect(function()
		local rain = rainPart
		local camera = Workspace.CurrentCamera
		if rain and camera then
			rain.CFrame = CFrame.new(camera.CFrame.Position + Vector3.new(0, 45, 0))
		end
	end)
end

return WeatherController
