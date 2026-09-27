--!strict
-- Ponto de entrada do servidor. Cria os RemoteEvents e liga os serviços na ordem certa.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Remotes = require(ReplicatedStorage.Shared.Util.Remotes)

Remotes.Setup()

local Services = script.Parent.Services

type Service = {
	Init: (() -> ())?,
	Start: (() -> ())?,
}

-- Ordem importa: o mapa e os dados vêm primeiro; quem depende deles vem depois.
local services: { { Name: string, Module: Service } } = {
	{ Name = "MapService", Module = require(Services.MapService) :: any },
	{ Name = "DataService", Module = require(Services.DataService) :: any },
	{ Name = "EconomyService", Module = require(Services.EconomyService) :: any },
	{ Name = "EventService", Module = require(Services.EventService) :: any },
	{ Name = "VehicleService", Module = require(Services.VehicleService) :: any },
	{ Name = "DeliveryService", Module = require(Services.DeliveryService) :: any },
	{ Name = "ObstacleService", Module = require(Services.ObstacleService) :: any },
	{ Name = "DebugService", Module = require(Services.DebugService) :: any },
}

for _, entry in services do
	local init = entry.Module.Init
	if init then
		local ok, err = pcall(init :: any)
		if not ok then
			warn("[Main] Falha ao iniciar " .. entry.Name .. ": " .. tostring(err))
		end
	end
end

for _, entry in services do
	local start = entry.Module.Start
	if start then
		local ok, err = pcall(start :: any)
		if not ok then
			warn("[Main] Falha ao ligar " .. entry.Name .. ": " .. tostring(err))
		end
	end
end

print("[ENTREGA IMPOSSÍVEL] Servidor pronto.")
