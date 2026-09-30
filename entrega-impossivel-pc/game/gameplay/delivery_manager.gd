class_name DeliveryManager
extends Node
## Ciclo de entregas: pedidos no celular → ir até a coleta → parar na vaga para
## carregar → levar ao destino dentro do prazo → parar na vaga para entregar → resultado.
##
## Regras de dinheiro (o jogador NUNCA perde dinheiro numa entrega):
##   • no prazo: valor cheio + bônus de rapidez (se sobrou bastante tempo);
##   • atrasado (até LATE_GRACE_SECONDS): LATE_MULTIPLIER do valor;
##   • passou do limite: o pedido é cancelado e paga 0;
##   • carga danificada reduz o pagamento e a avaliação; boa avaliação dá gorjeta.
## Todo o cálculo acontece aqui (a interface só mostra).

signal offers_changed
signal stage_changed
signal finished(result: Dictionary)
## A carga estragou numa batida: quanto perdeu (pontos %) e como ficou.
signal cargo_damaged(loss: float, condition: float)

enum Stage { IDLE, TO_PICKUP, DELIVERING, RESULT }

## Metade do tamanho da vaga (ao longo da calçada, atravessado) + folga.
const BAY_HALF := Vector2(7.5, 2.8)

var vehicle: Vehicle
var graph: RoadGraph
var stage := Stage.IDLE
var offers: Array[Dictionary] = []
var active: Dictionary = {}
var time_left := 0.0
var cargo_condition := 100.0
## 0 → 1 enquanto parado na vaga (carregando/descarregando).
var load_progress := 0.0
var last_result: Dictionary = {}
var refresh_cooldown := 0.0
var result_timer := 0.0

var _rng := RandomNumberGenerator.new()
var _late_warned := false
var _hit_cooldown := 0.0


func _ready() -> void:
	_rng.randomize()


func setup(player_vehicle: Vehicle, road_graph: RoadGraph) -> void:
	graph = road_graph
	set_vehicle(player_vehicle)
	if offers.is_empty():
		generate_offers()


func set_vehicle(player_vehicle: Vehicle) -> void:
	if vehicle and vehicle.impacted.is_connected(_on_impact):
		vehicle.impacted.disconnect(_on_impact)
	vehicle = player_vehicle
	if vehicle:
		vehicle.impacted.connect(_on_impact)


func has_cargo() -> bool:
	return stage == Stage.DELIVERING


## Ponto onde o jogador deve ir agora (Vector3.INF se nenhum).
func target_position() -> Vector3:
	match stage:
		Stage.TO_PICKUP:
			return active["pickup_zone"]
		Stage.DELIVERING:
			return active["dropoff_zone"]
	return Vector3.INF


func target_along_x() -> bool:
	if stage == Stage.TO_PICKUP:
		return active["pickup_along_x"]
	return active.get("dropoff_along_x", true)


# --- pedidos -------------------------------------------------------------------------

func generate_offers() -> void:
	offers.clear()
	var fits_found := false
	for i in GameConfig.OFFERS_ON_PHONE:
		var offer := _make_offer()
		# Garante pelo menos um pedido que cabe no veículo atual.
		if i == GameConfig.OFFERS_ON_PHONE - 1 and not fits_found:
			for attempt in 12:
				if VehicleSpecs.can_carry(GameState.current_vehicle, offer["size"]):
					break
				offer = _make_offer()
		if VehicleSpecs.can_carry(GameState.current_vehicle, offer["size"]):
			fits_found = true
		offers.append(offer)
	refresh_cooldown = GameConfig.REFRESH_COOLDOWN
	offers_changed.emit()


func refresh_offers() -> bool:
	if refresh_cooldown > 0.0:
		return false
	generate_offers()
	Sfx.play("click")
	return true


