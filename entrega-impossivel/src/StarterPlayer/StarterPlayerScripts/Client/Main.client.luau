--!strict
-- Ponto de entrada do cliente. Liga os controladores (interface, direção, marcadores...).
-- Fica em StarterPlayerScripts, então roda uma vez por sessão (não reinicia ao morrer).

local Controllers = script.Parent.Controllers

type Controller = {
	Init: (() -> ())?,
	Start: (() -> ())?,
}

local controllers: { { Name: string, Module: Controller } } = {
	{ Name = "SoundController", Module = require(Controllers.SoundController) :: any },
	{ Name = "DeliveryClient", Module = require(Controllers.DeliveryClient) :: any },
	{ Name = "NotificationController", Module = require(Controllers.NotificationController) :: any },
	{ Name = "VehicleController", Module = require(Controllers.VehicleController) :: any },
	{ Name = "OrderBoardController", Module = require(Controllers.OrderBoardController) :: any },
	{ Name = "HUDController", Module = require(Controllers.HUDController) :: any },
	{ Name = "MarkerController", Module = require(Controllers.MarkerController) :: any },
	{ Name = "MinimapController", Module = require(Controllers.MinimapController) :: any },
	{ Name = "WeatherController", Module = require(Controllers.WeatherController) :: any },
	{ Name = "TrafficController", Module = require(Controllers.TrafficController) :: any },
	{ Name = "DebugController", Module = require(Controllers.DebugController) :: any },
}

for _, entry in controllers do
	local init = entry.Module.Init
	if init then
		local ok, err = pcall(init :: any)
		if not ok then
			warn("[Cliente] Falha ao iniciar " .. entry.Name .. ": " .. tostring(err))
		end
	end
end

for _, entry in controllers do
	local start = entry.Module.Start
	if start then
		local ok, err = pcall(start :: any)
		if not ok then
			warn("[Cliente] Falha ao ligar " .. entry.Name .. ": " .. tostring(err))
		end
	end
end
