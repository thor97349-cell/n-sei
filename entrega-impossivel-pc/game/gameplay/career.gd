class_name Career
extends RefCounted
## Progressão do entregador: reputação (nível), combo de entregas, contratos, desafios,
## histórico com cada cliente e marcos de história. Vive dentro do GameState (é salvo
## junto) e não depende da cena — as regras são testadas sem abrir a cidade.
##
## Fluxo de uma entrega:
##   DeliveryManager registra como foi a viagem ("run") → Payout.compute calcula o dinheiro
##   da entrega → Career.settle_delivery atualiza combo, reputação, contratos e desafios e
##   devolve um relatório (o HUD mostra no resumo).
## Os números ficam em CareerRules, Clients, Challenges e JobRules.

signal changed

var reputation := 0
## Maior nível já alcançado (a reputação não cai abaixo do começo dele).
var rank_reached := 0
var combo := 0
var best_combo := 0
## Contratos assinados (em andamento) e os disponíveis para assinar.
var contracts: Array[Dictionary] = []
var contract_offers: Array[Dictionary] = []
var challenges: Array[Dictionary] = []
## Histórico por cliente: id → {"deliveries": n, "level": nível de contrato concluído}.
var clients := {}
var deliveries_since_special := 0
## Entregas que faltam para entrar um desafio novo no lugar de um concluído.
var challenge_wait := 0
## Marcos de história (personagens conhecidos, eventos únicos já vistos...). Livre para a
## história futura: chave → valor simples (bool, número ou texto).
var flags := {}
## Penalidade da última multa (o HUD mostra no aviso): {"combo_before", "combo", "rep"}.
var last_penalty := {}
var serial := 0
var rng := RandomNumberGenerator.new()


func _init() -> void:
	rng.randomize()


# --- nível -----------------------------------------------------------------------------

func rank() -> int:
	return maxi(rank_reached, CareerRules.rank_for(reputation))


func rank_info() -> Dictionary:
	return CareerRules.rank_info(rank())


## Soma reputação (negativa também), sem cair abaixo do começo do nível atual.
func add_reputation(delta: int) -> Dictionary:
	var before := rank()
	var floor_rep := int(CareerRules.rank_info(before)["rep"])
	reputation = maxi(reputation + delta, floor_rep)
	rank_reached = maxi(rank_reached, CareerRules.rank_for(reputation))
	return {"delta": delta, "rank_up": rank() > before, "rank": rank()}


## 0..1 até o próximo nível (1 no último).
func rank_progress() -> float:
	var current := int(rank_info()["rep"])
	var next := CareerRules.next_rank_rep(rank())
	if next < 0:
		return 1.0
	return clampf(float(reputation - current) / float(next - current), 0.0, 1.0)


# --- preparação -----------------------------------------------------------------------

## Chamado no começo da partida: completa contratos disponíveis e desafios.
func prepare(clock_minutes: float) -> void:
	refresh_contract_offers()
	ensure_challenges(clock_minutes)


func ensure_challenges(clock_minutes: float) -> bool:
	var wanted := int(rank_info()["challenges"])
	var added := false
	while challenges.size() < wanted and challenge_wait <= 0:
		var avoid: Array = []
		for challenge in challenges:
			avoid.append(challenge["kind"])
		challenges.append(Challenges.make(rng, rank(), avoid, clock_minutes, combo))
		added = true
	if added:
		changed.emit()
	return added


# --- entregas --------------------------------------------------------------------------

