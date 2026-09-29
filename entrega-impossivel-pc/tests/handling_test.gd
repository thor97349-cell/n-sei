extends Node3D
## Teste automático de dirigibilidade e batidas (sem tela), para cada veículo:
##   • curva com o volante todo (como no teclado) a 30, 60 e 90 km/h: o carro não pode
##     rodar, e ao soltar o volante precisa endireitar rápido;
##   • troca de faixa brusca a 80 km/h;
##   • batida de lado num muro a 50 km/h e batida de quina num poste a 40 km/h:
##     o carro não pode capotar nem sair girando descontrolado;
##   • batida num poste de luz a 50 km/h: o poste cai e o carro segue andando.
## Uso: godot --headless --fixed-fps 120 --path . res://tests/handling_test.tscn [-- id]

const SCENARIOS := ["curve_30", "curve_60", "curve_90", "half_90", "lane_change_80", "wall_50", "pole_40", "lamp_50"]
## Limites de aprovação.
const MAX_SLIP_DEG := 25.0
const MAX_RECOVERY_S := 1.6
const MAX_TILT_DEG := 25.0
const MAX_YAW_AFTER_HIT := 0.6

var _queue: Array = []
var _vehicle: Vehicle
var _obstacle: StaticBody3D
var _breakables: Breakables
var _scenario := ""
var _id := ""
var _time := 0.0
var _stage := ""
var _data := {}
var _rows: Array[String] = []
var _failures: Array[String] = []


func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	var ids: Array = [args[0]] if args.size() > 0 else VehicleSpecs.ORDER
	for id: String in ids:
		for scenario: String in SCENARIOS:
			if id == "truck" and scenario.ends_with("_90"):
				continue
			_queue.append([id, scenario])
	var ground := StaticBody3D.new()
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(6000, 2, 6000)
	shape.shape = box
	shape.position.y = -1.0
	ground.add_child(shape)
	add_child(ground)
	_next()


func _next() -> void:
	if _vehicle:
		_vehicle.queue_free()
		_vehicle = null
	if _obstacle:
		_obstacle.queue_free()
		_obstacle = null
	if _breakables:
		_breakables.queue_free()
		_breakables = null
	if _queue.is_empty():
		_finish()
		return
	var entry: Array = _queue.pop_front()
	_id = entry[0]
	_scenario = entry[1]
	_vehicle = Vehicle.new()
	_vehicle.setup(_id, Color(0, 0, 0, 0), false)
	_vehicle.use_player_input = false
	add_child(_vehicle)
	_time = 0.0
	_data = {"max_slip": 0.0, "max_tilt": 0.0, "max_yaw": 0.0}
	_stage = "settle"
	if _scenario.begins_with("wall") or _scenario.begins_with("pole") or _scenario.begins_with("lamp"):
		_build_obstacle()
	var yaw := deg_to_rad(28.0) if _scenario.begins_with("wall") else 0.0
	_vehicle.place(Transform3D(Basis(Vector3.UP, yaw), Vector3(0, 0, 0)))


func _build_obstacle() -> void:
	_obstacle = StaticBody3D.new()
	var shape := CollisionShape3D.new()
	if _scenario.begins_with("wall"):
		var box := BoxShape3D.new()
		box.size = Vector3(1.0, 3.0, 200.0)
		shape.shape = box
		shape.position = Vector3(14.0, 1.5, 60.0)
	else:
		var cylinder := CylinderShape3D.new()
		cylinder.radius = 0.15
		cylinder.height = 7.0
		shape.shape = cylinder
		# Poste desalinhado: pega a quina dianteira direita.
		shape.position = Vector3(-0.75, 3.5, 30.0)
	_obstacle.add_child(shape)
	add_child(_obstacle)
	if _scenario.begins_with("lamp"):
		# Poste de luz de verdade (quebra): MultiMesh + colisão registrados no Breakables.
		var multimesh := MultiMesh.new()
		multimesh.transform_format = MultiMesh.TRANSFORM_3D
		multimesh.mesh = CylinderMesh.new()
		multimesh.instance_count = 1
		var xform := Transform3D(Basis(), Vector3(-0.75, 0, 30.0))
		multimesh.set_instance_transform(0, xform)
		_breakables = Breakables.new()
		add_child(_breakables)
		_breakables.setup([[shape, multimesh, 0, xform, Vector3(0, 7, 30)]])


