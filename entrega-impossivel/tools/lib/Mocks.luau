-- Objetos falsos do Roblox (jogadores, remotes, DataStore, relógio) para testar os
-- serviços do servidor sem abrir o Studio.

local roblox = require("@lune/roblox")

local Vector3 = roblox.Vector3

local Mocks = {}

function Mocks.signal()
	local handlers = {}
	local signal = {}
	function signal:Connect(fn)
		local connection = { Connected = true }
		table.insert(handlers, { Fn = fn, Connection = connection })
		function connection:Disconnect()
			connection.Connected = false
		end
		return connection
	end
	function signal:Fire(...)
		for _, handler in table.clone(handlers) do
			if handler.Connection.Connected then
				handler.Fn(...)
			end
		end
	end
	function signal:Wait()
		return nil
	end
	return signal
end

function Mocks.remote(name: string)
	local remote = {
		Name = name,
		OnServerEvent = Mocks.signal(),
		OnClientEvent = Mocks.signal(),
		Sent = {} :: { [any]: { any } },
		Broadcasts = {} :: { any },
	}
	function remote:FireClient(player, payload)
		remote.Sent[player] = remote.Sent[player] or {}
		table.insert(remote.Sent[player], payload)
	end
	function remote:FireAllClients(payload)
		table.insert(remote.Broadcasts, payload)
	end
	function remote:LastSent(player)
		local list = remote.Sent[player]
		return list and list[#list]
	end
	return remote
end

-- Substituto do módulo Remotes (Setup/Get).
function Mocks.remotes()
	local all = {}
	local module = {}
	function module.Setup() end
	function module.Get(name: string)
		all[name] = all[name] or Mocks.remote(name)
		return all[name]
	end
	return module
end

function Mocks.character(position: any)
	local root = { Name = "HumanoidRootPart", Position = position }
	function root:IsA(className: string)
		return className == "BasePart"
	end
	local humanoid = { Health = 100 }
	local character = { Root = root, Humanoid = humanoid }
	function character:FindFirstChild(name: string)
		if name == "HumanoidRootPart" then
			return root
		end
		return nil
	end
	function character:FindFirstChildOfClass(className: string)
		if className == "Humanoid" then
			return humanoid
		end
		return nil
	end
	function character:MoveTo(newPosition: any)
		root.Position = newPosition
	end
	return character
end

function Mocks.players()
	local players = {
		PlayerAdded = Mocks.signal(),
		PlayerRemoving = Mocks.signal(),
		List = {},
	}
	function players:GetPlayers()
		return table.clone(players.List)
	end
	function players:GetPlayerFromCharacter(character)
		for _, player in players.List do
			if player.Character == character then
				return player
			end
		end
		return nil
	end
	function players:Add(userId: number, name: string?)
		local attributes = {}
		local player = {
			UserId = userId,
			Name = name or ("Jogador" .. userId),
			DisplayName = name or ("Jogador" .. userId),
			Parent = players,
			Character = Mocks.character(Vector3.new(0, 1, 80)),
			KickMessage = nil :: string?,
			Children = {},
			CharacterAdded = Mocks.signal(),
		}
		function player:Kick(message: string)
			player.KickMessage = message
		end
		function player:SetAttribute(key: string, value: any)
			attributes[key] = value
		end
		function player:GetAttribute(key: string)
			return attributes[key]
		end
		function player:FindFirstChild(childName: string)
			return player.Children[childName]
		end
		table.insert(players.List, player)
		players.PlayerAdded:Fire(player)
		return player
	end
	function players:Remove(player)
		local index = table.find(players.List, player)
		if index then
			table.remove(players.List, index)
		end
		player.Parent = nil
		players.PlayerRemoving:Fire(player)
	end
	return players
end

-- Relógio controlado pelo teste (substitui Workspace:GetServerTimeNow()).
function Mocks.clock(start: number?)
	local clock = { Now = start or 1000 }
	function clock:Advance(seconds: number)
		clock.Now += seconds
	end
	return clock
end

function Mocks.workspace(clock)
	local workspace = {}
	function workspace:GetServerTimeNow()
		return clock.Now
	end
	function workspace:FindFirstChild()
		return nil
	end
	return workspace
end

function Mocks.runService(isStudio: boolean)
	local runService = { Heartbeat = Mocks.signal() }
	function runService:IsStudio()
		return isStudio
	end
	function runService:IsServer()
		return true
	end
	return runService
end

local function deepCopy(value)
	if type(value) ~= "table" then
		return value
	end
	local copy = {}
	for key, inner in value do
		copy[key] = deepCopy(inner)
	end
	return copy
end

-- DataStore em memória com UpdateAsync e falhas programáveis.
function Mocks.dataStore()
	local store = {
		Data = {} :: { [string]: any },
		FailNext = 0,
		Writes = 0,
		Calls = 0,
		ErrorMessage = "502: API Services rejected request",
	}
	function store:UpdateAsync(key: string, transform)
		store.Calls += 1
		if store.FailNext > 0 then
			store.FailNext -= 1
			error(store.ErrorMessage)
		end
		local current = deepCopy(store.Data[key])
		local result = transform(current, nil)
		if result ~= nil then
			store.Data[key] = deepCopy(result)
			store.Writes += 1
		end
		return result
	end
	local service = { Store = store }
	function service:GetDataStore()
		return store
	end
	return service
end

function Mocks.httpService()
	local counter = 0
	local service = {}
	function service:GenerateGUID()
		counter += 1
		return "guid-" .. counter
	end
	return service
end

-- Random compatível com o do Roblox (determinístico).
function Mocks.randomClass(rngFactory)
	return {
		new = function(seed: number?)
			return rngFactory(seed or 12345)
		end,
	}
end

return Mocks