## Entrega concluída. `payout` vem de Payout.compute (com o combo novo já calculado).
## Devolve o relatório: reputação, nível, combo, contratos e desafios, e `money` (o que os
## contratos/desafios pagam além da entrega).
func settle_delivery(offer: Dictionary, run: Dictionary, payout: Dictionary) -> Dictionary:
	var report := {
		"money": 0, "rep": 0, "rank_up": false, "rank": rank(),
		"combo_before": combo, "combo": combo, "combo_milestone": 0,
		"contracts": [], "challenges": [],
	}
	var late: bool = payout["late"]
	var condition: float = run["condition"]
	var perfect: bool = payout["perfect"]
	combo = int(payout["combo"])
	best_combo = maxi(best_combo, combo)
	report["combo"] = combo
	var rep := 0
	if combo > int(report["combo_before"]) and CareerRules.COMBO_MILESTONES.has(combo):
		report["combo_milestone"] = int(CareerRules.COMBO_MILESTONES[combo])
		rep += int(report["combo_milestone"])
	var tier := JobRules.tier(offer.get("tier", "safe"))
	rep += CareerRules.REP_LATE_DELIVERY if late else roundi(CareerRules.REP_DELIVERY * float(tier["rep"]))
	if perfect:
		rep += CareerRules.REP_PERFECT
	if condition < CareerRules.SEVERE_DAMAGE:
		rep += CareerRules.REP_SEVERE_DAMAGE
	# Histórico do cliente.
	var client_id := client_of(offer)
	if client_id != "":
		var entry := _client(client_id)
		entry["deliveries"] = int(entry["deliveries"]) + 1
	# Contratos.
	for contract in contracts.duplicate():
		if not Clients.matches(contract["client"], offer):
			continue
		var counted := _contract_step(contract, offer, run, payout)
		var done := int(contract["progress"]) >= int(contract["target"])
		report["contracts"].append({
			"client": contract["client"], "progress": contract["progress"], "target": contract["target"],
			"counted": counted, "completed": done, "reward": contract["reward"] if done else 0,
		})
		if done:
			report["money"] = int(report["money"]) + int(contract["reward"])
			rep += int(contract["rep"])
			_finish_contract(contract)
	# Desafios (um concluído só é substituído depois de algumas entregas).
	challenge_wait = maxi(challenge_wait - 1, 0)
	for challenge in challenges.duplicate():
		_challenge_step(challenge, offer, run, payout)
		if int(challenge["progress"]) >= int(challenge["target"]):
			report["challenges"].append({"text": Challenges.text(challenge), "reward": challenge["reward"]})
			report["money"] = int(report["money"]) + int(challenge["reward"])
			challenges.erase(challenge)
			challenge_wait = Challenges.COOLDOWN_DELIVERIES
			GameState.increment("challenges")
	if offer.get("special", "") != "":
		deliveries_since_special = 0
		GameState.increment("specials")
	else:
		deliveries_since_special += 1
	if perfect:
		GameState.increment("perfect")
	GameState.stats["best_combo"] = maxi(int(GameState.stats.get("best_combo", 0)), best_combo)
	var result := add_reputation(rep)
	report["rep"] = rep
	report["rank_up"] = result["rank_up"]
	report["rank"] = result["rank"]
	if result["rank_up"]:
		# Nível novo: mais contratos e desafios na hora.
		refresh_contract_offers()
	var before := challenges.size()
	ensure_challenges(float(run.get("clock", 600.0)))
	report["new_challenges"] = []
	for i in range(before, challenges.size()):
		report["new_challenges"].append(Challenges.text(challenges[i]))
	changed.emit()
	return report


## Entrega que estourou o prazo (ou cancelada com a carga no carro).
func on_failed(offer: Dictionary, rep_penalty: int = CareerRules.REP_FAILED) -> Dictionary:
	var report := {"combo_before": combo, "combo": 0, "rep": rep_penalty}
	combo = 0
	for contract in contracts:
		if contract["goal"] == "streak" and Clients.matches(contract["client"], offer):
			contract["progress"] = 0
	for challenge in challenges:
		if challenge["kind"] == "intact_streak":
			challenge["progress"] = 0
	add_reputation(rep_penalty)
	changed.emit()
	return report


## Multa de trânsito: combo −1, um pouco de reputação e o desafio "sem multas" zera.
func on_fine() -> Dictionary:
	last_penalty = {"combo_before": combo, "combo": maxi(combo - 1, 0), "rep": CareerRules.REP_FINE}
	combo = maxi(combo - 1, 0)
	for challenge in challenges:
		if challenge["kind"] == "no_fines":
			challenge["progress"] = 0
	add_reputation(CareerRules.REP_FINE)
	changed.emit()
	return last_penalty


## Cliente ligado ao pedido ("" se nenhum): o do pedido ou o dono da coleta/destino.
func client_of(offer: Dictionary) -> String:
	var id: String = offer.get("client", "")
	if id != "":
		return id
	for client_id: String in Clients.DATA:
		if Clients.matches(client_id, offer):
			return client_id
	return ""


func _client(id: String) -> Dictionary:
	if not clients.has(id):
		clients[id] = {"deliveries": 0, "level": 0}
	return clients[id]


# --- contratos --------------------------------------------------------------------------

func max_contracts() -> int:
	return int(rank_info()["contracts"])


