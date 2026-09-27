--!strict
-- Comandos de teste. SÓ funcionam dentro do Roblox Studio: em servidores publicados o
-- servidor ignora tudo que chega por este remote.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Remotes = require(ReplicatedStorage.Shared.Util.Remotes)
local RateLimiter = require(ReplicatedStorage.Shared.Util.RateLimiter)

local EconomyService = require(script.Parent.EconomyService)
local EventService = require(script.Parent.EventService)
local NotificationService = require(script.Parent.NotificationService)

local DebugService = {}

local limiter = RateLimiter.new(0.5)

local function handle(player: Player, command: unknown)
	if not RunService:IsStudio() then
		return
	end
	if type(command) ~= "string" or #command > 40 or not limiter:Check(player) then
		return
	end
	local eventId = string.match(command, "^event:(%a+)$")
	if eventId then
		if EventService.TriggerEvent(eventId) then
			NotificationService.Send(player, "🛠️ Evento forçado: " .. eventId, "info", 2)
		end
	elseif command == "stopevent" then
		EventService.StopActiveEvent()
	elseif command == "money" then
		EconomyService.AddMoney(player, 1000, "debug")
	end
end

function DebugService.Init() end

function DebugService.Start()
	Remotes.Get("DebugCommand").OnServerEvent:Connect(handle)
end

return DebugService
