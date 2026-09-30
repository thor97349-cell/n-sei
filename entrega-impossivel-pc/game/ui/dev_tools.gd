class_name DevTools
extends Control
## Modo dev: um selo no canto da tela e o painel de testes (F1). Com o painel aberto o
## jogo fica pausado. Dá para trocar de veículo na hora, chamar eventos, mudar a hora,
## ganhar dinheiro, ir direto para a vaga da entrega, teleportar pela cidade e mudar a
## quantidade de trânsito e pedestres. Usa um save separado ("dev").

const TRAFFIC_LEVELS := [["dev.normal", -1], ["dev.lots", 48], ["dev.none", 0]]
const PEOPLE_LEVELS := [["dev.normal", -1], ["dev.lots", 64], ["dev.none", 0]]

var session: GameSession
var panel_open := false

var _badge: Label
var _panel: PanelContainer
var _auto_events: Button
var _clock: Button
var _traffic: Button
var _people: Button
var _fps: Button
var _places: OptionButton
var _place_list: Array[Dictionary] = []
var _traffic_level := 0
var _people_level := 0
var _show_fps := false


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	theme = UiKit.theme()
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_badge = UiKit.label(Loc.t("dev.badge"), 16, UiKit.WARNING, true)
	_badge.anchor_top = 1.0
	_badge.anchor_bottom = 1.0
	_badge.offset_left = 24
	_badge.offset_top = -318
	_badge.add_theme_constant_override("outline_size", 6)
	_badge.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.7))
	add_child(_badge)
	_build_panel()
	_panel.visible = false


func _process(_delta: float) -> void:
	var text := Loc.t("dev.badge")
	if _show_fps:
		text += "  •  %d FPS" % Engine.get_frames_per_second()
	_badge.text = text


func _unhandled_input(event: InputEvent) -> void:
	var key := event as InputEventKey
	if key and key.pressed and not key.echo and key.keycode == KEY_F1:
		get_viewport().set_input_as_handled()
		set_open(not panel_open)
	elif panel_open and event.is_action_pressed("pause"):
		get_viewport().set_input_as_handled()
		set_open(false)


func set_open(open: bool) -> void:
	panel_open = open
	_panel.visible = open
	get_tree().paused = open
	if open:
		_refresh_labels()


# --- montagem do painel ----------------------------------------------------------------

func _build_panel() -> void:
	_panel = UiKit.panel(Color(0.05, 0.06, 0.08, 0.95), 14, 16)
	_panel.anchor_left = 1.0
	_panel.anchor_right = 1.0
	_panel.anchor_bottom = 1.0
	_panel.offset_left = -560
	_panel.offset_right = -20
	_panel.offset_top = 20
	_panel.offset_bottom = -20
	add_child(_panel)
	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_panel.add_child(scroll)
	var column := UiKit.vbox(8)
	column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(column)
	column.add_child(UiKit.label(Loc.t("dev.title"), 28, UiKit.WARNING, true))
	var subtitle := UiKit.label(Loc.t("dev.subtitle"), 15, UiKit.MUTED)
	subtitle.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	column.add_child(subtitle)

	var vehicles := _section(column, "dev.vehicles")
	for id: String in VehicleSpecs.ORDER:
		var spec := VehicleSpecs.get_spec(id)
		_button(vehicles, "%s" % spec["name"], _switch_vehicle.bind(id))

	var events := _section(column, "dev.events")
	_button(events, Loc.t("dev.accident"), _event.bind("accident", ""))
	_button(events, Loc.t("dev.storm"), _event.bind("storm", ""))
	_button(events, Loc.t("dev.bridge"), _event.bind("shortcut", "bridge"))
	_button(events, Loc.t("dev.mall"), _event.bind("shortcut", "mall_gate"))
	_button(events, Loc.t("dev.stop_event"), _stop_event)
	_auto_events = _button(events, "", _toggle_auto_events)

	var time := _section(column, "dev.time")
	for pair: Array in [["dev.morning", 7.0], ["dev.noon", 12.0], ["dev.sunset", 18.0], ["dev.night", 22.0]]:
		_button(time, Loc.t(pair[0]), _set_hour.bind(float(pair[1])))
	_clock = _button(time, "", _toggle_clock)

	var money := _section(column, "dev.money")
	_button(money, "+" + UiKit.money(10_000), _add_money.bind(10_000))
	_button(money, "+" + UiKit.money(100_000), _add_money.bind(100_000))
	_button(money, Loc.t("dev.zero"), _zero_money)

	var delivery := _section(column, "dev.delivery")
	_button(delivery, Loc.t("dev.new_orders"), _new_orders)
	_button(delivery, Loc.t("dev.go_bay"), _go_to_bay)
	_button(delivery, Loc.t("dev.cargo_fix"), _fix_cargo)
	_button(delivery, Loc.t("dev.fuel"), _fill_tank)
	_button(delivery, Loc.t("dev.recover"), _recover)

	var teleport := _section(column, "dev.teleport")
	_places = OptionButton.new()
	_places.add_theme_font_size_override("font_size", 17)
	_places.custom_minimum_size = Vector2(360, 40)
	_place_list = [{"name": Loc.t("dev.hq"), "icon": "🚚", "hq": true}]
	for loc in CityLayout.all_locations():
		_place_list.append(loc)
	for place in _place_list:
		_places.add_item("%s %s" % [place.get("icon", ""), place["name"]])
	teleport.add_child(_places)
	_button(teleport, Loc.t("dev.go"), _teleport)

	var world := _section(column, "dev.world")
	_traffic = _button(world, "", _cycle_traffic)
	_people = _button(world, "", _cycle_people)
	_fps = _button(world, "", _toggle_fps)
	_refresh_labels()


