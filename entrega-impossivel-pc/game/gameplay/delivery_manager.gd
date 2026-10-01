class_name DeliveryManager
extends Node
## Ciclo de entregas: pedidos no celular → ir até a coleta → parar na vaga para
## carregar → levar ao destino dentro do prazo → parar na vaga para entregar → resultado.
##
## Pedidos: OfferGenerator (níveis de risco, modificadores, contratos, especiais raras).
## Pagamento: compute_payment (abaixo) + Payout (modificadores, adicionais, combo).
## Carreira (combo, reputação, contratos, desafios): GameState.career.
##
## Regras do pagamento base (o jogador NUNCA perde dinheiro numa entrega):
##   • no prazo: valor cheio + bônus de rapidez (se sobrou bastante tempo);
##   • atrasado (até LATE_GRACE_SECONDS): LATE_MULTIPLIER do valor;
##   • passou do limite: o pedido é cancelado e paga 0;
##   • carga danificada reduz o pagamento e a avaliação; boa avaliação dá gorjeta.
## Multas de trânsito são cobradas na hora (e aparecem no resumo da entrega).
## Todo o cálculo acontece aqui e no Payout (a interface só mostra).

signal offers_changed
signal stage_changed
signal finished(result: Dictionary)
## A carga estragou numa batida: quanto perdeu (pontos %) e como ficou.
signal cargo_damaged(loss: float, condition: float)
## Apareceu uma entrega especial no celular.
signal special_offered(offer: Dictionary)

enum Stage { IDLE, TO_PICKUP, DELIVERING, RESULT }

## Metade do tamanho da vaga (ao longo da calçada, atravessado) + folga.
const BAY_HALF := Vector2(7.5, 2.8)

var vehicle: Vehicle
var graph: RoadGraph
## Céu/clima (chuva e hora para os adicionais). Opcional.
var atmosphere: Atmosphere
var generator: OfferGenerator
var stage := Stage.IDLE
var offers: Array[Dictionary] = []
var active: Dictionary = {}
var mission: Mission
## Como está indo a entrega atual: multas, combustível, distância, chuva (vira o "run"
## do Payout e dos desafios).
var run: Dictionary = {}
var time_left := 0.0
var cargo_condition := 100.0
## 0 → 1 enquanto parado na vaga (carregando/descarregando).
var load_progress := 0.0
var last_result: Dictionary = {}
var refresh_cooldown := 0.0
var result_timer := 0.0

var _late_warned := false
var _hit_cooldown := 0.0
var _last_fuel := 0.0
var _last_odometer := 0.0


func setup(player_vehicle: Vehicle, road_graph: RoadGraph) -> void:
	graph = road_graph
	generator = OfferGenerator.new(graph)
	if not Bus.fine_issued.is_connected(_on_fine):
		Bus.fine_issued.connect(_on_fine)
	set_vehicle(player_vehicle)
	if offers.is_empty():
		generate_offers()


func _exit_tree() -> void:
	if Bus.fine_issued.is_connected(_on_fine):
		Bus.fine_issued.disconnect(_on_fine)


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

## Monta pedidos novos (as entregas especiais que ainda não expiraram continuam).
func generate_offers() -> void:
	var specials: Array[Dictionary] = []
	for offer in offers:
		if offer.get("special", "") != "":
			specials.append(offer)
	offers = specials
	generator.clock_minutes = _clock()
	offers.append_array(generator.board(GameState.current_vehicle, GameState.career))
	refresh_cooldown = GameConfig.REFRESH_COOLDOWN
	offers_changed.emit()


func refresh_offers() -> bool:
	if refresh_cooldown > 0.0:
		return false
	generate_offers()
	Sfx.play("click")
	return true


## Contrato recém-assinado: coloca um pedido dele no celular (sem trocar os outros).
func ensure_contract_offers() -> void:
	for contract in GameState.career.contracts:
		var found := false
		for offer in offers:
			if offer.get("contract_id", "") == contract["id"]:
				found = true
		if found:
			continue
		var offer := generator.contract_offer(contract, GameState.current_vehicle, GameState.career)
		if not offer.is_empty():
			var index := 0
			while index < offers.size() and offers[index].get("special", "") != "":
				index += 1
			offers.insert(index, offer)
	offers_changed.emit()


