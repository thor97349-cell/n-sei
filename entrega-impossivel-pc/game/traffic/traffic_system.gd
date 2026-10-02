class_name TrafficSystem
extends Node3D
## Trânsito da IA: carros andam na faixa da esquerda de cada mão (a da direita fica
## livre para as vagas de carga), seguem reto ou viram à direita nos cruzamentos,
## respeitam o semáforo, mantêm distância do carro da frente e do jogador e param
## antes de acidentes. Os carros aparecem e somem em volta do jogador.
##
## Também detecta quando o JOGADOR avança o sinal vermelho (multa).
##
## Batidas: para a física, os carros da IA andam "em trilhos" (como se tivessem massa
## infinita). Quando o jogador (ou um destroço) bate num deles, `ram` refaz a batida com
## as massas de verdade; numa pancada forte o carro vira um TrafficWreck (corpo solto).

signal red_light_run
## Batida entre um destroço e outro carro do trânsito (para faíscas e som).
signal crash(point: Vector3, normal: Vector3, strength: float)

static var current: TrafficSystem

const LANE_OFFSET := CityLayout.LANE_WIDTH / 2.0
## Distância da linha de retenção até o fim do trecho de rua (igual ao shader da rua).
const STOP_LINE := 5.3
const TURN_SPEED := 6.5
const ACCEL := 2.3
const BRAKE := 5.5
const SPAWN_MIN := 80.0
const SPAWN_MAX := 360.0
const DESPAWN := 470.0
const TICK := 1.0 / 60.0
## Tolerância logo depois que o sinal fica vermelho (quem já estava em cima da faixa).
const RED_GRACE := 0.6
## Coeficiente de restituição das batidas entre carros (0 = grudam, 1 = bola de bilhar).
const RESTITUTION := 0.2
## Variação de velocidade (m/s) a partir da qual o carro batido vira destroço solto.
const WRECK_MIN_DV := 2.0
const MAX_WRECKS := 8

var graph: RoadGraph
var lights: TrafficLights
var player: Vehicle
var camera: Camera3D
## Obstáculos fixos na pista (acidentes).
var obstacles: Array[Vector3] = []
var night := false
var target_count := 22

var _cars: Array[TrafficCar] = []
var _wrecks: Array[TrafficWreck] = []
var _rng := RandomNumberGenerator.new()
var _accum := 0.0
var _frame := 0
var _focus := Vector3.ZERO
var _player_track := {}
var _fine_cooldown := 0.0
## Cruzamentos já multados: "nó:eixo" → número da fase vermelha em que a multa saiu.
var _fined := {}


func _enter_tree() -> void:
	current = self


func _exit_tree() -> void:
	if current == self:
		current = null


func setup(road_graph: RoadGraph, traffic_lights: TrafficLights) -> void:
	graph = road_graph
	lights = traffic_lights
	_rng.randomize()
	apply_settings()
	if not Bus.settings_changed.is_connected(apply_settings):
		Bus.settings_changed.connect(apply_settings)


func apply_settings() -> void:
	var density: float = Settings.get_value("game/traffic_density")
	target_count = roundi(float(Settings.quality()["traffic_cars"]) * density)


func set_player(vehicle: Vehicle) -> void:
	player = vehicle
	_player_track = {}
	if player and not player.impacted.is_connected(_on_player_impact):
		player.impacted.connect(_on_player_impact)


func car_count() -> int:
	return _cars.size()


func wrecks() -> Array[TrafficWreck]:
	return _wrecks


## Põe na lista um carro já montado e posicionado (para testes: sem rede de ruas, ele fica
## parado onde está, mas pode ser atingido e virar destroço).
func adopt(car: TrafficCar) -> void:
	_cars.append(car)


## Preenche a cidade de uma vez (início do jogo), longe do ponto informado.
func fill(around: Vector3) -> void:
	_focus = around
	var attempts := 0
	while _cars.size() < target_count and attempts < target_count * 20:
		attempts += 1
		_try_spawn(25.0)


func clear() -> void:
	for car in _cars:
		car.queue_free()
	_cars.clear()
	for wreck in _wrecks:
		wreck.queue_free()
	_wrecks.clear()


func _physics_process(delta: float) -> void:
	if graph == null:
		return
	_accum += delta
	if _accum < TICK:
		return
	var dt := _accum
	_accum = 0.0
	_frame += 1
	if player and is_instance_valid(player):
		_focus = player.global_position
	elif camera:
		_focus = camera.global_position
	if _frame % 15 == 0:
		_maintain_population()
	for car in _cars:
		_update_car(car, dt)
	for wreck in _wrecks:
		wreck.night = night
	_fine_cooldown = maxf(_fine_cooldown - dt, 0.0)
	if player and is_instance_valid(player):
		_check_red_light()


