class_name GameSession
extends Node
## Uma partida em andamento: carro do jogador, câmera, entregas, eventos e serviços
## (resgate, guincho, posto de gasolina, multa por sinal vermelho, garagem, relógio,
## faróis automáticos, pista molhada e salvamento automático).

signal garage_requested
signal vehicle_spawned(vehicle: Vehicle)

const FUEL_RATE := 14.0
const TOW_FUEL := 12.0

var world: World
var vehicle: Vehicle
var camera: ChaseCamera
var delivery: DeliveryManager
var events: EventDirector
var markers: Markers
var route_points := PackedVector3Array()
var route_distance := 0.0
## Texto de ação para o HUD e progresso (0..1, ou -1 sem barra).
var prompt := ""
var prompt_progress := -1.0
var near_garage := false

var _route_timer := 0.0
var _autosave := GameConfig.AUTOSAVE_SECONDS
var _recover_cooldown := 0.0
var _last_odometer := 0.0
var _fuel_warned := false
var _fuel_bill := 0.0
var _fuel_spent := 0
var _refueling := false
var _stations: Array[Dictionary] = []


func start(world_ref: World) -> void:
	world = world_ref
	world.atmosphere.minutes = GameState.clock_minutes
	world.atmosphere.clock_running = true
	world.atmosphere.set_rain(false)
	camera = ChaseCamera.new()
	camera.name = "PlayerCamera"
	world.add_child(camera)
	markers = Markers.new()
	markers.name = "Markers"
	world.add_child(markers)
	delivery = DeliveryManager.new()
	delivery.name = "Delivery"
	add_child(delivery)
	events = EventDirector.new()
	events.name = "Events"
	add_child(events)
	events.setup(world)
	_stations = CityLayout.fuel_stations()
	spawn_vehicle(GameState.current_vehicle, spawn_transform())
	delivery.setup(vehicle, world.graph)
	delivery.stage_changed.connect(_on_stage_changed)
	world.traffic.red_light_run.connect(_on_red_light)
	world.traffic.clear()
	world.traffic.fill(vehicle.global_position)
	_on_stage_changed()


func end() -> void:
	if vehicle:
		GameState.set_fuel(vehicle.id, vehicle.fuel)
	GameState.clock_minutes = world.atmosphere.minutes
	GameState.save_game()
	if events.active_id != "":
		events.stop()
	world.traffic.set_player(null)
	world.traffic.red_light_run.disconnect(_on_red_light)
	for node: Node in [vehicle, camera, markers]:
		if node and is_instance_valid(node):
			node.queue_free()
	vehicle = null


static func spawn_transform() -> Transform3D:
	var spawn: Vector3 = CityLayout.SPAWN["position"]
	return Transform3D(Basis(Vector3.UP, float(CityLayout.SPAWN["yaw"])), Vector3(spawn.x, CityLayout.CURB_HEIGHT + 0.03, spawn.z))


func spawn_vehicle(id: String, xform: Transform3D) -> void:
	if vehicle and is_instance_valid(vehicle):
		GameState.set_fuel(vehicle.id, vehicle.fuel)
		vehicle.queue_free()
	vehicle = Vehicle.new()
	vehicle.name = "PlayerVehicle"
	vehicle.setup(id)
	world.add_child(vehicle)
	vehicle.place(xform)
	vehicle.fuel = GameState.get_fuel(id, float(vehicle.spec["fuel_capacity"]))
	vehicle.out_of_fuel.connect(func() -> void: Bus.toast(Loc.t("hud.out_of_fuel"), "warning"))
	_last_odometer = 0.0
	_fuel_warned = false
	camera.follow(vehicle)
	camera.current = true
	world.set_camera(camera)
	world.traffic.set_player(vehicle)
	events.player = vehicle
	if delivery.graph:
		delivery.set_vehicle(vehicle)
	vehicle_spawned.emit(vehicle)


