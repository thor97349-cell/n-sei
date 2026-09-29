class_name MapOverlay
extends Control
## Mapa da cidade inteira (tecla M).

var map: MiniMap


func _ready() -> void:
	theme = UiKit.theme()
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	var shade := ColorRect.new()
	shade.color = Color(0, 0, 0, 0.5)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(shade)
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	center.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(center)
	var column := UiKit.vbox(8)
	center.add_child(column)
	column.add_child(UiKit.label(Loc.t("hud.map_title"), 26, UiKit.ACCENT, true, HORIZONTAL_ALIGNMENT_CENTER))
	map = MiniMap.new()
	map.full = true
	map.custom_minimum_size = Vector2(820, 820)
	column.add_child(map)
	column.add_child(UiKit.label(Loc.t("hud.legend"), 18, UiKit.MUTED, false, HORIZONTAL_ALIGNMENT_CENTER))


func bind(session: GameSession) -> void:
	map.session = session