func _make_offer() -> Dictionary:
	var type_id := _pick_type()
	var data := OrderTypes.get_type(type_id)
	var pickups: Array = data["pickups"]
	var pickup := CityLayout.find_location(pickups[_rng.randi() % pickups.size()])
	var candidates: Array = []
	var destinations: Array = data["destinations"]
	for loc in CityLayout.all_locations():
		if loc["id"] == pickup["id"] or not loc.get("dropoff", false):
			continue
		if destinations.is_empty() or destinations.has(loc["id"]):
			candidates.append(loc)
	var dropoff: Dictionary = candidates[_rng.randi() % candidates.size()]
	var route := graph.route_distance(pickup["zone"], dropoff["zone"])
	for attempt in 10:
		if route >= GameConfig.MIN_ROUTE_METERS:
			break
		dropoff = candidates[_rng.randi() % candidates.size()]
		route = graph.route_distance(pickup["zone"], dropoff["zone"])
	var time_limit := route / GameConfig.REFERENCE_SPEED * float(data["time_factor"]) + float(data["time_buffer"])
	var reward := int(snappedf(float(data["base"]) + float(data["per_km"]) * route / 1000.0, 5.0))
	return {
		"type": type_id,
		"icon": data["icon"],
		"size": data["size"],
		"fragility": data["fragility"],
		"pickup_id": pickup["id"],
		"pickup_name": pickup["name"],
		"pickup_zone": pickup["zone"],
		"pickup_along_x": pickup.get("zone_along_x", true),
		"dropoff_id": dropoff["id"],
		"dropoff_name": dropoff["name"],
		"dropoff_zone": dropoff["zone"],
		"dropoff_along_x": dropoff.get("zone_along_x", true),
		"route_m": route,
		"time_limit": roundf(time_limit),
		"reward": reward,
	}


func _pick_type() -> String:
	var total := 0.0
	for id: String in OrderTypes.ORDER:
		total += float(OrderTypes.get_type(id)["weight"])
	var roll := _rng.randf() * total
	for id: String in OrderTypes.ORDER:
		roll -= float(OrderTypes.get_type(id)["weight"])
		if roll <= 0.0:
			return id
	return "package"


func accept(index: int) -> bool:
	if stage != Stage.IDLE or index < 0 or index >= offers.size():
		return false
	var offer: Dictionary = offers[index]
	if not VehicleSpecs.can_carry(GameState.current_vehicle, offer["size"]):
		Bus.toast(Loc.t("toast.too_big"), "warning")
		Sfx.play("fail")
		return false
	active = offer
	stage = Stage.TO_PICKUP
	load_progress = 0.0
	cargo_condition = 100.0
	_late_warned = false
	offers.remove_at(index)
	offers.append(_make_offer())
	offers_changed.emit()
	Sfx.play("accept")
	_changed()
	return true


func cancel() -> void:
	if stage != Stage.TO_PICKUP and stage != Stage.DELIVERING:
		return
	active = {}
	stage = Stage.IDLE
	load_progress = 0.0
	Bus.toast(Loc.t("toast.cancelled"), "info")
	_changed()


func _changed() -> void:
	stage_changed.emit()
	Bus.delivery_changed.emit()


# --- andamento -------------------------------------------------------------------------

func _physics_process(delta: float) -> void:
	refresh_cooldown = maxf(refresh_cooldown - delta, 0.0)
	_hit_cooldown = maxf(_hit_cooldown - delta, 0.0)
	if vehicle == null or not is_instance_valid(vehicle):
		return
	match stage:
		Stage.TO_PICKUP:
			if _update_bay(delta, active["pickup_zone"], active["pickup_along_x"]):
				_pick_up()
		Stage.DELIVERING:
			time_left -= delta
			if time_left < 0.0 and not _late_warned:
				_late_warned = true
				Bus.toast(Loc.t("toast.late"), "warning")
				Sfx.play("fail")
			if time_left < -GameConfig.LATE_GRACE_SECONDS:
				_fail()
			elif _update_bay(delta, active["dropoff_zone"], active["dropoff_along_x"]):
				_complete()
		Stage.RESULT:
			result_timer -= delta
			if result_timer <= 0.0:
				stage = Stage.IDLE
				_changed()


## Está parado dentro da vaga? Enche a barra de carga; devolve true quando completa.
func _update_bay(delta: float, zone: Vector3, along_x: bool) -> bool:
	if in_bay(zone, along_x) and absf(vehicle.speed) < GameConfig.STOP_SPEED:
		load_progress += delta / GameConfig.LOAD_SECONDS
		if load_progress >= 1.0:
			load_progress = 0.0
			return true
	else:
		load_progress = maxf(load_progress - delta * 2.0, 0.0)
	return false


