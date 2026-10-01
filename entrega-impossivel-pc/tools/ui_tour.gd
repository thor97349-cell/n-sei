extends Node
## Ferramenta de desenvolvimento: abre o jogo de verdade (main.tscn), passa pelo menu,
## começa um jogo novo, aceita um pedido, dirige um pouco e tira prints de cada tela.
## Usa um save separado ("tour") para não mexer no save do jogador.
## Uso: godot --path . res://tools/ui_tour.tscn -- prefixo [idioma: pt/en]

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
	if args.size() > 1:
		Loc.language = args[1]
	_main = load("res://scenes/main.tscn").instantiate()
	add_child(_main)
	_steps = [
		[90, "shot", "menu"],
		[95, "call", func() -> void: _main._start(true)],
		# Carreira de exemplo: Confiável, combo 3 e um contrato assinado.
		[100, "call", func() -> void:
			var career := GameState.career
			career.add_reputation(150)
			career.combo = 3
			career.refresh_contract_offers()
			career.accept_contract(career.contract_offers[0]["id"])
			_main.session.delivery.generate_offers()],
		[150, "shot", "hud_start"],
		[155, "call", func() -> void: _main.phone.visible = true],
		[170, "shot", "phone"],
		[172, "call", func() -> void: _main.phone._set_tab(1)],
		[185, "shot", "phone_career"],
		[187, "call", func() -> void:
			_main.phone._set_tab(0)
			_main.session.delivery.add_special("vip")],
		[200, "shot", "phone_special"],
		[205, "call", func() -> void:
			_main.phone.visible = false
			var delivery: DeliveryManager = _main.session.delivery
			var index := -1
			for i in delivery.offers.size():
				if VehicleSpecs.can_carry(GameState.current_vehicle, delivery.offers[i]["size"]):
					if index < 0 or (delivery.offers[i]["tier"] == "risky" and delivery.offers[i]["special"] == ""):
						index = i
			delivery.accept(index)
			_main.session.vehicle.use_player_input = false],
		[210, "drive", 1.0],
		[450, "shot", "driving"],
		[462, "call", func() -> void:
			GameState.money = 200
			_main.session._on_red_light()],
		[472, "shot", "fine"],
		[490, "call", func() -> void: _main.map_overlay.visible = true],
		[505, "shot", "map"],
		[510, "call", func() -> void:
			_main.map_overlay.visible = false
			_main.hud.visible = true
			_autopilot = false
			_park(true)],
		[535, "shot", "pickup_bay"],
		[538, "call", func() -> void: _main.session.delivery._on_impact(9.0)],
		[544, "shot", "cargo_hit"],
		[585, "call", func() -> void: _park(false)],
		[625, "shot", "delivering"],
		[705, "shot", "result"],
		[706, "call", func() -> void:
			var offer := {"type": "pizza", "reward": 320, "time_limit": 120.0, "tier": "risky", "modifiers": ["urgent", "fragile"]}
			var payout := Payout.compute(offer, {"time_left": 40.0, "condition": 62.0, "fines": 1, "fine_total": 50, "night": true}, 3)
			payout.merge({"failed": false, "total": payout["payout"], "type": "pizza", "dropoff_name": "Casa Azul", "report": {
				"combo_before": 3, "combo": 4, "rep": 15, "rank_up": false, "rank": 1,
				"contracts": [{"client": "bella_napoli", "progress": 3, "target": 4, "counted": true, "completed": false, "reward": 0}],
				"challenges": [{"text": Challenges.text({"kind": "tier", "target": 2}), "reward": 80}],
			}})
			_main.hud._show_result(payout)],
		[712, "shot", "result_damaged"],
		[713, "call", func() -> void:
			_main.hud._result_panel.visible = false
			_main.hud._queue_banner(Loc.t("banner.rank", [CareerRules.rank_name(2).to_upper()]), CareerRules.rank_unlocks(2), Color(0.45, 0.3, 0.05, 0.95))],
		[730, "shot", "rank_up"],
		[735, "call", func() -> void: _main._open_garage()],
		[750, "shot", "garage"],
		[755, "call", func() -> void:
			_main._garage.queue_free()
			_main._garage = null
			_main._pause_game()],
		[770, "shot", "pause"],
		[775, "call", func() -> void: _main._open_settings()],
		[790, "shot", "settings"],
		[795, "call", func() -> void:
			_main._settings.queue_free()
			_main._settings = null
			_main._resume()
			_main.world.atmosphere.minutes = 21.0 * 60.0
			_main.session.events.start("storm")],
		[890, "shot", "night_rain"],
		[895, "quit"],
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
