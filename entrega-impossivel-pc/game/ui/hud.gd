class_name Hud
extends Control
## HUD da partida: dinheiro/avaliação/relógio, nível e combo, contratos e desafios em
## andamento, painel da entrega (estado, destino, risco, modificadores, distância, prazo,
## estado da carga, pagamento estimado), avisos, ação contextual, minimapa, velocímetro,
## o resumo ao terminar uma entrega e faixas de comemoração (nível novo, contrato).

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
var _cargo_fill: StyleBoxFlat
var _cargo_percent: Label
var _cargo_kind: Label
var _cargo_pay: Label
var _cargo_popup: Label
var _cargo_color_level := -1
var _prompt_panel: PanelContainer
var _prompt: Label
var _prompt_bar: ProgressBar
var _result_panel: PanelContainer
var _result_box: VBoxContainer
var _toasts: VBoxContainer
var _flash: ColorRect
var _fine_panel: PanelContainer
var _fine_title: Label
var _fine_reason: Label
var _fine_amount: Label
var _fine_balance: Label
var _fine_tween: Tween
var _fine_penalty: Label
var _blink := 0.0
var _rank: Label
var _rank_bar: ProgressBar
var _combo: Label
var _tracker: PanelContainer
var _tracker_box: VBoxContainer
var _tracker_dirty := true
var _tags_holder: VBoxContainer
var _tags_key := ""
var _note: Label
var _banner_panel: PanelContainer
var _banner_title: Label
var _banner_text: Label
var _banners: Array[Array] = []
var _banner_busy := false


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	theme = UiKit.theme()
	_build_top_left()
	_build_status()
	_build_prompt()
	_build_result()
	_build_toasts()
	_build_fine()
	_build_banner()
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
	Bus.fine_issued.connect(_on_fine)
	_on_money(GameState.money, 0)


func bind(game_session: GameSession) -> void:
	session = game_session
	minimap.session = session
	speedometer.vehicle = session.vehicle
	session.vehicle_spawned.connect(func(v: Vehicle) -> void: speedometer.vehicle = v)
	session.delivery.finished.connect(_show_result)
	session.delivery.cargo_damaged.connect(_on_cargo_damaged)
	session.delivery.special_offered.connect(_on_special)
	GameState.career.changed.connect(func() -> void: _tracker_dirty = true)


# --- construção ------------------------------------------------------------------------

func _build_top_left() -> void:
	var left := UiKit.vbox(8)
	left.position = Vector2(24, 20)
	left.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(left)
	var box := UiKit.panel(UiKit.BACKGROUND, 12, 12)
	left.add_child(box)
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
	# Nível de reputação (com a barra até o próximo) e o combo atual.
	var career := UiKit.hbox(8)
	column.add_child(career)
	_rank = UiKit.label("", 17, Color(0.75, 0.85, 1.0), true)
	career.add_child(_rank)
	_rank_bar = UiKit.bar(0.0, Color(0.45, 0.65, 1.0), 6, 70)
	career.add_child(_rank_bar)
	_combo = UiKit.label("", 18, UiKit.ACCENT, true)
	career.add_child(_combo)
	_event = UiKit.label("", 17, Color(0.85, 0.7, 1.0))
	_event.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_event.custom_minimum_size = Vector2(320, 0)
	column.add_child(_event)
	# Contratos e desafios em andamento (só aparece se houver).
	_tracker = UiKit.panel(Color(0.06, 0.07, 0.09, 0.72), 10, 10)
	_tracker.custom_minimum_size = Vector2(330, 0)
	left.add_child(_tracker)
	_tracker_box = UiKit.vbox(3)
	_tracker.add_child(_tracker_box)


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
	# Nível de risco, modificadores e contrato do pedido em andamento.
	_tags_holder = UiKit.vbox(0)
	_tags_holder.alignment = BoxContainer.ALIGNMENT_CENTER
	column.add_child(_tags_holder)
	_note = UiKit.label("", 16, Color(0.95, 0.85, 0.65), false, HORIZONTAL_ALIGNMENT_CENTER)
	_note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_note.custom_minimum_size = Vector2(520, 0)
	column.add_child(_note)
	var row := UiKit.hbox(24)
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	column.add_child(row)
	_timer = UiKit.label("", 34, UiKit.TEXT, true, HORIZONTAL_ALIGNMENT_CENTER)
	row.add_child(_timer)
	_distance = UiKit.label("", 22, UiKit.PICKUP, true, HORIZONTAL_ALIGNMENT_CENTER)
	row.add_child(_distance)
	_hint = UiKit.label("", 17, UiKit.WARNING, false, HORIZONTAL_ALIGNMENT_CENTER)
	column.add_child(_hint)
	# Estado da carga: tipo (resistência), barra colorida, % e quanto a entrega paga agora.
	_cargo_row = UiKit.hbox(8)
	column.add_child(_cargo_row)
	_cargo_row.add_child(UiKit.label(Loc.t("hud.cargo"), 16, UiKit.MUTED))
	_cargo_bar = ProgressBar.new()
	_cargo_bar.show_percentage = false
	_cargo_bar.custom_minimum_size = Vector2(0, 12)
	_cargo_bar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_cargo_bar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_cargo_fill = UiKit.stylebox(UiKit.SUCCESS, 6, Color(0, 0, 0, 0), 0, 0)
	_cargo_bar.add_theme_stylebox_override("fill", _cargo_fill)
	_cargo_row.add_child(_cargo_bar)
	_cargo_percent = UiKit.label("", 17, UiKit.SUCCESS, true)
	_cargo_percent.custom_minimum_size = Vector2(52, 0)
	_cargo_percent.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_cargo_row.add_child(_cargo_percent)
	_cargo_kind = UiKit.label("", 15, UiKit.MUTED)
	_cargo_row.add_child(_cargo_kind)
	_cargo_pay = UiKit.label("", 16, UiKit.MUTED, false, HORIZONTAL_ALIGNMENT_CENTER)
	column.add_child(_cargo_pay)
	# "-7%" que aparece e sobe a cada batida que estraga a carga.
	_cargo_popup = UiKit.label("", 24, UiKit.DANGER, true)
	_cargo_popup.modulate.a = 0.0
	_cargo_popup.top_level = true
	_cargo_popup.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_cargo_popup)


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