# --- população -----------------------------------------------------------------------

func _maintain_population() -> void:
	for car: TrafficCar in _cars.duplicate():
		var distance := car.global_position.distance_to(_focus)
		var hidden := camera == null or not camera.is_position_in_frustum(car.global_position)
		if distance > DESPAWN or (car.stuck_time > 45.0 and distance > 60.0 and hidden) or (car.next_edge == null and not car.turning and car.s > car.edge.length - 20.0 and hidden):
			_cars.erase(car)
			car.queue_free()
	# Destroços: somem quando ficam longe, ou parados há um tempo fora da vista.
	for wreck: TrafficWreck in _wrecks.duplicate():
		var distance := wreck.global_position.distance_to(_focus)
		var hidden := camera == null or not camera.is_position_in_frustum(wreck.global_position)
		if distance > DESPAWN or (hidden and distance > 40.0 and (wreck.still_time > 25.0 or wreck.age > 120.0)):
			_wrecks.erase(wreck)
			wreck.queue_free()
	var spawned := 0
	while _cars.size() < target_count and spawned < 2:
		if _try_spawn(SPAWN_MIN):
			spawned += 1
		else:
			break


func _try_spawn(min_distance: float) -> bool:
	for attempt in 12:
		var edge: RoadGraph.Edge = graph.edges[_rng.randi() % graph.edges.size()]
		if not edge.traffic or edge.blocked:
			continue
		var direction := 1 if _rng.randf() < 0.5 else -1
		var start_half := graph.crossing_width(_start_node(edge, direction), edge) / 2.0
		var end_half := graph.crossing_width(_end_node_of(edge, direction), edge) / 2.0
		var low := start_half + 6.0
		var high := edge.length - end_half - 16.0
		if high <= low:
			continue
		var s := _rng.randf_range(low, high)
		var point := _lane_point(edge, direction, s)
		var distance := point.distance_to(Vector3(_focus.x, 0, _focus.z))
		if distance < min_distance or distance > SPAWN_MAX:
			continue
		if camera and distance < 200.0 and camera.is_position_in_frustum(point):
			continue
		var crowded := false
		for other in _cars:
			if other.global_position.distance_to(point) < 14.0:
				crowded = true
				break
		for obstacle in obstacles:
			if obstacle.distance_to(point) < 30.0:
				crowded = true
		if crowded:
			continue
		var car := TrafficCar.new()
		car.setup(TrafficCar.random_style(_rng), _rng.randi() % TrafficCar.COLORS.size())
		add_child(car)
		car.edge = edge
		car.direction = direction
		car.s = s
		car.scan_offset = _rng.randi() % 3
		car.target_speed = (22.0 if edge.highway else 13.9) * _rng.randf_range(0.85, 1.05)
		car.speed = car.target_speed * 0.7
		_choose_next(car)
		car.place(point, edge.dir * direction)
		car.reset_physics_interpolation()
		_cars.append(car)
		return true
	return false


# --- geometria da rota --------------------------------------------------------------------

func _start_node(edge: RoadGraph.Edge, direction: int) -> int:
	return edge.a if direction > 0 else edge.b


func _end_node_of(edge: RoadGraph.Edge, direction: int) -> int:
	return edge.b if direction > 0 else edge.a


func _lane_point(edge: RoadGraph.Edge, direction: int, s: float) -> Vector3:
	var start := edge.from if direction > 0 else edge.to
	var d := edge.dir * float(direction)
	var right := Vector3(-d.z, 0, d.x)
	return start + d * s + right * LANE_OFFSET


func _choose_next(car: TrafficCar) -> void:
	var node := _end_node_of(car.edge, car.direction)
	var d_in := car.edge.dir * float(car.direction)
	var right_in := Vector3(-d_in.z, 0, d_in.x)
	var allowed: Array = []
	var lefts: Array = []
	for index: int in graph.node_edges[node]:
		var option: RoadGraph.Edge = graph.edges[index]
		if option == car.edge or not option.traffic or option.blocked:
			continue
		var option_direction := 1 if option.a == node else -1
		var d_out := option.dir * float(option_direction)
		if d_out.dot(d_in) > 0.9:
			allowed.append([option, option_direction, 0.62])
		elif d_out.dot(right_in) > 0.9:
			allowed.append([option, option_direction, 0.38])
		else:
			lefts.append([option, option_direction, 1.0])
	# Esquinas do anel só têm a curva à esquerda (sem tráfego cruzando).
	if allowed.is_empty():
		allowed = lefts
	car.next_edge = null
	if allowed.is_empty():
		return
	var total := 0.0
	for entry: Array in allowed:
		total += float(entry[2])
	var roll := _rng.randf() * total
	for entry: Array in allowed:
		roll -= float(entry[2])
		if roll <= 0.0:
			car.next_edge = entry[0]
			car.next_direction = entry[1]
			return
	car.next_edge = allowed[0][0]
	car.next_direction = allowed[0][1]


