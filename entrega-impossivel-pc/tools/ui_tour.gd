extends Node
## Ferramenta de desenvolvimento: abre o jogo de verdade (main.tscn), passa pelo menu,
## começa um jogo novo, aceita um pedido, dirige um pouco e tira prints de cada tela.
## Usa um save separado ("tour") para não mexer no save do jogador.
## Uso: godot --path . res://tools/ui_tour.tscn -- prefixo

var _prefix := "user://tour"
var _main: Node
var _frame := 0
var _steps: Array = []
var _autopilot := true


## Estaciona o carro na vaga da coleta (true) ou do destino (false).
func _park(pickup: bool) -> void:
	var delivery: DeliveryManager = _main.session.delivery
	var zone: Vector3 = delivery.active["pickup_zone" if pickup else "dropoff_zone"]
	var along_x: bool = delivery.active["pickup_along_x" if pickup else "dropoff_along_x"]
	var vehicle: Vehicle = _main.session.vehicle
	vehicle.input_throttle = 0.0
	vehicle.input_steer = 0.0
	vehicle.input_brake = 0.0
	vehicle.place(Transform3D(Basis(Vector3.UP, PI / 2.0 if along_x else 0.0), zone))


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	GameState.slot = "tour"
	var args := OS.get_cmdline_user_args()
	if args.size() > 0:
		_prefix = args[0]
	_main = load("res://scenes/main.tscn").instantiate()
	add_child(_main)
	_steps = [
		[90, "shot", "menu"],
		[95, "call", func() -> void: _main._start(true)],
		[149, "call", func() -> void: print("hud size ", _main.hud.size, " rect ", _main.hud.get_global_rect(), " anchors ", [_main.hud.anchor_left, _main.hud.anchor_right, _main.hud.anchor_bottom], " offsets ", [_main.hud.offset_left, _main.hud.offset_right, _main.hud.offset_bottom], " viewport ", get_viewport().get_visible_rect())],
		[150, "shot", "hud_start"],
		[155, "call", func() -> void: _main.phone.visible = true],
		[170, "shot", "phone"],
		[175, "call", func() -> void:
			_main.phone.visible = false
			var delivery: DeliveryManager = _main.session.delivery
			for i in delivery.offers.size():
				if VehicleSpecs.can_carry(GameState.current_vehicle, delivery.offers[i]["size"]):
					delivery.accept(i)
					break
			_main.session.vehicle.use_player_input = false],
		[180, "drive", 1.0],
		[420, "shot", "driving"],
		[432, "call", func() -> void:
			GameState.money = 200
			_main.session._on_red_light()],
		[442, "shot", "fine"],
		[460, "call", func() -> void: _main.map_overlay.visible = true],
		[475, "shot", "map"],
		[480, "call", func() -> void:
			_main.map_overlay.visible = false
			_main.hud.visible = true
			_autopilot = false
			_park(true)],
		[505, "shot", "pickup_bay"],
		[508, "call", func() -> void: _main.session.delivery._on_impact(9.0)],
		[514, "shot", "cargo_hit"],
		[555, "call", func() -> void: _park(false)],
		[595, "shot", "delivering"],
		[675, "shot", "result"],
		[676, "call", func() -> void:
			var payment := DeliveryManager.compute_payment(200, 120.0, 40.0, 62.0)
			payment.merge({"failed": false, "condition": 62.0, "type": "pizza", "dropoff_name": "Casa Azul"})
			_main.hud._show_result(payment)],
		[679, "shot", "result_damaged"],
		[680, "call", func() -> void: _main._open_garage()],
		[695, "shot", "garage"],
		[700, "call", func() -> void:
			_main._garage.queue_free()
			_main._garage = null
			_main._pause_game()],
		[715, "shot", "pause"],
		[720, "call", func() -> void: _main._open_settings()],
		[735, "shot", "settings"],
		[740, "call", func() -> void:
			_main._settings.queue_free()
			_main._settings = null
			_main._resume()
			_main.world.atmosphere.minutes = 21.0 * 60.0
			_main.session.events.start("storm")],
		[835, "shot", "night_rain"],
		[840, "quit"],
	]


func _process(_delta: float) -> void:
	_frame += 1
	while not _steps.is_empty() and _frame >= int(_steps[0][0]):
		var step: Array = _steps.pop_front()
		match step[1]:
			"shot":
				var path := "%s_%s.png" % [_prefix, step[2]]
				get_viewport().get_texture().get_image().save_png(path)
				print("salvo ", path)
			"call":
				(step[2] as Callable).call()
			"drive":
				set_physics_process(true)
			"quit":
				get_tree().quit()


func _physics_process(_delta: float) -> void:
	if _main == null or _main.session == null or _main.session.vehicle == null:
		return
	var vehicle: Vehicle = _main.session.vehicle
	if vehicle.use_player_input or not _autopilot:
		return
	# Piloto automático simples: segue a rota do GPS.
	var route: PackedVector3Array = _main.session.route_points
	if route.size() < 3:
		vehicle.input_throttle = 0.0
		vehicle.input_brake = 1.0
		return
	var target := route[2] if vehicle.global_position.distance_to(route[1]) < 8.0 else route[1]
	var local := vehicle.global_transform.affine_inverse() * target
	var angle := atan2(-local.x, local.z)
	vehicle.input_steer = clampf(-angle * 1.5, -1.0, 1.0)
	var wanted := 9.0 if absf(angle) > 0.4 else 14.0
	vehicle.input_throttle = clampf((wanted - vehicle.speed) * 0.3, 0.0, 0.8)
	vehicle.input_brake = clampf((vehicle.speed - wanted) * 0.2, 0.0, 1.0)
