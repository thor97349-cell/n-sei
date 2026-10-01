extends Node
## Teste automático das regras de carreira (sem abrir a cidade):
##  1. pagamento (Payout): modificadores cumpridos/perdidos, adicionais, combo, multas;
##  2. combo e reputação (atraso, carga muito danificada, multa, falha, piso do nível);
##  3. contratos (assinar, progresso por objetivo, concluir paga e libera contrato maior);
##  4. desafios (progresso, pagamento e substituição);
##  5. pedidos (mistura de riscos por nível, Chácara só depois, contrato no celular,
##     especiais, modificadores coerentes, sempre algo que cabe no veículo);
##  6. salvar/carregar a carreira e converter save antigo.
## Uso: godot --headless --path . res://tests/career_test.tscn

var _failures: Array[String] = []
var _log: Array[String] = []


func _ready() -> void:
	GameState.slot = "test_career"
	GameState.reset()
	_payout()
	_combo_and_reputation()
	_contracts()
	_challenges()
	_offers()
	_save()
	for line in _log:
		print(line)
	print("RESULTADO: ", "OK" if _failures.is_empty() else "FALHOU (%d)" % _failures.size())
	get_tree().quit(0 if _failures.is_empty() else 1)


func _check(condition: bool, message: String) -> void:
	if condition:
		_log.append("ok   " + message)
	else:
		_log.append("FALHA " + message)
		_failures.append(message)


func _offer(modifiers: Array = [], tier: String = "hard") -> Dictionary:
	return {
		"type": "pizza", "reward": 200, "time_limit": 100.0, "tier": tier, "modifiers": modifiers,
		"pickup_id": "pizzaria", "dropoff_id": "house_pink", "dropoff_zone": Vector3(-150, 0, 300),
		"special": "", "client": "", "contract_id": "",
	}


func _run(time_left: float = 50.0, condition: float = 100.0, fines: int = 0) -> Dictionary:
	return {"time_left": time_left, "condition": condition, "fines": fines, "fine_total": fines * 40, "elapsed": 50.0, "distance": 900.0, "fuel_used": 0.5, "vehicle": "van"}


func _amount(payout: Dictionary, key: String, modifier: String = "") -> int:
	for line: Dictionary in payout["lines"]:
		if line["key"] == key and (modifier == "" or line.get("modifier", "") == modifier):
			return int(line["amount"])
	return -999


# --- 1. pagamento ----------------------------------------------------------------------

func _payout() -> void:
	var plain := Payout.compute(_offer(), _run(), 0)
	_check(plain["payout"] == 200 + 70 + 40, "entrega simples: valor + rapidez + gorjeta (%d)" % plain["payout"])
	_check(plain["perfect"] and plain["combo"] == 1, "entrega no prazo e intacta é perfeita e abre o combo")
	var urgent := Payout.compute(_offer(["urgent"]), _run(), 0)
	_check(_amount(urgent, "modifier", "urgent") == roundi(200 * float(JobRules.MODIFIERS["urgent"]["bonus"])), "URGENTE no prazo paga o bônus")
	var late := Payout.compute(_offer(["urgent"]), _run(-5.0), 0)
	_check(_amount(late, "modifier", "urgent") == 0 and late["late"], "URGENTE atrasado não paga o bônus")
	var fined := Payout.compute(_offer(["no_fines", "perfect"]), _run(50.0, 100.0, 1), 0)
	_check(_amount(fined, "modifier", "no_fines") == 0 and _amount(fined, "modifier", "perfect") == 0, "multa perde SEM MULTAS e ENTREGA PERFEITA")
	_check(fined["net"] == fined["payout"] - 40 and _amount(fined, "result.fines") == -40, "multas da viagem aparecem no resumo (líquido)")
	var damaged := Payout.compute(_offer(["perfect"]), _run(50.0, 90.0), 0)
	_check(_amount(damaged, "modifier", "perfect") == 0, "carga 90% não é entrega perfeita")
	var combo := Payout.compute(_offer(), _run(), 2)
	_check(combo["combo"] == 3 and _amount(combo, "result.combo") == roundi(270 * CareerRules.combo_bonus(3)), "combo 2→3 paga o bônus do combo 3")
	var big := Payout.compute(_offer(), _run(), 30)
	_check(_amount(big, "result.combo") == roundi(270 * CareerRules.combo_bonus(99)), "bônus do combo tem teto")
	var rain_run := _run()
	rain_run["rain_fraction"] = 0.6
	rain_run["night"] = true
	var extras := Payout.compute(_offer(), rain_run, 0)
	_check(_amount(extras, "result.rain") == 30 and _amount(extras, "result.night") == 20, "adicional de chuva (+15%) e noturno (+10%)")
	var wrecked := Payout.compute(_offer(["fragile"]), _run(-30.0, 0.0, 3), 5)
	_check(wrecked["payout"] >= 0 and wrecked["combo"] == 0, "carga destruída: pagamento nunca negativo e combo zera")