func _begin_turn(car: TrafficCar) -> void:
	var node := _end_node_of(car.edge, car.direction)
	var node_position := graph.nodes[node]
	var d_in := car.edge.dir * float(car.direction)
	var d_out := car.next_edge.dir * float(car.next_direction)
	var right_in := Vector3(-d_in.z, 0, d_in.x)
	var right_out := Vector3(-d_out.z, 0, d_out.x)
	var p0 := _lane_point(car.edge, car.direction, car.s)
	var p2 := _lane_point(car.next_edge, car.next_direction, graph.crossing_width(node, car.next_edge) / 2.0)
	var p1 := (p0 + p2) / 2.0
	if d_in.dot(d_out) < 0.9:
		p1 = node_position + right_in * LANE_OFFSET + right_out * LANE_OFFSET
	car.turn_blinker = _turn_signal(car)
	car.turn_points = [p0, p1, p2]
	var length := 0.0
	var previous := p0
	for i in range(1, 9):
		var point := _bezier(car.turn_points, i / 8.0)
		length += previous.distance_to(point)
		previous = point
	car.turn_length = maxf(length, 0.5)
	car.turn_t = 0.0
	car.turning = true


func _bezier(points: Array[Vector3], t: float) -> Vector3:
	var u := 1.0 - t
	return points[0] * u * u + points[1] * 2.0 * u * t + points[2] * t * t


func _bezier_tangent(points: Array[Vector3], t: float) -> Vector3:
	var tangent := (points[1] - points[0]) * 2.0 * (1.0 - t) + (points[2] - points[1]) * 2.0 * t
	return tangent.normalized() if tangent.length() > 0.001 else Vector3.FORWARD


# --- direção de cada carro --------------------------------------------------------------------

func _stop_speed(distance: float) -> float:
	return sqrt(maxf(distance, 0.0) * 2.0 * BRAKE * 0.8)


## Seta da próxima conversão (Blinker.LEFT/RIGHT) ou NONE se for seguir reto.
func _turn_signal(car: TrafficCar) -> int:
	if car.next_edge == null:
		return CarLights.Blinker.NONE
	var d_in := car.edge.dir * float(car.direction)
	var d_out := car.next_edge.dir * float(car.next_direction)
	if d_in.dot(d_out) > 0.9:
		return CarLights.Blinker.NONE
	return CarLights.Blinker.RIGHT if d_in.cross(d_out).y < 0.0 else CarLights.Blinker.LEFT


