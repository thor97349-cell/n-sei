class_name Hud
extends Control
## HUD da partida: dinheiro/avaliação/relógio, painel da entrega (estado, destino,
## distância, prazo, estado da carga), avisos, ação contextual, minimapa, velocímetro
## e o quadro de resultado ao terminar uma entrega.

const TOAST_SECONDS := 4.5
const TOAST_COLORS := {
	"success": Color(0.12, 0.42, 0.22, 0.92), "warning": Color(0.5, 0.33, 0.05, 0.92),
	"fine": Color(0.55, 0.1, 0.1, 0.92), "event": Color(0.3, 0.16, 0.5, 0.92), "info": Color(0.1, 0.12, 0.16, 0.9),
}

var session: GameSession
var minimap: MiniMap
var speedometer: Speedometer

var _money: Label
var _money_delta: Label
var _rating: Label
var _clock: Label
var _event: Label
var _status: Label
var _detail: Label
var _timer: Label
var _distance: Label
var _hint: Label
var _cargo_row: HBoxContainer
var _cargo_bar: ProgressBar
var _prompt_panel: PanelContainer
var _prompt: Label
var _prompt_bar: ProgressBar
var _result_panel: PanelContainer
var _result_box: VBoxContainer
var _toasts: VBoxContainer
var _blink := 0.0


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	theme = UiKit.theme()
	_build_top_left()
	_build_status()
	_build_prompt()
	_build_result()
	_build_toasts()
	minimap = MiniMap.new()
	minimap.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
	minimap.position = Vector2(24, -24 - 260)
	minimap.size = Vector2(260, 260)
	minimap.anchor_top = 1.0
	minimap.anchor_bottom = 1.0
	minimap.offset_top = -284
	minimap.offset_bottom = -24
	minimap.offset_left = 24
	minimap.offset_right = 284
	add_child(minimap)
	speedometer = Speedometer.new()
	speedometer.anchor_left = 1.0
	speedometer.anchor_right = 1.0
	speedometer.anchor_top = 1.0
	speedometer.anchor_bottom = 1.0
	speedometer.offset_left = -284
	speedometer.offset_right = -24
	speedometer.offset_top = -284
	speedometer.offset_bottom = -24
	add_child(speedometer)
	Bus.notify.connect(_on_toast)
	Bus.money_changed.connect(_on_money)
	_on_money(GameState.money, 0)


func bind(game_session: GameSession) -> void:
	session = game_session
	minimap.session = session
	speedometer.vehicle = session.vehicle
	session.vehicle_spawned.connect(func(v: Vehicle) -> void: speedometer.vehicle = v)
	session.delivery.finished.connect(_show_result)


# --- construção ------------------------------------------------------------------------

func _build_top_left() -> void:
	var box := UiKit.panel(UiKit.BACKGROUND, 12, 12)
	box.position = Vector2(24, 20)
	add_child(box)
	var column := UiKit.vbox(2)
	box.add_child(column)
	var row := UiKit.hbox(10)
	column.add_child(row)
	_money = UiKit.label("", 34, UiKit.SUCCESS, true)
	row.add_child(_money)
	_money_delta = UiKit.label("", 22, UiKit.SUCCESS, true)
	_money_delta.modulate.a = 0.0
	row.add_child(_money_delta)
	var info := UiKit.hbox(14)
	column.add_child(info)
	_rating = UiKit.label("", 18, UiKit.WARNING)
	info.add_child(_rating)
	_clock = UiKit.label("", 18, UiKit.MUTED)
	info.add_child(_clock)
	_event = UiKit.label("", 17, Color(0.85, 0.7, 1.0))
	_event.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_event.custom_minimum_size = Vector2(320, 0)
	column.add_child(_event)


