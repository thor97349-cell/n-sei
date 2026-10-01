extends Node
## Teste do ciclo completo (o jogo de verdade, com HUD e celular): faz várias entregas
## seguidas misturando pedidos seguros/difíceis/arriscados, entregas especiais, contratos,
## batidas, multas, atrasos, falhas e cancelamentos. Confere a cada entrega que nada
## trava e que as regras se mantêm (saldo nunca negativo, reputação nunca abaixo do nível,
## sempre há pedidos no celular, o resumo aparece) e, no fim, que houve progressão.
## Uso: godot --headless --fixed-fps 60 --path . res://tests/loop_test.tscn [-- entregas]

var _main: Node
var _deliveries := 30
var _done := 0
var _step := 0
var _wait := 0.0
var _timer := 0.0
var _rng := RandomNumberGenerator.new()
var _failures: Array[String] = []
var _log: Array[String] = []
var _plan := ""
var _results := {"ok": 0, "late": 0, "failed": 0, "cancelled": 0, "special": 0, "contract": 0, "risky": 0}
var _summaries := 0


func _ready() -> void:
	_rng.seed = 5
	GameState.slot = "test_loop"
	var args := OS.get_cmdline_user_args()
	if args.size() > 0:
		_deliveries = int(args[0])
	_main = load("res://scenes/main.tscn").instantiate()
	add_child(_main)


func _check(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)
		_log.append("FALHA " + message)


func _physics_process(delta: float) -> void:
	if _main.world == null:
		return
	if _main.session == null:
		_main._start(true)
		_main.session.events.enabled = false
		_main.hud.session.delivery.finished.connect(func(_r: Dictionary) -> void: _summaries += 1)
		return
	var session: GameSession = _main.session
	var delivery := session.delivery
	_timer += delta
	_wait -= delta
	if _wait > 0.0:
		return
	if _timer > 900.0:
		_check(false, "o teste demorou demais (etapa %d)" % _step)
		_finish()
		return
	match _step:
		0:
			_choose(session)
		1:
			if delivery.stage == DeliveryManager.Stage.DELIVERING:
				_during(session)
		2:
			if delivery.stage == DeliveryManager.Stage.RESULT or delivery.stage == DeliveryManager.Stage.IDLE:
				_after(session)


## Escolhe o pedido (especial, contrato, arriscado ou qualquer um) e às vezes assina contrato.
func _choose(session: GameSession) -> void:
	var delivery := session.delivery
	var career := GameState.career
	if career.contracts.size() < career.max_contracts() and not career.contract_offers.is_empty() and _rng.randf() < 0.5:
		career.accept_contract(career.contract_offers[0]["id"])
		delivery.ensure_contract_offers()
	if _done % 7 == 3:
		delivery.add_special(JobRules.SPECIALS.keys()[_rng.randi() % JobRules.SPECIALS.size()])
	# O celular aberto nas duas abas (monta os cartões de verdade).
	_main.phone.visible = true
	_main.phone._set_tab(_done % 2)
	_main.phone._process(0.0)
	_main.phone.visible = false
	_check(delivery.offers.size() >= 2, "celular com pedidos (%d)" % delivery.offers.size())
	var index := -1
	for i in delivery.offers.size():
		var offer: Dictionary = delivery.offers[i]
		if not VehicleSpecs.can_carry(GameState.current_vehicle, offer["size"]):
			continue
		if index < 0 or offer.get("special", "") != "" or (offer.get("contract_id", "") != "" and _rng.randf() < 0.6) or (offer["tier"] == "risky" and _rng.randf() < 0.4):
			index = i
	_check(index >= 0, "algum pedido cabe no veículo")
	var offer: Dictionary = delivery.offers[index]
	if offer.get("special", "") != "":
		_results["special"] += 1
	if offer.get("contract_id", "") != "":
		_results["contract"] += 1
	if offer["tier"] == "risky":
		_results["risky"] += 1
	_check(delivery.accept(index), "aceitar pedido")
	# Como vai ser esta entrega.
	var roll := _rng.randf()
	_plan = "ok"
	if roll < 0.1:
		_plan = "fail"
	elif roll < 0.2:
		_plan = "late"
	elif roll < 0.27:
		_plan = "cancel"
	_teleport(session, delivery.active["pickup_zone"], delivery.active["pickup_along_x"])
	_step = 1
	_wait = 0.2


func _during(session: GameSession) -> void:
	var delivery := session.delivery
	_main.hud._process(0.016)
	if _rng.randf() < 0.4:
		delivery._on_impact(_rng.randf_range(4.0, 10.0))
	if _rng.randf() < 0.2:
		GameState.money += 100
		session._on_red_light()
	match _plan:
		"fail":
			delivery.time_left = -GameConfig.LATE_GRACE_SECONDS - 1.0
		"late":
			delivery.time_left = -3.0
		"cancel":
			delivery.cancel()
			_results["cancelled"] += 1
			_step = 2
			return
		_:
			delivery.time_left = float(delivery.active["time_limit"]) * _rng.randf_range(0.1, 0.7)
	if _plan != "fail":
		_teleport(session, delivery.active["dropoff_zone"], delivery.active["dropoff_along_x"])
	_step = 2
	_wait = 0.1


func _after(session: GameSession) -> void:
	var delivery := session.delivery
	if delivery.stage == DeliveryManager.Stage.RESULT:
		var result := delivery.last_result
		if result.get("failed", false):
			_results["failed"] += 1
		elif result.get("late", false):
			_results["late"] += 1
		else:
			_results["ok"] += 1
		_check(result.has("report"), "resultado tem o relatório da carreira")
		_main.hud._process(0.016)
		delivery.result_timer = 0.0
		_wait = 0.1
		return
	var career := GameState.career
	_check(GameState.money >= 0, "saldo nunca negativo")
	_check(career.reputation >= int(career.rank_info()["rep"]), "reputação nunca abaixo do nível")
	_check(career.combo >= 0 and career.challenges.size() <= int(career.rank_info()["challenges"]), "combo e desafios válidos")
	_done += 1
	if _done >= _deliveries:
		_finish()
		return
	_step = 0
	_wait = 0.1


func _teleport(session: GameSession, zone: Vector3, along_x: bool) -> void:
	session.vehicle.place(Transform3D(Basis(Vector3.UP, PI / 2.0 if along_x else 0.0), zone))


func _finish() -> void:
	var career := GameState.career
	var stats := GameState.stats
	print("entregas: %d | concluídas %d, atrasadas %d, falhas %d, canceladas %d | especiais %d, de contrato %d, arriscadas %d" % [_done, _results["ok"], _results["late"], _results["failed"], _results["cancelled"], _results["special"], _results["contract"], _results["risky"]])
	print("saldo R$ %d | reputação %d (%s) | combo %d (melhor %d) | contratos %d | desafios %d | perfeitas %d | resumos na tela %d" % [GameState.money, career.reputation, CareerRules.rank_name(career.rank()), career.combo, career.best_combo, int(stats["contracts"]), int(stats["challenges"]), int(stats["perfect"]), _summaries])
	_check(_done >= _deliveries, "fez todas as entregas")
	_check(career.reputation > 0 and int(stats["deliveries"]) > 0, "houve progressão")
	_check(_summaries >= _results["ok"] + _results["late"] + _results["failed"], "um resumo para cada entrega")
	for line in _log:
		print(line)
	print("RESULTADO: ", "OK" if _failures.is_empty() else "FALHOU (%d)" % _failures.size())
	get_tree().quit(0 if _failures.is_empty() else 1)
