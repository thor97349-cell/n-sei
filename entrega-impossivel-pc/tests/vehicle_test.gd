extends Node3D
## Teste automático da física dos veículos (sem tela). Para cada veículo:
## assentamento na suspensão, 0–100 km/h, velocidade máxima, frenagem de 100 a 0,
## aceleração lateral máxima em curva e estabilidade em zigue-zague.
## Uso: godot --headless --fixed-fps 120 --path . res://tests/vehicle_test.tscn [-- id]

var _ids: Array = []
var _vehicle: Vehicle
var _phase := ""
var _time := 0.0
var _data := {}
var _results := {}
var _failures: Array[String] = []


func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	_ids = [args[0]] if args.size() > 0 else VehicleSpecs.ORDER.duplicate()
	var ground := StaticBody3D.new()
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(6000, 2, 6000)
	shape.shape = box
	shape.position.y = -1.0
	ground.add_child(shape)
	add_child(ground)
	_next_vehicle()


func _next_vehicle() -> void:
	if _vehicle:
		_vehicle.queue_free()
		_vehicle = null
	if _ids.is_empty():
		_finish()
		return
	var id: String = _ids.pop_front()
	_vehicle = Vehicle.new()
	_vehicle.setup(id, Color(0, 0, 0, 0), false)
	_vehicle.use_player_input = false
	add_child(_vehicle)
	_vehicle.place(Transform3D(Basis(), Vector3(0, 0, -2500)))
	_results[id] = {}
	_set_phase("settle")


func _set_phase(phase: String) -> void:
	_phase = phase
	_time = 0.0
	_data = {}


func _controls(throttle: float, brake: float, steer: float) -> void:
	_vehicle.input_throttle = throttle
	_vehicle.input_brake = brake
	_vehicle.input_steer = steer


func _physics_process(delta: float) -> void:
	if _vehicle == null:
		return
	_time += delta
	var r: Dictionary = _results[_vehicle.id]
	var kmh := _vehicle.speed * 3.6
	if _vehicle.is_flipped():
		_failures.append("%s capotou na fase %s" % [_vehicle.id, _phase])
		_next_vehicle()
		return
	match _phase:
		"settle":
			_controls(0, 0, 0)
			if _time > 2.0:
				r["height"] = _vehicle.global_position.y
				for child in _vehicle.get_children():
					if child is VehicleWheel3D:
						r["wheel_y"] = child.global_position.y
						if OS.has_environment("VT_DEBUG"):
							print(_vehicle.id, " roda ", child.name, " y=", child.global_position.y, " contato=", child.get_contact_point() if child.has_method("get_contact_point") else "?", " raio=", child.wheel_radius)
				if OS.has_environment("VT_DEBUG"):
					print(_vehicle.id, " corpo y=", _vehicle.global_position.y, " offset=", _vehicle.ground_offset)
				r["expected_height"] = _vehicle.ground_offset
				var sink := float(VehicleSpecs.get_spec(_vehicle.id)["wheel_radius"]) - float(r["wheel_y"])
				if absf(sink) > 0.02:
					_failures.append("%s: pneu %.3f m dentro do chão" % [_vehicle.id, sink])
				if absf(_vehicle.global_position.y - _vehicle.ground_offset) > 0.02:
					_failures.append("%s: altura parado %.3f ≠ esperado %.3f" % [_vehicle.id, _vehicle.global_position.y, _vehicle.ground_offset])
				r["pitch"] = rad_to_deg(_vehicle.global_rotation.x)
				_set_phase("accelerate")
		"accelerate":
			_controls(1, 0, 0)
			if OS.has_environment("VT_DEBUG") and fmod(_time, 2.0) < delta:
				var skid := []
				var forces := []
				for child in _vehicle.get_children():
					if child is VehicleWheel3D:
						skid.append(snappedf(child.get_skidinfo(), 0.01))
						forces.append([snappedf(child.engine_force, 1), snappedf(child.brake, 0.01), child.is_in_contact()])
				print("t=%.0f v=%.1f g=%d rpm=%.0f skid=%s f=%s" % [_time, kmh, _vehicle.gear, _vehicle.rpm, skid, forces])
			if kmh >= 100.0 and not r.has("0_100"):
				r["0_100"] = _time
			if _time > 45.0 or (kmh > float(_vehicle.spec["limiter_kmh"]) - 1.5 and _time > 8.0):
				r["top_kmh"] = kmh
				r["top_gear"] = _vehicle.gear
				_set_phase("to_100")
		"to_100":
			# Mantém ~100 km/h e freia de uma vez.
			_controls(0, 0.4 if kmh > 101.0 else 0.0, 0)
			if kmh <= 101.0:
				_data["start"] = _vehicle.global_position
				_set_phase("brake")
				_data["start"] = _vehicle.global_position
		"brake":
			_controls(0, 1, 0)
			if _vehicle.speed < 0.3:
				r["brake_100_0_m"] = (_vehicle.global_position - Vector3(_data["start"])).length()
				r["brake_time"] = _time
				_set_phase("skidpad")
		"skidpad":
			# Acelera até 50 km/h e esterça tudo; mede a aceleração lateral.
			var target := 50.0
			_controls(clampf((target - kmh) * 0.15, 0, 1), 0, 1.0 if _time > 6.0 else 0.0)
			if _time > 9.0:
				var lateral := absf(_vehicle.angular_velocity.y * _vehicle.linear_velocity.length())
				_data["max_lat"] = maxf(float(_data.get("max_lat", 0.0)), lateral)
			if _time > 14.0:
				r["lateral_g"] = float(_data.get("max_lat", 0.0)) / 9.8
				r["skidpad_kmh"] = kmh
				_set_phase("slalom")
		"slalom":
			var target := 70.0
			var steer := sin(_time * 2.4) if _time > 5.0 else 0.0
			_controls(clampf((target - kmh) * 0.15, 0, 1), 0, steer)
			_data["max_roll"] = maxf(float(_data.get("max_roll", 0.0)), absf(rad_to_deg(_vehicle.global_rotation.z)))
			if _time > 14.0:
				r["slalom_max_roll"] = _data["max_roll"]
				_set_phase("reverse")
		"reverse":
			# Para, segura o freio (engata a ré) e dá ré.
			_controls(0, 1, 0)
			if _time > 7.0:
				_data["reversed"] = true
			if _vehicle.gear < 0 and _time > 7.5:
				r["reverse_kmh"] = kmh
				r["fuel_left"] = _vehicle.fuel
				_next_vehicle()


func _finish() -> void:
	for id: String in _results:
		var r: Dictionary = _results[id]
		print("%-6s altura %.2f (esp. %.2f) | 0-100 %s s | máx %s km/h (%sª) | frenagem 100-0 %s m | lateral %s g | rolagem %s° | ré %s km/h" % [
			id, r.get("height", -1.0), r.get("expected_height", -1.0),
			_fmt(r.get("0_100")), _fmt(r.get("top_kmh")), r.get("top_gear", "?"),
			_fmt(r.get("brake_100_0_m")), _fmt(r.get("lateral_g")), _fmt(r.get("slalom_max_roll")), _fmt(r.get("reverse_kmh"))])
	for failure in _failures:
		print("FALHA: ", failure)
	print("RESULTADO: ", "OK" if _failures.is_empty() else "FALHOU")
	get_tree().quit(0 if _failures.is_empty() else 1)


func _fmt(value: Variant) -> String:
	if value == null:
		return "—"
	return "%.2f" % float(value)