func _build_status() -> void:
	var holder := CenterContainer.new()
	holder.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	holder.anchor_left = 0.5
	holder.anchor_right = 0.5
	holder.offset_left = -330
	holder.offset_right = 330
	holder.offset_top = 16
	holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(holder)
	var box := UiKit.panel(UiKit.BACKGROUND, 14, 14)
	box.custom_minimum_size = Vector2(560, 0)
	holder.add_child(box)
	var column := UiKit.vbox(4)
	box.add_child(column)
	_status = UiKit.label("", 26, UiKit.TEXT, true, HORIZONTAL_ALIGNMENT_CENTER)
	column.add_child(_status)
	_detail = UiKit.label("", 19, UiKit.MUTED, false, HORIZONTAL_ALIGNMENT_CENTER)
	column.add_child(_detail)
	var row := UiKit.hbox(24)
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	column.add_child(row)
	_timer = UiKit.label("", 34, UiKit.TEXT, true, HORIZONTAL_ALIGNMENT_CENTER)
	row.add_child(_timer)
	_distance = UiKit.label("", 22, UiKit.PICKUP, true, HORIZONTAL_ALIGNMENT_CENTER)
	row.add_child(_distance)
	_hint = UiKit.label("", 17, UiKit.WARNING, false, HORIZONTAL_ALIGNMENT_CENTER)
	column.add_child(_hint)
	_cargo_row = UiKit.hbox(8)
	column.add_child(_cargo_row)
	_cargo_row.add_child(UiKit.label(Loc.t("hud.cargo"), 16, UiKit.MUTED))
	_cargo_bar = ProgressBar.new()
	_cargo_bar.show_percentage = false
	_cargo_bar.custom_minimum_size = Vector2(0, 12)
	_cargo_bar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_cargo_bar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_cargo_row.add_child(_cargo_bar)


func _build_prompt() -> void:
	var holder := CenterContainer.new()
	holder.anchor_left = 0.5
	holder.anchor_right = 0.5
	holder.anchor_top = 1.0
	holder.anchor_bottom = 1.0
	holder.offset_left = -300
	holder.offset_right = 300
	holder.offset_top = -150
	holder.offset_bottom = -90
	holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(holder)
	_prompt_panel = UiKit.panel(UiKit.BACKGROUND, 10, 10)
	holder.add_child(_prompt_panel)
	var column := UiKit.vbox(6)
	_prompt_panel.add_child(column)
	_prompt = UiKit.label("", 22, UiKit.TEXT, true, HORIZONTAL_ALIGNMENT_CENTER)
	column.add_child(_prompt)
	_prompt_bar = ProgressBar.new()
	_prompt_bar.show_percentage = false
	_prompt_bar.custom_minimum_size = Vector2(360, 10)
	_prompt_bar.max_value = 1.0
	column.add_child(_prompt_bar)


func _build_result() -> void:
	var holder := CenterContainer.new()
	holder.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(holder)
	_result_panel = UiKit.panel(Color(0.05, 0.06, 0.08, 0.93), 16, 24)
	_result_panel.custom_minimum_size = Vector2(440, 0)
	_result_panel.visible = false
	holder.add_child(_result_panel)
	_result_box = UiKit.vbox(6)
	_result_panel.add_child(_result_box)


func _build_toasts() -> void:
	_toasts = UiKit.vbox(8)
	_toasts.anchor_left = 1.0
	_toasts.anchor_right = 1.0
	_toasts.offset_left = -440
	_toasts.offset_right = -24
	_toasts.offset_top = 20
	_toasts.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_toasts)


# --- atualização ------------------------------------------------------------------------

func _process(delta: float) -> void:
	if session == null or session.vehicle == null:
		return
	_blink += delta
	_rating.text = "%s %.1f" % [UiKit.stars(GameState.average_rating()), GameState.average_rating()]
	_clock.text = "🕒 " + session.world.atmosphere.clock_text()
	var events := session.events
	_event.visible = events.active_id != ""
	if _event.visible:
		_event.text = "%s (%ds)" % [events.label(), maxi(int(events.time_left), 0)] if events.active_id != "shortcut" else events.label()
	_update_status()
	_prompt_panel.visible = session.prompt != ""
	_prompt.text = session.prompt
	_prompt_bar.visible = session.prompt_progress >= 0.0
	_prompt_bar.value = session.prompt_progress