## Aviso de multa: flash de "câmera" na tela toda e um quadro no meio com o valor.
func _build_fine() -> void:
	_flash = ColorRect.new()
	_flash.color = Color(1, 1, 1, 0)
	_flash.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_flash.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_flash)
	var holder := CenterContainer.new()
	holder.anchor_left = 0.5
	holder.anchor_right = 0.5
	holder.offset_left = -260
	holder.offset_right = 260
	holder.offset_top = 250
	holder.offset_bottom = 420
	holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(holder)
	_fine_panel = UiKit.panel(Color(0.5, 0.07, 0.06, 0.95), 14, 28)
	_fine_panel.visible = false
	holder.add_child(_fine_panel)
	var column := UiKit.vbox(2)
	_fine_panel.add_child(column)
	_fine_title = UiKit.label("", 30, Color.WHITE, true, HORIZONTAL_ALIGNMENT_CENTER)
	column.add_child(_fine_title)
	_fine_reason = UiKit.label("", 19, Color(1.0, 0.86, 0.82), false, HORIZONTAL_ALIGNMENT_CENTER)
	column.add_child(_fine_reason)
	_fine_amount = UiKit.label("", 42, Color(1.0, 0.82, 0.3), true, HORIZONTAL_ALIGNMENT_CENTER)
	column.add_child(_fine_amount)
	_fine_balance = UiKit.label("", 17, Color(1, 1, 1, 0.78), false, HORIZONTAL_ALIGNMENT_CENTER)
	column.add_child(_fine_balance)
	_fine_penalty = UiKit.label("", 16, Color(1.0, 0.8, 0.6), false, HORIZONTAL_ALIGNMENT_CENTER)
	column.add_child(_fine_penalty)