# --- 2. combo e reputação -------------------------------------------------------------------

func _combo_and_reputation() -> void:
	var career := Career.new()
	career.rng.seed = 1
	_check(CareerRules.combo_after(4, true, 100.0) == 2, "atraso corta o combo pela metade")
	_check(CareerRules.combo_after(4, false, 40.0) == 0, "carga muito danificada zera o combo")
	career.combo = 3
	career.on_fine()
	_check(career.combo == 2 and career.last_penalty["rep"] < 0, "multa tira 1 do combo e reputação")
	career.on_failed(_offer())
	_check(career.combo == 0, "falha zera o combo")
	_check(career.reputation == 0, "reputação não fica negativa")
	var up := career.add_reputation(130)
	_check(up["rank_up"] and career.rank() == 1, "130 de reputação: Confiável")
	career.add_reputation(-500)
	_check(career.rank() == 1 and career.reputation == 120, "reputação não cai abaixo do nível alcançado")
	var hard := Payout.compute(_offer([], "hard"), _run(), career.combo)
	var report := career.settle_delivery(_offer([], "hard"), _run(), hard)
	_check(int(report["rep"]) == roundi(CareerRules.REP_DELIVERY * 1.5) + CareerRules.REP_PERFECT, "difícil e perfeita: %d de reputação" % report["rep"])
	career.combo = 2
	var milestone := career.settle_delivery(_offer(), _run(), Payout.compute(_offer(), _run(), 2))
	_check(int(milestone["combo_milestone"]) == 5, "chegar ao combo 3 dá reputação extra")


# --- 3. contratos ------------------------------------------------------------------------

func _contracts() -> void:
	var career := Career.new()
	career.rng.seed = 7
	career.prepare(600.0)
	_check(career.contract_offers.size() == 2, "Novato vê 2 contratos para assinar")
	var contract: Dictionary = career.contract_offers[0]
	_check(int(contract["level"]) == 1 and contract["goal"] == "count", "primeiro contrato é nível 1 (entregas simples)")
	_check(career.accept_contract(contract["id"]) and career.contracts.size() == 1, "assinar contrato")
	_check(not career.accept_contract(career.contract_offers[0]["id"]), "Novato só tem 1 contrato por vez")
	var client := Clients.get_client(contract["client"])
	var offer := _offer()
	offer["type"] = client["types"][0]
	if client["role"] == "dropoff":
		offer["dropoff_id"] = client["location"]
	else:
		offer["pickup_id"] = client["location"]
	var other := _offer()
	other["pickup_id"] = "nowhere"
	other["dropoff_id"] = "nowhere"
	career.settle_delivery(other, _run(), Payout.compute(other, _run(), 0))
	_check(int(contract["progress"]) == 0, "entrega de outro cliente não conta no contrato")
	var money := 0
	for i in int(contract["target"]):
		var report := career.settle_delivery(offer, _run(), Payout.compute(offer, _run(), career.combo))
		money += int(report["money"])
	_check(career.contracts.is_empty() and money >= int(contract["reward"]), "contrato concluído paga %d" % contract["reward"])
	_check(int(career.clients[contract["client"]]["level"]) == 1, "cliente lembra do contrato concluído")
	career.add_reputation(200)
	career.contract_offers.clear()
	career.refresh_contract_offers()
	var bigger := false
	for entry in career.contract_offers:
		if entry["client"] == contract["client"] and int(entry["level"]) == 2:
			bigger = true
		if entry["client"] != contract["client"] and int(entry["level"]) != 1:
			bigger = false
	_check(career.contract_offers.size() == 3, "Confiável vê 3 contratos")
	var streak := {"id": "s", "client": contract["client"], "level": 4, "goal": "streak", "target": 3, "region": "", "progress": 2, "reward": 500, "rep": 10}
	career.contracts = [streak]
	career.settle_delivery(offer, _run(-5.0), Payout.compute(offer, _run(-5.0), 0))
	_check(int(streak["progress"]) == 0, "contrato de sequência zera com atraso")
	var region := {"id": "r", "client": contract["client"], "level": 3, "goal": "region", "target": 2, "region": "south", "progress": 0, "reward": 500, "rep": 10}
	career.contracts = [region]
	career.settle_delivery(offer, _run(), Payout.compute(offer, _run(), 0))
	_check(int(region["progress"]) == 1, "contrato de região conta entrega na Zona Sul")
	for level in range(1, 5):
		for id: String in Clients.DATA:
			if Clients.DATA[id]["contracts"]:
				var made := Clients.make_contract(id, level, career.rng, 1)
				if int(made["reward"]) <= 0 or Clients.goal_text(made).contains("{"):
					_check(false, "contrato inválido: %s" % str(made))
					return
	_check(true, "todos os clientes geram contratos válidos (níveis 1–4)")


