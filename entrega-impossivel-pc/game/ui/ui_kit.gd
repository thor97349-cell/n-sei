class_name UiKit
extends RefCounted
## Tema visual da interface e atalhos para criar painéis, textos e botões por código.

const ACCENT := Color(0.97, 0.52, 0.1)
const BACKGROUND := Color(0.06, 0.07, 0.09, 0.86)
const PANEL_LIGHT := Color(0.12, 0.13, 0.16, 0.92)
const TEXT := Color(0.96, 0.96, 0.97)
const MUTED := Color(0.66, 0.68, 0.72)
const SUCCESS := Color(0.3, 0.86, 0.45)
const WARNING := Color(1.0, 0.76, 0.2)
const DANGER := Color(1.0, 0.3, 0.3)
const PICKUP := Color(0.3, 0.82, 1.0)

static var _theme: Theme
static var _regular: FontFile
static var _bold: FontFile


static func regular_font() -> FontFile:
	if _regular == null:
		_regular = _font("res://assets/fonts/LiberationSans-Regular.ttf")
	return _regular


static func bold_font() -> FontFile:
	if _bold == null:
		_bold = _font("res://assets/fonts/LiberationSans-Bold.ttf")
	return _bold


static func _font(path: String) -> FontFile:
	var font: FontFile = (load(path) as FontFile).duplicate()
	# Emojis (📦 ✅ ❌ ⛽...) vêm da fonte colorida embutida.
	font.fallbacks = [load("res://assets/fonts/NotoColorEmoji.ttf")]
	return font


static func stylebox(color: Color, radius: int = 10, border: Color = Color(0, 0, 0, 0), border_width: int = 0, padding: int = 12) -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = color
	box.set_corner_radius_all(radius)
	box.set_content_margin_all(padding)
	if border_width > 0:
		box.border_color = border
		box.set_border_width_all(border_width)
	box.anti_aliasing = true
	return box


static func theme() -> Theme:
	if _theme:
		return _theme
	var t := Theme.new()
	t.default_font = regular_font()
	t.default_font_size = 20
	t.set_color("font_color", "Label", TEXT)
	t.set_color("font_outline_color", "Label", Color(0, 0, 0, 0.6))
	t.set_stylebox("panel", "PanelContainer", stylebox(BACKGROUND, 12))
	t.set_stylebox("panel", "Panel", stylebox(BACKGROUND, 12))
	# Botões.
	t.set_font("font", "Button", bold_font())
	t.set_font_size("font_size", "Button", 22)
	t.set_color("font_color", "Button", TEXT)
	t.set_color("font_hover_color", "Button", Color.WHITE)
	t.set_color("font_pressed_color", "Button", Color.WHITE)
	t.set_color("font_focus_color", "Button", Color.WHITE)
	t.set_color("font_disabled_color", "Button", Color(0.55, 0.56, 0.6))
	t.set_stylebox("normal", "Button", stylebox(Color(0.16, 0.17, 0.21, 0.95), 10, Color(1, 1, 1, 0.08), 1, 12))
	t.set_stylebox("hover", "Button", stylebox(Color(0.24, 0.25, 0.3, 0.98), 10, ACCENT, 2, 12))
	t.set_stylebox("pressed", "Button", stylebox(ACCENT.darkened(0.2), 10, ACCENT, 2, 12))
	t.set_stylebox("focus", "Button", stylebox(Color(0, 0, 0, 0), 10, ACCENT, 3, 12))
	t.set_stylebox("disabled", "Button", stylebox(Color(0.12, 0.12, 0.14, 0.9), 10, Color(1, 1, 1, 0.04), 1, 12))
	for type_name: String in ["CheckBox", "OptionButton"]:
		t.set_font_size("font_size", type_name, 20)
		t.set_color("font_color", type_name, TEXT)
	t.set_stylebox("normal", "OptionButton", stylebox(Color(0.16, 0.17, 0.21, 0.95), 8, Color(1, 1, 1, 0.1), 1, 8))
	t.set_stylebox("hover", "OptionButton", stylebox(Color(0.22, 0.23, 0.28, 0.98), 8, ACCENT, 2, 8))
	t.set_stylebox("focus", "OptionButton", stylebox(Color(0, 0, 0, 0), 8, ACCENT, 2, 8))
	t.set_stylebox("pressed", "OptionButton", stylebox(Color(0.22, 0.23, 0.28, 0.98), 8, ACCENT, 2, 8))
	t.set_stylebox("panel", "PopupMenu", stylebox(Color(0.1, 0.11, 0.14, 0.98), 8, Color(1, 1, 1, 0.1), 1, 6))
	t.set_font_size("font_size", "PopupMenu", 20)
	# Barras e sliders.
	t.set_stylebox("background", "ProgressBar", stylebox(Color(1, 1, 1, 0.12), 6, Color(0, 0, 0, 0), 0, 0))
	t.set_stylebox("fill", "ProgressBar", stylebox(ACCENT, 6, Color(0, 0, 0, 0), 0, 0))
	t.set_stylebox("slider", "HSlider", stylebox(Color(1, 1, 1, 0.15), 4, Color(0, 0, 0, 0), 0, 3))
	t.set_stylebox("grabber_area", "HSlider", stylebox(ACCENT, 4, Color(0, 0, 0, 0), 0, 3))
	t.set_stylebox("grabber_area_highlight", "HSlider", stylebox(ACCENT.lightened(0.2), 4, Color(0, 0, 0, 0), 0, 3))
	t.set_stylebox("panel", "TooltipPanel", stylebox(Color(0.08, 0.09, 0.11, 0.95), 6))
	_theme = t
	return t