## Faixa de comemoração (nível novo, contrato concluído, entrega especial).
func _build_banner() -> void:
	var holder := CenterContainer.new()
	holder.anchor_left = 0.5
	holder.anchor_right = 0.5
	holder.offset_left = -330
	holder.offset_right = 330
	holder.offset_top = 205
	holder.offset_bottom = 360
	holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(holder)
	_banner_panel = UiKit.panel(Color(0.45, 0.3, 0.05, 0.95), 14, 22)
	_banner_panel.visible = false
	holder.add_child(_banner_panel)
	var column := UiKit.vbox(4)
	_banner_panel.add_child(column)
	_banner_title = UiKit.label("", 30, Color(1.0, 0.92, 0.6), true, HORIZONTAL_ALIGNMENT_CENTER)
	column.add_child(_banner_title)
	_banner_text = UiKit.label("", 18, Color.WHITE, false, HORIZONTAL_ALIGNMENT_CENTER)
	_banner_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_banner_text.custom_minimum_size = Vector2(560, 0)
	column.add_child(_banner_text)


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
	_update_career()
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
	_cargo_pay.visible = false
	_detail.visible = true
	_note.visible = false
	_detail.add_theme_color_override("font_color", UiKit.MUTED)
	_status.add_theme_color_override("font_color", UiKit.TEXT)
	if delivery.stage == DeliveryManager.Stage.TO_PICKUP or delivery.stage == DeliveryManager.Stage.DELIVERING:
		_show_tags(delivery)
	else:
		_set_tags(null, "")
	match delivery.stage:
		DeliveryManager.Stage.IDLE:
			_status.text = Loc.t("hud.no_delivery")
			_detail.visible = false
			# Entrega especial esperando no celular: avisa com o tempo que falta.
			for offer in delivery.offers:
				if offer.get("special", "") != "":
					_detail.visible = true
					_detail.text = Loc.t("hud.special_waiting", [JobRules.special(offer["special"])["icon"], JobRules.special_title(offer["special"]), UiKit.clock(maxf(float(offer["expires"]), 0.0))])
					_detail.add_theme_color_override("font_color", Color(1.0, 0.6, 0.75) if int(_blink * 2.0) % 2 == 0 else Color(1.0, 0.85, 0.9))
					break
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
			_cargo_pay.visible = true
			_cargo_pay.text = Loc.t("hud.reward", [UiKit.money(int(active["reward"]))])
			_cargo_pay.add_theme_color_override("font_color", UiKit.MUTED)
			var note := delivery.mission.hud_note() if delivery.mission else ""
			_note.visible = note != ""
			_note.text = "“%s”" % note
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
			_show_cargo(delivery)
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


func _show_cargo(delivery: DeliveryManager) -> void:
	var active := delivery.active
	var condition := delivery.cargo_condition
	_cargo_row.visible = true
	_cargo_bar.value = condition
	var level := 0 if condition > 70.0 else (1 if condition > 40.0 else 2)
	var color: Color = [UiKit.SUCCESS, UiKit.WARNING, UiKit.DANGER][level]
	if level != _cargo_color_level:
		_cargo_color_level = level
		_cargo_fill.bg_color = color
		_cargo_percent.add_theme_color_override("font_color", color)
	_cargo_percent.text = "%d%%" % roundi(condition)
	var fragility := OrderTypes.fragility_level_of(float(active["fragility"]))
	_cargo_kind.text = Loc.t("fragility.short.%d" % fragility)
	_cargo_kind.add_theme_color_override("font_color", OrderTypes.fragility_color(fragility))
	# Quanto a entrega pagaria se fosse feita agora (a mesma conta do pagamento: bônus,
	# modificadores, adicionais e combo).
	var now := delivery.preview_payout()
	var damage := 0
	for line: Dictionary in now.get("lines", []):
		if line["key"] == "result.damage":
			damage = -int(line["amount"])
	_cargo_pay.visible = true
	_cargo_pay.text = Loc.t("hud.pay_now", [UiKit.money(int(now.get("payout", 0)))])
	if damage > 0:
		_cargo_pay.text += "  " + Loc.t("hud.pay_loss", [UiKit.money(damage)])
	_cargo_pay.add_theme_color_override("font_color", UiKit.MUTED if damage == 0 else UiKit.DANGER.lightened(0.25))


func _on_cargo_damaged(loss: float, _condition: float) -> void:
	_cargo_popup.text = "-%d%%" % maxi(roundi(loss), 1)
	var start := _cargo_percent.get_global_rect().position + Vector2(-8.0, -6.0)
	_cargo_popup.position = start
	_cargo_popup.modulate.a = 1.0
	var tween := _cargo_popup.create_tween().set_parallel(true)
	tween.tween_property(_cargo_popup, "position:y", start.y - 34.0, 1.1).set_ease(Tween.EASE_OUT)
	tween.tween_property(_cargo_popup, "modulate:a", 0.0, 1.1).set_delay(0.35)
	# A barra pisca em vermelho.
	_cargo_bar.modulate = Color(1.8, 0.6, 0.6)
	_cargo_bar.create_tween().tween_property(_cargo_bar, "modulate", Color.WHITE, 0.5)


