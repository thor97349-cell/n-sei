extends Node3D
## Teste automático da jogabilidade (sem tela), com a cidade e o carro de verdade:
##  1. cálculo do pagamento (no prazo, bônus, atraso, carga danificada, nunca negativo);
##  2. entrega completa: aceitar → parar na vaga da coleta → parar na vaga do destino;
##  3. entrega atrasada (paga menos) e entrega que estoura o limite (paga 0, sem perder dinheiro);
##  4. eventos: acidente bloqueia a rua e o GPS desvia; atalho abre a ponte; tempestade molha a pista;
##  5. posto de gasolina, guincho e resgate;
##  6. salvar e carregar o progresso.
## Uso: godot --headless --fixed-fps 60 --path . res://tests/gameplay_test.tscn

var _world: World
var _session: GameSession
var _step := 0
var _wait := 0.0
var _failures: Array[String] = []
var _money_before := 0
var _log: Array[String] = []


func _ready() -> void:
	GameState.slot = "test_save"
	GameState.reset()
	GameState.money = 500
	_check_payments()
	_world = World.new()
	add_child(_world)
	_session = GameSession.new()
	add_child(_session)
	_session.start(_world)
	_session.events.enabled = false


func _check(condition: bool, message: String) -> void:
	if condition:
		_log.append("ok   " + message)
	else:
		_log.append("FALHA " + message)
		_failures.append(message)


func _check_payments() -> void:
	var on_time := DeliveryManager.compute_payment(200, 100.0, 60.0, 100.0)
	_check(on_time["bonus"] == 70 and on_time["total"] >= 270, "no prazo com 60% do tempo sobrando: bônus de 35%")
	var mid := DeliveryManager.compute_payment(200, 100.0, 30.0, 100.0)
	_check(mid["bonus"] == 30, "com 30% do tempo sobrando: bônus de 15%")
	var late := DeliveryManager.compute_payment(200, 100.0, -10.0, 100.0)
	_check(late["late"] and late["base"] == 80 and late["bonus"] == 0, "atrasado paga 40%")
	var wrecked := DeliveryManager.compute_payment(200, 100.0, -30.0, 0.0)
	_check(wrecked["total"] >= 0, "carga destruída e atrasada nunca dá valor negativo")
	var damaged := DeliveryManager.compute_payment(200, 100.0, 50.0, 50.0)
	_check(damaged["damage"] == 100 and damaged["rating"] < 5.0, "carga 50% danificada desconta metade e baixa a nota")


