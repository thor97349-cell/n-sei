--!strict
-- Obstáculos derrubáveis (barris e cones) voltam sozinhos para o lugar depois de um
-- tempo, quando ninguém está por perto.

local CollectionService = game:GetService("CollectionService")
local Players = game:GetService("Players")
local Workspace = game:GetService("Workspace")

local MapBuilder = require(script.Parent.Parent.Map.MapBuilder)

local RESET_INTERVAL = 25
local NOBODY_NEAR_RADIUS = 45
local DISPLACED_DISTANCE = 2.5

local ObstacleService = {}

local function isAnyoneNear(position: Vector3): boolean
	for _, player in Players:GetPlayers() do
		local character = player.Character
		local root = character and character:FindFirstChild("HumanoidRootPart")
		if root and root:IsA("BasePart") and (root.Position - position).Magnitude < NOBODY_NEAR_RADIUS then
			return true
		end
	end
	local vehicles = Workspace:FindFirstChild("Vehicles")
	if vehicles then
		for _, model in vehicles:GetChildren() do
			if
				model:IsA("Model")
				and model.PrimaryPart
				and (model.PrimaryPart.Position - position).Magnitude < NOBODY_NEAR_RADIUS
			then
				return true
			end
		end
	end
	return false
end

local function resetDisplaced()
	for _, instance in CollectionService:GetTagged(MapBuilder.KnockableTag) do
		if instance:IsA("BasePart") and not instance.Anchored and instance:IsDescendantOf(Workspace) then
			local home = instance:GetAttribute("HomeCFrame")
			if typeof(home) == "CFrame" then
				local moved = (instance.Position - home.Position).Magnitude > DISPLACED_DISTANCE
				local tipped = instance.CFrame.RightVector:Dot(home.RightVector) < 0.9
				if (moved or tipped) and not isAnyoneNear(home.Position) and not isAnyoneNear(instance.Position) then
					instance.AssemblyLinearVelocity = Vector3.zero
					instance.AssemblyAngularVelocity = Vector3.zero
					instance.CFrame = home
				end
			end
		end
	end
end

function ObstacleService.Init() end

function ObstacleService.Start()
	task.spawn(function()
		while true do
			task.wait(RESET_INTERVAL)
			resetDisplaced()
		end
	end)
end

return ObstacleService