static func label(text: String, size: int = 20, color: Color = TEXT, bold: bool = false, align: HorizontalAlignment = HORIZONTAL_ALIGNMENT_LEFT) -> Label:
	var node := Label.new()
	node.text = text
	node.add_theme_font_size_override("font_size", size)
	node.add_theme_color_override("font_color", color)
	if bold:
		node.add_theme_font_override("font", bold_font())
	node.horizontal_alignment = align
	return node


static func button(text: String, size: int = 22) -> Button:
	var node := Button.new()
	node.text = text
	node.add_theme_font_size_override("font_size", size)
	node.focus_mode = Control.FOCUS_ALL
	return node


static func panel(color: Color = BACKGROUND, radius: int = 12, padding: int = 14) -> PanelContainer:
	var node := PanelContainer.new()
	node.add_theme_stylebox_override("panel", stylebox(color, radius, Color(1, 1, 1, 0.06), 1, padding))
	return node


## Etiqueta pequena colorida (nível de risco, modificadores, contrato...).
static func chip(text: String, color: Color, size: int = 14, text_color: Color = Color.WHITE) -> PanelContainer:
	var node := PanelContainer.new()
	var box := stylebox(color, 7, Color(0, 0, 0, 0), 0, 0)
	box.content_margin_left = 7
	box.content_margin_right = 7
	box.content_margin_top = 2
	box.content_margin_bottom = 2
	node.add_theme_stylebox_override("panel", box)
	node.add_child(label(text, size, text_color, true))
	node.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return node


## Linha que quebra sozinha (etiquetas lado a lado).
static func flow(separation: int = 6) -> HFlowContainer:
	var node := HFlowContainer.new()
	node.add_theme_constant_override("h_separation", separation)
	node.add_theme_constant_override("v_separation", separation)
	node.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return node


## Barra de progresso fina com a cor dada.
static func bar(value: float, color: Color, height: int = 8, width: int = 0) -> ProgressBar:
	var node := ProgressBar.new()
	node.max_value = 1.0
	node.value = value
	node.show_percentage = false
	node.custom_minimum_size = Vector2(width, height)
	node.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	node.add_theme_stylebox_override("fill", stylebox(color, 4, Color(0, 0, 0, 0), 0, 0))
	node.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return node


static func vbox(separation: int = 8) -> VBoxContainer:
	var node := VBoxContainer.new()
	node.add_theme_constant_override("separation", separation)
	return node


static func hbox(separation: int = 8) -> HBoxContainer:
	var node := HBoxContainer.new()
	node.add_theme_constant_override("separation", separation)
	return node


static func spacer() -> Control:
	var node := Control.new()
	node.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	node.size_flags_vertical = Control.SIZE_EXPAND_FILL
	return node


## Tela escura por trás de menus (bloqueia cliques no jogo).
static func overlay(alpha: float = 0.55) -> ColorRect:
	var node := ColorRect.new()
	node.color = Color(0, 0, 0, alpha)
	node.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	node.mouse_filter = Control.MOUSE_FILTER_STOP
	return node


static func money(amount: int) -> String:
	var digits := str(absi(amount))
	var sep := "." if Loc.language == "pt" else ","
	var grouped := ""
	while digits.length() > 3:
		grouped = sep + digits.substr(digits.length() - 3) + grouped
		digits = digits.substr(0, digits.length() - 3)
	grouped = digits + grouped
	return ("R$ " if Loc.language == "pt" else "$ ") + ("-" if amount < 0 else "") + grouped


static func clock(seconds: float) -> String:
	var total := int(ceilf(absf(seconds)))
	return "%s%d:%02d" % ["-" if seconds < 0.0 else "", total / 60, total % 60]


static func distance(meters: float) -> String:
	if Settings.get_value("game/units") == "mph":
		var miles := meters / 1609.34
		return "%.1f mi" % miles if miles >= 0.2 else "%d ft" % roundi(meters * 3.281)
	return "%.1f km" % (meters / 1000.0) if meters >= 1000.0 else "%d m" % roundi(meters)


static func stars(rating: float) -> String:
	var full := int(floorf(rating + 0.25))
	return "★".repeat(full) + "☆".repeat(maxi(5 - full, 0))