func _physics_process(delta: float) -> void:
	if _session.vehicle == null:
		return
	_wait -= delta
	if _wait > 0.0:
		return
	var delivery := _session.delivery
	var vehicle := _session.vehicle
	match _step:
		0:
			_check(delivery.offers.size() == GameConfig.OFFERS_ON_PHONE, "celular mostra %d pedidos" % GameConfig.OFFERS_ON_PHONE)
			_check(_world.traffic.car_count() > 5, "trânsito criado (%d carros)" % _world.traffic.car_count())
			var index := _fitting_offer()
			_check(index >= 0, "existe pedido que cabe no furgão")
			_money_before = GameState.money
			_check(delivery.accept(index), "aceitar pedido")
			_check(delivery.stage == DeliveryManager.Stage.TO_PICKUP, "etapa: ir até a coleta")
			_teleport(delivery.active["pickup_zone"], delivery.active["pickup_along_x"])
			_next(1.0)
		1:
			if _waited == 0.0:
				_check(_session.route_points.size() >= 2, "GPS traçou a rota")
			_wait_for(delivery.stage == DeliveryManager.Stage.DELIVERING, "coletou parando na vaga", 6.0)
		2:
			_check(delivery.time_left > 0.0, "prazo começou a contar na coleta")
			_teleport(delivery.active["dropoff_zone"], delivery.active["dropoff_along_x"])
			_next(0.5)
		3:
			_wait_for(delivery.stage == DeliveryManager.Stage.RESULT, "entregou parando na vaga", 6.0)
		4:
			var result := delivery.last_result
			_check(not result.get("failed", true) and int(result["total"]) > 0, "recebeu pagamento: %s" % [result.get("total")])
			_check(GameState.money == _money_before + int(result["total"]), "pagamento somado ao saldo")
			_check(int(GameState.stats["deliveries"]) == 1, "estatística de entregas")
			_next(GameConfig.RESULT_SECONDS + 0.5)
		5:
			_check(delivery.stage == DeliveryManager.Stage.IDLE, "voltou a procurar entrega")
			# Entrega atrasada: coleta, espera o prazo acabar e entrega dentro da tolerância.
			delivery.accept(_fitting_offer())
			_teleport(delivery.active["pickup_zone"], delivery.active["pickup_along_x"])
			_next(0.2)
		6:
			_wait_for(delivery.stage == DeliveryManager.Stage.DELIVERING, "coletou a segunda", 6.0)
		7:
			delivery.time_left = -5.0
			_money_before = GameState.money
			_teleport(delivery.active["dropoff_zone"], delivery.active["dropoff_along_x"])
			_next(0.2)
		8:
			_wait_for(delivery.stage == DeliveryManager.Stage.RESULT, "entregou atrasado", 6.0)
		9:
			_check(delivery.last_result.get("late", false), "resultado marcado como atrasado")
			_check(GameState.money > _money_before, "atrasado ainda paga alguma coisa")
			delivery.stage = DeliveryManager.Stage.IDLE
			# Estourou o limite: pedido cancelado, sem perder dinheiro.
			delivery.accept(_fitting_offer())
			_teleport(delivery.active["pickup_zone"], delivery.active["pickup_along_x"])
			_next(0.2)
		10:
			_wait_for(delivery.stage == DeliveryManager.Stage.DELIVERING, "coletou a terceira", 6.0)
		11:
			_money_before = GameState.money
			delivery.time_left = -GameConfig.LATE_GRACE_SECONDS + 0.05
			_next(0.3)
		12:
			_check(delivery.last_result.get("failed", false), "passou do limite: entrega falhou")
			_check(GameState.money == _money_before, "falha não tira dinheiro")
			delivery.stage = DeliveryManager.Stage.IDLE
			# Evento: acidente bloqueia uma rua; o GPS deve evitar o trecho.
			_session.events.start("accident")
			var edge := _find_blocked_edge()
			_check(edge != null, "acidente bloqueou um trecho de rua")
			if edge:
				var from := edge.from + edge.dir * 20.0 + Vector3(0, 0, 0)
				var to := edge.to - edge.dir * 20.0
				var path := _world.graph.find_path(from, to)
				var length := 0.0
				for i in range(1, path.size()):
					length += path[i - 1].distance_to(path[i])
				_check(length > edge.length, "GPS desviou do acidente (%.0f m em vez de %.0f m)" % [length, edge.length - 40.0])
			_session.events.stop()
			_check(_find_blocked_edge() == null, "rua liberada no fim do acidente")
			_session.events.start("shortcut")
			var shortcut_open := _world.info.is_shortcut_open("bridge") or _world.info.is_shortcut_open("mall_gate")
			_check(shortcut_open, "atalho aberto durante o evento")
			_session.events.stop()
			_check(not _world.info.is_shortcut_open("bridge") and not _world.info.is_shortcut_open("mall_gate"), "atalho fechado depois")
			_check(not _world.graph.closed_crossing_edge().open, "ponte em obras volta a ficar fechada no GPS")
			_session.events.start("storm")
			_next(25.0)
		13:
			_check(_world.atmosphere.wetness > 0.5, "tempestade molhou a pista (%.2f)" % _world.atmosphere.wetness)
			_check(vehicle.grip_factor < 0.9, "pneu perde aderência na chuva (%.2f)" % vehicle.grip_factor)
			_session.events.stop()
			# Guincho sem combustível: vai para o posto e nunca deixa saldo negativo.
			GameState.money = 30
			vehicle.fuel = 0.0
			_session.tow()
			_check(GameState.money == 0, "guincho cobra só o que tem (sem saldo negativo)")
			_check(vehicle.fuel > 0.0, "guincho deixa um pouco de combustível")
			var near_station := false
			for station in CityLayout.fuel_stations():
				if (station["pumps"] as Vector3).distance_to(vehicle.global_position) < 6.0:
					near_station = true
			_check(near_station, "guincho leva ao posto")
			_next(1.0)
		14:
			# Resgate: vira o carro e aperta R.
			vehicle.place(Transform3D(Basis(Vector3.FORWARD, PI), Vector3(-150, 0.5, -222)))
			_next(1.5)
		15:
			_check(vehicle.is_flipped(), "carro virado detectado")
			_session.recover()
			_next(1.5)
		16:
			_check(not vehicle.is_flipped(), "resgate desvira o carro na faixa")
			var result: Array = _world.graph.nearest_edge(vehicle.global_position)
			_check(float(result[2]) < 8.0, "resgate coloca o carro na rua")
			# Salvar e carregar.
			GameState.money = 1234
			GameState.stats["deliveries"] = 7
			_check(GameState.save_game(), "salvar o jogo")
			GameState.reset()
			_check(GameState.load_game() and GameState.money == 1234 and int(GameState.stats["deliveries"]) == 7, "carregar o jogo")
			_finish()


func _fitting_offer() -> int:
	for i in _session.delivery.offers.size():
		if VehicleSpecs.can_carry(GameState.current_vehicle, _session.delivery.offers[i]["size"]):
			return i
	return -1


func _find_blocked_edge() -> RoadGraph.Edge:
	for edge in _world.graph.edges:
		if edge.blocked:
			return edge
	return null


func _teleport(zone: Vector3, along_x: bool) -> void:
	var basis := Basis(Vector3.UP, PI / 2.0 if along_x else 0.0)
	_session.vehicle.place(Transform3D(basis, zone))


var _waited := 0.0


func _next(seconds: float) -> void:
	_step += 1
	_wait = seconds
	_waited = 0.0


func _wait_for(condition: bool, message: String, timeout: float) -> void:
	if condition:
		_check(true, message)
		_next(0.0)
		return
	_waited += get_physics_process_delta_time()
	if _waited > timeout:
		_check(false, message)
		_finish()


func _finish() -> void:
	for line in _log:
		print(line)
	print("RESULTADO: ", "OK" if _failures.is_empty() else "FALHOU (%d)" % _failures.size())
	get_tree().quit(0 if _failures.is_empty() else 1)