func _show_distance() -> void:
	if session.route_distance > 0.0:
		_distance.visible = true
		_distance.text = "📍 " + UiKit.distance(session.route_distance)


func _show_result(result: Dictionary) -> void:
	for child in _result_box.get_children():
		child.queue_free()
	var failed: bool = result.get("failed", false)
	var report: Dictionary = result.get("report", {})
	var title := Loc.t("result.failed") if failed else (Loc.t("result.done_late") if result.get("late", false) else Loc.t("result.done"))
	_result_box.add_child(UiKit.label(title, 30, UiKit.DANGER if failed else UiKit.SUCCESS, true, HORIZONTAL_ALIGNMENT_CENTER))
	_result_box.add_child(UiKit.label("%s  %s" % [OrderTypes.get_type(result.get("type", "package"))["icon"], result.get("dropoff_name", "")], 20, UiKit.MUTED, false, HORIZONTAL_ALIGNMENT_CENTER))
	var extra := 0
	if failed:
		var text := UiKit.label(Loc.t("result.failed_text"), 19, UiKit.TEXT, false, HORIZONTAL_ALIGNMENT_CENTER)
		text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		text.custom_minimum_size = Vector2(420, 0)
		_result_box.add_child(text)
	else:
		_result_box.add_child(HSeparator.new())
		for line: Dictionary in result.get("lines", []):
			_payout_line(line)
		_result_box.add_child(HSeparator.new())
		_line(Loc.t("result.total"), int(result.get("net", result.get("total", 0))), UiKit.SUCCESS, 28)
		var condition := roundi(float(result.get("condition", 100.0)))
		_result_box.add_child(UiKit.label("%s  %s" % [UiKit.stars(float(result.get("rating", 5.0))), Loc.t("result.condition", [condition])], 19, UiKit.WARNING, false, HORIZONTAL_ALIGNMENT_CENTER))
		extra = (result.get("lines", []) as Array).size()
	# Carreira: combo, reputação, contratos e desafios (só o que aconteceu).
	var career := UiKit.vbox(3)
	var combo_before := int(report.get("combo_before", 0))
	var combo := int(report.get("combo", 0))
	if combo >= 2 and combo > combo_before:
		career.add_child(UiKit.label(Loc.t("result.combo_up", [combo, roundi(CareerRules.combo_bonus(combo + 1) * 100.0)]), 22, UiKit.ACCENT, true, HORIZONTAL_ALIGNMENT_CENTER))
	elif combo_before >= 2 and combo == 0:
		career.add_child(UiKit.label(Loc.t("result.combo_lost", [combo_before]), 20, UiKit.DANGER, true, HORIZONTAL_ALIGNMENT_CENTER))
	elif combo_before >= 2 and combo < combo_before:
		career.add_child(UiKit.label(Loc.t("result.combo_cut", [combo_before, combo]), 20, UiKit.WARNING, true, HORIZONTAL_ALIGNMENT_CENTER))
	var rep := int(report.get("rep", 0))
	if rep != 0:
		var rep_text := Loc.t("result.rep", ["%+d" % rep, CareerRules.rank_name(GameState.career.rank())])
		career.add_child(UiKit.label(rep_text, 17, Color(0.75, 0.85, 1.0) if rep > 0 else UiKit.DANGER.lightened(0.2), false, HORIZONTAL_ALIGNMENT_CENTER))
	for entry: Dictionary in report.get("contracts", []):
		var name := Clients.display_name(entry["client"])
		if entry["completed"]:
			career.add_child(UiKit.label(Loc.t("result.contract_done", [name, UiKit.money(int(entry["reward"]))]), 20, UiKit.SUCCESS, true, HORIZONTAL_ALIGNMENT_CENTER))
			_queue_banner(Loc.t("banner.contract"), Loc.t("banner.contract_text", [name, UiKit.money(int(entry["reward"]))]), Color(0.1, 0.4, 0.22, 0.95))
		else:
			var key := "result.contract" if entry["counted"] else "result.contract_miss"
			career.add_child(UiKit.label(Loc.t(key, [name, entry["progress"], entry["target"]]), 18, Color(0.6, 0.78, 1.0) if entry["counted"] else UiKit.MUTED, false, HORIZONTAL_ALIGNMENT_CENTER))
	for entry: Dictionary in report.get("challenges", []):
		career.add_child(UiKit.label(Loc.t("result.challenge", [entry["text"], UiKit.money(int(entry["reward"]))]), 18, UiKit.WARNING, true, HORIZONTAL_ALIGNMENT_CENTER))
	for text: String in report.get("new_challenges", []):
		career.add_child(UiKit.label(Loc.t("result.new_challenge", [text]), 16, Color(1.0, 0.86, 0.55), false, HORIZONTAL_ALIGNMENT_CENTER))
	if report.get("rank_up", false):
		var rank := int(report["rank"])
		_queue_banner(Loc.t("banner.rank", [CareerRules.rank_name(rank).to_upper()]), CareerRules.rank_unlocks(rank), Color(0.45, 0.3, 0.05, 0.95))
	for child in career.get_children():
		(child as Label).autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		(child as Label).custom_minimum_size = Vector2(420, 0)
	if career.get_child_count() > 0:
		_result_box.add_child(HSeparator.new())
		_result_box.add_child(career)
		extra += career.get_child_count()
	_result_panel.visible = true
	_result_panel.modulate.a = 1.0
	var seconds := clampf(GameConfig.RESULT_SECONDS + extra * 0.35, GameConfig.RESULT_SECONDS, 9.0)
	var tween := create_tween()
	tween.tween_interval(seconds - 0.6)
	tween.tween_property(_result_panel, "modulate:a", 0.0, 0.6)
	tween.tween_callback(func() -> void:
		_result_panel.visible = false
		_next_banner())