# --- 4. desafios ------------------------------------------------------------------------

func _challenges() -> void:
	var career := Career.new()
	career.rng.seed = 3
	career.challenges = [
		{"kind": "under_time", "target": 1, "value": 120.0, "progress": 0, "reward": 120},
		{"kind": "no_fines", "target": 50, "value": 0.0, "progress": 0, "reward": 110},
	]
	var report := career.settle_delivery(_offer(), _run(), Payout.compute(_offer(), _run(), 0))
	_check((report["challenges"] as Array).size() == 1 and int(report["money"]) == 120, "desafio de tempo concluído paga na hora")
	var no_fines: Dictionary = career.challenges[0]
	_check(no_fines["kind"] == "no_fines" and int(no_fines["progress"]) == 1, "desafio sem multas avançou")
	career.on_fine()
	_check(int(no_fines["progress"]) == 0, "multa zera o desafio sem multas")
	_check(career.challenges.size() == 1 and career.challenge_wait == Challenges.COOLDOWN_DELIVERIES, "desafio novo espera algumas entregas")
	for i in Challenges.COOLDOWN_DELIVERIES:
		var other := _offer()
		other["pickup_id"] = "nowhere"
		career.settle_delivery(other, _run(-5.0), Payout.compute(other, _run(-5.0), 0))
	_check(career.challenges.size() == 2, "depois disso um desafio novo entra no lugar")
	for kind: String in Challenges.DATA:
		var text := Challenges.text({"kind": kind, "target": 2, "value": 120.0})
		if text.begins_with("challenge.") or text.contains("{"):
			_check(false, "texto do desafio %s" % kind)
			return
	_check(true, "todos os desafios têm texto")


# --- 5. pedidos -------------------------------------------------------------------------

