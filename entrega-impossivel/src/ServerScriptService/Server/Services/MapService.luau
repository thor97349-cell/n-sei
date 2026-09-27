--!strict
-- Garante que o mapa, as pastas de runtime e a iluminação existam quando o servidor liga.

local Lighting = game:GetService("Lighting")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local MapLayout = require(ReplicatedStorage.Shared.Map.MapLayout)
local MapBuilder = require(script.Parent.Parent.Map.MapBuilder)

local MapService = {}

local function ensureLighting()
	-- O arquivo do jogo já vem com isto; aqui é só para quem sincroniza num lugar vazio.
	if not Lighting:FindFirstChildOfClass("Atmosphere") then
		local atmosphere = Instance.new("Atmosphere")
		atmosphere.Density = 0.28
		atmosphere.Offset = 0.25
		atmosphere.Color = Color3.fromRGB(199, 209, 230)
		atmosphere.Decay = Color3.fromRGB(107, 112, 128)
		atmosphere.Glare = 0.2
		atmosphere.Haze = 1.2
		atmosphere.Parent = Lighting
	end
	if not Lighting:FindFirstChildOfClass("ColorCorrectionEffect") then
		local correction = Instance.new("ColorCorrectionEffect")
		correction.Saturation = 0.18
		correction.Contrast = 0.06
		correction.Parent = Lighting
	end
	if not Lighting:FindFirstChildOfClass("BloomEffect") then
		local bloom = Instance.new("BloomEffect")
		bloom.Intensity = 0.5
		bloom.Size = 24
		bloom.Threshold = 1.6
		bloom.Parent = Lighting
	end
end

function MapService.Init()
	local map = Workspace:FindFirstChild("Map")
	if not map then
		warn("[MapService] workspace.Map não encontrado — construindo a cidade agora.")
		MapBuilder.Build(Workspace)
	elseif map:GetAttribute("LayoutVersion") ~= MapLayout.Version then
		warn(
			"[MapService] O mapa salvo no lugar é de outra versão da planta (MapLayout.Version). "
				.. "Apague workspace.Map para reconstruir, ou gere o arquivo de novo."
		)
	end
	ensureLighting()
end

function MapService.Start() end

return MapService
