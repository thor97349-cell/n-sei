extends Node3D
## Teste automático dos pedestres (sem tela): monta a cidade, descobre os trechos livres
## das calçadas e simula um minuto. Verifica:
##   • todo mundo fica na calçada (nunca na rua, nunca dentro de prédio, poste ou árvore)
##     e ninguém anda "dentro" de outra pessoa;
##   • um carro andando pela calçada a 30 km/h não passa por dentro de ninguém.
## Uso: godot --headless --fixed-fps 60 --path . res://tests/pedestrian_test.tscn

const WALK_SECONDS := 60.0
const DRIVE_SPEED := 30.0 / 3.6

var _world: World
var _camera: Camera3D
var _stage := "scan"
var _time := 0.0
var _next_check := 0.0
var _checks := 0
var _off_sidewalk := 0
var _inside := 0
var _crowded := 0
var _vehicle: Vehicle
var _run_end := Vector3.ZERO
var _run_dir := Vector3.ZERO
var _query: PhysicsShapeQueryParameters3D
var _failures: Array[String] = []


func _ready() -> void:
	_world = World.new()
	add_child(_world)
	_camera = Camera3D.new()
	add_child(_camera)
	_camera.position = Vector3(60, 25, -150)
	_world.set_camera(_camera)
	var cylinder := CylinderShape3D.new()
	cylinder.radius = 0.2
	cylinder.height = 1.2
	_query = PhysicsShapeQueryParameters3D.new()
	_query.shape = cylinder


func _physics_process(delta: float) -> void:
	_time += delta
	var people := _world.pedestrians
	match _stage:
		"scan":
			if people.is_ready():
				var total := 0.0
				for segment in people.segments():
					total += segment.length()
				print("trechos de calçada livres: %d (%.1f km), descobertos em %.1f s" % [people.segments().size(), total / 1000.0, _time])
				people.fill(_camera.position)
				print("pedestres: %d (pontos de ônibus: %d)" % [people.count(), _world.info.bus_stops.size()])
				if people.count() < 10:
					_failures.append("poucos pedestres (%d)" % people.count())
				_stage = "walk"
				_time = 0.0
			elif _time > 30.0:
				_failures.append("a descoberta das calçadas não terminou")
				_finish()
		"walk":
			if _time >= _next_check:
				_next_check = _time + 0.5
				_check_positions(people)
			if _time > WALK_SECONDS:
				print("posições verificadas: %d | fora da calçada: %d | dentro de objetos: %d | pessoas uma dentro da outra: %d" % [_checks, _off_sidewalk, _inside, _crowded])
				if _crowded > _checks / 200:
					_failures.append("%d vezes duas pessoas uma dentro da outra" % _crowded)
				if _off_sidewalk > 0:
					_failures.append("%d posições fora da calçada" % _off_sidewalk)
				if _inside > 0:
					_failures.append("%d posições dentro de objetos" % _inside)
				_start_drive(people)
		"drive":
			var error := DRIVE_SPEED - _vehicle.speed
			_vehicle.input_throttle = clampf(error * 0.5, 0.0, 1.0)
			_vehicle.input_brake = clampf(-error * 0.3, 0.0, 1.0)
			if (_run_end - _vehicle.global_position).dot(_run_dir) < 6.0 or _time > 20.0:
				print("carro na calçada: %.0f m a %.0f km/h | encostou em alguém: %d vez(es) | pedestres restantes: %d" % [_time * DRIVE_SPEED, _vehicle.speed * 3.6, people.touches, people.count()])
				if people.touches > 0:
					_failures.append("o carro encostou em pedestres %d vez(es)" % people.touches)
				_finish()