## Completa a lista de contratos para assinar (um por cliente, nunca de quem já tem
## contrato ativo). Clientes com mais contratos concluídos oferecem contratos maiores.
func refresh_contract_offers() -> void:
	var wanted := 2 if rank() == 0 else 3
	var busy: Array[String] = []
	for contract in contracts + contract_offers:
		busy.append(contract["client"])
	var pool := Clients.contract_clients(rank()).filter(func(id: String) -> bool: return not busy.has(id))
	pool.shuffle()
	while contract_offers.size() < wanted and not pool.is_empty():
		var id: String = pool.pop_back()
		var level := mini(int(_client(id)["level"]) + 1, int(rank_info()["contract_level"]))
		serial += 1
		contract_offers.append(Clients.make_contract(id, level, rng, serial))
	changed.emit()


func accept_contract(id: String) -> bool:
	if contracts.size() >= max_contracts():
		return false
	for contract in contract_offers:
		if contract["id"] == id:
			contract_offers.erase(contract)
			contracts.append(contract)
			refresh_contract_offers()
			changed.emit()
			return true
	return false


func abandon_contract(id: String) -> bool:
	for contract in contracts:
		if contract["id"] == id:
			contracts.erase(contract)
			add_reputation(CareerRules.REP_CONTRACT_ABANDON)
			refresh_contract_offers()
			changed.emit()
			return true
	return false


func find_contract(id: String) -> Dictionary:
	for contract in contracts:
		if contract["id"] == id:
			return contract
	return {}


## Conta (ou não) a entrega no contrato. Devolve true se avançou.
func _contract_step(contract: Dictionary, offer: Dictionary, run: Dictionary, payout: Dictionary) -> bool:
	var late: bool = payout["late"]
	var counts := false
	match contract["goal"]:
		"count":
			counts = true
		"on_time", "streak":
			counts = not late
		"intact":
			counts = float(run["condition"]) >= Clients.CONTRACT_INTACT
		"region":
			counts = CityLayout.region_of(offer["dropoff_zone"]) == contract["region"]
		"perfect":
			counts = payout["perfect"]
	if counts:
		contract["progress"] = int(contract["progress"]) + 1
	elif contract["goal"] == "streak":
		contract["progress"] = 0
	return counts


func _finish_contract(contract: Dictionary) -> void:
	contracts.erase(contract)
	var entry := _client(contract["client"])
	entry["level"] = maxi(int(entry["level"]), int(contract["level"]))
	GameState.increment("contracts")
	flags["contract_" + str(contract["client"])] = int(entry["level"])
	refresh_contract_offers()


# --- desafios ----------------------------------------------------------------------------

func _challenge_step(challenge: Dictionary, offer: Dictionary, run: Dictionary, payout: Dictionary) -> void:
	var late: bool = payout["late"]
	var progress := int(challenge["progress"])
	match challenge["kind"]:
		"intact_streak":
			progress = progress + 1 if float(run["condition"]) >= JobRules.INTACT else 0
		"under_time":
			if not late and float(run.get("elapsed", INF)) < float(challenge["value"]):
				progress = 1
		"no_fines":
			if int(run.get("fines", 0)) == 0:
				progress += 1
		"fuel":
			var km := float(run.get("distance", 0.0)) / 1000.0
			if km * 1000.0 >= Challenges.FUEL_MIN_ROUTE and float(run.get("fuel_used", 99.0)) / km <= Challenges.fuel_limit(run.get("vehicle", "van")):
				progress = 1
		"tier":
			if offer.get("tier", "safe") in ["hard", "risky"]:
				progress += 1
		"combo":
			progress = maxi(progress, combo)
		"perfect":
			if payout["perfect"]:
				progress += 1
		"night":
			if run.get("night", false):
				progress = 1
	challenge["progress"] = mini(progress, int(challenge["target"]))


# --- entregas especiais --------------------------------------------------------------------

## Sorteia se aparece uma entrega especial agora (depois de uma entrega). Devolve o tipo
## (JobRules.SPECIALS) ou "".
func roll_special() -> String:
	if int(GameState.stats.get("deliveries", 0)) < JobRules.SPECIAL_MIN_DELIVERIES:
		return ""
	var chance := minf(JobRules.SPECIAL_BASE + JobRules.SPECIAL_PER_DELIVERY * deliveries_since_special, JobRules.SPECIAL_MAX)
	chance *= float(rank_info()["special_factor"])
	if rng.randf() >= chance:
		return ""
	var total := 0.0
	var kinds: Array[String] = []
	for kind: String in JobRules.SPECIALS:
		if int(JobRules.SPECIALS[kind]["min_rank"]) <= rank():
			kinds.append(kind)
			total += float(JobRules.SPECIALS[kind]["weight"])
	var roll := rng.randf() * total
	for kind in kinds:
		roll -= float(JobRules.SPECIALS[kind]["weight"])
		if roll <= 0.0:
			return kind
	return kinds[kinds.size() - 1]