## Uma linha do pagamento (Payout): entrega, bônus, modificadores, adicionais, combo, multas.
func _payout_line(line: Dictionary) -> void:
	var amount := int(line["amount"])
	match line["key"]:
		"modifier":
			var id: String = line["modifier"]
			var data := JobRules.modifier(id)
			var text := "%s %s" % [data["icon"], JobRules.modifier_name(id)]
			if line.get("missed", false):
				_line(text + " — " + Loc.t("result.missed"), 0, UiKit.MUTED, 19)
			else:
				_line(text, amount, UiKit.SUCCESS)
		"result.combo":
			_line(Loc.t("result.combo", [line["arg"], roundi(float(line["rate"]) * 100.0)]), amount, UiKit.ACCENT)
		"result.fines":
			_line(Loc.t("result.fines", [line["arg"]]), amount, UiKit.DANGER)
		"result.damage":
			_line(Loc.t("result.damage", [line["arg"]]), amount, UiKit.DANGER)
		"result.tip":
			_line(Loc.t("result.tip"), amount, UiKit.WARNING)
		"result.base":
			_line(Loc.t("result.base"), amount, UiKit.TEXT)
		_:
			_line(Loc.t(line["key"]), amount, UiKit.SUCCESS)


func _line(text: String, amount: int, color: Color, size: int = 21) -> void:
	var row := UiKit.hbox(12)
	row.add_child(UiKit.label(text, size, UiKit.TEXT))
	row.add_child(UiKit.spacer())
	row.add_child(UiKit.label(("+" if amount > 0 else "") + UiKit.money(amount), size, color, true))
	_result_box.add_child(row)


# --- carreira ---------------------------------------------------------------------------

func _update_career() -> void:
	var career := GameState.career
	_rank.text = "🏅 " + CareerRules.rank_name(career.rank())
	_rank_bar.value = career.rank_progress()
	_combo.visible = career.combo >= 1
	if _combo.visible:
		var bonus := roundi(CareerRules.combo_bonus(career.combo + 1) * 100.0)
		_combo.text = "🔥 %d" % career.combo + ("  " + Loc.t("hud.combo_next", [bonus]) if bonus > 0 else "")
	if _tracker_dirty:
		_tracker_dirty = false
		_rebuild_tracker()


## Contratos e desafios ativos, um por linha (com o progresso).
func _rebuild_tracker() -> void:
	for child in _tracker_box.get_children():
		child.queue_free()
	var career := GameState.career
	for contract in career.contracts:
		var row := UiKit.label(Loc.t("hud.contract_line", [Clients.get_client(contract["client"]).get("icon", "📋"), Clients.display_name(contract["client"]), contract["progress"], contract["target"]]), 15, Color(0.7, 0.82, 1.0))
		_tracker_box.add_child(row)
	for challenge in career.challenges:
		var text := "🎯 %s" % Challenges.text(challenge)
		if int(challenge["target"]) > 1:
			text += "  %d/%d" % [int(challenge["progress"]), int(challenge["target"])]
		var row := UiKit.label(text, 15, Color(1.0, 0.86, 0.55))
		row.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		row.custom_minimum_size = Vector2(320, 0)
		_tracker_box.add_child(row)
	_tracker.visible = _tracker_box.get_child_count() > 0


