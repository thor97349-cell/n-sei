extends Node
## Ponto de entrada: tela de carregamento → cidade → menu principal (câmera passeando)
## → partida (HUD, celular, mapa, pausa, opções, garagem).

enum State { LOADING, MENU, PLAYING }

var state := State.LOADING
var world: World
var session: GameSession
var ui: CanvasLayer
var hud: Hud
var phone: Phone
var map_overlay: MapOverlay

var _menu: MainMenu
var _pause: PauseMenu
var _settings: SettingsMenu
var _garage: GarageMenu
var _menu_camera: Camera3D
var _menu_angle := 0.6


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	ui = CanvasLayer.new()
	ui.layer = 10
	add_child(ui)
	var loading := _loading_screen()
	ui.add_child(loading)
	# Deixa a tela de carregamento aparecer antes de construir a cidade.
	await get_tree().process_frame
	await get_tree().process_frame
	world = World.new()
	world.name = "World"
	world.process_mode = Node.PROCESS_MODE_PAUSABLE
	add_child(world)
	_menu_camera = Camera3D.new()
	_menu_camera.far = 3200.0
	_menu_camera.fov = 60.0
	world.add_child(_menu_camera)
	world.set_camera(_menu_camera)
	world.traffic.fill(Vector3.ZERO)
	loading.queue_free()
	Bus.language_changed.connect(_on_language_changed)
	_open_menu()


func _loading_screen() -> Control:
	var root := ColorRect.new()
	root.color = Color(0.05, 0.06, 0.08)
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.theme = UiKit.theme()
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.add_child(center)
	var column := UiKit.vbox(10)
	center.add_child(column)
	column.add_child(UiKit.label("ENTREGA IMPOSSÍVEL", 56, Color.WHITE, true, HORIZONTAL_ALIGNMENT_CENTER))
	column.add_child(UiKit.label(Loc.t("menu.loading"), 24, UiKit.ACCENT, false, HORIZONTAL_ALIGNMENT_CENTER))
	return root


func _process(delta: float) -> void:
	if state == State.MENU and _menu_camera:
		# Passeio lento em volta do centro da cidade.
		_menu_angle += delta * 0.035
		var target := Vector3(40.0, 18.0, -40.0)
		_menu_camera.global_position = target + Vector3(cos(_menu_angle) * 300.0, 95.0 + sin(_menu_angle * 0.7) * 20.0, sin(_menu_angle) * 300.0)
		_menu_camera.look_at(target)


# --- menu principal -------------------------------------------------------------------

func _open_menu() -> void:
	state = State.MENU
	get_tree().paused = false
	world.atmosphere.minutes = 16.2 * 60.0
	world.atmosphere.clock_running = true
	world.atmosphere.set_rain(false)
	world.set_camera(_menu_camera)
	_menu_camera.current = true
	_menu = MainMenu.new()
	ui.add_child(_menu)
	_menu.continue_requested.connect(func() -> void: _start(false))
	_menu.new_game_requested.connect(func() -> void: _start(true))
	_menu.settings_requested.connect(_open_settings)
	_menu.quit_requested.connect(_quit)


func _start(new_game: bool) -> void:
	if new_game or not GameState.load_game():
		GameState.new_game()
	if _menu:
		_menu.queue_free()
		_menu = null
	state = State.PLAYING
	session = GameSession.new()
	session.name = "Session"
	session.process_mode = Node.PROCESS_MODE_PAUSABLE
	add_child(session)
	session.start(world)
	session.garage_requested.connect(_open_garage)
	_build_game_ui()
	if int(GameState.stats.get("deliveries", 0)) == 0:
		Bus.toast(Loc.t("toast.welcome"), "event")


func _build_game_ui() -> void:
	for node: Node in [hud, phone, map_overlay]:
		if node and is_instance_valid(node):
			node.queue_free()
	hud = Hud.new()
	ui.add_child(hud)
	hud.bind(session)
	map_overlay = MapOverlay.new()
	map_overlay.visible = false
	ui.add_child(map_overlay)
	map_overlay.bind(session)
	phone = Phone.new()
	phone.visible = false
	ui.add_child(phone)
	phone.bind(session)


func _on_language_changed() -> void:
	if state == State.PLAYING:
		var phone_open := phone.visible
		_build_game_ui()
		phone.visible = phone_open
		# Menus abertos por cima continuam por cima.
		for node: Node in [_pause, _settings, _garage]:
			if node and is_instance_valid(node):
				ui.move_child(node, -1)


# --- partida ------------------------------------------------------------------------

func _unhandled_input(event: InputEvent) -> void:
	if state != State.PLAYING or _pause or _settings or _garage:
		return
	if event.is_action_pressed("pause"):
		get_viewport().set_input_as_handled()
		if phone.visible:
			phone.visible = false
		elif map_overlay.visible:
			map_overlay.visible = false
			hud.visible = true
		else:
			_pause_game()
	elif event.is_action_pressed("phone"):
		get_viewport().set_input_as_handled()
		phone.visible = not phone.visible
		Sfx.play("click")
	elif event.is_action_pressed("map"):
		get_viewport().set_input_as_handled()
		map_overlay.visible = not map_overlay.visible
		hud.visible = not map_overlay.visible


func _pause_game() -> void:
	get_tree().paused = true
	_pause = PauseMenu.new()
	ui.add_child(_pause)
	_pause.resume_requested.connect(_resume)
	_pause.settings_requested.connect(_open_settings)
	_pause.main_menu_requested.connect(_back_to_menu)
	_pause.quit_requested.connect(_quit)


func _resume() -> void:
	if _pause:
		_pause.queue_free()
		_pause = null
	get_tree().paused = false


func _open_settings() -> void:
	if _settings:
		return
	_settings = SettingsMenu.new()
	ui.add_child(_settings)
	_settings.closed.connect(func() -> void:
		_settings = null
		if _pause:
			(_pause.find_children("*", "Button", true, false)[0] as Button).grab_focus())


func _open_garage() -> void:
	if _garage:
		return
	phone.visible = false
	_garage = GarageMenu.new()
	_garage.session = session
	ui.add_child(_garage)
	_garage.closed.connect(func() -> void: _garage = null)


func _end_session() -> void:
	if session:
		session.end()
		session.queue_free()
		session = null
	for node: Node in [hud, phone, map_overlay, _pause, _garage]:
		if node and is_instance_valid(node):
			node.queue_free()
	hud = null
	phone = null
	map_overlay = null
	_pause = null
	_garage = null


func _back_to_menu() -> void:
	_end_session()
	get_tree().paused = false
	_open_menu()


func _quit() -> void:
	_end_session()
	Settings.save_settings()
	get_tree().quit()


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST and session:
		session.end()
