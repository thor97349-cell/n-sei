class_name OfferGenerator
extends RefCounted
## Monta os pedidos do celular: uma mistura de níveis de risco (segura, difícil,
## arriscada), modificadores, pedidos dos contratos ativos e as entregas especiais raras.
##
## Valor e prazo continuam vindo do tipo de encomenda (OrderTypes: base + km × per_km);
## o nível de risco, os modificadores e o nível de reputação multiplicam (JobRules,
## CareerRules). Nada é absurdo de propósito: cada tipo só sai dos lugares que vendem
## aquilo e vai para destinos que fazem sentido (remédio para casas e hospital etc.).

## Rota mínima para manter o modificador LONGA DISTÂNCIA (senão vira pedido comum).
const LONG_HAUL_MIN := 700.0

var graph: RoadGraph
var rng := RandomNumberGenerator.new()
## Hora do jogo (minutos desde meia-noite) para o "preciso antes das 22h".
var clock_minutes := 540.0

var _locations: Array[Dictionary] = []
var _by_id := {}
var _routes := {}


func _init(road_graph: RoadGraph) -> void:
	graph = road_graph
	rng.randomize()
	_locations = CityLayout.all_locations()
	for loc in _locations:
		_by_id[loc["id"]] = loc


## Pedidos do celular para o nível atual: um de cada contrato ativo e o resto variando o
## risco (sempre há uma entrega segura; arriscadas a partir de "Confiável").
func board(vehicle_id: String, career: Career) -> Array[Dictionary]:
	var rank := career.rank()
	var count := int(CareerRules.rank_info(rank)["offers"])
	var result: Array[Dictionary] = []
	for contract in career.contracts:
		var offer := contract_offer(contract, vehicle_id, career)
		if not offer.is_empty():
			result.append(offer)
	var regular := maxi(count - result.size(), 2)
	var tiers: Array[String] = ["safe", "hard", "risky" if rank >= 1 else _either("safe", "hard")]
	while tiers.size() < regular:
		tiers.append(_either("hard", "risky" if rank >= 1 else "safe"))
	# Os pedidos de contrato já ocupam um nível: os outros completam a mistura.
	for offer in result:
		if tiers.size() > regular and tiers.has(offer["tier"]):
			tiers.erase(offer["tier"])
	tiers.resize(regular)
	# Tipos diferentes no celular sempre que der (variedade).
	var used: Array = []
	for offer in result:
		used.append(offer["type"])
	var others: Array[Dictionary] = []
	for i in regular:
		var fresh: Array = OrderTypes.ORDER.filter(func(id: String) -> bool: return not used.has(id))
		var offer := make_offer(tiers[i], vehicle_id, career, {"types": fresh} if fresh.size() >= 3 else {})
		used.append(offer["type"])
		others.append(offer)
	# Pelo menos dois pedidos que cabem no veículo (um só se o celular tiver dois).
	var wanted := mini(2, others.size())
	for i in others.size():
		if _fitting(others, vehicle_id) >= wanted:
			break
		if not VehicleSpecs.can_carry(vehicle_id, others[i]["size"]):
			others[i] = make_offer(others[i]["tier"], vehicle_id, career, {"fit": true})
	others.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		return JobRules.TIER_ORDER.find(a["tier"]) < JobRules.TIER_ORDER.find(b["tier"]))
	result.append_array(others)
	return result


## Pedido de um contrato ativo (vazio se o veículo não leva nada desse cliente).
func contract_offer(contract: Dictionary, vehicle_id: String, career: Career) -> Dictionary:
	var client := Clients.get_client(contract["client"])
	if client.is_empty():
		return {}
	var types := _fitting_types(client["types"], vehicle_id)
	if types.is_empty():
		return {}
	var level := int(contract["level"])
	var tier_id: String = ["safe", "safe", _either("safe", "hard"), "hard", "risky" if career.rank() >= 1 else "hard"][level]
	var options := {"types": types, "region": contract.get("region", "")}
	if client["role"] == "dropoff":
		options["dropoff_id"] = client["location"]
	else:
		options["pickup_id"] = client["location"]
	var offer := make_offer(tier_id, vehicle_id, career, options)
	offer["contract_id"] = contract["id"]
	offer["client"] = contract["client"]
	if rng.randf() < 0.5:
		offer["note"] = Clients.line(contract["client"], rng)
	return offer