func _show_tags(delivery: DeliveryManager) -> void:
	var lost := JobTags.lost_modifiers(delivery.active, delivery.run, delivery.time_left if delivery.stage == DeliveryManager.Stage.DELIVERING else 1.0, delivery.cargo_condition)
	var key := "%s|%s|%s" % [delivery.active.get("pickup_id", ""), delivery.active.get("dropoff_id", ""), str(lost)]
	if key != _tags_key:
		_set_tags(JobTags.build(delivery.active, 15, lost), key)


func _set_tags(row: Control, key: String) -> void:
	if key == _tags_key and row == null:
		return
	_tags_key = key
	for child in _tags_holder.get_children():
		child.queue_free()
	if row:
		(row as HFlowContainer).alignment = FlowContainer.ALIGNMENT_CENTER
		row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		_tags_holder.add_child(row)


func _on_special(offer: Dictionary) -> void:
	var special := JobRules.special(offer.get("special", ""))
	Sfx.play("event")
	Bus.toast(Loc.t("toast.special", [special.get("icon", "🚨"), JobRules.special_title(offer.get("special", "")), UiKit.money(int(offer["reward"]))]), "event")


func _queue_banner(title: String, text: String, color: Color) -> void:
	_banners.append([title, text, color])
	if not _result_panel.visible:
		_next_banner()


func _next_banner() -> void:
	if _banner_busy or _banners.is_empty():
		return
	_banner_busy = true
	var entry: Array = _banners.pop_front()
	_banner_title.text = entry[0]
	_banner_text.text = entry[1]
	_banner_text.visible = entry[1] != ""
	_banner_panel.add_theme_stylebox_override("panel", UiKit.stylebox(entry[2], 14, Color(1, 0.9, 0.5, 0.5), 2, 22))
	_banner_panel.visible = true
	_banner_panel.modulate.a = 0.0
	_banner_panel.pivot_offset = _banner_panel.size / 2.0
	_banner_panel.scale = Vector2(0.9, 0.9)
	Sfx.play("success", -3.0)
	var tween := create_tween()
	tween.tween_property(_banner_panel, "modulate:a", 1.0, 0.2)
	tween.parallel().tween_property(_banner_panel, "scale", Vector2.ONE, 0.25).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tween.tween_interval(3.6)
	tween.tween_property(_banner_panel, "modulate:a", 0.0, 0.5)
	tween.tween_callback(func() -> void:
		_banner_panel.visible = false
		_banner_busy = false
		_next_banner())


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


func _on_fine(reason: String, amount: int) -> void:
	_fine_title.text = Loc.t("fine.title")
	_fine_reason.text = Loc.t("fine." + reason)
	if amount > 0:
		_fine_amount.text = "-" + UiKit.money(amount)
		_fine_balance.text = Loc.t("fine.balance", [UiKit.money(GameState.money)])
	else:
		_fine_amount.text = UiKit.money(0)
		_fine_balance.text = Loc.t("fine.no_money")
	var penalty := GameState.career.last_penalty
	_fine_penalty.visible = not penalty.is_empty()
	if not penalty.is_empty():
		var parts: Array[String] = [Loc.t("fine.rep", [int(penalty["rep"])])]
		if int(penalty["combo_before"]) > int(penalty["combo"]):
			parts.append(Loc.t("fine.combo", [penalty["combo_before"], penalty["combo"]]))
		_fine_penalty.text = "  •  ".join(parts)
	_flash.color.a = 0.55
	var flash := create_tween()
	flash.tween_property(_flash, "color:a", 0.0, 0.4).set_ease(Tween.EASE_OUT)
	if _fine_tween and _fine_tween.is_valid():
		_fine_tween.kill()
	_fine_panel.visible = true
	_fine_panel.modulate.a = 0.0
	_fine_tween = create_tween()
	_fine_tween.tween_property(_fine_panel, "modulate:a", 1.0, 0.12)
	_fine_tween.tween_interval(3.4)
	_fine_tween.tween_property(_fine_panel, "modulate:a", 0.0, 0.5)
	_fine_tween.tween_callback(func() -> void: _fine_panel.visible = false)
