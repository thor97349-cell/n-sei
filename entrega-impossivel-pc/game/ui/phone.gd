class_name Phone
extends Control
## Celular com o app "EntregaJá". Duas abas (Q troca):
##   📦 Pedidos: entregas especiais (com tempo para aceitar), pedidos dos contratos e os
##      outros por nível de risco. Aceitar com clique ou 1–5; atualizar a lista.
##      Com uma entrega em andamento, mostra a entrega atual (e cancelar).
##   🏅 Carreira: nível de reputação (e o que o próximo libera), contratos em andamento e
##      para assinar, desafios e recordes.
## No topo, sempre: saldo, avaliação, nível e combo.

const DARK := Color(0.12, 0.13, 0.16)
const GREY := Color(0.28, 0.3, 0.34)
const LIGHT_GREY := Color(0.45, 0.47, 0.5)
const MONEY := Color(0.1, 0.55, 0.25)

var session: GameSession
var _list: VBoxContainer
var _balance: Label
var _rank: Label
var _rank_bar: ProgressBar
var _rep: Label
var _combo: Label
var _refresh: Button
var _tab_orders: Button
var _tab_career: Button
var _hint: Label
var _tab := 0
var _dirty := true
## Etiquetas de contagem regressiva das entregas especiais: [Label, pedido].
var _countdowns: Array[Array] = []


func _ready() -> void:
	theme = UiKit.theme()
	anchor_left = 1.0
	anchor_right = 1.0
	anchor_top = 0.5
	anchor_bottom = 0.5
	offset_left = -480
	offset_right = -24
	offset_top = -390
	offset_bottom = 390
	var frame := UiKit.panel(Color(0.03, 0.03, 0.04, 0.97), 34, 12)
	frame.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(frame)
	var screen := UiKit.panel(Color(0.93, 0.94, 0.96, 1.0), 24, 14)
	frame.add_child(screen)
	var column := UiKit.vbox(8)
	screen.add_child(column)
	var header := UiKit.hbox(8)
	column.add_child(header)
	header.add_child(UiKit.label("📦 " + Loc.t("phone.app_name"), 26, UiKit.ACCENT, true))
	header.add_child(UiKit.spacer())
	_balance = UiKit.label("", 18, Color(0.15, 0.16, 0.2), true, HORIZONTAL_ALIGNMENT_RIGHT)
	header.add_child(_balance)
	# Nível, reputação e combo.
	var strip := UiKit.hbox(8)
	column.add_child(strip)
	_rank = UiKit.label("", 17, Color(0.18, 0.32, 0.62), true)
	strip.add_child(_rank)
	_rank_bar = UiKit.bar(0.0, Color(0.3, 0.5, 0.9), 8, 80)
	_rank_bar.add_theme_stylebox_override("background", UiKit.stylebox(Color(0, 0, 0, 0.12), 4, Color(0, 0, 0, 0), 0, 0))
	strip.add_child(_rank_bar)
	_rep = UiKit.label("", 14, LIGHT_GREY)
	strip.add_child(_rep)
	strip.add_child(UiKit.spacer())
	_combo = UiKit.label("", 17, Color(0.9, 0.42, 0.05), true)
	strip.add_child(_combo)
	# Abas.
	var tabs := UiKit.hbox(6)
	column.add_child(tabs)
	_tab_orders = UiKit.button("📦 " + Loc.t("phone.tab_orders"), 16)
	_tab_orders.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_tab_orders.pressed.connect(_set_tab.bind(0))
	tabs.add_child(_tab_orders)
	_tab_career = UiKit.button("🏅 " + Loc.t("phone.tab_career"), 16)
	_tab_career.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_tab_career.pressed.connect(_set_tab.bind(1))
	tabs.add_child(_tab_career)
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	column.add_child(scroll)
	_list = UiKit.vbox(10)
	_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(_list)
	_refresh = UiKit.button(Loc.t("phone.refresh"), 18)
	_refresh.pressed.connect(func() -> void:
		if session.delivery.refresh_offers():
			_dirty = true)
	column.add_child(_refresh)
	_hint = UiKit.label("", 14, LIGHT_GREY, false, HORIZONTAL_ALIGNMENT_CENTER)
	column.add_child(_hint)


