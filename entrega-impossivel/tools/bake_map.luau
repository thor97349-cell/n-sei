-- Uso: lune run tools/bake_map.luau <entrada.rbxl> <saida.rbxl>
-- Executa o MapBuilder do próprio jogo e grava o lugar com workspace.Map já pronto,
-- para a cidade aparecer no Roblox Studio mesmo em modo de edição.

local fs = require("@lune/fs")
local process = require("@lune/process")
local roblox = require("@lune/roblox")

local RobloxEnv = require("./lib/RobloxEnv")

local input = process.args[1] or "build/_base.rbxl"
local output = process.args[2] or "build/EntregaImpossivel.rbxl"

local game = roblox.deserializePlace(fs.readFile(input))
local env = RobloxEnv.new(game)

local MapBuilder = env.require(RobloxEnv.find(game, "ServerScriptService.Server.Map.MapBuilder"))
local workspace = game:GetService("Workspace")
local map = MapBuilder.Build(workspace)

local parts = 0
for _, descendant in map:GetDescendants() do
	if descendant:IsA("BasePart") then
		parts += 1
	end
end

fs.writeFile(output, roblox.serializePlace(game))
print(string.format("Mapa gerado com %d partes → %s", parts, output))
