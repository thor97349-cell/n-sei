extends Node3D
## Teste das batidas entre o carro do jogador e os carros do trânsito (sem tela):
## 1. batida lateral a 50 km/h num sedã parado: o sedã vira destroço e é empurrado, a van
##    perde só parte da velocidade (não para seco como num muro);
## 2. encostada a 8 km/h: o carro só liga o pisca-alerta (continua no trânsito);
## 3. engavetamento: o destroço empurrado acerta outro carro, que também vira destroço.
## Com um prefixo de arquivo (e com tela), salva prints da batida 1.
## Uso: godot --headless --fixed-fps 60 --path . res://tests/crash_test.tscn [-- prefixo]

const SCENARIOS := ["side", "bump", "chain"]

var _prefix := ""
var _traffic: TrafficSystem
var _effects: VehicleEffects
var _camera: Camera3D
var _van: Vehicle
var _cars: Array[TrafficCar] = []
var _scenario := ""
var _time := 0.0
var _speed_before := 0.0
var _target_speed := 0.0
## Velocidades dos últimos quadros (a de antes da batida é a maior delas: no quadro em que
## o teste percebe a batida, a física já começou a frear a van).
var _recent: Array[float] = []
var _speed_after := -1.0
var _hit_time := -1.0
var _shots: Array = []
var _failures: Array[String] = []
var _queue: Array = SCENARIOS.duplicate()


func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0:
		_prefix = args[0]
	var ground := StaticBody3D.new()
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(400, 2, 400)
	shape.shape = box
	shape.position.y = -1.0
	ground.add_child(shape)
	add_child(ground)
	_traffic = TrafficSystem.new()
	add_child(_traffic)
	_effects = VehicleEffects.new()
	add_child(_effects)
	_traffic.crash.connect(_effects.burst)
	if _prefix != "":
		var atmosphere := Atmosphere.new()
		add_child(atmosphere)
		atmosphere.minutes = 15.0 * 60.0
		atmosphere.clock_running = false
		var plane := MeshInstance3D.new()
		var mesh := PlaneMesh.new()
		mesh.size = Vector2(400, 400)
		plane.mesh = mesh
		plane.material_override = Mats.sidewalk()
		add_child(plane)
		_camera = Camera3D.new()
		_camera.fov = 55.0
		add_child(_camera)
		_camera.current = true
		_camera.position = Vector3(11.0, 5.5, -9.0)
		_camera.look_at(Vector3(0, 0.6, 1.5))
	_next()


func _next() -> void:
	for car in _cars:
		if is_instance_valid(car):
			car.queue_free()
	_cars.clear()
	_traffic.clear()
	if _van:
		_van.queue_free()
		_van = null
	_effects.attach(null)
	if _queue.is_empty():
		_finish()
		return
	_scenario = _queue.pop_front()
	_time = 0.0
	_hit_time = -1.0
	_speed_after = -1.0
	_recent.clear()
	var speed := 13.9
	match _scenario:
		"side":
			_park("sedan", Vector3(0, 0, 0), Vector3.RIGHT)
			if _prefix != "":
				_shots = [[-0.3, "approach"], [0.08, "impact"], [0.5, "after"], [2.5, "slide"]]
		"bump":
			_park("hatch", Vector3(0, 0, 0), Vector3.BACK)
			speed = 2.2
		"chain":
			_park("hatch", Vector3(0, 0, 0), Vector3.RIGHT)
			_park("sedan", Vector3(0.3, 0, 7.5), Vector3.RIGHT)
			speed = 19.5
	_van = Vehicle.new()
	_van.setup("van", Color(0, 0, 0, 0), false)
	_van.use_player_input = false
	add_child(_van)
	_van.place(Transform3D(Basis(), Vector3(0.3, 0, -16.0)))
	_van.linear_velocity = Vector3.BACK * speed
	_target_speed = speed
	_traffic.set_player(_van)
	_effects.attach(_van)


func _park(style: String, where: Vector3, forward: Vector3) -> void:
	var car := TrafficCar.new()
	car.setup(style, 4)
	add_child(car)
	car.place(where, forward)
	_traffic.adopt(car)
	_cars.append(car)


func _physics_process(delta: float) -> void:
	if _van == null:
		return
	_time += delta
	var hit := not _traffic.wrecks().is_empty() or _cars.any(func(car: TrafficCar) -> bool: return is_instance_valid(car) and car.crashed_time > 0.0)
	if _hit_time < 0.0:
		var speed := _van.linear_velocity.length()
		_recent.append(speed)
		if _recent.size() > 6:
			_recent.pop_front()
		# Mantém a velocidade até a batida (acelerador proporcional ao que falta).
		_van.input_throttle = clampf((_target_speed - speed) * 0.8 + 0.15, 0.0, 1.0)
		if hit:
			_hit_time = _time
			_speed_before = _recent.max()
	else:
		_van.input_throttle = 0.0
		if _speed_after < 0.0 and _time - _hit_time > 0.1:
			_speed_after = _van.linear_velocity.length()
		# Depois da batida: freia forte (marcas de pneu).
		_van.input_brake = 1.0 if _time - _hit_time > 0.3 else 0.0
	if _time > 20.0 or (_hit_time >= 0.0 and _time - _hit_time > 4.0):
		_check()
		_next()


func _process(_delta: float) -> void:
	if _shots.is_empty() or _scenario != "side":
		return
	var shot: Array = _shots[0]
	var at := float(shot[0])
	var due := (at < 0.0 and _hit_time < 0.0 and _van.global_position.z > -2.4 + at * 13.9) or (at >= 0.0 and _hit_time >= 0.0 and _time - _hit_time >= at)
	if due:
		_shots.pop_front()
		var path := "%s_%s.png" % [_prefix, shot[1]]
		get_viewport().get_texture().get_image().save_png(path)
		print("salvo ", path)


func _check() -> void:
	var wrecks := _traffic.wrecks()
	match _scenario:
		"side":
			_expect(wrecks.size() == 1, "batida lateral: o sedã virou destroço (%d)" % wrecks.size())
			if wrecks.size() == 1:
				var moved := wrecks[0].global_position.distance_to(Vector3.ZERO)
				_expect(moved > 2.0, "batida lateral: destroço empurrado %.1f m" % moved)
				_expect(absf(wrecks[0].global_basis.y.y) > 0.99, "batida lateral: destroço de pé")
			var kept := _speed_after / maxf(_speed_before, 0.1)
			_expect(kept > 0.15 and kept < 0.8, "batida lateral: van manteve %.0f%% da velocidade (%.1f → %.1f m/s)" % [kept * 100.0, _speed_before, _speed_after])
		"bump":
			_expect(wrecks.is_empty(), "encostada: nenhum destroço")
			_expect(_cars.size() == 1 and is_instance_valid(_cars[0]) and _cars[0].crashed_time > 0.0, "encostada: carro parado com pisca-alerta")
		"chain":
			_expect(wrecks.size() == 2, "engavetamento: dois destroços (%d)" % wrecks.size())
	_expect(_hit_time >= 0.0, "%s: houve batida" % _scenario)


func _expect(ok: bool, message: String) -> void:
	print("ok  " if ok else "FALHA: ", message)
	if not ok:
		_failures.append(message)


func _finish() -> void:
	print("RESULTADO: ", "OK" if _failures.is_empty() else "FALHOU (%d)" % _failures.size())
	get_tree().quit(0 if _failures.is_empty() else 1)
