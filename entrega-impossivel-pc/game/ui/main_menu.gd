class_name MainMenu
extends Control
## Menu principal sobre a cidade (a câmera passeia ao fundo).

signal continue_requested
signal new_game_requested
signal settings_requested
signal quit_requested

var _buttons: VBoxContainer
var _credits: PanelContainer


func _ready() -> void:
	theme = UiKit.theme()
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var shade := ColorRect.new()
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	shade.color = Color(0, 0, 0, 0.25)
	shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(shade)
	var left := MarginContainer.new()
	left.set_anchors_and_offsets_preset(Control.PRESET_LEFT_WIDE)
	left.offset_right = 620
	left.add_theme_constant_override("margin_left", 80)
	left.add_theme_constant_override("margin_top", 110)
	add_child(left)
	var column := UiKit.vbox(14)
	left.add_child(column)
	var title := UiKit.label("ENTREGA\nIMPOSSÍVEL", 78, Color.WHITE, true)
	title.add_theme_constant_override("outline_size", 14)
	title.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.55))
	title.add_theme_constant_override("line_spacing", -18)
	column.add_child(title)
	var tagline := UiKit.label(Loc.t("menu.tagline"), 24, UiKit.ACCENT, true)
	tagline.add_theme_constant_override("outline_size", 8)
	tagline.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.6))
	column.add_child(tagline)
	column.add_child(UiKit.spacer())
	_buttons = UiKit.vbox(12)
	_buttons.custom_minimum_size = Vector2(360, 0)
	column.add_child(_buttons)
	if GameState.has_save():
		_add_button("menu.continue", func() -> void: continue_requested.emit())
	_add_button("menu.new_game", _on_new_game)
	_add_button("menu.settings", func() -> void: settings_requested.emit())
	_add_button("menu.credits", _toggle_credits)
	if OS.get_name() != "Web":
		_add_button("menu.quit", func() -> void: quit_requested.emit())
	var version := UiKit.label("v%s" % ProjectSettings.get_setting("application/config/version", "0.1.0"), 15, Color(1, 1, 1, 0.6))
	version.anchor_top = 1.0
	version.anchor_bottom = 1.0
	version.offset_left = 20
	version.offset_top = -34
	add_child(version)
	_credits = UiKit.panel(Color(0.05, 0.06, 0.08, 0.92), 14, 20)
	_credits.anchor_left = 1.0
	_credits.anchor_right = 1.0
	_credits.anchor_top = 1.0
	_credits.anchor_bottom = 1.0
	_credits.offset_left = -560
	_credits.offset_right = -40
	_credits.offset_top = -220
	_credits.offset_bottom = -40
	var credits_text := UiKit.label(Loc.t("menu.credits_text"), 18, UiKit.TEXT)
	credits_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_credits.add_child(credits_text)
	_credits.visible = false
	add_child(_credits)
	(_buttons.get_child(0) as Button).grab_focus.call_deferred()


func _add_button(key: String, callback: Callable) -> void:
	var button := UiKit.button(Loc.t(key), 26)
	button.custom_minimum_size = Vector2(360, 58)
	button.pressed.connect(func() -> void:
		Sfx.play("click")
		callback.call())
	_buttons.add_child(button)


func _toggle_credits() -> void:
	_credits.visible = not _credits.visible


func _on_new_game() -> void:
	if not GameState.has_save():
		new_game_requested.emit()
		return
	var dialog := ConfirmationDialog.new()
	dialog.dialog_text = Loc.t("menu.new_game_confirm")
	dialog.ok_button_text = Loc.t("menu.yes")
	dialog.cancel_button_text = Loc.t("menu.no")
	dialog.theme = UiKit.theme()
	dialog.confirmed.connect(func() -> void: new_game_requested.emit())
	add_child(dialog)
	dialog.popup_centered(Vector2i(560, 180))
