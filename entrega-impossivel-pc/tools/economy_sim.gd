extends Node
## Ferramenta de balanceamento: simula horas de jogo com o código de verdade (pedidos,
## pagamento, combo, contratos, desafios, especiais, combustível e multas) para três
## perfis de jogador, e compara com a economia antiga (só a entrega, sem carreira).
## Mostra dinheiro por hora, tempo até cada veículo e até cada nível de reputação.
## Uso: godot --headless --path . res://tools/economy_sim.tscn [-- horas]
##
## O "jogador" é um modelo simples: velocidade média na cidade, chance de bater por km,
## chance de avançar sinal por entrega e um critério de escolha (o cuidadoso evita as
## arriscadas; o ousado vai no maior valor por minuto).

## speed = média porta a porta (m/s) com curvas, semáforos e trânsito; detour = até quanto
## a mais de caminho/tempo numa entrega ruim (erro de rua, trânsito, sinal fechado);
## mishap = chance de um imprevisto grande (perdeu a entrada, capotou, errou a vaga):
## +20 a 60 s e uma batida a mais.
const PROFILES := {
	"cuidadoso": {"speed": 8.0, "detour": 0.25, "mishap": 0.08, "crash_per_km": 0.25, "fine_chance": 0.03, "spread": 0.1, "risk": 0.5},
	"médio": {"speed": 9.0, "detour": 0.3, "mishap": 0.12, "crash_per_km": 0.5, "fine_chance": 0.1, "spread": 0.14, "risk": 1.0},
	"ousado": {"speed": 10.5, "detour": 0.35, "mishap": 0.16, "crash_per_km": 0.9, "fine_chance": 0.22, "spread": 0.18, "risk": 1.6},
}
## Preços antes deste update (para comparar o tempo até cada veículo).
const LEGACY_PRICES := {"hatch": 7500, "truck": 18000, "sport": 42000}
## Tempo parado a cada entrega (escolher no celular, carregar, descarregar).
const OVERHEAD := 16.0
const START := Vector3(-10.0, 0.0, 53.0)

var _graph: RoadGraph
var _rng := RandomNumberGenerator.new()


func _ready() -> void:
	GameState.slot = "economy_sim"
	_graph = RoadGraph.new()
	var args := OS.get_cmdline_user_args()
	var hours := float(args[0]) if args.size() > 0 else 6.0
	print("Simulação de %.0f h de jogo por perfil (furgão, preço da gasolina R$ %.2f/L)\n" % [hours, GameConfig.FUEL_PRICE_PER_LITER])
	for name: String in PROFILES:
		var legacy := _simulate(PROFILES[name], hours, true)
		var current := _simulate(PROFILES[name], hours, false)
		print("== %s ==" % name)
		print("  antes:  R$ %5d/h | %4.1f entregas/h | falhas %2d%%" % [legacy["per_hour"], legacy["deliveries_per_hour"], legacy["fail_pct"]])
		print("  agora:  R$ %5d/h | %4.1f entregas/h | falhas %2d%% | gasolina R$ %d/h | multas R$ %d/h" % [current["per_hour"], current["deliveries_per_hour"], current["fail_pct"], current["fuel_per_hour"], current["fines_per_hour"]])
		print("          contratos %.1f/h | desafios %.1f/h | especiais %.1f/h | melhor combo %d | combo médio %.1f" % [current["contracts_per_hour"], current["challenges_per_hour"], current["specials_per_hour"], current["best_combo"], current["avg_combo"]])
		print("          de onde vem: entrega %d%% | bônus/gorjeta %d%% | modificadores %d%% | combo %d%% | contratos+desafios %d%%" % current["sources"])
		print("          ganho médio por nível: segura R$ %d | difícil R$ %d | arriscada R$ %d | especial R$ %d" % current["tier_avg"])
		var line := "          veículos:"
		for id: String in ["hatch", "truck", "sport"]:
			var price := int(VehicleSpecs.get_spec(id)["price"])
			line += "  %s R$ %d em %s (antes: R$ %d em %s)" % [VehicleSpecs.get_spec(id)["name"], price, _time(current["money_times"].get(id, -1.0)), LEGACY_PRICES[id], _time(legacy["money_times"].get(id, -1.0))]
		print(line)
		line = "          níveis:"
		for rank in range(1, CareerRules.RANKS.size()):
			line += "  %s em %s" % [CareerRules.rank_name(rank), _time(current["rank_times"].get(rank, -1.0))]
		print(line + "\n")
	get_tree().quit()


func _time(seconds: float) -> String:
	if seconds < 0.0:
		return "—"
	return "%dh%02d" % [int(seconds / 3600.0), int(fmod(seconds, 3600.0) / 60.0)]


