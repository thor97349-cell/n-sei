-- Testes de integração: roda DeliveryService e DataService de verdade, com jogadores,
-- remotes, relógio e DataStore simulados.

local task = require("@lune/task")
local roblox = require("@lune/roblox")

local TestKit = require("../lib/TestKit")
local RobloxEnv = require("../lib/RobloxEnv")
local Mocks = require("../lib/Mocks")

local Vector3 = roblox.Vector3

local SERVICES = "ServerScriptService.Server.Services."

return function(game: any, _env: any)
	local test, expect, equal = TestKit.test, TestKit.expect, TestKit.equal

	-- Nome completo (GetFullName) de um ModuleScript no lugar carregado.
	local function fullName(path: string): string
		return RobloxEnv.find(game, path):GetFullName()
	end

	----------------------------------------------------------------------------
	-- DeliveryService
	----------------------------------------------------------------------------
	TestKit.group("DeliveryService (integração)", function()
		local clock = Mocks.clock(5000)
		local players = Mocks.players()
		local remotes = Mocks.remotes()
		local datas = {}
		local money = {}
		local payments = {}
		local observers = {}

		local dataServiceMock = {
			GetData = function(player)
				return datas[player]
			end,
			IsPersistent = function()
				return true
			end,
			ObserveProfiles = function(callback)
				table.insert(observers, callback)
				for player in datas do
					callback(player, datas[player])
				end
				return { Disconnect = function() end }
			end,
		}
		local economyMock = {
			AddMoney = function(player, amount)
				money[player] = (money[player] or 0) + amount
				table.insert(payments, amount)
				return true
			end,
		}
		local notificationMock = { Send = function() end, Broadcast = function() end }

		local env = RobloxEnv.new(game, {
			Services = {
				Players = players,
				Workspace = Mocks.workspace(clock),
				HttpService = Mocks.httpService(),
			},
			Overrides = {
				[fullName("ReplicatedStorage.Shared.Util.Remotes")] = remotes,
				[fullName(SERVICES .. "DataService")] = dataServiceMock,
				[fullName(SERVICES .. "EconomyService")] = economyMock,
				[fullName(SERVICES .. "NotificationService")] = notificationMock,
			},
			Globals = { Random = Mocks.randomClass(TestKit.rng) },
		})
		local GameConfig = env.require(RobloxEnv.find(game, "ReplicatedStorage.Shared.Config.GameConfig"))
		local MapLayout = env.require(RobloxEnv.find(game, "ReplicatedStorage.Shared.Map.MapLayout"))
		local DeliveryRules = env.require(RobloxEnv.find(game, "ReplicatedStorage.Shared.DeliveryRules"))
		GameConfig.Delivery.MonitorInterval = 1e6 -- o teste chama Tick() manualmente
		local DeliveryService = env.require(RobloxEnv.find(game, SERVICES .. "DeliveryService"))
		DeliveryService.Init()
		DeliveryService.Start()

		local stateRemote = remotes.Get("DeliveryState")
		local acceptRemote = remotes.Get("AcceptOrder")
		local cancelRemote = remotes.Get("CancelOrder")
		local rerollRemote = remotes.Get("RerollOffers")

		local function join(userId: number)
			local player = players:Add(userId)
			datas[player] = {
				Money = 0,
				Stats = {
					DeliveriesCompleted = 0,
					DeliveriesLate = 0,
					DeliveriesFailed = 0,
					FastDeliveries = 0,
					TotalEarned = 0,
				},
			}
			for _, callback in observers do
				callback(player, datas[player])
			end
			return player
		end

		local function last(player)
			return stateRemote:LastSent(player)
		end

		local function moveTo(player, locationId: string)
			local location = MapLayout.GetLocation(locationId)
			player.Character:MoveTo(location.Position + Vector3.new(3, 2.5, 2))
		end

		local function waitLimiter()
			task.wait(0.35) -- os limitadores anti-spam usam tempo real
		end

		local alice = join(1)
		local bob = join(2)

		test("jogador recebe 3 ofertas ao carregar", function()
			local state = last(alice)
			equal(state.Status, "Idle")
			equal(#state.Offers, 3)
		end)

		test("id de oferta inválido ou de outro jogador é ignorado", function()
			acceptRemote.OnServerEvent:Fire(alice, "nao-existe")
			equal(DeliveryService.GetStatus(alice), "Idle")
			waitLimiter()
			acceptRemote.OnServerEvent:Fire(alice, 12345)
			equal(DeliveryService.GetStatus(alice), "Idle")
			waitLimiter()
			local bobOffer = last(bob).Offers[1].Id
			acceptRemote.OnServerEvent:Fire(alice, bobOffer)
			equal(DeliveryService.GetStatus(alice), "Idle", "Alice pegou pedido do Bob")
			waitLimiter()
		end)

		local offer
		test("aceitar oferta leva à coleta, sem timer ainda", function()
			offer = last(alice).Offers[1]
			acceptRemote.OnServerEvent:Fire(alice, offer.Id)
			local state = last(alice)
			equal(state.Status, "ToPickup")
			equal(state.Order.Offer.Id, offer.Id)
			expect(state.Order.Deadline == nil, "timer começou antes da coleta")
			DeliveryService.Tick()
			equal(DeliveryService.GetStatus(alice), "ToPickup")
		end)

		test("Bob parado no ponto de coleta da Alice não afeta ninguém", function()
			moveTo(bob, offer.PickupId)
			DeliveryService.Tick()
			equal(DeliveryService.GetStatus(alice), "ToPickup")
			equal(DeliveryService.GetStatus(bob), "Idle")
		end)

		test("chegar na coleta inicia o timer", function()
			moveTo(alice, offer.PickupId)
			DeliveryService.Tick()
			local state = last(alice)
			equal(state.Status, "ToDropoff")
			equal(state.Order.Deadline, clock.Now + offer.TimeLimit)
		end)

		test("teleporte direto para o destino não conta", function()
			moveTo(alice, offer.DropoffId)
			DeliveryService.Tick()
			equal(DeliveryService.GetStatus(alice), "ToDropoff")
			equal(#payments, 0)
		end)

		test("entrega rápida paga recompensa + bônus uma única vez", function()
			clock:Advance(DeliveryRules.MinimumPlausibleTime(offer.PickupId, offer.DropoffId, 60) + 1)
			local expected = DeliveryRules.ComputePayout(
				offer,
				offer.TimeLimit - (DeliveryRules.MinimumPlausibleTime(offer.PickupId, offer.DropoffId, 60) + 1)
			)
			DeliveryService.Tick()
			DeliveryService.Tick()
			DeliveryService.Tick()
			equal(DeliveryService.GetStatus(alice), "Result")
			equal(#payments, 1, "pagamentos")
			equal(money[alice], expected.Total)
			expect(expected.Bonus > 0, "deveria ter bônus")
			local state = last(alice)
			expect(state.Result.Success and not state.Result.Late)
			equal(datas[alice].Stats.DeliveriesCompleted, 1)
		end)

		test("depois do resultado, novas ofertas aparecem", function()
			clock:Advance(GameConfig.Delivery.ResultDuration + 0.1)
			DeliveryService.Tick()
			local state = last(alice)
			equal(state.Status, "Idle")
			equal(#state.Offers, 3)
			expect(state.Offers[1].Id ~= offer.Id, "ofertas repetidas")
			equal(#payments, 1)
		end)

		test("entrega atrasada paga só uma parte (dentro da tolerância)", function()
			waitLimiter()
			local lateOffer = last(alice).Offers[2]
			acceptRemote.OnServerEvent:Fire(alice, lateOffer.Id)
			moveTo(alice, lateOffer.PickupId)
			DeliveryService.Tick()
			clock:Advance(lateOffer.TimeLimit + 5)
			DeliveryService.Tick()
			equal(DeliveryService.GetStatus(alice), "ToDropoff", "cancelou cedo demais")
			moveTo(alice, lateOffer.DropoffId)
			DeliveryService.Tick()
			local state = last(alice)
			equal(state.Status, "Result")
			expect(state.Result.Late, "deveria estar atrasada")
			equal(state.Result.Total, math.floor(lateOffer.Reward * GameConfig.Delivery.LateRewardMultiplier))
			equal(datas[alice].Stats.DeliveriesLate, 1)
		end)

		test("prazo + tolerância esgotados: falha sem perder dinheiro", function()
			clock:Advance(GameConfig.Delivery.ResultDuration + 0.1)
			DeliveryService.Tick()
			waitLimiter()
			local before = money[alice]
			local failOffer = last(alice).Offers[1]
			acceptRemote.OnServerEvent:Fire(alice, failOffer.Id)
			moveTo(alice, failOffer.PickupId)
			DeliveryService.Tick()
			clock:Advance(failOffer.TimeLimit + GameConfig.Delivery.LateGracePeriod + 1)
			DeliveryService.Tick()
			local state = last(alice)
			equal(state.Status, "Result")
			expect(not state.Result.Success)
			equal(money[alice], before, "dinheiro mudou")
			equal(datas[alice].Stats.DeliveriesFailed, 1)
		end)

		test("cancelar volta às ofertas e respeita o intervalo para aceitar", function()
			clock:Advance(GameConfig.Delivery.ResultDuration + 0.1)
			DeliveryService.Tick()
			waitLimiter()
			acceptRemote.OnServerEvent:Fire(bob, last(bob).Offers[1].Id)
			equal(DeliveryService.GetStatus(bob), "ToPickup")
			cancelRemote.OnServerEvent:Fire(bob)
			equal(DeliveryService.GetStatus(bob), "Idle")
			waitLimiter()
			acceptRemote.OnServerEvent:Fire(bob, last(bob).Offers[1].Id)
			equal(DeliveryService.GetStatus(bob), "Idle", "aceitou durante o intervalo")
			clock:Advance(GameConfig.Delivery.CancelCooldown + 0.1)
			waitLimiter()
			acceptRemote.OnServerEvent:Fire(bob, last(bob).Offers[1].Id)
			equal(DeliveryService.GetStatus(bob), "ToPickup")
		end)

		test("pedir novas ofertas respeita o cooldown", function()
			local carol = join(3)
			local first = last(carol).Offers[1].Id
			rerollRemote.OnServerEvent:Fire(carol)
			local second = last(carol).Offers[1].Id
			expect(first ~= second, "não trocou as ofertas")
			waitLimiter()
			waitLimiter()
			rerollRemote.OnServerEvent:Fire(carol)
			equal(last(carol).Offers[1].Id, second, "trocou durante o cooldown")
		end)

		test("jogador que sai é removido sem erro", function()
			players:Remove(bob)
			DeliveryService.Tick()
			equal(DeliveryService.GetStatus(bob), nil)
		end)
	end)

	----------------------------------------------------------------------------
	-- DataService
	----------------------------------------------------------------------------
	local function newDataEnv(isStudio: boolean)
		local players = Mocks.players()
		local dataStoreService = Mocks.dataStore()
		local closeHandlers = {}
		local env = RobloxEnv.new(game, {
			Services = {
				Players = players,
				DataStoreService = dataStoreService,
				RunService = Mocks.runService(isStudio),
			},
			GameFields = {
				JobId = "server-A",
				BindToClose = function(_, handler)
					table.insert(closeHandlers, handler)
				end,
			},
		})
		local GameConfig = env.require(RobloxEnv.find(game, "ReplicatedStorage.Shared.Config.GameConfig"))
		GameConfig.Data.RetryBaseDelay = 0.01
		GameConfig.Data.SessionLockRetryDelay = 0.02
		GameConfig.Data.SessionLockWait = 0.2
		GameConfig.Data.AutosaveInterval = 1e6
		GameConfig.Data.MaxLoadAttempts = 3
		GameConfig.Data.MaxSaveAttempts = 3
		local DataService = env.require(RobloxEnv.find(game, SERVICES .. "DataService"))
		DataService.Init()
		DataService.Start()
		return {
			Players = players,
			Store = dataStoreService.Store,
			DataService = DataService,
			CloseHandlers = closeHandlers,
		}
	end

	TestKit.group("DataService (integração)", function()
		test("jogador novo começa com $0 e o servidor assume a trava", function()
			local ctx = newDataEnv(false)
			local player = ctx.Players:Add(10)
			local data = ctx.DataService.GetData(player)
			expect(data, "dados não carregaram")
			equal(data.Money, 0)
			equal(data.Vehicles.Equipped, "Starter")
			equal(ctx.Store.Data.Player_10.SessionLock.JobId, "server-A")
			expect(ctx.DataService.IsPersistent(player))
		end)

		test("dinheiro salvo é carregado e salvo de novo ao sair (trava liberada)", function()
			local ctx = newDataEnv(false)
			ctx.Store.Data.Player_11 = { Money = 1234, Stats = { DeliveriesCompleted = 7 } }
			local player = ctx.Players:Add(11)
			local data = ctx.DataService.GetData(player)
			equal(data.Money, 1234)
			equal(data.Stats.DeliveriesCompleted, 7)
			data.Money += 350
			ctx.Players:Remove(player)
			equal(ctx.Store.Data.Player_11.Money, 1584)
			equal(ctx.Store.Data.Player_11.SessionLock, nil)
			equal(ctx.DataService.GetData(player), nil)
		end)

		test("falhas temporárias do Roblox: tenta de novo e carrega", function()
			local ctx = newDataEnv(false)
			ctx.Store.Data.Player_12 = { Money = 900 }
			ctx.Store.FailNext = 2
			local player = ctx.Players:Add(12)
			equal(ctx.DataService.GetData(player).Money, 900)
			equal(player.KickMessage, nil)
		end)

		test("falha permanente: jogador é desconectado e o save NÃO é sobrescrito", function()
			local ctx = newDataEnv(false)
			ctx.Store.Data.Player_13 = { Money = 777 }
			ctx.Store.FailNext = 99
			local player = ctx.Players:Add(13)
			expect(player.KickMessage, "deveria desconectar")
			equal(ctx.DataService.GetData(player), nil)
			ctx.Store.FailNext = 0
			ctx.Players:Remove(player)
			equal(ctx.Store.Data.Player_13.Money, 777)
			equal(ctx.Store.Writes, 0)
		end)

		test("trava de outro servidor: espera e depois assume sem perder dados", function()
			local ctx = newDataEnv(false)
			ctx.Store.Data.Player_14 = { Money = 500, SessionLock = { JobId = "server-B", Time = os.time() } }
			local player = ctx.Players:Add(14)
			equal(ctx.DataService.GetData(player).Money, 500)
			equal(ctx.Store.Data.Player_14.SessionLock.JobId, "server-A")
			expect(ctx.Store.Calls > 1, "deveria ter esperado a outra sessão")
		end)

		test("se outro servidor assumiu, este não sobrescreve o save", function()
			local ctx = newDataEnv(false)
			local player = ctx.Players:Add(15)
			ctx.DataService.GetData(player).Money = 10
			ctx.Store.Data.Player_15.Money = 999
			ctx.Store.Data.Player_15.SessionLock = { JobId = "server-C", Time = os.time() }
			ctx.Players:Remove(player)
			equal(ctx.Store.Data.Player_15.Money, 999)
		end)

		test("valores corrompidos viram padrão seguro", function()
			local ctx = newDataEnv(false)
			ctx.Store.Data.Player_16 =
				{ Money = "muito", Stats = { DeliveriesCompleted = -3 }, Vehicles = { Equipped = "Foguete" } }
			local player = ctx.Players:Add(16)
			local data = ctx.DataService.GetData(player)
			equal(data.Money, 0)
			equal(data.Stats.DeliveriesCompleted, 0)
			equal(data.Vehicles.Equipped, "Starter")
		end)

		test("dinheiro inválido na memória nunca é gravado", function()
			local ctx = newDataEnv(false)
			ctx.Store.Data.Player_17 = { Money = 300 }
			local player = ctx.Players:Add(17)
			ctx.DataService.GetData(player).Money = 0 / 0
			ctx.Players:Remove(player)
			equal(ctx.Store.Data.Player_17.Money, 300)
		end)

		test("ao desligar o servidor, salva todo mundo", function()
			local ctx = newDataEnv(false)
			local a = ctx.Players:Add(18)
			local b = ctx.Players:Add(19)
			ctx.DataService.GetData(a).Money = 111
			ctx.DataService.GetData(b).Money = 222
			equal(#ctx.CloseHandlers, 1)
			ctx.CloseHandlers[1]()
			equal(ctx.Store.Data.Player_18.Money, 111)
			equal(ctx.Store.Data.Player_19.Money, 222)
		end)

		test("Studio sem acesso às APIs: joga normalmente, sem salvar e sem expulsar", function()
			local ctx = newDataEnv(true)
			ctx.Store.ErrorMessage = "StudioAccessToApisNotAllowed: API access is disabled"
			ctx.Store.FailNext = 99
			local player = ctx.Players:Add(20)
			equal(player.KickMessage, nil)
			local data = ctx.DataService.GetData(player)
			expect(data, "deveria ter dados temporários")
			equal(data.Money, 0)
			expect(not ctx.DataService.IsPersistent(player))
			ctx.Players:Remove(player)
			equal(ctx.Store.Writes, 0)
		end)
	end)
end
