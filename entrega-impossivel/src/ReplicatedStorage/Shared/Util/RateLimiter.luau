--!strict
-- Limita a frequência com que cada jogador pode acionar uma ação (anti-spam de remotes).

export type RateLimiter = {
	Check: (self: RateLimiter, player: Player) -> boolean,
	Remaining: (self: RateLimiter, player: Player) -> number,
	Reset: (self: RateLimiter, player: Player) -> (),
}

local RateLimiter = {}

function RateLimiter.new(interval: number): RateLimiter
	local lastUse: { [Player]: number } = setmetatable({}, { __mode = "k" }) :: any
	local self = {} :: RateLimiter

	-- Retorna true (e registra o uso) se a ação está liberada.
	function self.Check(_: RateLimiter, player: Player): boolean
		local now = os.clock()
		local last = lastUse[player]
		if last and now - last < interval then
			return false
		end
		lastUse[player] = now
		return true
	end

	function self.Remaining(_: RateLimiter, player: Player): number
		local last = lastUse[player]
		if not last then
			return 0
		end
		return math.max(0, interval - (os.clock() - last))
	end

	function self.Reset(_: RateLimiter, player: Player)
		lastUse[player] = nil
	end

	return self
end

return RateLimiter