## Troca de veículo na garagem (compra se ainda não tiver). Devolve true se trocou.
func switch_vehicle(id: String) -> bool:
	if delivery.stage == DeliveryManager.Stage.TO_PICKUP or delivery.stage == DeliveryManager.Stage.DELIVERING:
		Bus.toast(Loc.t("garage.finish_delivery"), "warning")
		return false
	if not GameState.owns(id):
		var price: int = VehicleSpecs.get_spec(id)["price"]
		if not GameState.spend_money(price):
			Bus.toast(Loc.t("garage.no_money"), "warning")
			Sfx.play("fail")
			return false
		GameState.owned_vehicles.append(id)
		Bus.toast(Loc.t("garage.bought", [VehicleSpecs.get_spec(id)["name"]]), "success")
		Sfx.play("cash")
	GameState.current_vehicle = id
	spawn_vehicle(id, spawn_transform())
	delivery.generate_offers()
	GameState.save_game()
	Bus.vehicle_changed.emit()
	return true


func _on_stage_changed() -> void:
	match delivery.stage:
		DeliveryManager.Stage.TO_PICKUP:
			var icon: String = delivery.active["icon"]
			markers.show_target(delivery.active["pickup_zone"], delivery.active["pickup_along_x"], "%s %s" % [icon, delivery.active["pickup_name"]], true)
		DeliveryManager.Stage.DELIVERING:
			markers.show_target(delivery.active["dropoff_zone"], delivery.active["dropoff_along_x"], "🏁 %s" % delivery.active["dropoff_name"], false)
		_:
			markers.hide_target()
			route_points = PackedVector3Array()
			route_distance = 0.0
	_route_timer = 0.0


func _physics_process(delta: float) -> void:
	if vehicle == null or not is_instance_valid(vehicle):
		return
	var atmosphere := world.atmosphere
	GameState.clock_minutes = atmosphere.minutes
	vehicle.grip_factor = lerpf(1.0, 0.78, atmosphere.wetness)
	if vehicle.headlights_auto:
		var want := atmosphere.night_factor > 0.45 or atmosphere.rain_amount() > 0.5
		if want != vehicle.headlights_on:
			vehicle.set_headlights(want)
	var driven := vehicle.odometer - _last_odometer
	if driven > 50.0:
		GameState.increment("distance_km", driven / 1000.0)
		_last_odometer = vehicle.odometer
	GameState.set_fuel(vehicle.id, vehicle.fuel)
	if vehicle.fuel_fraction() < 0.15 and not _fuel_warned and vehicle.fuel > 0.0:
		_fuel_warned = true
		Bus.toast(Loc.t("hud.low_fuel"), "warning")
	elif vehicle.fuel_fraction() > 0.3:
		_fuel_warned = false

	_recover_cooldown = maxf(_recover_cooldown - delta, 0.0)
	_update_prompts(delta)
	_route_timer -= delta
	if _route_timer <= 0.0:
		_route_timer = 1.0
		_update_route()
	_autosave -= delta
	if _autosave <= 0.0:
		_autosave = GameConfig.AUTOSAVE_SECONDS
		if not GameState.save_game():
			Bus.toast(Loc.t("toast.save_failed"), "warning")


func _unhandled_input(event: InputEvent) -> void:
	if vehicle == null:
		return
	if event.is_action_pressed("reset_vehicle"):
		if vehicle.fuel <= 0.0:
			tow()
		elif _recover_cooldown <= 0.0:
			recover()
	elif event.is_action_pressed("interact") and near_garage:
		garage_requested.emit()


## Coloca o carro de pé na faixa mais próxima (grátis).
func recover() -> void:
	var cars := world.traffic.get_children()
	var free_spot := func(point: Vector3) -> bool:
		for car: Node in cars:
			if car is Node3D and (car as Node3D).global_position.distance_to(point) < 9.0:
				return true
		return false
	var xform := world.graph.nearest_lane_transform(vehicle.global_position, vehicle.global_basis.z, free_spot)
	vehicle.place(xform)
	_recover_cooldown = 4.0
	Sfx.play("notify")
	Bus.toast(Loc.t("toast.recovered"), "info")