func _simulate(profile: Dictionary, hours: float, legacy: bool) -> Dictionary:
	_rng.seed = 2024
	GameState.reset()
	var career := GameState.career
	career.rng.seed = 99
	var generator := OfferGenerator.new(_graph)
	generator.rng.seed = 7
	var clock := 9.0 * 60.0
	var position := START
	var elapsed := 0.0
	var earned := 0.0
	var fuel_cost := 0.0
	var fines_cost := 0.0
	var deliveries := 0
	var failures := 0
	var combo_sum := 0.0
	var specials: Array[Dictionary] = []
	var sources := [0.0, 0.0, 0.0, 0.0, 0.0]
	var tier_money := {"safe": [0.0, 0], "hard": [0.0, 0], "risky": [0.0, 0], "special": [0.0, 0]}
	var money_times := {}
	var rank_times := {}
	var limit := hours * 3600.0
	career.prepare(clock)
	while elapsed < limit:
		# Assina contrato quando tem vaga (os que o furgão consegue fazer).
		if not legacy:
			while career.contracts.size() < career.max_contracts() and not career.contract_offers.is_empty():
				var signed := false
				for contract in career.contract_offers:
					if not generator.contract_offer(contract, "van", career).is_empty():
						career.accept_contract(contract["id"])
						signed = true
						break
				if not signed:
					break
		generator.clock_minutes = clock
		var offers: Array[Dictionary] = []
		if legacy:
			for i in 3:
				offers.append(generator.make_offer("safe", "van", career, {"modifiers": [], "reward_mult": 1.0 / 0.9, "time_mult": 1.0 / 1.15}))
		else:
			offers = specials.duplicate()
			offers.append_array(generator.board("van", career))
		var choice := _choose(offers, profile, position, career, legacy)
		if choice.is_empty():
			elapsed += 30.0
			continue
		var offer: Dictionary = choice["offer"]
		specials.erase(offer)
		# Viagem: até a coleta e depois a entrega (o prazo conta só da coleta).
		var approach := _graph.route_distance(position, offer["pickup_zone"])
		var speed := float(profile["speed"]) * _rng.randf_range(1.0 - profile["spread"], 1.0 + profile["spread"])
		var detour := 1.0 + pow(_rng.randf(), 2.0) * float(profile["detour"])
		var drive := float(offer["route_m"]) / speed * detour + 4.0
		var mishap := _rng.randf() < float(profile["mishap"])
		if mishap:
			drive += _rng.randf_range(20.0, 60.0)
		var trip := approach / float(profile["speed"]) * (1.0 + float(profile["detour"]) * 0.3) + drive + OVERHEAD
		var km := (approach + float(offer["route_m"])) / 1000.0
		var condition := 100.0
		var hits := _poisson(float(profile["crash_per_km"]) * float(offer["route_m"]) / 1000.0) + (1 if mishap else 0)
		for i in hits:
			condition -= _rng.randf_range(3.0, 10.0) * float(offer["fragility"])
		condition = clampf(condition, 0.0, 100.0)
		var fines := 1 if _rng.randf() < float(profile["fine_chance"]) * (km / 1.3) else 0
		var fine_total := GameConfig.red_light_fine(roundi(earned)) * fines
		fines_cost += fine_total
		var liters := km * VehicleSpecs.liters_per_km("van") * _rng.randf_range(0.9, 1.15)
		fuel_cost += liters * GameConfig.FUEL_PRICE_PER_LITER
		clock = fmod(clock + trip / 60.0 * GameConfig.CLOCK_SPEED * 60.0 / 60.0, 1440.0)
		elapsed += trip
		position = offer["dropoff_zone"]
		var time_left := float(offer["time_limit"]) - drive
		if time_left < -GameConfig.LATE_GRACE_SECONDS:
			failures += 1
			if not legacy:
				career.on_failed(offer)
			continue
		if fines > 0 and not legacy:
			career.on_fine()
		var run := {
			"time_left": time_left, "condition": condition, "fines": fines, "fine_total": fine_total,
			"elapsed": drive, "distance": float(offer["route_m"]), "fuel_used": liters * float(offer["route_m"]) / 1000.0 / km,
			"vehicle": "van", "clock": clock, "night": JobRules.is_night(clock) and not legacy, "rain_fraction": 0.0,
		}
		var gained := 0.0
		if legacy:
			gained = float(DeliveryManager.compute_payment(offer["reward"], offer["time_limit"], time_left, condition)["total"])
			sources[0] += gained
		else:
			var payout := Payout.compute(offer, run, career.combo)
			GameState.increment("deliveries")
			var report := career.settle_delivery(offer, run, payout)
			gained = float(payout["payout"]) + float(report["money"])
			for line: Dictionary in payout["lines"]:
				match line["key"]:
					"result.base", "result.damage":
						sources[0] += float(line["amount"])
					"result.bonus", "result.tip", "result.rain", "result.night":
						sources[1] += float(line["amount"])
					"modifier":
						sources[2] += float(line["amount"])
					"result.combo":
						sources[3] += float(line["amount"])
			sources[4] += float(report["money"])
			var kind := career.roll_special()
			if kind != "":
				specials.append(generator.special_offer(kind, "van", career))
			var tier_key: String = "special" if offer.get("special", "") != "" else offer["tier"]
			tier_money[tier_key][0] += float(payout["payout"])
			tier_money[tier_key][1] += 1
			combo_sum += career.combo
			for rank in range(1, CareerRules.RANKS.size()):
				if career.rank() >= rank and not rank_times.has(rank):
					rank_times[rank] = elapsed
		deliveries += 1
		earned += gained
		var net := earned - fuel_cost - fines_cost
		for id: String in ["hatch", "truck", "sport"]:
			var price: int = LEGACY_PRICES[id] if legacy else int(VehicleSpecs.get_spec(id)["price"])
			if net >= price and not money_times.has(id):
				money_times[id] = elapsed
	var total_sources := 0.0
	for value: float in sources:
		total_sources += value
	var pct: Array = []
	for value: float in sources:
		pct.append(roundi(value / maxf(total_sources, 1.0) * 100.0))
	var tier_avg: Array = []
	for key: String in ["safe", "hard", "risky", "special"]:
		tier_avg.append(roundi(tier_money[key][0] / maxf(tier_money[key][1], 1.0)))
	var h := elapsed / 3600.0
	return {
		"per_hour": roundi((earned - fuel_cost - fines_cost) / h),
		"deliveries_per_hour": deliveries / h,
		"fail_pct": roundi(100.0 * failures / maxf(deliveries + failures, 1.0)),
		"fuel_per_hour": roundi(fuel_cost / h),
		"fines_per_hour": roundi(fines_cost / h),
		"contracts_per_hour": float(GameState.stats.get("contracts", 0)) / h,
		"challenges_per_hour": float(GameState.stats.get("challenges", 0)) / h,
		"specials_per_hour": float(GameState.stats.get("specials", 0)) / h,
		"best_combo": career.best_combo,
		"avg_combo": combo_sum / maxf(deliveries, 1.0),
		"sources": pct,
		"tier_avg": tier_avg,
		"money_times": money_times,
		"rank_times": rank_times,
	}


