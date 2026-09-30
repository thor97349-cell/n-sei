extends Node
## Ferramenta de desenvolvimento: abre o jogo (main.tscn), entra no modo dev pelo menu,
## usa o painel F1 (trocar para o caminhão, tempestade, noite, teleporte) e tira prints.
## No fim volta ao menu e confere que o save normal voltou a ser o usado.
## Uso: godot --path . res://tools/dev_tour.tscn -- prefixo

var _prefix := "user://dev"
var _main: Node
var _frame := 0
var _steps: Array = []
var _failures: Array[String] = []


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	var args := OS.get_cmdline_user_args()
	if args.size() > 0:
		_prefix = args[0]
	_main = load("res://scenes/main.tscn").instantiate()
	add_child(_main)
	_steps = [
		[90, "shot", "menu"],
		[95, "call", func() -> void: _main._menu.dev_requested.emit()],
		[150, "call", func() -> void:
			_check(GameState.dev_mode and GameState.slot == "dev", "modo dev ligado com save próprio")
			_check(GameState.owned_vehicles.size() == VehicleSpecs.ORDER.size(), "todos os veículos liberados")
			_check(GameState.money >= 500_000, "dinheiro de sobra")
			_press_f1()],
		[165, "shot", "panel"],
		[166, "call", func() -> void:
			_check(get_tree().paused, "painel aberto pausa o jogo")
			_main._dev._switch_vehicle("truck")],
		[175, "call", func() -> void:
			_check(_main.session.vehicle.id == "truck", "trocou para o caminhão")
			_check(not get_tree().paused, "painel fechou e o jogo voltou")
			_main._dev._set_hour(18.0)
			_main._dev._event("storm", "")],
		[260, "shot", "truck_storm"],
		[261, "call", func() -> void:
			_check(_main.session.events.active_id == "storm", "tempestade ativa")
			_main._dev._set_hour(12.0)
			_main._dev._stop_event()
			var index := -1
			for i in _main._dev._place_list.size():
				if _main._dev._place_list[i].get("id", "") == "stadium":
					index = i
			_main._dev._places.select(index)
			_main._dev._teleport()],
		[300, "call", func() -> void:
			var stadium: Dictionary = CityLayout.find_location("stadium")
			_check(_main.session.vehicle.global_position.distance_to(stadium["zone"]) < 8.0, "teleporte até a Arena Sul")
			_main._dev._event("shortcut", "mall_gate")],
		[340, "shot", "stadium"],
		[341, "call", func() -> void:
			_check(_main.session.world.info.is_shortcut_open("mall_gate"), "atalho do shopping aberto pelo painel")
			_main._back_to_menu()],
		[360, "call", func() -> void:
			_check(not GameState.dev_mode and GameState.slot == "save", "saindo do modo dev volta ao save normal")
			for line in _failures:
				print("FALHA ", line)
			print("RESULTADO: ", "OK" if _failures.is_empty() else "FALHOU (%d)" % _failures.size())
			get_tree().quit(0 if _failures.is_empty() else 1)],
	]


func _check(ok: bool, message: String) -> void:
	print(("ok   " if ok else "FALHA ") + message)
	if not ok:
		_failures.append(message)


func _press_f1() -> void:
	var event := InputEventKey.new()
	event.keycode = KEY_F1
	event.pressed = true
	Input.parse_input_event(event)


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