func bind(game_session: GameSession) -> void:
	session = game_session
	session.delivery.offers_changed.connect(func() -> void: _dirty = true)
	session.delivery.stage_changed.connect(func() -> void: _dirty = true)
	Bus.money_changed.connect(func(_t: int, _d: int) -> void: _dirty = true)
	Bus.vehicle_changed.connect(func() -> void: _dirty = true)
	GameState.career.changed.connect(func() -> void: _dirty = true)


func _process(_delta: float) -> void:
	if session == null or not visible:
		return
	var cooldown := session.delivery.refresh_cooldown
	_refresh.visible = _tab == 0
	_refresh.disabled = cooldown > 0.0 or session.delivery.stage != DeliveryManager.Stage.IDLE
	_refresh.text = Loc.t("phone.refresh_wait", [ceili(cooldown)]) if cooldown > 0.0 else Loc.t("phone.refresh")
	if _dirty:
		_dirty = false
		_rebuild()
	for entry in _countdowns:
		var label: Label = entry[0]
		if is_instance_valid(label):
			label.text = Loc.t("phone.expires", [UiKit.clock(maxf(float((entry[1] as Dictionary).get("expires", 0.0)), 0.0))])


func _unhandled_input(event: InputEvent) -> void:
	if not visible or session == null:
		return
	if event.is_action_pressed("phone_tab"):
		get_viewport().set_input_as_handled()
		_set_tab(1 - _tab)
		return
	if _tab != 0:
		return
	for i in 5:
		if event.is_action_pressed("accept_%d" % (i + 1)):
			get_viewport().set_input_as_handled()
			if session.delivery.accept(i):
				_dirty = true


func _set_tab(tab: int) -> void:
	if tab != _tab:
		Sfx.play("click")
	_tab = tab
	_dirty = true


func _rebuild() -> void:
	var career := GameState.career
	_balance.text = "%s\n%s %.1f" % [UiKit.money(GameState.money), "★", GameState.average_rating()]
	_rank.text = "🏅 " + CareerRules.rank_name(career.rank())
	_rank_bar.value = career.rank_progress()
	var next := CareerRules.next_rank_rep(career.rank())
	_rep.text = "%d/%d" % [career.reputation, next] if next > 0 else "%d" % career.reputation
	_combo.visible = career.combo >= 1
	_combo.text = "🔥 " + Loc.t("phone.combo", [career.combo])
	_tab_orders.add_theme_stylebox_override("normal", UiKit.stylebox(UiKit.ACCENT if _tab == 0 else Color(0.2, 0.21, 0.25), 10, Color(0, 0, 0, 0), 0, 8))
	_tab_career.add_theme_stylebox_override("normal", UiKit.stylebox(UiKit.ACCENT if _tab == 1 else Color(0.2, 0.21, 0.25), 10, Color(0, 0, 0, 0), 0, 8))
	_tab_career.text = "🏅 " + Loc.t("phone.tab_career") + (" (%d)" % career.contracts.size() if not career.contracts.is_empty() else "")
	_hint.text = Loc.t("phone.hint") if _tab == 0 else Loc.t("phone.hint_career")
	_countdowns.clear()
	for child in _list.get_children():
		child.queue_free()
	if _tab == 0:
		_build_orders()
	else:
		_build_career()


# --- aba de pedidos ------------------------------------------------------------------