## Guincho até o posto mais próximo (sem gasolina). Nunca deixa o jogador preso:
## se não houver dinheiro suficiente, cobra só o que tiver.
func tow() -> void:
	var best: Dictionary = {}
	var best_distance := INF
	for station in _stations:
		var distance := (station["pumps"] as Vector3).distance_to(vehicle.global_position)
		if distance < best_distance:
			best_distance = distance
			best = station
	var charged := GameState.charge(GameConfig.TOW_PRICE)
	var pumps: Vector3 = best["pumps"]
	var forward := Vector3.RIGHT if best["along_x"] else Vector3.BACK
	var xform := Transform3D(Basis.looking_at(-forward, Vector3.UP), Vector3(pumps.x, CityLayout.CURB_HEIGHT, pumps.z))
	vehicle.place(xform)
	vehicle.refuel(TOW_FUEL)
	Sfx.play("notify")
	Bus.toast(Loc.t("toast.tow", [charged]), "warning")


func _update_prompts(delta: float) -> void:
	prompt = ""
	prompt_progress = -1.0
	near_garage = false
	var speed := absf(vehicle.speed)
	if vehicle.is_flipped() and speed < 2.0:
		prompt = Loc.t("hud.flipped")
		return
	# Carga/descarga na vaga.
	var target := delivery.target_position()
	if target != Vector3.INF:
		if delivery.load_progress > 0.0:
			prompt = Loc.t("hud.loading" if delivery.stage == DeliveryManager.Stage.TO_PICKUP else "hud.unloading")
			prompt_progress = delivery.load_progress
			return
		if target.distance_to(vehicle.global_position) < 30.0:
			prompt = Loc.t("hud.stop_to_load" if delivery.stage == DeliveryManager.Stage.TO_PICKUP else "hud.stop_to_unload")
			return
	# Posto de gasolina.
	for station in _stations:
		if (station["pumps"] as Vector3).distance_to(vehicle.global_position) < 10.0 and speed < 1.2:
			_update_refuel(delta)
			return
	_finish_refuel()
	# Garagem na Central.
	var pmin: Vector2 = CityLayout.HQ_PARKING["min"]
	var pmax: Vector2 = CityLayout.HQ_PARKING["max"]
	var p := vehicle.global_position
	if CityLayout.in_rect(Vector2(p.x, p.z), pmin, pmax, 2.0) and speed < 1.5:
		near_garage = true
		prompt = Loc.t("hud.garage_hint")


func _update_refuel(delta: float) -> void:
	var capacity: float = vehicle.spec["fuel_capacity"]
	if vehicle.fuel >= capacity - 0.05:
		prompt = Loc.t("hud.tank_full")
		_finish_refuel()
		return
	var price := GameConfig.FUEL_PRICE_PER_LITER
	prompt = Loc.t("hud.refuel_hold", ["%.2f" % price])
	prompt_progress = vehicle.fuel / capacity
	if not Input.is_action_pressed("interact"):
		_finish_refuel()
		return
	_refueling = true
	var liters := minf(FUEL_RATE * delta, capacity - vehicle.fuel)
	_fuel_bill += liters * price
	if _fuel_bill >= 1.0:
		var whole := int(_fuel_bill)
		if not GameState.spend_money(whole):
			Bus.toast(Loc.t("toast.no_money_fuel"), "warning")
			_fuel_bill = 0.0
			_finish_refuel()
			return
		_fuel_bill -= whole
		_fuel_spent += whole
	vehicle.refuel(liters)
	prompt = Loc.t("hud.refueling", ["%d%%" % roundi(vehicle.fuel_fraction() * 100.0)])


func _finish_refuel() -> void:
	if _refueling and _fuel_spent > 0:
		Bus.toast(Loc.t("toast.refueled", [_fuel_spent]), "success")
		Sfx.play("cash", -6.0)
	_refueling = false
	_fuel_spent = 0


func _update_route() -> void:
	var target := delivery.target_position()
	if target == Vector3.INF:
		route_points = PackedVector3Array()
		route_distance = 0.0
		markers.draw_route(route_points)
		return
	route_points = world.graph.find_path(vehicle.global_position, target, false)
	route_distance = 0.0
	for i in range(1, route_points.size()):
		route_distance += route_points[i - 1].distance_to(route_points[i])
	markers.draw_route(route_points)


func _on_red_light() -> void:
	var charged := GameState.charge(GameConfig.RED_LIGHT_FINE)
	GameState.increment("fines")
	Bus.fine_issued.emit("red_light", charged)
	Sfx.play("fine")
	Bus.toast(Loc.t("toast.fine_red_light", [charged]), "fine")