func _target_speed() -> float:
	return float(_scenario.get_slice("_", _scenario.get_slice_count("_") - 1)) / 3.6


func _cruise(target: float) -> void:
	var error := target - _vehicle.speed
	_vehicle.input_throttle = clampf(error * 0.4, 0.0, 1.0)
	_vehicle.input_brake = clampf(-error * 0.3, 0.0, 1.0)


func _steer_towards(target: float, delta: float) -> void:
	# Mesma velocidade de giro do volante no teclado.
	var rate := 3.2 if absf(target) > absf(_vehicle.input_steer) else 5.5
	_vehicle.input_steer = move_toward(_vehicle.input_steer, target, rate * delta)


func _slip_deg() -> float:
	var velocity := _vehicle.linear_velocity
	velocity.y = 0.0
	if velocity.length() < 3.0:
		return 0.0
	var forward := _vehicle.global_basis.z
	forward.y = 0.0
	return rad_to_deg(forward.normalized().angle_to(velocity.normalized()))


func _tilt_deg() -> float:
	return rad_to_deg(Vector3.UP.angle_to(_vehicle.global_basis.y))


func _physics_process(delta: float) -> void:
	if _vehicle == null:
		return
	_time += delta
	if _vehicle.is_flipped():
		_data["flipped"] = true
	_data["max_tilt"] = maxf(float(_data["max_tilt"]), _tilt_deg())
	if _stage in ["turn", "move", "release"]:
		_data["squeal"] = maxf(float(_data.get("squeal", 0.0)), _vehicle.tire_squeal)
	if _scenario.begins_with("curve") or _scenario.begins_with("half"):
		_curve(delta)
	elif _scenario.begins_with("lane"):
		_lane_change(delta)
	else:
		_impact(delta)


func _curve(delta: float) -> void:
	var target := _target_speed()
	match _stage:
		"settle":
			if _time > 1.0:
				_stage = "accelerate"
				_time = 0.0
		"accelerate":
			_cruise(target)
			if (_vehicle.speed > target - 0.4 and _time > 3.0) or _time > 30.0:
				_stage = "turn"
				_time = 0.0
				_data["entry_speed"] = _vehicle.speed
		"turn":
			_cruise(target)
			# "half": meio volante (deve dar mais ou menos meia curva).
			_steer_towards(0.5 if _scenario.begins_with("half") else 1.0, delta)
			_data["max_slip"] = maxf(float(_data["max_slip"]), _slip_deg())
			if _time > 1.5:
				var lateral := absf(_vehicle.angular_velocity.y * _vehicle.linear_velocity.length()) / 9.8
				_data["lat_g"] = maxf(float(_data.get("lat_g", 0.0)), lateral)
			if _time > 3.5:
				_stage = "release"
				_time = 0.0
		"release":
			_cruise(target)
			_steer_towards(0.0, delta)
			_data["max_slip"] = maxf(float(_data["max_slip"]), _slip_deg())
			if absf(_vehicle.angular_velocity.y) < 0.1 and not _data.has("recovery"):
				_data["recovery"] = _time
			if _time > 4.0:
				_report()


func _lane_change(delta: float) -> void:
	var target := _target_speed()
	match _stage:
		"settle":
			if _time > 1.0:
				_stage = "accelerate"
				_time = 0.0
		"accelerate":
			_cruise(target)
			if (_vehicle.speed > target - 0.4 and _time > 3.0) or _time > 40.0:
				_stage = "move"
				_time = 0.0
		"move":
			_cruise(target)
			var steer := 1.0 if _time < 0.6 else (-1.0 if _time < 1.2 else 0.0)
			_steer_towards(steer, delta)
			_data["max_slip"] = maxf(float(_data["max_slip"]), _slip_deg())
			if _time > 1.2 and absf(_vehicle.angular_velocity.y) < 0.1 and not _data.has("recovery"):
				_data["recovery"] = _time - 1.2
			if _time > 5.0:
				_report()