func _build_orders() -> void:
	var delivery := session.delivery
	if delivery.stage == DeliveryManager.Stage.TO_PICKUP or delivery.stage == DeliveryManager.Stage.DELIVERING:
		_list.add_child(_text(Loc.t("phone.active"), 20, UiKit.ACCENT, true))
		_list.add_child(_card(delivery.active, -1))
		var loaded := delivery.stage == DeliveryManager.Stage.DELIVERING
		var cancel := UiKit.button(Loc.t("phone.cancel_loaded" if loaded else "phone.cancel"), 17)
		cancel.pressed.connect(func() -> void:
			delivery.cancel()
			_dirty = true)
		_list.add_child(cancel)
		_list.add_child(_text(Loc.t("phone.no_offer_active"), 15, GREY))
		return
	_list.add_child(_text(Loc.t("phone.new_orders"), 20, DARK, true))
	if delivery.offers.is_empty():
		_list.add_child(_text(Loc.t("phone.empty"), 16, GREY))
	for i in delivery.offers.size():
		_list.add_child(_card(delivery.offers[i], i))


func _card(offer: Dictionary, index: int) -> Control:
	var type := OrderTypes.get_type(offer["type"])
	var special := str(offer.get("special", ""))
	var color := Color.WHITE
	if special != "":
		color = Color(1.0, 0.95, 0.88)
	elif offer.get("contract_id", "") != "":
		color = Color(0.92, 0.95, 1.0)
	var card := UiKit.panel(color, 16, 12)
	if special != "":
		card.add_theme_stylebox_override("panel", UiKit.stylebox(color, 16, JobTags.SPECIAL_COLOR, 3, 12))
	var column := UiKit.vbox(4)
	card.add_child(column)
	if special != "" and index >= 0:
		var countdown := UiKit.label("", 14, JobTags.SPECIAL_COLOR, true)
		column.add_child(countdown)
		_countdowns.append([countdown, offer])
	var top := UiKit.hbox(8)
	column.add_child(top)
	top.add_child(UiKit.label("%s %s" % [offer["icon"], OrderTypes.display_name(offer["type"])], 21, Color(0.1, 0.1, 0.12), true))
	var tag := UiKit.panel(type["tag_color"], 8, 4)
	tag.add_child(UiKit.label(OrderTypes.tag(offer["type"]), 13, Color.WHITE, true))
	top.add_child(tag)
	top.add_child(UiKit.spacer())
	top.add_child(UiKit.label(UiKit.money(offer["reward"]), 24, MONEY, true))
	column.add_child(JobTags.build(offer, 13))
	# Quem pede (contrato/especial) e o recado do cliente.
	var client: String = offer.get("client", "")
	if client != "" and Clients.get_client(client).get("kind", "") != "mystery":
		column.add_child(UiKit.label("%s %s • %s" % [Clients.get_client(client)["icon"], Clients.display_name(client), Clients.kind_name(client)], 15, Color(0.2, 0.35, 0.6), true))
	if str(offer.get("note", "")) != "":
		var note := _text("“%s”" % offer["note"], 15, Color(0.45, 0.32, 0.12))
		column.add_child(note)
	column.add_child(UiKit.label("📍 %s: %s" % [Loc.t("phone.pickup"), offer["pickup_name"]], 16, GREY))
	column.add_child(UiKit.label("🏁 %s: %s (%s)" % [Loc.t("phone.dropoff"), offer["dropoff_name"], CityLayout.region_name(offer.get("region", "center"))], 16, GREY))
	var info := UiKit.hbox(14)
	column.add_child(info)
	info.add_child(UiKit.label("🛣 %s" % UiKit.distance(offer["route_m"]), 15, GREY))
	info.add_child(UiKit.label("⏱ %s" % UiKit.clock(offer["time_limit"]), 15, GREY))
	info.add_child(UiKit.label("📦 %s" % Loc.t("cargo." + str(offer["size"])), 15, GREY))
	# Quanto a carga aguenta batidas (o modificador FRÁGIL deixa mais sensível).
	var level := OrderTypes.fragility_level_of(float(offer["fragility"]))
	var fragility := UiKit.hbox(8)
	column.add_child(fragility)
	fragility.add_child(UiKit.label(Loc.t("fragility.%d" % level), 15, OrderTypes.fragility_color(level).darkened(0.25), true))
	if level >= 2:
		fragility.add_child(UiKit.label("• " + Loc.t("phone.fragility_hint"), 14, LIGHT_GREY))
	# O que cada modificador pede (curto).
	for id: String in offer.get("modifiers", []):
		column.add_child(_text("%s %s" % [JobRules.modifier(id)["icon"], JobRules.modifier_desc(id)], 14, Color(0.3, 0.32, 0.38)))
	if session.vehicle:
		var away := session.vehicle.global_position.distance_to(offer["pickup_zone"])
		column.add_child(UiKit.label(Loc.t("phone.from_you", [UiKit.distance(away)]), 14, LIGHT_GREY))
		_fuel_line(column, offer, away)
	if index >= 0:
		var fits := VehicleSpecs.can_carry(GameState.current_vehicle, offer["size"])
		var key := "  [%d]" % (index + 1) if index < 5 else ""
		var accept := UiKit.button(Loc.t("phone.accept") + key if fits else Loc.t("phone.too_big"), 18)
		accept.disabled = not fits
		accept.pressed.connect(func() -> void:
			if session.delivery.accept(index):
				_dirty = true)
		column.add_child(accept)
	return card


