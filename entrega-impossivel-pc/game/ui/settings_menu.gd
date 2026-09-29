class_name SettingsMenu
extends Control
## Tela de opções: gráficos, áudio, jogo e controles. As mudanças valem na hora e
## são salvas ao fechar.

signal closed

var _rows: VBoxContainer


func _ready() -> void:
	theme = UiKit.theme()
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	process_mode = Node.PROCESS_MODE_ALWAYS
	add_child(UiKit.overlay(0.6))
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(center)
	var box := UiKit.panel(Color(0.07, 0.08, 0.1, 0.97), 18, 26)
	box.custom_minimum_size = Vector2(760, 640)
	center.add_child(box)
	var column := UiKit.vbox(14)
	box.add_child(column)
	column.add_child(UiKit.label(Loc.t("settings.title"), 36, UiKit.ACCENT, true, HORIZONTAL_ALIGNMENT_CENTER))
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	column.add_child(scroll)
	_rows = UiKit.vbox(12)
	_rows.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(_rows)

	_option("settings.graphics", "graphics/quality", [["low", "settings.quality.low"], ["medium", "settings.quality.medium"], ["high", "settings.quality.high"], ["ultra", "settings.quality.ultra"]])
	_check("settings.fullscreen", "display/fullscreen")
	_check("settings.vsync", "display/vsync")
	_slider("settings.render_scale", "display/render_scale", 0.5, 1.0, 0.05, true)
	_slider("settings.master", "audio/master", 0.0, 1.0, 0.05, true)
	_slider("settings.sfx", "audio/sfx", 0.0, 1.0, 0.05, true)
	_slider("settings.engine", "audio/engine", 0.0, 1.0, 0.05, true)
	_slider("settings.ambient", "audio/ambient", 0.0, 1.0, 0.05, true)
	_option("settings.language", "game/language", [["", "settings.lang.auto"], ["pt", "settings.lang.pt"], ["en", "settings.lang.en"]])
	_option("settings.units", "game/units", [["kmh", "settings.units.metric"], ["mph", "settings.units.imperial"]])
	_option("settings.traffic", "game/traffic_density", [[0.5, "settings.traffic.low"], [1.0, "settings.traffic.normal"], [1.4, "settings.traffic.high"]])
	_slider("settings.sensitivity", "controls/camera_sensitivity", 0.3, 2.0, 0.1, false)
	_check("settings.invert_y", "controls/invert_y")
	_rows.add_child(HSeparator.new())
	_rows.add_child(UiKit.label(Loc.t("settings.controls"), 24, UiKit.ACCENT, true))
	var controls := UiKit.label(Loc.t("settings.controls_text"), 17, UiKit.MUTED)
	controls.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	controls.custom_minimum_size = Vector2(680, 0)
	_rows.add_child(controls)

	var back := UiKit.button(Loc.t("menu.back"))
	back.pressed.connect(_close)
	column.add_child(back)
	back.grab_focus.call_deferred()


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("pause") or event.is_action_pressed("ui_cancel"):
		get_viewport().set_input_as_handled()
		_close()


func _close() -> void:
	Settings.save_settings()
	Sfx.play("click")
	closed.emit()
	queue_free()


func _row(text_key: String) -> HBoxContainer:
	var row := UiKit.hbox(12)
	var label := UiKit.label(Loc.t(text_key), 20)
	label.custom_minimum_size = Vector2(300, 0)
	row.add_child(label)
	_rows.add_child(row)
	return row


func _check(text_key: String, key: String) -> void:
	var row := _row(text_key)
	var box := CheckBox.new()
	box.button_pressed = bool(Settings.get_value(key))
	box.toggled.connect(func(on: bool) -> void: Settings.set_value(key, on))
	row.add_child(box)


func _slider(text_key: String, key: String, low: float, high: float, step: float, percent: bool) -> void:
	var row := _row(text_key)
	var slider := HSlider.new()
	slider.min_value = low
	slider.max_value = high
	slider.step = step
	slider.value = float(Settings.get_value(key))
	slider.custom_minimum_size = Vector2(280, 24)
	slider.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var value_label := UiKit.label("", 18, UiKit.MUTED)
	var show := func(value: float) -> void: value_label.text = ("%d%%" % roundi(value * 100.0)) if percent else ("%.1f×" % value)
	show.call(slider.value)
	slider.value_changed.connect(func(value: float) -> void:
		show.call(value)
		Settings.set_value(key, value))
	row.add_child(slider)
	row.add_child(value_label)


func _option(text_key: String, key: String, choices: Array) -> void:
	var row := _row(text_key)
	var button := OptionButton.new()
	button.custom_minimum_size = Vector2(280, 0)
	var current: Variant = Settings.get_value(key)
	for i in choices.size():
		button.add_item(Loc.t(choices[i][1]), i)
		var choice: Variant = choices[i][0]
		var same := false
		if (choice is float or choice is int) and (current is float or current is int):
			same = is_equal_approx(float(choice), float(current))
		elif typeof(choice) == typeof(current):
			same = choice == current
		if same:
			button.select(i)
	button.item_selected.connect(func(index: int) -> void:
		Settings.set_value(key, choices[index][0])
		Sfx.play("click"))
	row.add_child(button)
