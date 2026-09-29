class_name GarageMenu
extends Control
## Garagem da Central: ver, comprar e escolher veículos.

signal closed

var session: GameSession
var _cards: HBoxContainer
var _money: Label


func _ready() -> void:
	theme = UiKit.theme()
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(UiKit.overlay(0.6))
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(center)
	var box := UiKit.panel(Color(0.07, 0.08, 0.1, 0.97), 18, 24)
	center.add_child(box)
	var column := UiKit.vbox(16)
	box.add_child(column)
	var header := UiKit.hbox(12)
	column.add_child(header)
	header.add_child(UiKit.label("🚚 " + Loc.t("garage.title"), 36, UiKit.ACCENT, true))
	header.add_child(UiKit.spacer())
	_money = UiKit.label("", 26, UiKit.SUCCESS, true)
	header.add_child(_money)
	_cards = UiKit.hbox(14)
	column.add_child(_cards)
	var close := UiKit.button(Loc.t("garage.close"))
	close.pressed.connect(_close)
	column.add_child(close)
	_rebuild()
	close.grab_focus.call_deferred()


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("pause") or event.is_action_pressed("ui_cancel") or event.is_action_pressed("interact"):
		get_viewport().set_input_as_handled()
		_close()


func _close() -> void:
	Sfx.play("click")
	closed.emit()
	queue_free()


func _rebuild() -> void:
	_money.text = UiKit.money(GameState.money)
	for child in _cards.get_children():
		child.queue_free()
	for id: String in VehicleSpecs.ORDER:
		_cards.add_child(_card(id))


func _card(id: String) -> Control:
	var spec := VehicleSpecs.get_spec(id)
	var owned := GameState.owns(id)
	var in_use := GameState.current_vehicle == id
	var card := UiKit.panel(Color(0.12, 0.13, 0.16, 0.95) if not in_use else Color(0.2, 0.14, 0.06, 0.95), 14, 14)
	card.custom_minimum_size = Vector2(290, 0)
	var column := UiKit.vbox(6)
	card.add_child(column)
	var swatch := ColorRect.new()
	swatch.color = spec["color"]
	swatch.custom_minimum_size = Vector2(0, 10)
	column.add_child(swatch)
	column.add_child(UiKit.label(spec["name"], 26, UiKit.TEXT, true))
	var description := UiKit.label(spec["description_pt"] if Loc.language == "pt" else spec["description_en"], 16, UiKit.MUTED)
	description.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	description.custom_minimum_size = Vector2(260, 60)
	column.add_child(description)
	var stats: Dictionary = spec["stats"]
	for pair: Array in [["garage.speed", "speed"], ["garage.accel", "accel"], ["garage.handling", "handling"], ["garage.cargo", "cargo"]]:
		var row := UiKit.hbox(8)
		var name := UiKit.label(Loc.t(pair[0]), 16)
		name.custom_minimum_size = Vector2(120, 0)
		row.add_child(name)
		var bar := ProgressBar.new()
		bar.max_value = 5
		bar.value = stats[pair[1]]
		bar.show_percentage = false
		bar.custom_minimum_size = Vector2(130, 10)
		bar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		row.add_child(bar)
		column.add_child(row)
	column.add_child(UiKit.label("%s • %s" % [Settings.speed_text(float(spec["limiter_kmh"]) / 3.6), Loc.t("garage.cargo_size", [Loc.t("cargo." + str(spec["cargo"]))])], 16, UiKit.MUTED))
	var action: Button
	if in_use:
		action = UiKit.button(Loc.t("garage.in_use"))
		action.disabled = true
	elif owned:
		action = UiKit.button(Loc.t("garage.use"))
	else:
		action = UiKit.button(Loc.t("garage.buy", [UiKit.money(spec["price"])]))
		action.disabled = GameState.money < int(spec["price"])
	action.pressed.connect(func() -> void:
		if session.switch_vehicle(id):
			_rebuild())
	column.add_child(action)
	return card