func _update_car(car: TrafficCar, dt: float) -> void:
	if car.crashed_time > 0.0:
		car.crashed_time -= dt
		car.speed = 0.0
		car.show_brake(true, night)
		car.show_signal(CarLights.Blinker.HAZARD, CarLights.blink_lit())
		return
	if (_frame + car.scan_offset) % 3 == 0:
		car.obstacle_distance = _scan_ahead(car)
	var desired := car.target_speed
	if car.turning:
		desired = minf(desired, TURN_SPEED)
	else:
		var node := _end_node_of(car.edge, car.direction)
		var end_half := graph.crossing_width(node, car.edge) / 2.0
		var to_box := car.edge.length - end_half - car.s
		if car.next_edge == null:
			desired = minf(desired, _stop_speed(to_box - 4.0))
		elif (car.next_edge.dir * float(car.next_direction)).dot(car.edge.dir * float(car.direction)) < 0.9:
			desired = minf(desired, TURN_SPEED + maxf(to_box, 0.0) * 0.3)
		if graph.has_traffic_lights(node):
			var state := lights.state(car.edge.axis)
			if state != "green":
				var stop_distance := to_box - STOP_LINE - car.length / 2.0 - 0.4
				var needed := car.speed * car.speed / (2.0 * BRAKE)
				if stop_distance > -0.5 and (state == "red" or stop_distance > needed * 0.8):
					desired = minf(desired, _stop_speed(stop_distance))
	if car.obstacle_distance < INF:
		desired = minf(desired, _stop_speed(car.obstacle_distance - car.length / 2.0 - 2.2))
	if desired < car.speed:
		car.speed = maxf(desired, car.speed - BRAKE * 1.8 * dt)
	else:
		car.speed = minf(desired, car.speed + ACCEL * dt)
	car.stuck_time = car.stuck_time + dt if car.speed < 0.3 else 0.0
	car.show_brake(desired < car.speed - 0.2 or car.speed < 0.5, night)

	var distance := car.speed * dt
	var position: Vector3
	var forward: Vector3
	var steer := 0.0
	if car.turning:
		car.turn_t = minf(car.turn_t + distance / car.turn_length, 1.0)
		position = _bezier(car.turn_points, car.turn_t)
		forward = _bezier_tangent(car.turn_points, car.turn_t)
		var d_in := car.edge.dir * float(car.direction)
		steer = -signf(d_in.cross(forward).y) * 0.35 if d_in.dot(forward) < 0.99 else 0.0
		if car.turn_t >= 1.0:
			var node := _end_node_of(car.edge, car.direction)
			car.edge = car.next_edge
			car.direction = car.next_direction
			car.s = graph.crossing_width(node, car.edge) / 2.0
			car.turning = false
			car.target_speed = (22.0 if car.edge.highway else 13.9) * _rng.randf_range(0.85, 1.05)
			_choose_next(car)
	else:
		car.s += distance
		var node := _end_node_of(car.edge, car.direction)
		var end_half := graph.crossing_width(node, car.edge) / 2.0
		if car.s >= car.edge.length - end_half:
			car.s = car.edge.length - end_half
			if car.next_edge != null and not car.next_edge.blocked:
				_begin_turn(car)
			elif car.next_edge != null:
				_choose_next(car)
		position = _lane_point(car.edge, car.direction, car.s)
		forward = car.edge.dir * float(car.direction)
	car.place(position, forward)
	car.spin_wheels(distance, steer)
	# Seta ligada uns 40 m antes da esquina e durante a curva (desliga no fim dela).
	var blinker := CarLights.Blinker.NONE
	if car.turning:
		if car.turn_t < 0.8:
			blinker = car.turn_blinker
	else:
		var to_end := car.edge.length - graph.crossing_width(_end_node_of(car.edge, car.direction), car.edge) / 2.0 - car.s
		if to_end < 40.0:
			blinker = _turn_signal(car)
	car.show_signal(blinker, CarLights.blink_lit())


## Distância (do centro do carro) até o obstáculo mais próximo à frente, na mesma faixa.
func _scan_ahead(car: TrafficCar) -> float:
	var origin := car.global_position
	var forward := car.global_basis.z
	forward.y = 0.0
	forward = forward.normalized()
	var right := Vector3(-forward.z, 0, forward.x)
	var look := 6.0 + car.speed * 2.2 + car.length
	var width := 1.7 if not car.turning else 2.2
	var best := INF
	for other in _cars:
		if other == car:
			continue
		var relative := other.global_position - origin
		var ahead := relative.dot(forward)
		if ahead <= 0.0 or ahead > look + other.length:
			continue
		if absf(relative.dot(right)) < width:
			best = minf(best, ahead - other.length / 2.0)
	if player and is_instance_valid(player):
		var relative := player.global_position - origin
		var ahead := relative.dot(forward)
		if ahead > 0.0 and ahead < look + 5.0 and absf(relative.dot(right)) < 2.4:
			best = minf(best, ahead - float(player.spec.get("length", 4.5)) / 2.0)
	for obstacle in obstacles:
		var relative := obstacle - origin
		relative.y = 0.0
		var ahead := relative.dot(forward)
		if ahead > 0.0 and ahead < look + 8.0 and absf(relative.dot(right)) < 4.0:
			best = minf(best, ahead - 6.0)
	for wreck in _wrecks:
		var relative := wreck.global_position - origin
		var ahead := relative.dot(forward)
		if ahead > 0.0 and ahead < look + wreck.length and absf(relative.dot(right)) < 2.2:
			best = minf(best, ahead - wreck.length / 2.0)
	return best


# --- batidas --------------------------------------------------------------------------------

