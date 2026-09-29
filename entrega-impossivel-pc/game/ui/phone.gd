class_name Phone
extends Control
## Celular com o app "EntregaJá": lista de pedidos (aceitar com clique ou 1/2/3),
## atualizar pedidos, entrega em andamento (com cancelar), saldo e avaliação.

var session: GameSession
var _list: VBoxContainer
var _balance: Label
var _refresh: Button
var _dirty := true


func _ready() -> void:
	theme = UiKit.theme()
	anchor_left = 1.0
	anchor_right = 1.0
	anchor_top = 0.5
	anchor_bottom = 0.5
	offset_left = -470
	offset_right = -24
	offset_top = -330
	offset_bottom = 330
	var frame := UiKit.panel(Color(0.03, 0.03, 0.04, 0.97), 34, 12)
	frame.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(frame)
	var screen := UiKit.panel(Color(0.93, 0.94, 0.96, 1.0), 24, 14)
	frame.add_child(screen)
	var column := UiKit.vbox(10)
	screen.add_child(column)
	var header := UiKit.hbox(8)
	column.add_child(header)
	var logo := UiKit.label("📦 " + Loc.t("phone.app_name"), 26, UiKit.ACCENT, true)
	header.add_child(logo)
	header.add_child(UiKit.spacer())
	_balance = UiKit.label("", 18, Color(0.15, 0.16, 0.2), true, HORIZONTAL_ALIGNMENT_RIGHT)
	header.add_child(_balance)
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
	column.add_child(UiKit.label(Loc.t("phone.hint"), 14, Color(0.4, 0.42, 0.46), false, HORIZONTAL_ALIGNMENT_CENTER))


func bind(game_session: GameSession) -> void:
	session = game_session
	session.delivery.offers_changed.connect(func() -> void: _dirty = true)
	session.delivery.stage_changed.connect(func() -> void: _dirty = true)
	Bus.money_changed.connect(func(_t: int, _d: int) -> void: _dirty = true)
	Bus.vehicle_changed.connect(func() -> void: _dirty = true)


func _process(_delta: float) -> void:
	if session == null or not visible:
		return
	var cooldown := session.delivery.refresh_cooldown
	_refresh.disabled = cooldown > 0.0 or session.delivery.stage != DeliveryManager.Stage.IDLE
	_refresh.text = Loc.t("phone.refresh_wait", [ceili(cooldown)]) if cooldown > 0.0 else Loc.t("phone.refresh")
	if _dirty:
		_dirty = false
		_rebuild()


func _unhandled_input(event: InputEvent) -> void:
	if not visible or session == null:
		return
	for i in 3:
		if event.is_action_pressed("accept_%d" % (i + 1)):
			get_viewport().set_input_as_handled()
			if session.delivery.accept(i):
				_dirty = true


func _rebuild() -> void:
	_balance.text = "%s\n%s %.1f" % [UiKit.money(GameState.money), "★", GameState.average_rating()]
	for child in _list.get_children():
		child.queue_free()
	var delivery := session.delivery
	if delivery.stage == DeliveryManager.Stage.TO_PICKUP or delivery.stage == DeliveryManager.Stage.DELIVERING:
		_list.add_child(_dark(UiKit.label(Loc.t("phone.active"), 20, UiKit.ACCENT, true)))
		_list.add_child(_card(delivery.active, -1))
		var cancel := UiKit.button(Loc.t("phone.cancel"), 18)
		cancel.pressed.connect(func() -> void:
			delivery.cancel()
			_dirty = true)
		_list.add_child(cancel)
		_list.add_child(_dark(UiKit.label(Loc.t("phone.no_offer_active"), 15, Color(0.35, 0.36, 0.4))))
		return
	_list.add_child(_dark(UiKit.label(Loc.t("phone.new_orders"), 20, Color(0.12, 0.13, 0.16), true)))
	if delivery.offers.is_empty():
		_list.add_child(_dark(UiKit.label(Loc.t("phone.empty"), 16, Color(0.35, 0.36, 0.4))))
	for i in delivery.offers.size():
		_list.add_child(_card(delivery.offers[i], i))


func _dark(label: Label) -> Label:
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	return label


func _card(offer: Dictionary, index: int) -> Control:
	var type := OrderTypes.get_type(offer["type"])
	var card := UiKit.panel(Color.WHITE, 16, 12)
	var column := UiKit.vbox(4)
	card.add_child(column)
	var top := UiKit.hbox(8)
	column.add_child(top)
	top.add_child(UiKit.label("%s %s" % [offer["icon"], OrderTypes.display_name(offer["type"])], 21, Color(0.1, 0.1, 0.12), true))
	var tag := UiKit.panel(type["tag_color"], 8, 4)
	tag.add_child(UiKit.label(OrderTypes.tag(offer["type"]), 13, Color.WHITE, true))
	top.add_child(tag)
	top.add_child(UiKit.spacer())
	top.add_child(UiKit.label(UiKit.money(offer["reward"]), 24, Color(0.1, 0.55, 0.25), true))
	var dark := Color(0.28, 0.3, 0.34)
	column.add_child(UiKit.label("📍 %s: %s" % [Loc.t("phone.pickup"), offer["pickup_name"]], 16, dark))
	column.add_child(UiKit.label("🏁 %s: %s" % [Loc.t("phone.dropoff"), offer["dropoff_name"]], 16, dark))
	var info := UiKit.hbox(14)
	column.add_child(info)
	info.add_child(UiKit.label("🛣 %s" % UiKit.distance(offer["route_m"]), 15, dark))
	info.add_child(UiKit.label("⏱ %s" % UiKit.clock(offer["time_limit"]), 15, dark))
	info.add_child(UiKit.label("📦 %s" % Loc.t("cargo." + str(offer["size"])), 15, dark))
	if session.vehicle:
		var away := session.vehicle.global_position.distance_to(offer["pickup_zone"])
		column.add_child(UiKit.label(Loc.t("phone.from_you", [UiKit.distance(away)]), 14, Color(0.45, 0.47, 0.5)))
	if index >= 0:
		var fits := VehicleSpecs.can_carry(GameState.current_vehicle, offer["size"])
		var accept := UiKit.button("%s  [%d]" % [Loc.t("phone.accept"), index + 1] if fits else Loc.t("phone.too_big"), 18)
		accept.disabled = not fits
		accept.pressed.connect(func() -> void:
			if session.delivery.accept(index):
				_dirty = true)
		column.add_child(accept)
	return card