func _offers() -> void:
	var graph := RoadGraph.new()
	var generator := OfferGenerator.new(graph)
	generator.rng.seed = 11
	var rookie := Career.new()
	var tiers := {"safe": 0, "hard": 0, "risky": 0}
	var rewards := {"safe": 0.0, "hard": 0.0, "risky": 0.0}
	var farm := false
	var bad_modifier := ""
	var min_fit := 99
	for i in 80:
		var board := generator.board("van", rookie)
		for offer in board:
			tiers[offer["tier"]] += 1
			rewards[offer["tier"]] += float(offer["reward"])
			if offer["dropoff_id"] == "farm":
				farm = true
			for id: String in offer["modifiers"]:
				if not JobRules.fits_type(id, offer["type"]) and id != "long_haul":
					bad_modifier = "%s em %s" % [id, offer["type"]]
			if float(offer["time_limit"]) <= 0.0 or int(offer["reward"]) <= 0:
				bad_modifier = "valor/prazo inválido"
		var hatch := generator.board("hatch", rookie)
		var fits := 0
		for offer in hatch:
			if VehicleSpecs.can_carry("hatch", offer["size"]):
				fits += 1
		min_fit = mini(min_fit, fits)
	_check(tiers["risky"] == 0 and tiers["safe"] > 0 and tiers["hard"] > 0, "Novato: entregas seguras e difíceis, nenhuma arriscada")
	_check(not farm, "Novato não recebe entregas na Chácara")
	_check(bad_modifier == "", "modificadores e valores coerentes %s" % bad_modifier)
	_check(min_fit >= 2, "sempre há pelo menos 2 pedidos que cabem no hatch")
	_check(rewards["hard"] / tiers["hard"] > rewards["safe"] / tiers["safe"] * 1.3, "difícil paga bem mais que segura (%.0f × %.0f)" % [rewards["hard"] / tiers["hard"], rewards["safe"] / tiers["safe"]])
	var trusted := Career.new()
	trusted.add_reputation(130)
	var risky := 0
	var risky_reward := 0.0
	for i in 40:
		for offer in generator.board("van", trusted):
			if offer["tier"] == "risky":
				risky += 1
				risky_reward += float(offer["reward"])
	_check(risky >= 40, "Confiável recebe entregas arriscadas")
	_check(risky_reward / risky > rewards["hard"] / tiers["hard"], "arriscada paga mais que difícil (%.0f)" % (risky_reward / risky))
	var pro := Career.new()
	pro.add_reputation(450)
	_check(generator.board("van", pro).size() == 4, "Profissional vê 4 pedidos")
	# Contrato ativo: um pedido do cliente aparece no celular.
	trusted.prepare(600.0)
	var contract: Dictionary = trusted.contract_offers[0]
	trusted.accept_contract(contract["id"])
	var board := generator.board("truck", trusted)
	var linked := board.filter(func(o: Dictionary) -> bool: return o["contract_id"] == contract["id"])
	_check(linked.size() == 1 and Clients.matches(contract["client"], linked[0]), "pedido do contrato no celular (%s)" % contract["client"])
	for kind: String in JobRules.SPECIALS:
		var special := generator.special_offer(kind, "hatch", pro)
		var ok: bool = special["special"] == kind and VehicleSpecs.can_carry("hatch", special["size"]) and float(special["expires"]) > 0.0 and str(special["note"]) != ""
		_check(ok, "especial %s: cabe no veículo, tem recado e prazo para aceitar (R$ %d)" % [kind, special["reward"]])
	var long_haul := 0
	for i in 60:
		var offer := generator.make_offer("risky", "van", trusted, {"modifiers": ["long_haul"]})
		if (offer["modifiers"] as Array).has("long_haul"):
			long_haul += 1
			if float(offer["route_m"]) < OfferGenerator.LONG_HAUL_MIN:
				long_haul = -999
	_check(long_haul > 30, "longa distância usa as rotas mais longas da cidade (%d de 60)" % long_haul)


# --- 6. save ---------------------------------------------------------------------------

func _save() -> void:
	GameState.reset()
	var career := GameState.career
	career.add_reputation(150)
	career.combo = 4
	career.prepare(600.0)
	career.accept_contract(career.contract_offers[0]["id"])
	career.contracts[0]["progress"] = 1
	career.flags["met_valente"] = true
	_check(GameState.save_game(), "salvar")
	GameState.reset()
	_check(GameState.career.reputation == 0, "reset limpa a carreira")
	_check(GameState.load_game(), "carregar")
	var loaded := GameState.career
	_check(loaded.reputation == 150 and loaded.combo == 4 and loaded.rank() == 1, "reputação, nível e combo voltam")
	_check(loaded.contracts.size() == 1 and int(loaded.contracts[0]["progress"]) == 1, "contrato em andamento volta")
	_check(loaded.challenges.size() == 2 and loaded.flags.get("met_valente", false), "desafios e marcos de história voltam")
	var legacy := {"version": 1, "money": 900, "stats": {"deliveries": 20}}
	GameState.from_dict(legacy)
	_check(GameState.career.reputation == 160 and GameState.career.rank() == 1, "save antigo: 20 entregas viram reputação (Confiável)")
	var broken := {"version": 2, "career": {"reputation": "x", "contracts": [{"client": "???"}], "challenges": [1, {"kind": "nada"}], "flags": {"a": [1]}}}
	GameState.from_dict(broken)
	_check(GameState.career.reputation == 0 and GameState.career.contracts.is_empty() and GameState.career.challenges.is_empty() and GameState.career.flags.is_empty(), "save corrompido não quebra a carreira")