## Coloca uma entrega especial no topo do celular (também usado pelo modo dev).
func add_special(kind: String) -> void:
	generator.clock_minutes = _clock()
	var offer := generator.special_offer(kind, GameState.current_vehicle, GameState.career)
	offers.insert(0, offer)
	offers_changed.emit()
	special_offered.emit(offer)


func accept(index: int) -> bool:
	if stage != Stage.IDLE or index < 0 or index >= offers.size():
		return false
	var offer: Dictionary = offers[index]
	if not VehicleSpecs.can_carry(GameState.current_vehicle, offer["size"]):
		Bus.toast(Loc.t("toast.too_big"), "warning")
		Sfx.play("fail")
		return false
	active = offer
	mission = Mission.create(offer)
	stage = Stage.TO_PICKUP
	load_progress = 0.0
	cargo_condition = 100.0
	_late_warned = false
	run = {
		"fines": 0, "fine_total": 0, "fuel_used": 0.0, "distance": 0.0, "rain_time": 0.0,
		"drive_time": 0.0, "vehicle": GameState.current_vehicle,
	}
	offers.remove_at(index)
	mission.on_accept(self)
	offers_changed.emit()
	Sfx.play("accept")
	_changed()
	return true


## Cancelar antes da coleta devolve o pedido ao celular; com a encomenda no carro conta
## como falha (zera o combo e tira reputação).
func cancel() -> void:
	if stage != Stage.TO_PICKUP and stage != Stage.DELIVERING:
		return
	if stage == Stage.DELIVERING:
		GameState.career.on_failed(active, CareerRules.REP_CANCEL_LOADED)
		GameState.increment("failed")
		Bus.toast(Loc.t("toast.cancelled_loaded"), "warning")
		active = {}
		generate_offers()
	else:
		offers.insert(0, active)
		active = {}
		Bus.toast(Loc.t("toast.cancelled"), "info")
		offers_changed.emit()
	mission = null
	stage = Stage.IDLE
	load_progress = 0.0
	_changed()


func _changed() -> void:
	stage_changed.emit()
	Bus.delivery_changed.emit()


# --- andamento -------------------------------------------------------------------------

func _physics_process(delta: float) -> void:
	refresh_cooldown = maxf(refresh_cooldown - delta, 0.0)
	_hit_cooldown = maxf(_hit_cooldown - delta, 0.0)
	_tick_specials(delta)
	if vehicle == null or not is_instance_valid(vehicle):
		return
	match stage:
		Stage.TO_PICKUP:
			_track(delta, false)
			if _update_bay(delta, active["pickup_zone"], active["pickup_along_x"]):
				_pick_up()
		Stage.DELIVERING:
			time_left -= delta
			_track(delta, true)
			var verdict := mission.tick(self, delta) if mission else ""
			if time_left < 0.0 and not _late_warned:
				_late_warned = true
				Bus.toast(Loc.t("toast.late"), "warning")
				Sfx.play("fail")
			if verdict == "fail" or time_left < -GameConfig.LATE_GRACE_SECONDS:
				_fail()
			elif _update_bay(delta, active["dropoff_zone"], active["dropoff_along_x"]):
				_complete()
		Stage.RESULT:
			result_timer -= delta
			if result_timer <= 0.0:
				stage = Stage.IDLE
				_changed()


## Combustível, distância e chuva durante a entrega (com a encomenda no carro).
func _track(delta: float, delivering: bool) -> void:
	var fuel := vehicle.fuel
	if delivering:
		if fuel < _last_fuel:
			run["fuel_used"] = float(run["fuel_used"]) + _last_fuel - fuel
		run["distance"] = float(run["distance"]) + maxf(vehicle.odometer - _last_odometer, 0.0)
		run["drive_time"] = float(run["drive_time"]) + delta
		if atmosphere and atmosphere.rain_amount() > 0.5:
			run["rain_time"] = float(run["rain_time"]) + delta
	_last_fuel = fuel
	_last_odometer = vehicle.odometer