func _check_positions(people: Pedestrians) -> void:
	var space := get_world_3d().direct_space_state
	var points := people.positions()
	# Duas pessoas uma "dentro" da outra.
	for i in points.size():
		for j in range(i + 1, points.size()):
			if points[i].distance_to(points[j]) < 0.4:
				_crowded += 1
	for point in points:
		_checks += 1
		var on_sidewalk := false
		for block in CityLayout.blocks():
			var bmin: Vector2 = block["min"]
			var bmax: Vector2 = block["max"]
			if not CityLayout.in_rect(Vector2(point.x, point.z), bmin, bmax):
				continue
			var edge := minf(minf(point.x - bmin.x, bmax.x - point.x), minf(point.z - bmin.y, bmax.y - point.z))
			on_sidewalk = edge > 0.5 and edge < CityLayout.SIDEWALK
		if not on_sidewalk:
			_off_sidewalk += 1
			if _off_sidewalk <= 5:
				print("  fora da calçada: ", point)
		_query.transform = Transform3D(Basis(), point + Vector3.UP * 0.9)
		for hit: Dictionary in space.intersect_shape(_query, 4):
			if hit["collider"] is StaticBody3D and not hit["collider"] is AnimatableBody3D:
				_inside += 1
				if _inside <= 5:
					print("  dentro de objeto: ", point)
				break


## Procura um trecho reto e comprido de calçada onde um carro cabe (sem poste nem árvore
## no caminho) e manda o carro por ele, com pessoas vindo e indo na frente.
func _start_drive(people: Pedestrians) -> void:
	_stage = "drive"
	_time = 0.0
	var space := get_world_3d().direct_space_state
	var box := BoxShape3D.new()
	var query := PhysicsShapeQueryParameters3D.new()
	query.shape = box
	var runs: Array = []
	for segment in people.segments():
		var points := segment.points
		var start := 0
		for i in range(1, points.size()):
			var straight := i < points.size() - 1 and (points[i] - points[i - 1]).normalized().dot((points[i + 1] - points[i]).normalized()) > 0.999
			if not straight:
				if i - start >= 70:
					runs.append([segment, start, i])
				start = i
	runs.sort_custom(func(a: Array, b: Array) -> bool: return int(a[2]) - int(a[1]) > int(b[2]) - int(b[1]))
	for run: Array in runs:
		var segment: Pedestrians.Segment = run[0]
		var a := segment.points[int(run[1])]
		var b := segment.points[int(run[2])]
		var direction := (b - a).normalized()
		var road: Array = _world.graph.nearest_edge(a)
		var edge: RoadGraph.Edge = road[0]
		var on_road := edge.from + edge.dir * float(road[1])
		var to_curb := Vector3(on_road.x - a.x, 0, on_road.z - a.z).normalized()
		# Carro com o lado de fora a ~1,2 m do meio-fio: passa por cima da linha das pessoas.
		var center := (a + b) / 2.0 + to_curb * 0.8
		box.size = Vector3(2.4, 1.6, a.distance_to(b))
		query.transform = Transform3D(Basis.looking_at(direction, Vector3.UP), center + Vector3.UP * 1.1)
		var blocked := space.intersect_shape(query, 4).any(func(hit: Dictionary) -> bool: return hit["collider"] is StaticBody3D and not hit["collider"] is AnimatableBody3D)
		if blocked:
			continue
		people.clear()
		var start_s := float(run[1]) * Pedestrians.SCAN_STEP
		for k in 8:
			people.add_walker(segment, start_s + 14.0 + k * 7.0, 1 if k % 2 == 0 else -1)
		_vehicle = Vehicle.new()
		_vehicle.setup("van", Color(0, 0, 0, 0), false)
		_vehicle.use_player_input = false
		add_child(_vehicle)
		var start := a + to_curb * 0.8 + direction * 4.0
		_vehicle.place(Transform3D(Basis.looking_at(-direction, Vector3.UP), start))
		_vehicle.linear_velocity = direction * DRIVE_SPEED
		_world.traffic.set_player(_vehicle)
		_run_end = b
		_run_dir = direction
		print("carro na calçada: de %s a %s (%.0f m, %d pessoas na frente)" % [a, b, a.distance_to(b), people.count()])
		return
	_failures.append("nenhum trecho reto de calçada livre para o carro")
	_finish()


func _finish() -> void:
	for failure in _failures:
		print("FALHA: ", failure)
	print("RESULTADO: ", "OK" if _failures.is_empty() else "FALHOU (%d)" % _failures.size())
	get_tree().quit(0 if _failures.is_empty() else 1)
