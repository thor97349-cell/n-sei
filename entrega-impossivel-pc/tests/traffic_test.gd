extends Node3D
## Teste automático do trânsito (sem tela): monta a cidade inteira, enche de carros e
## simula alguns minutos. Verifica: carros continuam andando (sem travar a cidade),
## nenhum carro atravessa outro e ninguém da IA avança o sinal vermelho.
## Uso: godot --headless --fixed-fps 60 --path . res://tests/traffic_test.tscn [-- segundos]

var _world: World
var _camera: Camera3D
var _time := 0.0
var _duration := 180.0
var _samples := 0
var _moving_sum := 0.0
var _overlaps := 0
var _red_runs := 0
var _max_stuck := 0.0
var _last_s := {}
var _distance := 0.0
var _positions := {}


func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0:
		_duration = float(args[0])
	_world = World.new()
	add_child(_world)
	_camera = Camera3D.new()
	add_child(_camera)
	_camera.position = Vector3(0, 30, 0)
	_world.set_camera(_camera)
	_world.traffic.target_count = 36
	_world.traffic.fill(Vector3.ZERO)
	print("carros criados: ", _world.traffic.car_count())


func _process(_delta: float) -> void:
	if OS.has_environment("TT_PROFILE") and Engine.get_process_frames() % 60 == 0:
		print("frame %d: process %.1f ms, physics %.1f ms" % [Engine.get_process_frames(), Performance.get_monitor(Performance.TIME_PROCESS) * 1000.0, Performance.get_monitor(Performance.TIME_PHYSICS_PROCESS) * 1000.0])


func _physics_process(delta: float) -> void:
	_time += delta
	var traffic := _world.traffic
	var cars: Array = traffic.get_children().filter(func(n: Node) -> bool: return n is TrafficCar and not n.is_queued_for_deletion())
	if int(_time * 10) % 10 == 0 and fmod(_time, 1.0) < delta:
		_samples += 1
		var moving := 0
		for car: TrafficCar in cars:
			if car.speed > 1.0:
				moving += 1
			_max_stuck = maxf(_max_stuck, car.stuck_time)
		_moving_sum += float(moving) / maxf(cars.size(), 1)
		# Carros sobrepostos (um dentro do outro).
		for i in cars.size():
			for j in range(i + 1, cars.size()):
				var a: TrafficCar = cars[i]
				var b: TrafficCar = cars[j]
				var gap := a.global_position.distance_to(b.global_position)
				if gap < 2.2:
					_overlaps += 1
	for car: TrafficCar in cars:
		var id := car.get_instance_id()
		if _positions.has(id):
			_distance += (car.global_position - Vector3(_positions[id])).length()
		_positions[id] = car.global_position
		if car.turning or car.edge == null:
			_last_s.erase(id)
			continue
		var node := car.edge.b if car.direction > 0 else car.edge.a
		if not _world.graph.has_traffic_lights(node):
			continue
		var stop_s := car.edge.length - _world.graph.crossing_width(node, car.edge) / 2.0 - TrafficSystem.STOP_LINE
		var front := car.s + car.length / 2.0
		var key := "%d" % id
		var previous: float = _last_s.get(key, -1.0)
		_last_s[key] = front
		if previous >= 0.0 and previous < stop_s and front >= stop_s and _world.lights.state(car.edge.axis) == "red":
			_red_runs += 1
			print("vermelho: t=%.1f carro v=%.1f antes=%.2f frente=%.2f linha=%.2f obst=%.1f vermelho há %.1f s" % [_time, car.speed, previous, front, stop_s, car.obstacle_distance, _world.lights.since_change])
	if _time >= _duration:
		var moving_ratio := _moving_sum / maxf(_samples, 1)
		print("simulados %.0f s | carros: %d | andando em média: %.0f%% | km rodados pela IA: %.1f | maior tempo parado: %.0f s | sobreposições: %d | avanços no vermelho: %d" % [
			_time, cars.size(), moving_ratio * 100.0, _distance / 1000.0, _max_stuck, _overlaps, _red_runs])
		var ok := moving_ratio > 0.35 and _overlaps == 0 and _red_runs == 0 and _max_stuck < 60.0
		print("RESULTADO: ", "OK" if ok else "FALHOU")
		get_tree().quit(0 if ok else 1)