## Batida de um corpo solto (`body`: o jogador ou um destroço, com a velocidade de antes da
## batida e a massa) no carro `car`, no ponto `point`. Faz a troca de quantidade de
## movimento como se os dois fossem soltos e devolve {"velocity": nova velocidade de quem
## bateu}; numa pancada forte o carro vira destroço (no fim do quadro). Pancada fraca (ou
## sem aproximação) devolve {}: o carro só para com o pisca-alerta e a física cuida do resto.
func ram(body: Node3D, velocity: Vector3, body_mass: float, car: TrafficCar, point: Vector3) -> Dictionary:
	if not is_instance_valid(car) or car.wrecked:
		return {}
	# Normal da batida: a face da caixa do carro mais perto do ponto de contato.
	var local := car.global_transform.affine_inverse() * point
	var half_width := float(car.spec["width"]) / 2.0
	var half_length := car.length / 2.0
	var normal_local := Vector3(signf(local.x), 0, 0) if absf(local.x) / half_width > absf(local.z) / half_length else Vector3(0, 0, signf(local.z))
	var normal := car.global_basis * normal_local
	normal.y = 0.0
	if normal.length_squared() < 0.01:
		return {}
	normal = normal.normalized()
	var car_velocity := car.global_basis.z * car.speed
	var approach := (velocity - car_velocity).dot(normal)
	if approach > -0.5:
		return {}
	var car_mass := float(car.spec.get("mass", 1300.0))
	var impulse := -(1.0 + RESTITUTION) * approach / (1.0 / body_mass + 1.0 / car_mass)
	var car_change := impulse / car_mass
	car.crashed_time = maxf(car.crashed_time, 6.0)
	if car_change < WRECK_MIN_DV:
		return {}
	car.wrecked = true
	# Batida fora do centro faz o carro girar.
	var arm := point - car.global_position
	arm.y = 0.0
	var width := half_width * 2.0
	var inertia := car_mass * (car.length * car.length + width * width) / 12.0
	var spin := clampf(arm.cross(-normal * impulse).y / inertia, -3.0, 3.0)
	_make_wreck.call_deferred(car, car_velocity - normal * car_change, spin, -normal * car_change)
	if body is TrafficWreck:
		crash.emit(point, normal, car_change)
	return {"velocity": velocity + normal * impulse / body_mass}


func _make_wreck(car: TrafficCar, velocity: Vector3, spin: float, push: Vector3) -> void:
	if not is_instance_valid(car) or not _cars.has(car):
		return
	_cars.erase(car)
	car.disable_collision()
	var wreck := TrafficWreck.new()
	wreck.name = "Wreck"
	add_child(wreck)
	wreck.setup_from(car)
	wreck.night = night
	wreck.hit(velocity, spin, push)
	car.queue_free()
	_wrecks.append(wreck)
	while _wrecks.size() > MAX_WRECKS:
		var old: TrafficWreck = _wrecks.pop_front()
		old.queue_free()


func _on_player_impact(strength: float) -> void:
	if strength < 2.5 or player == null:
		return
	for car in _cars:
		if car.global_position.distance_to(player.global_position) < car.length / 2.0 + 4.0:
			car.crashed_time = 6.0


# --- multa por avançar o sinal ------------------------------------------------------------------

func _check_red_light() -> void:
	var position := player.global_position
	var result := graph.nearest_edge(position)
	var edge: RoadGraph.Edge = result[0]
	if edge == null or float(result[2]) > edge.width / 2.0:
		_player_track = {}
		return
	var velocity := player.linear_velocity
	var along_speed := velocity.dot(edge.dir)
	if absf(along_speed) < 3.0:
		return
	var direction := 1 if along_speed > 0.0 else -1
	var s: float = result[1] if direction > 0 else edge.length - float(result[1])
	var node := _end_node_of(edge, direction)
	# Só vale para quem está na mão certa, indo em direção ao cruzamento.
	var d := edge.dir * float(direction)
	var right := Vector3(-d.z, 0, d.x)
	var center: Vector3 = edge.from + edge.dir * float(result[1])
	var on_right_side := (position - center).dot(right) > 0.0
	var key := "%d:%d" % [edge.index, direction]
	var previous: float = _player_track.get(key, -1.0)
	_player_track = {key: s}
	if previous < 0.0 or not on_right_side or not graph.has_traffic_lights(node):
		return
	var stop_s := edge.length - graph.crossing_width(node, edge) / 2.0 - STOP_LINE
	if previous >= stop_s or s < stop_s or lights.state(edge.axis) != "red":
		return
	# Uma multa só por cruzamento em cada sinal vermelho (dar ré e passar de novo não
	# multa outra vez), e uma pequena tolerância para quem pegou o vermelho em cima da faixa.
	var fined_key := "%d:%s" % [node, edge.axis]
	var serial := lights.red_serial(edge.axis)
	if lights.red_for(edge.axis) < RED_GRACE or _fine_cooldown > 0.0 or int(_fined.get(fined_key, -1)) == serial:
		return
	_fined[fined_key] = serial
	_fine_cooldown = 6.0
	red_light_run.emit()