func in_bay(zone: Vector3, along_x: bool) -> bool:
	var offset := vehicle.global_position - zone
	var along := absf(offset.x if along_x else offset.z)
	var across := absf(offset.z if along_x else offset.x)
	return along < BAY_HALF.x and across < BAY_HALF.y


func _pick_up() -> void:
	stage = Stage.DELIVERING
	time_left = active["time_limit"]
	cargo_condition = 100.0
	Sfx.play("pickup")
	Bus.toast(Loc.t("toast.picked_up", [active["dropoff_name"]]), "success")
	_changed()


func _on_impact(strength: float) -> void:
	if stage != Stage.DELIVERING or strength < GameConfig.CARGO_IMPACT_THRESHOLD:
		return
	var damage := GameConfig.CARGO_DAMAGE_PER_IMPACT * (strength / GameConfig.CARGO_IMPACT_THRESHOLD) * float(active["fragility"])
	var before := cargo_condition
	cargo_condition = maxf(cargo_condition - damage, 0.0)
	if before - cargo_condition < 0.5:
		return
	cargo_damaged.emit(before - cargo_condition, cargo_condition)
	# O HUD mostra cada batida; o aviso escrito só aparece ao passar de 75%, 50% e 25%.
	for threshold: float in [75.0, 50.0, 25.0]:
		if before > threshold and cargo_condition <= threshold and _hit_cooldown <= 0.0:
			_hit_cooldown = 1.5
			Bus.toast(Loc.t("toast.cargo_hit", [roundi(cargo_condition)]), "warning")
			break


## Calcula o pagamento (função pura, usada também pelos testes).
static func compute_payment(reward: int, time_limit: float, time_left: float, condition: float) -> Dictionary:
	var late := time_left < 0.0
	var fraction := time_left / maxf(time_limit, 1.0)
	var base := reward if not late else roundi(reward * GameConfig.LATE_MULTIPLIER)
	var bonus := 0
	if not late:
		for tier: Dictionary in GameConfig.BONUS_TIERS:
			if fraction >= float(tier["min_fraction"]):
				bonus = roundi(reward * float(tier["multiplier"]))
				break
	var damage := roundi(base * (1.0 - clampf(condition, 0.0, 100.0) / 100.0))
	var rating := 5.0
	if late:
		rating -= 2.0
	rating -= (100.0 - condition) / 25.0
	if not late and bonus == 0 and fraction < 0.1:
		rating -= 0.5
	rating = clampf(snappedf(rating, 0.5), 1.0, 5.0)
	var tip := 0
	if rating >= 4.0:
		tip = roundi(reward * GameConfig.MAX_TIP * (rating - 3.0) / 2.0)
	var total := maxi(base - damage + bonus + tip, 0)
	return {"late": late, "base": base, "bonus": bonus, "damage": damage, "tip": tip, "rating": rating, "total": total}


func _complete() -> void:
	var payment := compute_payment(active["reward"], active["time_limit"], time_left, cargo_condition)
	GameState.add_money(payment["total"], "delivery")
	GameState.increment("deliveries")
	if payment["late"]:
		GameState.increment("late")
	if payment["bonus"] > 0:
		GameState.increment("fast")
	GameState.add_rating(payment["rating"])
	last_result = payment.duplicate()
	last_result["failed"] = false
	last_result["condition"] = cargo_condition
	last_result["type"] = active["type"]
	last_result["dropoff_name"] = active["dropoff_name"]
	active = {}
	stage = Stage.RESULT
	result_timer = GameConfig.RESULT_SECONDS
	Sfx.play("success")
	Sfx.play("cash", -4.0)
	GameState.save_game()
	finished.emit(last_result)
	_changed()


func _fail() -> void:
	GameState.increment("failed")
	GameState.add_rating(1.0)
	last_result = {"failed": true, "total": 0, "type": active["type"], "dropoff_name": active["dropoff_name"]}
	active = {}
	stage = Stage.RESULT
	result_timer = GameConfig.RESULT_SECONDS
	Sfx.play("fail")
	finished.emit(last_result)
	_changed()