func _impact(delta: float) -> void:
	var target := _target_speed()
	match _stage:
		"settle":
			if _time > 1.0:
				# Já sai na velocidade do teste (não há espaço para acelerar).
				_vehicle.linear_velocity = _vehicle.global_basis.z * target
				_stage = "drive"
				_time = 0.0
				_data["last_speed"] = target
		"drive":
			_vehicle.input_throttle = 0.35
			var speed := _vehicle.linear_velocity.length()
			var history: Array = _data.get("history", [])
			history.append(speed)
			if history.size() > 18:
				history.pop_front()
			_data["history"] = history
			if float(history[0]) - speed > 1.2 and not _data.has("hit_time"):
				_data["hit_time"] = _time
				_data["hit_speed"] = float(history[0])
			_data["last_speed"] = speed
			if _data.has("hit_time"):
				var since := _time - float(_data["hit_time"])
				_data["max_yaw"] = maxf(float(_data["max_yaw"]), absf(_vehicle.angular_velocity.y))
				var roll_pitch := Vector2(_vehicle.angular_velocity.x, _vehicle.angular_velocity.z).length()
				_data["max_roll_rate"] = maxf(float(_data.get("max_roll_rate", 0.0)), roll_pitch)
				if since > 1.5 and not _data.has("yaw_after"):
					_data["yaw_after"] = absf(_vehicle.angular_velocity.y)
					_data["speed_after"] = _vehicle.linear_velocity.length() * 3.6
				if since > 2.0:
					_report()
			elif _time > 8.0:
				_data["no_hit"] = true
				_report()


func _report() -> void:
	var row := ""
	var ok := true
	var name := "%-6s %-15s" % [_id, _scenario]
	if _scenario.begins_with("curve") or _scenario.begins_with("lane") or _scenario.begins_with("half"):
		var slip: float = _data["max_slip"]
		var recovery: float = _data.get("recovery", 99.0)
		row = "%s deriva máx %5.1f° | lateral %4.2f g | endireita em %4.2f s | inclinação %4.1f° | pneu canta %3.0f%%" % [name, slip, float(_data.get("lat_g", 0.0)), recovery, float(_data["max_tilt"]), float(_data.get("squeal", 0.0)) * 100.0]
		ok = slip < MAX_SLIP_DEG and recovery < MAX_RECOVERY_S and not _data.has("flipped")
	else:
		row = "%s batida a %4.0f km/h | giro máx %4.2f rad/s | giro 1,5 s depois %4.2f | tombo máx %4.1f° | rolagem/arfagem %4.2f rad/s | segue a %4.0f km/h" % [
			name, float(_data.get("hit_speed", 0.0)) * 3.6, float(_data["max_yaw"]), float(_data.get("yaw_after", 99.0)),
			float(_data["max_tilt"]), float(_data.get("max_roll_rate", 0.0)), float(_data.get("speed_after", 0.0))]
		ok = not _data.has("no_hit") and not _data.has("flipped") and float(_data["max_tilt"]) < MAX_TILT_DEG and float(_data.get("yaw_after", 99.0)) < MAX_YAW_AFTER_HIT
	if _data.has("flipped"):
		row += " | CAPOTOU"
	_rows.append(("ok   " if ok else "FALHA ") + row)
	if not ok:
		_failures.append("%s %s" % [_id, _scenario])
	_next()


func _finish() -> void:
	for row in _rows:
		print(row)
	print("RESULTADO: ", "OK" if _failures.is_empty() else "FALHOU (%d)" % _failures.size())
	get_tree().quit(0 if _failures.is_empty() else 1)