## Entrega especial (rara). `kind` = id de JobRules.SPECIALS.
func special_offer(kind: String, vehicle_id: String, career: Career) -> Dictionary:
	var data := JobRules.special(kind)
	var options := {
		"modifiers": (data["modifiers"] as Array).duplicate(), "reward_mult": data["reward"],
		"time_mult": data["time"], "fit": true, "any_pickup": data["any_pickup"],
	}
	var client_id: String = data["client"]
	if client_id != "":
		var client := Clients.get_client(client_id)
		options["types"] = client["types"]
		if client["location"] != "":
			if client["role"] == "dropoff":
				options["dropoff_id"] = client["location"]
			else:
				options["pickup_id"] = client["location"]
	var offer := make_offer(data["tier"], vehicle_id, career, options)
	var floor_reward := float(data.get("min_reward", 0)) * (1.0 + float(CareerRules.rank_info(career.rank())["reward_bonus"]))
	offer["reward"] = maxi(int(offer["reward"]), int(snappedf(floor_reward, 5.0)))
	offer["special"] = kind
	offer["client"] = client_id
	offer["mission"] = data["mission"]
	offer["expires"] = JobRules.SPECIAL_SECONDS
	if client_id != "":
		offer["note"] = Clients.line(client_id, rng)
	elif data["deadline"]:
		# Tempo até a coleta (estimado) + prazo, arredondado para cima de 10 em 10 min.
		var minutes := clock_minutes + 150.0 + float(offer["time_limit"])
		minutes = ceilf(minutes / 10.0) * 10.0
		offer["note"] = Loc.t("special.deadline", ["%02d:%02d" % [int(minutes / 60.0) % 24, int(minutes) % 60]])
	else:
		offer["note"] = Loc.t("special.%s_note" % kind)
	return offer


## Um pedido. options: types (tipos permitidos), fit (só o que cabe no veículo),
## modifiers (lista fixa), pickup_id, dropoff_id, region, any_pickup, reward_mult, time_mult.
func make_offer(tier_id: String, vehicle_id: String, career: Career, options: Dictionary = {}) -> Dictionary:
	var rank := career.rank()
	var tier := JobRules.tier(tier_id)
	var allowed: Array = options.get("types", OrderTypes.ORDER)
	if options.get("fit", false):
		var fitting := _fitting_types(allowed, vehicle_id)
		allowed = fitting if not fitting.is_empty() else _fitting_types(OrderTypes.ORDER, vehicle_id)
	var type_id := _pick_type(allowed)
	var data := OrderTypes.get_type(type_id)
	var modifiers: Array[String] = []
	if options.has("modifiers"):
		for id: String in options["modifiers"]:
			if JobRules.fits_type(id, type_id) or id == "long_haul":
				modifiers.append(id)
	else:
		var amount := int(tier["modifiers"])
		var mild := amount == 0
		if mild and rng.randf() < float(tier["mild_chance"]):
			amount = 1
		modifiers = _pick_modifiers(amount, type_id, mild)
	var band: Vector2 = tier["route"]
	if modifiers.has("long_haul"):
		band = Vector2(maxf(band.x, float(JobRules.MODIFIERS["long_haul"]["min_route"])), 99999.0)
	var pickup := _pickup(data, options)
	var picked := _pick_dropoff(pickup, _destinations(pickup, data, options, rank), band)
	# Destino fixo (cliente que recebe, VIP): tenta outros tipos/coletas até a rota cair
	# na faixa do nível de risco (senão sairia uma "entrega VIP" de 150 m).
	if options.has("dropoff_id") and not options.has("pickup_id"):
		var gap := _band_gap(picked[0], band)
		for attempt in 10:
			if gap <= 0.0:
				break
			var other_type := _pick_type(allowed)
			var other_data := OrderTypes.get_type(other_type)
			var other_pickup := _pickup(other_data, options)
			var other := _pick_dropoff(other_pickup, _destinations(other_pickup, other_data, options, rank), band)
			var other_gap := _band_gap(other[0], band)
			if other_gap < gap:
				gap = other_gap
				picked = other
				pickup = other_pickup
				type_id = other_type
				data = other_data
		for id in modifiers.duplicate():
			if not JobRules.fits_type(id, type_id) and id != "long_haul":
				modifiers.erase(id)
	var dropoff: Dictionary = picked[1]
	var route: float = picked[0]
	# Longa distância sem destino longe o bastante: vira um pedido comum.
	if modifiers.has("long_haul") and route < LONG_HAUL_MIN:
		modifiers.erase("long_haul")
	var reward_mult := float(tier["reward"]) * (1.0 + float(CareerRules.rank_info(rank)["reward_bonus"])) * float(options.get("reward_mult", 1.0))
	var time_mult := float(tier["time"]) * float(options.get("time_mult", 1.0))
	var fragility := float(data["fragility"])
	for id in modifiers:
		var modifier := JobRules.modifier(id)
		reward_mult *= float(modifier["reward"])
		time_mult *= float(modifier["time"])
		fragility *= float(modifier.get("fragility", 1.0))
	var time_limit := (route / GameConfig.REFERENCE_SPEED * float(data["time_factor"]) + float(data["time_buffer"])) * time_mult
	var reward := int(snappedf((float(data["base"]) + float(data["per_km"]) * route / 1000.0) * reward_mult, 5.0))
	var offer := {
		"type": type_id,
		"icon": data["icon"],
		"size": data["size"],
		"fragility": fragility,
		"pickup_id": pickup["id"],
		"pickup_name": pickup["name"],
		"pickup_zone": pickup["zone"],
		"pickup_along_x": pickup.get("zone_along_x", true),
		"dropoff_id": dropoff["id"],
		"dropoff_name": dropoff["name"],
		"dropoff_zone": dropoff["zone"],
		"dropoff_along_x": dropoff.get("zone_along_x", true),
		"region": CityLayout.region_of(dropoff["zone"]),
		"route_m": route,
		"time_limit": roundf(time_limit),
		"reward": reward,
		"tier": tier_id,
		"modifiers": modifiers,
		"client": "",
		"contract_id": "",
		"special": "",
		"mission": "delivery",
		"note": "",
	}
	# Às vezes o próprio cliente manda um recado (dá personalidade à cidade).
	if rng.randf() < 0.18:
		for client_id: String in Clients.DATA:
			if Clients.matches(client_id, offer):
				offer["note"] = Clients.line(client_id, rng)
				break
	return offer


