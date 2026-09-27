-- Mini framework de testes para rodar com o Lune.

local TestKit = {}

local results = { passed = 0, failed = 0, failures = {} :: { string } }
local currentGroup = ""

function TestKit.group(name: string, fn: () -> ())
	currentGroup = name
	print("▶ " .. name)
	fn()
end

function TestKit.test(name: string, fn: () -> ())
	local ok, err = pcall(fn)
	if ok then
		results.passed += 1
		print("  ✓ " .. name)
	else
		results.failed += 1
		local message = currentGroup .. " › " .. name .. "\n      " .. tostring(err)
		table.insert(results.failures, message)
		print("  ✗ " .. name .. "\n      " .. tostring(err))
	end
end

function TestKit.expect(condition: any, message: string?)
	if not condition then
		error(message or "expectativa falhou", 2)
	end
end

function TestKit.equal(actual: any, expected: any, message: string?)
	if actual ~= expected then
		error(
			string.format(
				"%sesperado %s, recebido %s",
				message and (message .. ": ") or "",
				tostring(expected),
				tostring(actual)
			),
			2
		)
	end
end

function TestKit.finish(): boolean
	print(string.format("\n%d testes passaram, %d falharam", results.passed, results.failed))
	for _, failure in results.failures do
		print("✗ " .. failure)
	end
	return results.failed == 0
end

-- Gerador pseudo-aleatório determinístico com a mesma interface do Random do Roblox.
function TestKit.rng(seed: number)
	local state = seed
	local function nextFloat(): number
		-- LCG simples, suficiente para testes.
		state = (state * 1103515245 + 12345) % 2147483648
		return state / 2147483648
	end
	return {
		NextNumber = function(_, min: number?, max: number?): number
			local lo, hi = min or 0, max or 1
			return lo + nextFloat() * (hi - lo)
		end,
		NextInteger = function(_, min: number, max: number): number
			return math.min(max, min + math.floor(nextFloat() * (max - min + 1)))
		end,
	}
end

return TestKit
