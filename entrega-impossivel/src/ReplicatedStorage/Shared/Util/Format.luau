--!strict
-- Formatação de textos exibidos ao jogador (dinheiro, tempo, distância, velocidade).

local GameConfig = require(script.Parent.Parent.Config.GameConfig)

local Format = {}

local function groupThousands(value: number): string
	local digits = tostring(math.floor(math.abs(value)))
	local result = digits:reverse():gsub("(%d%d%d)", "%1."):reverse()
	if result:sub(1, 1) == "." then
		result = result:sub(2)
	end
	if value < 0 then
		result = "-" .. result
	end
	return result
end

-- 1250 -> "$ 1.250"
function Format.Money(value: number): string
	return GameConfig.Economy.CurrencySymbol .. " " .. groupThousands(value)
end

-- 165 -> "02:45". Nunca mostra valores negativos.
function Format.Time(seconds: number): string
	local total = math.max(0, math.ceil(seconds))
	local minutes = math.floor(total / 60)
	local secs = total % 60
	return string.format("%02d:%02d", minutes, secs)
end

-- Distância em studs -> "420 m" ou "1,2 km"
function Format.Distance(studs: number): string
	local meters = studs * GameConfig.Units.StudsToMeters
	if meters >= 1000 then
		local km = string.format("%.1f", meters / 1000):gsub("%.", ",")
		return km .. " km"
	end
	return tostring(math.floor(meters / 10 + 0.5) * 10) .. " m"
end

-- Velocidade em studs/s -> "72 km/h"
function Format.Speed(studsPerSecond: number): string
	local kmh = math.abs(studsPerSecond) * GameConfig.Units.StudsToMeters * 3.6
	return tostring(math.floor(kmh + 0.5)) .. " km/h"
end

return Format