## Entregas especiais somem do celular quando o tempo delas acaba.
func _tick_specials(delta: float) -> void:
	for offer in offers.duplicate():
		if offer.get("special", "") == "":
			continue
		offer["expires"] = float(offer["expires"]) - delta
		if float(offer["expires"]) <= 0.0:
			offers.erase(offer)
			Bus.toast(Loc.t("toast.special_expired"), "info")
			offers_changed.emit()


func _on_fine(_reason: String, amount: int) -> void:
	if stage == Stage.TO_PICKUP or stage == Stage.DELIVERING:
		run["fines"] = int(run.get("fines", 0)) + 1
		run["fine_total"] = int(run.get("fine_total", 0)) + amount


func _clock() -> float:
	return atmosphere.minutes if atmosphere else GameState.clock_minutes


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
	_last_fuel = vehicle.fuel
	_last_odometer = vehicle.odometer
	if mission:
		mission.on_pickup(self)
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


## Como estaria o pagamento se a entrega fosse feita agora (o HUD mostra).
func preview_payout() -> Dictionary:
	if stage != Stage.DELIVERING:
		return {}
	return Payout.compute(active, _run_snapshot(), GameState.career.combo)


func _run_snapshot() -> Dictionary:
	var snapshot := run.duplicate()
	var clock := _clock()
	snapshot["time_left"] = time_left
	snapshot["condition"] = cargo_condition
	snapshot["elapsed"] = float(active.get("time_limit", 0.0)) - time_left
	snapshot["clock"] = clock
	snapshot["night"] = JobRules.is_night(clock)
	snapshot["rain_fraction"] = float(run.get("rain_time", 0.0)) / maxf(float(run.get("drive_time", 0.0)), 1.0)
	return snapshot


func _complete() -> void:
	var career := GameState.career
	run = _run_snapshot()
	var payout := Payout.compute(active, run, career.combo)
	if mission:
		for line in mission.extra_lines(run):
			payout["lines"].append(line)
			payout["payout"] = int(payout["payout"]) + int(line["amount"])
	GameState.add_money(int(payout["payout"]), "delivery")
	GameState.increment("deliveries")
	if payout["late"]:
		GameState.increment("late")
	for line: Dictionary in payout["lines"]:
		if line["key"] == "result.bonus":
			GameState.increment("fast")
	GameState.add_rating(payout["rating"])
	var report := career.settle_delivery(active, run, payout)
	if int(report["money"]) > 0:
		GameState.add_money(int(report["money"]), "career")
	last_result = payout.duplicate()
	last_result["failed"] = false
	last_result["total"] = payout["payout"]
	last_result["type"] = active["type"]
	last_result["dropoff_name"] = active["dropoff_name"]
	last_result["tier"] = active.get("tier", "safe")
	last_result["special"] = active.get("special", "")
	last_result["report"] = report
	active = {}
	mission = null
	stage = Stage.RESULT
	result_timer = GameConfig.RESULT_SECONDS
	# Pedidos novos (e, às vezes, uma entrega especial).
	generate_offers()
	var special := career.roll_special()
	last_result["special_offer"] = special
	Sfx.play("success")
	Sfx.play("cash", -4.0)
	GameState.save_game()
	finished.emit(last_result)
	_changed()
	if special != "":
		add_special(special)
	# Primeira entrega do jogo: mostra onde ficam contratos e desafios (uma vez só).
	if not career.flags.get("tip_career", false):
		career.flags["tip_career"] = true
		Bus.toast(Loc.t("toast.tip_career"), "event")


func _fail() -> void:
	var report := GameState.career.on_failed(active)
	GameState.increment("failed")
	GameState.add_rating(1.0)
	last_result = {
		"failed": true, "total": 0, "net": -int(run.get("fine_total", 0)), "type": active["type"],
		"dropoff_name": active["dropoff_name"], "tier": active.get("tier", "safe"), "report": report,
	}
	active = {}
	mission = null
	stage = Stage.RESULT
	result_timer = GameConfig.RESULT_SECONDS
	generate_offers()
	Sfx.play("fail")
	GameState.save_game()
	finished.emit(last_result)
	_changed()