func _section(parent: Container, title_key: String) -> HFlowContainer:
	parent.add_child(HSeparator.new())
	parent.add_child(UiKit.label(Loc.t(title_key), 19, UiKit.ACCENT, true))
	var flow := HFlowContainer.new()
	flow.add_theme_constant_override("h_separation", 8)
	flow.add_theme_constant_override("v_separation", 8)
	parent.add_child(flow)
	return flow


func _button(parent: Container, text: String, callback: Callable) -> Button:
	var button := UiKit.button(text, 17)
	button.custom_minimum_size = Vector2(0, 40)
	button.pressed.connect(func() -> void:
		Sfx.play("click")
		callback.call()
		_refresh_labels())
	parent.add_child(button)
	return button


func _refresh_labels() -> void:
	if session == null:
		return
	_auto_events.text = Loc.t("dev.auto_events", [Loc.t("dev.on" if session.events.enabled else "dev.off")])
	_clock.text = Loc.t("dev.clock", [Loc.t("dev.running" if session.world.atmosphere.clock_running else "dev.stopped")])
	_traffic.text = Loc.t("dev.traffic", [Loc.t(TRAFFIC_LEVELS[_traffic_level][0])])
	_people.text = Loc.t("dev.people", [Loc.t(PEOPLE_LEVELS[_people_level][0])])
	_fps.text = Loc.t("dev.fps", [Loc.t("dev.yes" if _show_fps else "dev.no")])


# --- ações -----------------------------------------------------------------------------

## Troca de veículo no mesmo lugar (de pé, mesma direção). No modo dev todos são do jogador.
func _switch_vehicle(id: String) -> void:
	var old := session.vehicle
	var xform := GameSession.spawn_transform()
	if old and is_instance_valid(old):
		var forward := old.global_basis.z
		forward.y = 0.0
		var origin := old.global_position - Vector3.UP * old.ground_offset
		xform = Transform3D(Basis(Vector3.UP, atan2(forward.x, forward.z)), origin + Vector3.UP * 0.1)
	if not GameState.owns(id):
		GameState.owned_vehicles.append(id)
	GameState.current_vehicle = id
	session.spawn_vehicle(id, xform)
	Bus.vehicle_changed.emit()
	set_open(false)


func _event(id: String, variant: String) -> void:
	session.events.start(id, variant)
	set_open(false)


func _stop_event() -> void:
	if session.events.active_id != "":
		session.events.stop()


func _toggle_auto_events() -> void:
	session.events.enabled = not session.events.enabled


func _set_hour(hour: float) -> void:
	session.world.atmosphere.minutes = hour * 60.0
	GameState.clock_minutes = hour * 60.0


func _toggle_clock() -> void:
	var atmosphere := session.world.atmosphere
	atmosphere.clock_running = not atmosphere.clock_running


func _add_money(amount: int) -> void:
	GameState.add_money(amount)


func _zero_money() -> void:
	GameState.charge(GameState.money)


func _new_orders() -> void:
	session.delivery.generate_offers()


## Leva o carro direto para a vaga da coleta ou da entrega em andamento.
func _go_to_bay() -> void:
	var delivery := session.delivery
	if not (delivery.stage == DeliveryManager.Stage.TO_PICKUP or delivery.stage == DeliveryManager.Stage.DELIVERING):
		Bus.toast(Loc.t("dev.no_delivery"), "warning")
		return
	_place_vehicle(delivery.target_position(), delivery.target_along_x())
	set_open(false)


func _fix_cargo() -> void:
	session.delivery.cargo_condition = 100.0


func _fill_tank() -> void:
	var vehicle := session.vehicle
	vehicle.refuel(float(vehicle.spec["fuel_capacity"]))


func _recover() -> void:
	session.recover()
	set_open(false)


func _teleport() -> void:
	var place: Dictionary = _place_list[_places.selected]
	if place.get("hq", false):
		session.vehicle.place(GameSession.spawn_transform())
	else:
		_place_vehicle(place["zone"], place["zone_along_x"])
	set_open(false)


func _place_vehicle(zone: Vector3, along_x: bool) -> void:
	var basis := Basis(Vector3.UP, PI / 2.0 if along_x else 0.0)
	session.vehicle.place(Transform3D(basis, Vector3(zone.x, 0.0, zone.z)))
	session.camera.follow(session.vehicle)


func _cycle_traffic() -> void:
	_traffic_level = (_traffic_level + 1) % TRAFFIC_LEVELS.size()
	var traffic := session.world.traffic
	var count: int = TRAFFIC_LEVELS[_traffic_level][1]
	if count < 0:
		traffic.apply_settings()
	else:
		traffic.target_count = count
	if traffic.target_count == 0:
		traffic.clear()
	else:
		traffic.fill(session.vehicle.global_position)


func _cycle_people() -> void:
	_people_level = (_people_level + 1) % PEOPLE_LEVELS.size()
	var people := session.world.pedestrians
	var count: int = PEOPLE_LEVELS[_people_level][1]
	if count < 0:
		people.apply_settings()
	else:
		people.target_count = count
	people.fill(session.vehicle.global_position)


func _toggle_fps() -> void:
	_show_fps = not _show_fps
