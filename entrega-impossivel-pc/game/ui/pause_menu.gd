class_name PauseMenu
extends Control
## Menu de pausa (o jogo fica parado enquanto aberto).

signal resume_requested
signal settings_requested
signal main_menu_requested
signal quit_requested


func _ready() -> void:
	theme = UiKit.theme()
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	process_mode = Node.PROCESS_MODE_ALWAYS
	add_child(UiKit.overlay(0.55))
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(center)
	var box := UiKit.panel(Color(0.07, 0.08, 0.1, 0.96), 18, 28)
	box.custom_minimum_size = Vector2(420, 0)
	center.add_child(box)
	var column := UiKit.vbox(12)
	box.add_child(column)
	column.add_child(UiKit.label(Loc.t("pause.title"), 40, UiKit.ACCENT, true, HORIZONTAL_ALIGNMENT_CENTER))
	var stats := GameState.stats
	var summary := UiKit.label("%s  •  %d 📦  •  %.1f km  •  %s %.1f" % [UiKit.money(GameState.money), int(stats.get("deliveries", 0)), float(stats.get("distance_km", 0.0)), "★", GameState.average_rating()], 17, UiKit.MUTED, false, HORIZONTAL_ALIGNMENT_CENTER)
	column.add_child(summary)
	var first: Button = null
	for entry: Array in [["pause.resume", resume_requested], ["pause.settings", settings_requested], ["pause.main_menu", main_menu_requested], ["pause.quit", quit_requested]]:
		var button := UiKit.button(Loc.t(entry[0]))
		var signal_ref: Signal = entry[1]
		button.pressed.connect(func() -> void:
			Sfx.play("click")
			signal_ref.emit())
		column.add_child(button)
		if first == null:
			first = button
	first.grab_focus.call_deferred()