## Combustível estimado (coleta + rota) quando a viagem é longa ou o tanque está baixo.
func _fuel_line(column: VBoxContainer, offer: Dictionary, away: float) -> void:
	var vehicle := session.vehicle
	var liters := (away * 1.25 + float(offer["route_m"])) / 1000.0 * VehicleSpecs.liters_per_km(vehicle.id)
	var long_trip := float(offer["route_m"]) >= 1000.0 or (offer.get("modifiers", []) as Array).has("long_haul")
	if not long_trip and liters < vehicle.fuel * 0.6:
		return
	var enough := liters < vehicle.fuel * 0.9
	var text := Loc.t("phone.fuel_estimate", ["%.1f" % liters, "%.0f" % vehicle.fuel])
	if not enough:
		text += "  " + Loc.t("phone.fuel_warning")
	column.add_child(_text("⛽ " + text, 14, Color(0.2, 0.45, 0.7) if enough else Color(0.8, 0.25, 0.15), not enough))


# --- aba de carreira -------------------------------------------------------------------

func _build_career() -> void:
	var career := GameState.career
	var rank := career.rank()
	# Nível e o que o próximo libera.
	var rank_card := UiKit.panel(Color.WHITE, 16, 12)
	_list.add_child(rank_card)
	var rank_box := UiKit.vbox(4)
	rank_card.add_child(rank_box)
	rank_box.add_child(UiKit.label("🏅 %s" % CareerRules.rank_name(rank), 22, Color(0.18, 0.32, 0.62), true))
	var next := CareerRules.next_rank_rep(rank)
	if next > 0:
		rank_box.add_child(UiKit.bar(career.rank_progress(), Color(0.3, 0.5, 0.9), 10))
		rank_box.add_child(UiKit.label(Loc.t("phone.rep", [career.reputation, next]), 14, LIGHT_GREY))
		rank_box.add_child(_text(Loc.t("phone.next_rank", [CareerRules.rank_name(rank + 1), CareerRules.rank_unlocks(rank + 1)]), 14, GREY))
	else:
		rank_box.add_child(_text(Loc.t("phone.max_rank"), 14, GREY))
	rank_box.add_child(_text(Loc.t("phone.rep_hint"), 13, LIGHT_GREY))
	# Contratos.
	_list.add_child(_text(Loc.t("phone.contracts", [career.contracts.size(), career.max_contracts()]), 20, DARK, true))
	if career.contracts.is_empty():
		_list.add_child(_text(Loc.t("phone.no_contract"), 14, GREY))
	for contract in career.contracts:
		_list.add_child(_contract_card(contract, true))
	if not career.contract_offers.is_empty():
		_list.add_child(_text(Loc.t("phone.contract_offers"), 16, GREY, true))
		for contract in career.contract_offers:
			_list.add_child(_contract_card(contract, false))
	# Desafios.
	_list.add_child(_text(Loc.t("phone.challenges"), 20, DARK, true))
	for challenge in career.challenges:
		var card := UiKit.panel(Color(1.0, 0.98, 0.9), 14, 10)
		var box := UiKit.vbox(4)
		card.add_child(box)
		var row := UiKit.hbox(8)
		box.add_child(row)
		var text := _text("🎯 " + Challenges.text(challenge), 16, DARK, true, 250)
		text.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(text)
		row.add_child(UiKit.label("+" + UiKit.money(int(challenge["reward"])), 17, MONEY, true))
		if int(challenge["target"]) > 1:
			var progress := UiKit.hbox(8)
			box.add_child(progress)
			var bar := UiKit.bar(float(challenge["progress"]) / float(challenge["target"]), Color(0.95, 0.65, 0.1), 8)
			bar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			progress.add_child(bar)
			progress.add_child(UiKit.label("%d/%d" % [int(challenge["progress"]), int(challenge["target"])], 14, GREY))
		_list.add_child(card)
	# Recordes.
	var stats := GameState.stats
	_list.add_child(_text(Loc.t("phone.records", [career.best_combo, int(stats.get("contracts", 0)), int(stats.get("perfect", 0)), int(stats.get("specials", 0))]), 14, LIGHT_GREY))


