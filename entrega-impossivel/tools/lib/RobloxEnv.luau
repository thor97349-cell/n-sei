-- Executa ModuleScripts de um arquivo .rbxl fora do Roblox Studio, usando o Lune
-- (https://lune-org.github.io). Usado para gerar o mapa no arquivo do jogo e para os
-- testes automatizados. Só existe para desenvolvimento — não vai para o jogo.
--
-- Opções (para testes de integração):
--   Services  = { Players = mock, ... }   serviços falsos devolvidos por game:GetService
--   GameFields = { JobId = "..." }        campos/métodos extras do objeto `game`
--   Overrides = { ["ServerScriptService.Server.Services.X"] = mock }  substitui módulos
--   Globals   = { Random = ... }          globais extras

local roblox = require("@lune/roblox")
local luau = require("@lune/luau")
local task = require("@lune/task")

local RobloxEnv = {}

export type Options = {
	Services: { [string]: any }?,
	GameFields: { [string]: any }?,
	Overrides: { [string]: any }?,
	Globals: { [string]: any }?,
}

-- Um `game` que devolve serviços falsos quando pedido, e o DataModel real no resto.
local function makeGameProxy(realGame: any, options: Options): any
	local services = options.Services or {}
	local fields = options.GameFields or {}
	if next(services) == nil and next(fields) == nil then
		return realGame
	end
	return setmetatable({}, {
		__index = function(_, key)
			if key == "GetService" then
				return function(_, name: string)
					return services[name] or realGame:GetService(name)
				end
			end
			if fields[key] ~= nil then
				return fields[key]
			end
			local value = realGame[key]
			if type(value) == "function" then
				return function(_, ...)
					return value(realGame, ...)
				end
			end
			return value
		end,
	})
end

function RobloxEnv.new(game: any, options: Options?)
	local opts = options or {}
	local cache: { [string]: any } = {}
	local loading: { [string]: boolean } = {}
	local proxy = makeGameProxy(game, opts)
	local services = opts.Services or {}

	local globals = {
		game = proxy,
		workspace = services.Workspace or game:GetService("Workspace"),
		Instance = roblox.Instance,
		Vector3 = roblox.Vector3,
		Vector2 = roblox.Vector2,
		CFrame = roblox.CFrame,
		Color3 = roblox.Color3,
		BrickColor = roblox.BrickColor,
		Enum = roblox.Enum,
		UDim = roblox.UDim,
		UDim2 = roblox.UDim2,
		NumberSequence = roblox.NumberSequence,
		NumberSequenceKeypoint = roblox.NumberSequenceKeypoint,
		ColorSequence = roblox.ColorSequence,
		ColorSequenceKeypoint = roblox.ColorSequenceKeypoint,
		NumberRange = roblox.NumberRange,
		PhysicalProperties = roblox.PhysicalProperties,
		Font = roblox.Font,
		Rect = roblox.Rect,
		Ray = roblox.Ray,
		Faces = roblox.Faces,
		Axes = roblox.Axes,
		task = task,
		warn = function(...)
			print("      [warn]", ...)
		end,
	}
	for name, value in opts.Globals or {} do
		globals[name] = value
	end

	local requireModule

	requireModule = function(moduleScript: any): any
		assert(moduleScript and moduleScript.ClassName == "ModuleScript", "require() espera um ModuleScript")
		local key = moduleScript:GetFullName()
		local override = opts.Overrides and opts.Overrides[key]
		if override ~= nil then
			return override
		end
		if cache[key] ~= nil then
			return cache[key]
		end
		assert(not loading[key], "require circular: " .. key)
		loading[key] = true

		local env = {}
		for name, value in globals do
			env[name] = value
		end
		env.script = moduleScript
		env.require = requireModule

		local chunk = luau.load(moduleScript.Source, { debugName = key, environment = env })
		local result = chunk()
		loading[key] = nil
		cache[key] = result
		return result
	end

	return {
		require = requireModule,
		globals = globals,
		game = proxy,
	}
end

-- Procura uma instância por caminho, ex.: find(game, "ReplicatedStorage.Shared.Map.MapLayout")
function RobloxEnv.find(root: any, path: string): any
	local current = root
	for name in string.gmatch(path, "[^%.]+") do
		if current == root and root.ClassName == "DataModel" then
			current = root:GetService(name)
		else
			local child = current:FindFirstChild(name)
			assert(child, "Não encontrado: " .. path .. " (parou em " .. name .. ")")
			current = child
		end
	end
	return current
end

return RobloxEnv