## Escolhe o pedido com o melhor "valor por minuto" esperado, descontando o risco
## conforme o perfil (o cuidadoso desconta muito as arriscadas e as frágeis).
func _choose(offers: Array[Dictionary], profile: Dictionary, position: Vector3, career: Career, legacy: bool) -> Dictionary:
	var best: Dictionary = {}
	var best_score := -INF
	for offer in offers:
		if not VehicleSpecs.can_carry("van", offer["size"]):
			continue
		var approach := _graph.route_distance(position, offer["pickup_zone"])
		var drive := float(offer["route_m"]) / float(profile["speed"]) * (1.0 + float(profile["detour"]) * 0.3) + 4.0
		var trip := approach / float(profile["speed"]) + drive + OVERHEAD
		var expected_condition := 100.0 - float(profile["crash_per_km"]) * float(offer["route_m"]) / 1000.0 * 6.5 * float(offer["fragility"])
		var run := {"time_left": float(offer["time_limit"]) - drive, "condition": expected_condition, "fines": 0, "fine_total": 0}
		var value := float(DeliveryManager.compute_payment(offer["reward"], offer["time_limit"], run["time_left"], expected_condition)["total"]) if legacy else float(Payout.compute(offer, run, career.combo)["payout"])
		var slack := (float(offer["time_limit"]) - drive) / maxf(float(offer["time_limit"]), 1.0)
		var risk := 1.0
		if slack < 0.1:
			risk *= 0.5
		if offer.get("tier", "safe") == "risky":
			risk *= lerpf(0.55, 1.1, clampf(profile["risk"] - 0.5, 0.0, 1.0))
		if offer.get("contract_id", "") != "":
			risk *= 1.25
		var score := value * risk / trip
		if score > best_score:
			best_score = score
			best = {"offer": offer}
	return best


func _poisson(mean: float) -> int:
	var limit := exp(-mean)
	var product := _rng.randf()
	var count := 0
	while product > limit:
		product *= _rng.randf()
		count += 1
	return count
