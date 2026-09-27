--!strict
-- Sinal simples em Luau puro (sem BindableEvent), usado para comunicação entre módulos
-- do mesmo lado (servidor ↔ servidor ou cliente ↔ cliente).

export type Connection = {
	Connected: boolean,
	Disconnect: (self: Connection) -> (),
}

export type Signal = {
	Connect: (self: Signal, handler: (...any) -> ()) -> Connection,
	Fire: (self: Signal, ...any) -> (),
	DisconnectAll: (self: Signal) -> (),
}

type Handler = {
	Fn: (...any) -> (),
	Connection: Connection,
}

local Signal = {}

function Signal.new(): Signal
	local handlers: { Handler } = {}
	local self = {} :: Signal

	function self.Connect(_: Signal, fn: (...any) -> ()): Connection
		local connection = { Connected = true } :: Connection
		local handler: Handler = { Fn = fn, Connection = connection }
		function connection.Disconnect(conn: Connection)
			if not conn.Connected then
				return
			end
			conn.Connected = false
			local index = table.find(handlers, handler)
			if index then
				table.remove(handlers, index)
			end
		end
		table.insert(handlers, handler)
		return connection
	end

	function self.Fire(_: Signal, ...: any)
		-- Copia a lista para permitir desconectar durante o disparo.
		for _, handler in table.clone(handlers) do
			if handler.Connection.Connected then
				task.spawn(handler.Fn, ...)
			end
		end
	end

	function self.DisconnectAll(_: Signal)
		for _, handler in handlers do
			handler.Connection.Connected = false
		end
		table.clear(handlers)
	end

	return self
end

return Signal