# --- partes ----------------------------------------------------------------------------

func _pickup(data: Dictionary, options: Dictionary) -> Dictionary:
	if options.has("pickup_id") and _by_id.has(options["pickup_id"]):
		return _by_id[options["pickup_id"]]
	if options.get("any_pickup", false):
		var places: Array[Dictionary] = []
		for loc in _locations:
			if loc["id"] != "farm" and not loc.get("fuel", false):
				places.append(loc)
		return places[rng.randi() % places.size()]
	var pickups: Array = data["pickups"]
	return _by_id[pickups[rng.randi() % pickups.size()]]


func _destinations(pickup: Dictionary, data: Dictionary, options: Dictionary, rank: int) -> Array[Dictionary]:
	var region: String = options.get("region", "")
	for attempt in 2:
		var result: Array[Dictionary] = []
		for loc in _locations:
			if loc["id"] == pickup["id"] or not loc.get("dropoff", false):
				continue
			if options.has("dropoff_id"):
				if loc["id"] == options["dropoff_id"]:
					result.append(loc)
				continue
			var destinations: Array = data["destinations"]
			if not destinations.is_empty() and not destinations.has(loc["id"]):
				continue
			# A Chácara (zona rural) só a partir de "Confiável".
			if loc["id"] == "farm" and not CareerRules.rank_info(rank)["farm"]:
				continue
			if region != "" and CityLayout.region_of(loc["zone"]) != region:
				continue
			result.append(loc)
		if not result.is_empty():
			return result
		region = ""
	# Sem destino possível (não deveria acontecer): qualquer lugar que recebe entregas.
	var fallback: Array[Dictionary] = []
	for loc in _locations:
		if loc["id"] != pickup["id"] and loc.get("dropoff", false) and loc["id"] != "farm":
			fallback.append(loc)
	return fallback


## [rota, local]: sorteia entre os destinos cuja rota cai na faixa do nível de risco; se
## nenhum cair, o mais próximo da faixa.
func _pick_dropoff(pickup: Dictionary, candidates: Array[Dictionary], band: Vector2) -> Array:
	var inside: Array = []
	var best: Array = []
	var best_gap := INF
	for loc in candidates:
		var route := _route(pickup, loc)
		if route >= maxf(band.x, GameConfig.MIN_ROUTE_METERS) and route <= band.y:
			inside.append([route, loc])
		var gap := _band_gap(route, band)
		if gap < best_gap:
			best_gap = gap
			best = [route, loc]
	if not inside.is_empty():
		return inside[rng.randi() % inside.size()]
	return best


## Quanto a rota fica fora da faixa (0 = dentro); rotas curtas demais pesam mais.
func _band_gap(route: float, band: Vector2) -> float:
	return maxf(band.x - route, 0.0) + maxf(route - band.y, 0.0) + (1000.0 if route < GameConfig.MIN_ROUTE_METERS else 0.0)


func _route(a: Dictionary, b: Dictionary) -> float:
	var key: String = a["id"] + "|" + b["id"]
	if not _routes.has(key):
		_routes[key] = graph.route_distance(a["zone"], b["zone"])
	return _routes[key]


func _pick_type(allowed: Array) -> String:
	var total := 0.0
	for id: String in allowed:
		total += float(OrderTypes.get_type(id)["weight"])
	var roll := rng.randf() * total
	for id: String in allowed:
		roll -= float(OrderTypes.get_type(id)["weight"])
		if roll <= 0.0:
			return id
	return allowed[allowed.size() - 1] if not allowed.is_empty() else "package"


func _pick_modifiers(amount: int, type_id: String, mild_only: bool) -> Array[String]:
	var pool: Array[String] = []
	for id: String in JobRules.MODIFIERS:
		if mild_only and not JobRules.MODIFIERS[id]["mild"]:
			continue
		if JobRules.fits_type(id, type_id):
			pool.append(id)
	var result: Array[String] = []
	while result.size() < amount and not pool.is_empty():
		var id: String = pool[rng.randi() % pool.size()]
		pool.erase(id)
		result.append(id)
	return result


func _fitting_types(types: Array, vehicle_id: String) -> Array:
	return types.filter(func(id: String) -> bool: return VehicleSpecs.can_carry(vehicle_id, OrderTypes.get_type(id)["size"]))


func _fitting(offers: Array[Dictionary], vehicle_id: String) -> int:
	var count := 0
	for offer in offers:
		if VehicleSpecs.can_carry(vehicle_id, offer["size"]):
			count += 1
	return count


func _either(a: String, b: String) -> String:
	return a if rng.randf() < 0.5 else b
