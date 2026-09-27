-- Testa as regras das entregas (ofertas, prazo, recompensa, bônus) e a formatação.

local TestKit = require("../lib/TestKit")
local RobloxEnv = require("../lib/RobloxEnv")
local Vector3 = require("@lune/roblox").Vector3

return function(game: any, env: any)
	local DeliveryRules = env.require(RobloxEnv.find(game, "ReplicatedStorage.Shared.DeliveryRules"))
	local RoadNetwork = env.require(RobloxEnv.find(game, "ReplicatedStorage.Shared.Map.RoadNetwork"))
	local MapLayout = env.require(RobloxEnv.find(game, "ReplicatedStorage.Shared.Map.MapLayout"))
	local OrderConfig = env.require(RobloxEnv.find(game, "ReplicatedStorage.Shared.Config.OrderConfig"))
	local GameConfig = env.require(RobloxEnv.find(game, "ReplicatedStorage.Shared.Config.GameConfig"))
	local VehicleConfig = env.require(RobloxEnv.find(game, "ReplicatedStorage.Shared.Config.VehicleConfig"))
	local Format = env.require(RobloxEnv.find(game, "ReplicatedStorage.Shared.Util.Format"))
	local test, expect, equal = TestKit.test, TestKit.expect, TestKit.equal

	TestKit.group("Rede de ruas", function()
		test("grafo tem 36 cruzamentos e 60 trechos", function()
			equal(#RoadNetwork.GetNodes(), 36)
			equal(#RoadNetwork.GetEdges(), 60)
		end)

		test("pinguela e ponte em obras ficam fora da rota segura", function()
			local blocked = 0
			for _, edge in RoadNetwork.GetEdges() do
				if edge.Crossing == "Narrow" or edge.Crossing == "Closed" then
					expect(not edge.Routable and not edge.Spawnable, "travessia " .. edge.Crossing .. " roteável")
					blocked += 1
				end
			end
			equal(blocked, 2)
		end)

		test("rota nunca é menor que a linha reta e sempre é finita", function()
			for _, a in MapLayout.Locations do
				for _, b in MapLayout.Locations do
					if a ~= b then
						local route = RoadNetwork.RouteDistance(a.Position, b.Position)
						local straight = (Vector3.new(a.Position.X, 0, a.Position.Z) - Vector3.new(
							b.Position.X,
							0,
							b.Position.Z
						)).Magnitude
						expect(route < math.huge, a.Id .. " → " .. b.Id .. " sem rota")
						expect(route + 1 >= straight, a.Id .. " → " .. b.Id .. " menor que linha reta")
					end
				end
			end
		end)

		test("atravessar o canal pela Av. Aurora obriga a dar a volta", function()
			-- Da obra (norte do canal) até as casas logo ao sul, na mesma avenida.
			local route = RoadNetwork.RouteDistance(Vector3.new(170, 0, 250), Vector3.new(170, 0, 400))
			expect(route > 500, "rota deveria contornar pela Av. Horizonte (obtido " .. route .. ")")
		end)

		test("ponto de faixa mais próximo fica na rua e respeita exclusões", function()
			local cf = RoadNetwork.NearestLanePoint(Vector3.new(10, 5, 100))
			expect(cf, "sem ponto de faixa")
			expect(math.abs(cf.Position.Y - MapLayout.Heights.Road) < 1e-3, "altura da faixa")
			local excluded = RoadNetwork.NearestLanePoint(Vector3.new(10, 5, 100), {
				Exclude = function(p)
					return (p - cf.Position).Magnitude < 40
				end,
			})
			expect(excluded and (excluded.Position - cf.Position).Magnitude >= 40, "exclusão ignorada")
		end)
	end)

	TestKit.group("Ofertas de entrega", function()
		test("gera 3 ofertas válidas com ids únicos (1000 sorteios)", function()
			local rng = TestKit.rng(42)
			local counter = 0
			local nextId = function()
				counter += 1
				return "offer-" .. counter
			end
			local seenTypes = {}
			for _ = 1, 1000 do
				local offers = DeliveryRules.GenerateOffers(rng, 3, nextId)
				equal(#offers, 3, "quantidade de ofertas")
				local ids = {}
				for _, offer in offers do
					expect(not ids[offer.Id], "id repetido")
					ids[offer.Id] = true
					seenTypes[offer.TypeId] = true
					local orderType = OrderConfig.Types[offer.TypeId]
					expect(table.find(orderType.Pickups, offer.PickupId), "coleta fora do tipo")
					expect(offer.PickupId ~= offer.DropoffId, "coleta = destino")
					expect(MapLayout.GetLocation(offer.DropoffId).Dropoff, "destino não aceita entregas")
					expect(offer.RouteDistance >= GameConfig.Delivery.MinRouteDistance, "rota curta demais")
					expect(offer.Reward >= 5 and offer.Reward % 5 == 0, "recompensa inválida " .. offer.Reward)
					expect(offer.TimeLimit >= orderType.MinTime, "prazo abaixo do mínimo")
					expect(offer.TimeLimit <= 240, "prazo exagerado: " .. offer.TimeLimit)
				end
			end
			for _, typeId in OrderConfig.TypeOrder do
				expect(seenTypes[typeId], "tipo nunca sorteado: " .. typeId)
			end
		end)

		test("prazo é possível dirigindo na velocidade máxima do carro inicial", function()
			local starter = VehicleConfig.Vehicles.Starter.Handling.MaxSpeed
			for _, typeId in OrderConfig.TypeOrder do
				local orderType = OrderConfig.Types[typeId]
				for _, pickupId in orderType.Pickups do
					for _, loc in MapLayout.Locations do
						if loc.Dropoff and loc.Id ~= pickupId then
							local route = DeliveryRules.GetRouteDistance(pickupId, loc.Id)
							local limit = DeliveryRules.ComputeTimeLimit(orderType, route)
							-- Com 75% da velocidade máxima, média realista com curvas.
							expect(
								route / (starter * 0.75) < limit,
								typeId .. " " .. pickupId .. "→" .. loc.Id .. " impossível"
							)
						end
					end
				end
			end
		end)

		test("pacote urgente paga mais que pizza na mesma distância", function()
			local urgent = DeliveryRules.ComputeReward(OrderConfig.Types.PacoteUrgente, 1000)
			local pizza = DeliveryRules.ComputeReward(OrderConfig.Types.Pizza, 1000)
			expect(urgent > pizza * 2, "urgente deveria pagar bem mais")
			local urgentTime = DeliveryRules.ComputeTimeLimit(OrderConfig.Types.PacoteUrgente, 1000)
			local packageTime = DeliveryRules.ComputeTimeLimit(OrderConfig.Types.Pacote, 1000)
			expect(urgentTime < packageTime, "urgente deveria ter menos tempo")
		end)
	end)

	TestKit.group("Pagamento", function()
		local offer = {
			Id = "x",
			TypeId = "Pizza",
			PickupId = "Pizzaria",
			DropoffId = "Hospital",
			Reward = 200,
			TimeLimit = 100,
			RouteDistance = 900,
		}

		test("entrega relâmpago dá 35% de bônus", function()
			local payout = DeliveryRules.ComputePayout(offer, 60)
			equal(payout.Bonus, 70)
			equal(payout.Total, 270)
			expect(not payout.Late)
		end)

		test("entrega rápida dá 15% de bônus", function()
			local payout = DeliveryRules.ComputePayout(offer, 30)
			equal(payout.Bonus, 30)
			equal(payout.Total, 230)
		end)

		test("entrega no limite paga o valor normal", function()
			local payout = DeliveryRules.ComputePayout(offer, 5)
			equal(payout.Bonus, 0)
			equal(payout.Total, 200)
		end)

		test("entrega atrasada paga 40% e nunca é negativa", function()
			local payout = DeliveryRules.ComputePayout(offer, -10)
			expect(payout.Late)
			equal(payout.Total, 80)
			expect(payout.Total >= 0)
		end)

		test("tempo mínimo plausível bloqueia teleporte", function()
			local minimum =
				DeliveryRules.MinimumPlausibleTime("Distribuicao", "PostoRota66", VehicleConfig.GetFastestSpeed())
			expect(minimum > 10, "tempo mínimo baixo demais: " .. minimum)
		end)
	end)

	TestKit.group("Formatação", function()
		test("dinheiro com separador de milhar", function()
			equal(Format.Money(0), "$ 0")
			equal(Format.Money(350), "$ 350")
			equal(Format.Money(1250), "$ 1.250")
			equal(Format.Money(1234567), "$ 1.234.567")
		end)

		test("tempo mm:ss sem negativos", function()
			equal(Format.Time(165), "02:45")
			equal(Format.Time(20.2), "00:21")
			equal(Format.Time(-5), "00:00")
		end)

		test("distância e velocidade", function()
			equal(Format.Distance(840), "420 m")
			equal(Format.Distance(2400), "1,2 km")
			equal(Format.Speed(60), "108 km/h")
		end)
	end)
end