func _contract_card(contract: Dictionary, active: bool) -> Control:
	var client_id: String = contract["client"]
	var client := Clients.get_client(client_id)
	var card := UiKit.panel(Color(0.92, 0.95, 1.0) if active else Color.WHITE, 16, 12)
	var box := UiKit.vbox(4)
	card.add_child(box)
	var top := UiKit.hbox(8)
	box.add_child(top)
	top.add_child(UiKit.label("%s %s" % [client["icon"], client["name"]], 18, DARK, true))
	top.add_child(UiKit.spacer())
	top.add_child(UiKit.label("+" + UiKit.money(int(contract["reward"])), 19, MONEY, true))
	box.add_child(UiKit.label("%s • %s • %s" % [Clients.kind_name(client_id), Loc.t("phone.contract_level", [contract["level"]]), Loc.t("phone.rep_reward", [contract["rep"]])], 13, LIGHT_GREY))
	box.add_child(_text(Clients.goal_text(contract), 16, GREY, true))
	if active:
		var progress := UiKit.hbox(8)
		box.add_child(progress)
		var bar := UiKit.bar(float(contract["progress"]) / float(contract["target"]), JobTags.CONTRACT_COLOR, 9)
		bar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		progress.add_child(bar)
		progress.add_child(UiKit.label("%d/%d" % [int(contract["progress"]), int(contract["target"])], 15, GREY, true))
	# O veículo atual leva as encomendas desse cliente?
	var fits := false
	for type_id: String in client["types"]:
		if VehicleSpecs.can_carry(GameState.current_vehicle, OrderTypes.get_type(type_id)["size"]):
			fits = true
	if not fits:
		box.add_child(_text(Loc.t("phone.contract_vehicle"), 14, Color(0.8, 0.25, 0.15), true))
	if active:
		var abandon := UiKit.button(Loc.t("phone.abandon"), 14)
		abandon.pressed.connect(func() -> void:
			GameState.career.abandon_contract(contract["id"])
			Sfx.play("click")
			_dirty = true)
		box.add_child(abandon)
	else:
		var career := GameState.career
		var full := career.contracts.size() >= career.max_contracts()
		var sign := UiKit.button(Loc.t("phone.contract_full", [career.max_contracts()]) if full else Loc.t("phone.sign"), 16)
		sign.disabled = full
		sign.pressed.connect(func() -> void:
			if GameState.career.accept_contract(contract["id"]):
				Sfx.play("accept")
				Bus.toast(Loc.t("toast.contract_signed", [client["name"]]), "success")
				# Já aparece um pedido do cliente no celular.
				session.delivery.ensure_contract_offers()
			_dirty = true)
		box.add_child(sign)
	return card


## Texto que quebra linha. A largura cabe dentro de um cartão do celular.
func _text(text: String, size: int, color: Color, bold: bool = false, width: int = 340) -> Label:
	var label := UiKit.label(text, size, color, bold)
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.custom_minimum_size = Vector2(width, 0)
	return label