func _update_status() -> void:
	var delivery := session.delivery
	_timer.visible = false
	_distance.visible = false
	_hint.visible = false
	_cargo_row.visible = false
	_detail.visible = true
	_status.add_theme_color_override("font_color", UiKit.TEXT)
	match delivery.stage:
		DeliveryManager.Stage.IDLE:
			_status.text = Loc.t("hud.no_delivery")
			_detail.visible = false
		DeliveryManager.Stage.TO_PICKUP:
			var active := delivery.active
			_status.text = Loc.t("hud.go_pickup")
			_status.add_theme_color_override("font_color", UiKit.PICKUP)
			_detail.text = "%s %s  •  %s\n%s" % [active["icon"], OrderTypes.display_name(active["type"]), Loc.t("hud.pickup_at", [active["pickup_name"]]), Loc.t("hud.deliver_to", [active["dropoff_name"]])]
			_timer.visible = true
			_timer.text = "⏱ " + UiKit.clock(active["time_limit"])
			_timer.add_theme_color_override("font_color", UiKit.MUTED)
			_hint.visible = true
			_hint.text = Loc.t("hud.timer_starts")
			_show_distance()
		DeliveryManager.Stage.DELIVERING:
			var active := delivery.active
			var late := delivery.time_left < 0.0
			_status.text = Loc.t("hud.late") if late else Loc.t("hud.delivering")
			_status.add_theme_color_override("font_color", UiKit.DANGER if late else UiKit.ACCENT)
			_detail.text = "%s %s  •  %s" % [active["icon"], OrderTypes.display_name(active["type"]), Loc.t("hud.deliver_to", [active["dropoff_name"]])]
			_timer.visible = true
			var fraction := delivery.time_left / float(active["time_limit"])
			var color := UiKit.SUCCESS
			if late:
				color = UiKit.DANGER if int(_blink * 3.0) % 2 == 0 else UiKit.DANGER.darkened(0.4)
			elif fraction < 0.2:
				color = UiKit.DANGER
			elif fraction < 0.45:
				color = UiKit.WARNING
			_timer.text = "⏱ " + UiKit.clock(delivery.time_left)
			_timer.add_theme_color_override("font_color", color)
			_hint.visible = true
			if late:
				var grace := GameConfig.LATE_GRACE_SECONDS + delivery.time_left
				_hint.text = Loc.t("hud.late_bonus", [UiKit.clock(grace), "%d%%" % roundi(GameConfig.LATE_MULTIPLIER * 100.0)])
			elif fraction >= float(GameConfig.BONUS_TIERS[0]["min_fraction"]):
				_hint.text = Loc.t("hud.bonus_fast")
			elif fraction < 0.2:
				_hint.text = Loc.t("hud.hurry")
			else:
				_hint.visible = false
			_cargo_row.visible = true
			_cargo_bar.value = delivery.cargo_condition
			_show_distance()
		DeliveryManager.Stage.RESULT:
			var result := delivery.last_result
			if result.get("failed", false):
				_status.text = Loc.t("result.failed")
				_status.add_theme_color_override("font_color", UiKit.DANGER)
			else:
				_status.text = Loc.t("result.done_late") if result.get("late", false) else Loc.t("result.done")
				_status.add_theme_color_override("font_color", UiKit.SUCCESS)
			_detail.text = Loc.t("result.continue")


func _show_distance() -> void:
	if session.route_distance > 0.0:
		_distance.visible = true
		_distance.text = "📍 " + UiKit.distance(session.route_distance)


