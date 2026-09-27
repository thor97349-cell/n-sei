-- Uso: lune run tools/run_tests.luau build/_base.rbxl
-- Carrega o lugar gerado pelo Rojo e executa os testes em tools/tests.

local fs = require("@lune/fs")
local process = require("@lune/process")
local roblox = require("@lune/roblox")

local RobloxEnv = require("./lib/RobloxEnv")
local TestKit = require("./lib/TestKit")

local placePath = process.args[1] or "build/_base.rbxl"
local game = roblox.deserializePlace(fs.readFile(placePath))
local env = RobloxEnv.new(game)

local specs = {
	require("./tests/layout.spec"),
	require("./tests/rules.spec"),
	require("./tests/mapbuild.spec"),
	require("./tests/services.spec"),
	require("./tests/events.spec"),
}

for _, spec in specs do
	spec(game, env)
end

-- process.exit encerra também os loops de fundo dos serviços testados.
process.exit(if TestKit.finish() then 0 else 1)