# --- disco ---------------------------------------------------------------------------------

func to_dict() -> Dictionary:
	return {
		"reputation": reputation, "rank_reached": rank_reached, "combo": combo, "best_combo": best_combo,
		"contracts": contracts, "contract_offers": contract_offers, "challenges": challenges,
		"clients": clients, "deliveries_since_special": deliveries_since_special, "flags": flags,
		"challenge_wait": challenge_wait,
		"serial": serial,
	}


func from_dict(data: Dictionary) -> void:
	reputation = maxi(int(_number(data.get("reputation"), 0)), 0)
	rank_reached = clampi(int(_number(data.get("rank_reached"), 0)), 0, CareerRules.RANKS.size() - 1)
	combo = maxi(int(_number(data.get("combo"), 0)), 0)
	best_combo = maxi(int(_number(data.get("best_combo"), 0)), combo)
	deliveries_since_special = maxi(int(_number(data.get("deliveries_since_special"), 0)), 0)
	challenge_wait = clampi(int(_number(data.get("challenge_wait"), 0)), 0, Challenges.COOLDOWN_DELIVERIES)
	serial = maxi(int(_number(data.get("serial"), 0)), 0)
	contracts = _contracts(data.get("contracts"))
	contract_offers = _contracts(data.get("contract_offers"))
	challenges.clear()
	var loaded_challenges: Variant = data.get("challenges")
	if loaded_challenges is Array:
		for entry: Variant in loaded_challenges:
			if entry is Dictionary and Challenges.DATA.has(entry.get("kind", "")):
				challenges.append({
					"kind": entry["kind"], "target": maxi(int(_number(entry.get("target"), 1)), 1),
					"value": _number(entry.get("value"), 0.0), "progress": maxi(int(_number(entry.get("progress"), 0)), 0),
					"reward": maxi(int(_number(entry.get("reward"), 0)), 0),
				})
	clients.clear()
	var loaded_clients: Variant = data.get("clients")
	if loaded_clients is Dictionary:
		for id: Variant in loaded_clients:
			var entry: Variant = loaded_clients[id]
			if id is String and Clients.DATA.has(id) and entry is Dictionary:
				clients[id] = {
					"deliveries": maxi(int(_number(entry.get("deliveries"), 0)), 0),
					"level": clampi(int(_number(entry.get("level"), 0)), 0, Clients.MAX_LEVEL),
				}
	flags.clear()
	var loaded_flags: Variant = data.get("flags")
	if loaded_flags is Dictionary:
		for key: Variant in loaded_flags:
			var value: Variant = loaded_flags[key]
			if key is String and (value is bool or value is int or value is float or value is String):
				flags[key] = value


## Save antigo (sem carreira): começa com reputação pelas entregas já feitas, para quem já
## jogou bastante não voltar a "Novato" (no máximo até perto de Profissional).
func from_legacy(deliveries: int) -> void:
	add_reputation(mini(deliveries * 8, 380))


func _contracts(value: Variant) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	if not value is Array:
		return result
	for entry: Variant in value:
		if not entry is Dictionary or not Clients.DATA.has(entry.get("client", "")) or not Clients.GOALS.has(entry.get("goal", "")):
			continue
		result.append({
			"id": str(entry.get("id", "c0")), "client": entry["client"],
			"level": clampi(int(_number(entry.get("level"), 1)), 1, Clients.MAX_LEVEL),
			"goal": entry["goal"], "target": maxi(int(_number(entry.get("target"), 1)), 1),
			"region": str(entry.get("region", "")), "progress": maxi(int(_number(entry.get("progress"), 0)), 0),
			"reward": maxi(int(_number(entry.get("reward"), 0)), 0), "rep": maxi(int(_number(entry.get("rep"), 0)), 0),
		})
	return result


func _number(value: Variant, fallback: float) -> float:
	if (value is float or value is int) and not is_nan(float(value)) and not is_inf(float(value)):
		return float(value)
	return fallback