func _show_result(result: Dictionary) -> void:
	for child in _result_box.get_children():
		child.queue_free()
	var failed: bool = result.get("failed", false)
	var title := Loc.t("result.failed") if failed else (Loc.t("result.done_late") if result.get("late", false) else Loc.t("result.done"))
	_result_box.add_child(UiKit.label(title, 30, UiKit.DANGER if failed else UiKit.SUCCESS, true, HORIZONTAL_ALIGNMENT_CENTER))
	_result_box.add_child(UiKit.label("%s  %s" % [OrderTypes.get_type(result.get("type", "package"))["icon"], result.get("dropoff_name", "")], 20, UiKit.MUTED, false, HORIZONTAL_ALIGNMENT_CENTER))
	if failed:
		var text := UiKit.label(Loc.t("result.failed_text"), 19, UiKit.TEXT, false, HORIZONTAL_ALIGNMENT_CENTER)
		text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		text.custom_minimum_size = Vector2(400, 0)
		_result_box.add_child(text)
	else:
		_result_box.add_child(HSeparator.new())
		_line(Loc.t("result.base"), int(result["base"]), UiKit.TEXT)
		if int(result["bonus"]) > 0:
			_line(Loc.t("result.bonus"), int(result["bonus"]), UiKit.SUCCESS)
		if int(result["damage"]) > 0:
			_line(Loc.t("result.damage"), -int(result["damage"]), UiKit.DANGER)
		if int(result["tip"]) > 0:
			_line(Loc.t("result.tip"), int(result["tip"]), UiKit.WARNING)
		_result_box.add_child(HSeparator.new())
		_line(Loc.t("result.total"), int(result["total"]), UiKit.SUCCESS, 28)
		_result_box.add_child(UiKit.label("%s  %s" % [UiKit.stars(float(result["rating"])), Loc.t("result.condition", [roundi(float(result.get("condition", 100.0)))])], 20, UiKit.WARNING, false, HORIZONTAL_ALIGNMENT_CENTER))
	_result_panel.visible = true
	_result_panel.modulate.a = 1.0
	var tween := create_tween()
	tween.tween_interval(GameConfig.RESULT_SECONDS - 0.6)
	tween.tween_property(_result_panel, "modulate:a", 0.0, 0.6)
	tween.tween_callback(func() -> void: _result_panel.visible = false)


func _line(text: String, amount: int, color: Color, size: int = 21) -> void:
	var row := UiKit.hbox(12)
	row.add_child(UiKit.label(text, size, UiKit.TEXT))
	row.add_child(UiKit.spacer())
	row.add_child(UiKit.label(("+" if amount > 0 else "") + UiKit.money(amount), size, color, true))
	_result_box.add_child(row)


func _on_money(total: int, delta: int) -> void:
	_money.text = UiKit.money(total)
	if delta == 0:
		return
	_money_delta.text = ("+" if delta > 0 else "") + UiKit.money(delta)
	_money_delta.add_theme_color_override("font_color", UiKit.SUCCESS if delta > 0 else UiKit.DANGER)
	_money_delta.modulate.a = 1.0
	var tween := create_tween()
	tween.tween_interval(1.6)
	tween.tween_property(_money_delta, "modulate:a", 0.0, 0.8)


func _on_toast(text: String, style: String) -> void:
	var toast := UiKit.panel(TOAST_COLORS.get(style, TOAST_COLORS["info"]), 10, 12)
	var label := UiKit.label(text, 19, UiKit.TEXT, style != "info")
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.custom_minimum_size = Vector2(380, 0)
	toast.add_child(label)
	_toasts.add_child(toast)
	while _toasts.get_child_count() > 5:
		_toasts.get_child(0).queue_free()
		_toasts.remove_child(_toasts.get_child(0))
	var tween := toast.create_tween()
	tween.tween_interval(TOAST_SECONDS)
	tween.tween_property(toast, "modulate:a", 0.0, 0.5)
	tween.tween_callback(toast.queue_free)
