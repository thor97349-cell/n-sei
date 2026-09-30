class_name Pedestrians
extends Node3D
## Pedestres nas calçadas. Cada um anda num trecho livre da calçada em volta de um
## quarteirão (nunca atravessa a rua nem entra em prédios), dá meia-volta no fim do
## trecho, desvia do carro do jogador e aparece/some em volta da câmera. Alguns ficam
## parados nos pontos de ônibus. Todos são desenhados numa única MultiMesh; o passo é
## animado no shader (sem esqueleto), então custa pouco.
##
## Os trechos livres são descobertos uma vez, testando a colisão ao longo da calçada
## (postes, árvores, bancas, muretas... tudo o que tiver colisão corta o trecho).

## Distância da beira do quarteirão (meio-fio) até a linha onde as pessoas andam.
## Postes ficam a 0,7 m e árvores a 2 m do meio-fio; prédios começam a 4 m.
const INSET := 3.1
const SCAN_STEP := 1.0
const SCAN_RADIUS := 0.58
const SCAN_PER_FRAME := 500
const MIN_SEGMENT := 12.0
const SPAWN_MIN := 40.0
const SPAWN_MAX := 130.0
const DESPAWN := 160.0
const MAX_PEOPLE := 64
const WALK_CYCLE := 1.25
## Trechos onde a calçada foi coberta de asfalto (saída da frota na Central): ninguém anda
## ali, senão parece gente andando no meio da rua bem onde o jogador sai.
const NO_WALK: Array[Rect2] = [Rect2(-44.0, 58.0, 88.0, 12.0)]
const THEME_WEIGHT := {
	"downtown": 1.7, "commercial": 1.4, "plaza": 1.6, "mall": 1.3, "promenade": 1.5, "apartments": 1.2,
	"waterfront": 1.2, "school": 1.0, "park": 1.0, "residential": 0.7, "stadium": 0.7,
	"industrial": 0.25, "construction": 0.35,
}


class Segment:
	var points := PackedVector3Array()
	var closed := false
	var weight := 1.0
	var center := Vector3.ZERO
	var radius := 0.0

	func length() -> float:
		return float(points.size() - (0 if closed else 1)) * Pedestrians.SCAN_STEP

	## Posição na distância `s` e a direção do trecho ali.
	func sample(s: float) -> Array:
		var count := points.size()
		var f := s / Pedestrians.SCAN_STEP
		var i := int(floor(f))
		var t := f - float(i)
		var a: Vector3
		var b: Vector3
		if closed:
			i = posmod(i, count)
			a = points[i]
			b = points[(i + 1) % count]
		else:
			i = clampi(i, 0, count - 2)
			t = clampf(f - float(i), 0.0, 1.0)
			a = points[i]
			b = points[i + 1]
		var tangent := b - a
		return [a.lerp(b, t), tangent.normalized() if tangent.length() > 0.001 else Vector3.FORWARD]


class Person:
	var segment: Segment
	var s := 0.0
	var direction := 1
	var speed := 1.3
	var lateral := 0.0
	var side := 0.0
	var phase := 0.0
	var pause := 0.0
	var yaw := 0.0
	var scale := 1.0
	var look := Color()
	var offset := Vector3.ZERO
	var dodge := Vector3.ZERO
	var dodge_time := 0.0
	var scared := 0.0
	## Parado no ponto de ônibus (índice do ponto) ou -1.
	var stop := -1
	var position := Vector3.ZERO


var camera: Camera3D
var player: Vehicle
var night := false
var rain := 0.0
var target_count := 36
## Quantas vezes alguém encostou no carro do jogador (para os testes).
var touches := 0

var _segments: Array[Segment] = []
var _people: Array[Person] = []
var _stops: Array = []
var _stop_people := {}
var _scan: Array = []
var _scan_index := 0
var _scan_samples := PackedVector3Array()
var _scan_free: Array[bool] = []
var _scan_query: PhysicsShapeQueryParameters3D
var _ready_to_spawn := false
var _multimesh: MultiMesh
var _rng := RandomNumberGenerator.new()
var _maintain_timer := 0.0
var _fill_at := Vector3.ZERO


func setup(info: CityBuilder.CityInfo) -> void:
	_rng.randomize()
	_stops = info.bus_stops
	for block: Dictionary in CityLayout.blocks():
		_scan.append(block)
	var cylinder := CylinderShape3D.new()
	cylinder.radius = SCAN_RADIUS
	cylinder.height = 1.4
	_scan_query = PhysicsShapeQueryParameters3D.new()
	_scan_query.shape = cylinder
	_scan_query.collide_with_areas = false
	_multimesh = MultiMesh.new()
	_multimesh.transform_format = MultiMesh.TRANSFORM_3D
	_multimesh.use_custom_data = true
	_multimesh.mesh = PedestrianMesh.build()
	_multimesh.instance_count = MAX_PEOPLE
	_multimesh.visible_instance_count = 0
	var instance := MultiMeshInstance3D.new()
	instance.name = "People"
	instance.multimesh = _multimesh
	# As posições são atualizadas a cada quadro desenhado (não na física): sem interpolação.
	instance.physics_interpolation_mode = Node.PHYSICS_INTERPOLATION_MODE_OFF
	var material := ShaderMaterial.new()
	material.shader = load("res://game/world/shaders/pedestrian.gdshader")
	instance.material_override = material
	add_child(instance)
	apply_settings()
	if not Bus.settings_changed.is_connected(apply_settings):
		Bus.settings_changed.connect(apply_settings)


func apply_settings() -> void:
	target_count = int(Settings.quality().get("pedestrians", 36))


func count() -> int:
	return _people.size()


func segments() -> Array[Segment]:
	return _segments


func is_ready() -> bool:
	return _ready_to_spawn


## Posições atuais de todos (para testes e para o minimapa, se precisar).
func positions() -> Array[Vector3]:
	var result: Array[Vector3] = []
	for person in _people:
		result.append(person.position)
	return result


# --- descoberta dos trechos livres de calçada ------------------------------------------------

func _physics_process(_delta: float) -> void:
	if _ready_to_spawn:
		return
	var space := get_world_3d().direct_space_state
	var budget := SCAN_PER_FRAME
	while budget > 0 and not _scan.is_empty():
		if _scan_samples.is_empty():
			_scan_samples = _block_line(_scan[0])
			_scan_free.clear()
			_scan_index = 0
		while budget > 0 and _scan_index < _scan_samples.size():
			var point := _scan_samples[_scan_index]
			_scan_query.transform = Transform3D(Basis(), point + Vector3.UP * 0.95)
			var free := not NO_WALK.any(func(rect: Rect2) -> bool: return rect.has_point(Vector2(point.x, point.z)))
			if free:
				for hit: Dictionary in space.intersect_shape(_scan_query, 4):
					var collider: Object = hit["collider"]
					if collider is StaticBody3D and not collider is AnimatableBody3D:
						free = false
						break
			_scan_free.append(free)
			_scan_index += 1
			budget -= 1
		if _scan_index >= _scan_samples.size():
			_cut_segments(_scan.pop_front())
			_scan_samples = PackedVector3Array()
	if _scan.is_empty():
		_ready_to_spawn = true
		fill(_fill_at if player == null else player.global_position)


## Linha de caminhada do quarteirão, com um ponto a cada SCAN_STEP metros. Quarteirões
## na beira do canal não têm calçada desse lado: a linha fica aberta (em "U").
func _block_line(block: Dictionary) -> PackedVector3Array:
	var bmin: Vector2 = block["min"]
	var bmax: Vector2 = block["max"]
	var y := CityLayout.CURB_HEIGHT
	var a := Vector3(bmin.x + INSET, y, bmin.y + INSET)
	var b := Vector3(bmax.x - INSET, y, bmin.y + INSET)
	var c := Vector3(bmax.x - INSET, y, bmax.y - INSET)
	var d := Vector3(bmin.x + INSET, y, bmax.y - INSET)
	var corners: Array[Vector3] = [a, b, c, d, a]
	match block["canal_side"]:
		"S":
			c.z = bmax.y - 1.6
			d.z = bmax.y - 1.6
			corners = [d, a, b, c]
		"N":
			a.z = bmin.y + 1.6
			b.z = bmin.y + 1.6
			corners = [b, c, d, a]
	var points := PackedVector3Array()
	var carry := 0.0
	for i in corners.size() - 1:
		var from := corners[i]
		var to := corners[i + 1]
		var length := from.distance_to(to)
		var along := carry
		while along < length:
			points.append(from.lerp(to, along / length))
			along += SCAN_STEP
		carry = along - length
	if block["canal_side"] != "":
		points.append(corners[corners.size() - 1])
	return points


func _cut_segments(block: Dictionary) -> void:
	var closed_line: bool = block["canal_side"] == ""
	var count := _scan_samples.size()
	var weight: float = THEME_WEIGHT.get(block["theme"], 1.0)
	if closed_line and not _scan_free.has(false):
		_add_segment(_scan_samples, true, weight)
		return
	# Numa volta fechada, começa a contar num ponto bloqueado (o trecho não fica partido).
	var start := _scan_free.find(false) if closed_line else 0
	var run := PackedVector3Array()
	for k in count:
		var index := (start + k) % count
		if _scan_free[index]:
			run.append(_scan_samples[index])
		else:
			_add_run(run, weight)
			run = PackedVector3Array()
	_add_run(run, weight)


func _add_run(run: PackedVector3Array, weight: float) -> void:
	if float(run.size() - 1) * SCAN_STEP >= MIN_SEGMENT:
		_add_segment(run, false, weight)


func _add_segment(points: PackedVector3Array, closed: bool, weight: float) -> void:
	var segment := Segment.new()
	segment.points = points
	segment.closed = closed
	var low := points[0]
	var high := points[0]
	for point in points:
		low = Vector3(minf(low.x, point.x), 0, minf(low.z, point.z))
		high = Vector3(maxf(high.x, point.x), 0, maxf(high.z, point.z))
	segment.center = (low + high) / 2.0
	segment.radius = low.distance_to(high) / 2.0
	segment.weight = segment.length() * weight
	_segments.append(segment)


# --- população ----------------------------------------------------------------------------------

func _focus() -> Vector3:
	if player and is_instance_valid(player):
		return player.global_position
	if camera:
		return camera.global_position
	return Vector3.ZERO


func _desired_count() -> int:
	var wanted := float(target_count)
	if night:
		wanted *= 0.45
	wanted *= lerpf(1.0, 0.55, clampf(rain, 0.0, 1.0))
	return mini(roundi(wanted), MAX_PEOPLE)


func _walker_count() -> int:
	var walkers := 0
	for person in _people:
		if person.stop < 0:
			walkers += 1
	return walkers


func _maintain() -> void:
	var focus := _focus()
	for person: Person in _people.duplicate():
		if person.position.distance_to(focus) > DESPAWN:
			_remove(person)
	# Pontos de ônibus: uma ou duas pessoas esperando nos que estão por perto.
	for index in _stops.size():
		var stop: Array = _stops[index]
		var where: Vector3 = stop[0]
		var near := where.distance_to(focus) < SPAWN_MAX
		if near and not _stop_people.has(index) and not _in_view(where, 70.0):
			_populate_stop(index)
		elif not near and _stop_people.has(index) and where.distance_to(focus) > DESPAWN:
			_stop_people.erase(index)
	var wanted := _desired_count()
	var tries := 0
	while _walker_count() < wanted and tries < 3:
		tries += 1
		_spawn_walker(focus, SPAWN_MIN)


## Enche a vizinhança de uma vez (início do jogo). Se os trechos de calçada ainda
## estiverem sendo descobertos, enche assim que terminar.
func fill(around: Vector3) -> void:
	_people.clear()
	_stop_people.clear()
	_fill_at = around
	if not _ready_to_spawn:
		return
	for index in _stops.size():
		if ((_stops[index] as Array)[0] as Vector3).distance_to(around) < SPAWN_MAX:
			_populate_stop(index)
	var wanted := _desired_count()
	var tries := 0
	while _walker_count() < wanted and tries < wanted * 6:
		tries += 1
		_spawn_walker(around, 0.0)


func _in_view(point: Vector3, near: float) -> bool:
	if camera == null:
		return false
	return point.distance_to(camera.global_position) < near or camera.is_position_in_frustum(point + Vector3.UP)


func _spawn_walker(focus: Vector3, min_distance: float) -> bool:
	var candidates: Array[Segment] = []
	var total := 0.0
	for segment in _segments:
		if segment.center.distance_to(Vector3(focus.x, 0, focus.z)) - segment.radius < SPAWN_MAX:
			candidates.append(segment)
			total += segment.weight
	if candidates.is_empty():
		return false
	for attempt in 6:
		var roll := _rng.randf() * total
		var segment: Segment = candidates[0]
		for candidate in candidates:
			roll -= candidate.weight
			if roll <= 0.0:
				segment = candidate
				break
		var s := _rng.randf() * segment.length()
		var point: Vector3 = segment.sample(s)[0]
		var distance := point.distance_to(focus)
		if distance < min_distance or distance > SPAWN_MAX:
			continue
		# Quem aparece dentro da tela precisa estar longe (não "brota" na frente).
		if min_distance > 0.0 and distance < 95.0 and _in_view(point, 0.0):
			continue
		# Nem colado em outra pessoa.
		if _people.any(func(other: Person) -> bool: return other.position.distance_squared_to(point) < 4.0):
			continue
		add_walker(segment, s, 1 if _rng.randf() < 0.5 else -1)
		return true
	return false


## Coloca uma pessoa andando no trecho `segment`, na distância `s`.
func add_walker(segment: Segment, s: float, direction: int) -> void:
	if _people.size() >= MAX_PEOPLE:
		return
	var sample: Array = segment.sample(s)
	var person := Person.new()
	person.segment = segment
	person.s = s
	person.direction = direction
	person.speed = _rng.randf_range(1.05, 1.55)
	person.lateral = _rng.randf_range(0.26, 0.36)
	person.side = person.lateral * float(direction)
	person.phase = _rng.randf()
	person.scale = _rng.randf_range(0.9, 1.07)
	person.look = _random_look()
	person.position = sample[0]
	person.yaw = _yaw_of((sample[1] as Vector3) * float(direction))
	_people.append(person)


## Uma ou duas pessoas esperando no ponto de ônibus.
func _populate_stop(index: int) -> void:
	if _people.size() >= MAX_PEOPLE - 1:
		return
	_stop_people[index] = true
	for slot in (1 if _rng.randf() < 0.55 else 2):
		_spawn_waiting(index, slot)


func _spawn_waiting(stop_index: int, slot: int) -> void:
	if _people.size() >= MAX_PEOPLE:
		return
	var stop: Array = _stops[stop_index]
	var where: Vector3 = stop[0]
	var yaw: float = stop[1]
	var person := Person.new()
	person.stop = stop_index
	var side := Basis(Vector3.UP, yaw) * Vector3.RIGHT
	person.position = where + side * (-0.6 + 1.2 * slot + _rng.randf_range(-0.15, 0.15))
	person.yaw = yaw + _rng.randf_range(-0.5, 0.5)
	person.scale = _rng.randf_range(0.9, 1.07)
	person.look = _random_look()
	person.phase = _rng.randf()
	_people.append(person)


func _random_look() -> Color:
	return Color(_rng.randf(), 0, (float(_rng.randi() % 10) + 0.5) / 10.0, (float(_rng.randi() % 16) + 0.5) / 16.0)


func _remove(person: Person) -> void:
	_people.erase(person)
	if person.stop >= 0:
		var others := _people.any(func(p: Person) -> bool: return p.stop == person.stop)
		if not others:
			_stop_people.erase(person.stop)


func clear() -> void:
	_people.clear()
	_stop_people.clear()
	_multimesh.visible_instance_count = 0


static func _yaw_of(direction: Vector3) -> float:
	return atan2(direction.x, direction.z)


# --- movimento --------------------------------------------------------------------------------

func _process(delta: float) -> void:
	if not _ready_to_spawn:
		return
	_maintain_timer -= delta
	if _maintain_timer <= 0.0:
		_maintain_timer = 0.5
		_maintain()
	delta = minf(delta, 0.1)
	var danger := _player_danger()
	# Quem anda no mesmo trecho e no mesmo sentido (para manter distância de quem vai à frente).
	var lanes := {}
	for person in _people:
		if person.stop < 0:
			(lanes.get_or_add(_lane_key(person), []) as Array).append(person)
	for i in _people.size():
		var person := _people[i]
		var stride := 0.0
		var facing := person.yaw
		if person.stop >= 0:
			person.phase = fmod(person.phase + delta * 0.1, 1.0)
		else:
			var pace := person.speed * (1.25 if rain > 0.3 else 1.0)
			if person.scared > 0.0:
				person.scared -= delta
				pace = 3.2
			elif person.pause <= 0.0:
				# Alguém logo à frente no mesmo sentido: diminui o passo (e espera, se colar).
				var gap := _gap_ahead(person, lanes.get(_lane_key(person), []))
				if gap < 1.8:
					pace *= clampf((gap - 0.9) / 0.9, 0.0, 1.0)
			if person.pause > 0.0:
				person.pause -= delta
			elif pace > 0.05:
				_walk(person, pace * delta)
				stride = 1.6 if person.scared > 0.0 else clampf(pace / person.speed, 0.45, 1.0)
				person.phase = fmod(person.phase + pace * delta / WALK_CYCLE, 1.0)
			var sample: Array = person.segment.sample(person.s)
			var tangent: Vector3 = sample[1]
			var right := Vector3(-tangent.z, 0, tangent.x)
			# Mão direita: quem vai e quem vem passam cada um do seu lado.
			person.side = move_toward(person.side, person.lateral * float(person.direction), 0.6 * delta)
			person.position = (sample[0] as Vector3) + right * person.side + person.offset
			facing = _yaw_of(tangent * float(person.direction))
		if not danger.is_empty():
			_avoid(person, danger)
		if person.dodge_time > 0.0:
			person.dodge_time -= delta
			person.offset += person.dodge * delta
			person.position += person.dodge * delta
			facing = _yaw_of(person.dodge)
			stride = 1.6
			person.phase = fmod(person.phase + 3.5 * delta / WALK_CYCLE, 1.0)
		elif person.offset.length_squared() > 0.0001 and person.scared <= 0.0:
			# Passado o susto, volta para a calçada.
			person.offset = person.offset.move_toward(Vector3.ZERO, 0.9 * delta)
		person.yaw = lerp_angle(person.yaw, facing, minf(delta * 9.0, 1.0))
		var basis := Basis(Vector3.UP, person.yaw).scaled(Vector3.ONE * person.scale)
		_multimesh.set_instance_transform(i, Transform3D(basis, person.position))
		_multimesh.set_instance_custom_data(i, Color(person.phase, stride, person.look.b, person.look.a))
	_multimesh.visible_instance_count = _people.size()


func _lane_key(person: Person) -> int:
	return person.segment.get_instance_id() * 2 + (1 if person.direction > 0 else 0)


## Distância (ao longo do trecho) até a próxima pessoa à frente no mesmo sentido.
func _gap_ahead(person: Person, lane: Array) -> float:
	var best := INF
	var length := person.segment.length()
	for other: Person in lane:
		if other == person:
			continue
		var gap := (other.s - person.s) * float(person.direction)
		if person.segment.closed:
			gap = fposmod(gap, length)
		if gap > 0.0 and gap < best:
			best = gap
	return best


func _walk(person: Person, distance: float) -> void:
	var segment := person.segment
	person.s += distance * float(person.direction)
	if segment.closed:
		person.s = fposmod(person.s, segment.length())
		return
	var end := segment.length()
	if person.s <= 0.0 or person.s >= end:
		person.s = clampf(person.s, 0.0, end)
		person.direction = -person.direction
		person.pause = _rng.randf_range(0.5, 2.0)


# --- desviar do carro do jogador -----------------------------------------------------------------

## Área que o carro do jogador vai varrer no próximo segundo (vazia se estiver parado).
func _player_danger() -> Dictionary:
	if player == null or not is_instance_valid(player):
		return {}
	var velocity := player.linear_velocity
	velocity.y = 0.0
	var speed := velocity.length()
	var forward := player.global_basis.z
	forward.y = 0.0
	forward = forward.normalized()
	if speed > 1.0:
		forward = velocity / speed
	return {
		"origin": player.global_position, "forward": forward, "right": Vector3(-forward.z, 0, forward.x),
		"half_width": float(player.spec.get("width", 1.9)) / 2.0, "half_length": float(player.spec.get("length", 4.5)) / 2.0,
		"speed": speed,
	}


func _avoid(person: Person, danger: Dictionary) -> void:
	var relative := person.position - (danger["origin"] as Vector3)
	relative.y = 0.0
	if relative.length_squared() > 40.0 * 40.0:
		return
	var forward: Vector3 = danger["forward"]
	var right: Vector3 = danger["right"]
	var ahead := relative.dot(forward)
	var side := relative.dot(right)
	var half_width: float = danger["half_width"]
	var half_length: float = danger["half_length"]
	var speed: float = danger["speed"]
	# Encostou no carro: sai de lado na hora (ninguém atravessa a lataria).
	if absf(ahead) < half_length + 0.3 and absf(side) < half_width + 0.3:
		var push := right * signf(side if absf(side) > 0.01 else 1.0) * (half_width + 0.35 - absf(side))
		person.offset += push
		person.position += push
		touches += 1
		return
	if speed < 2.0:
		# Carro parado ou devagar na calçada: quem vem andando dá meia-volta antes de encostar.
		if absf(ahead) < half_length + 1.2 and absf(side) < half_width + 1.2 and person.stop < 0 and person.pause <= 0.0 and person.scared <= 0.0:
			var heading: Vector3 = (person.segment.sample(person.s)[1] as Vector3) * float(person.direction)
			if heading.dot(-relative) > 0.0:
				person.direction = -person.direction
				person.pause = _rng.randf_range(0.3, 0.8)
		return
	if person.dodge_time > 0.0:
		return
	var reach := half_length + speed * 1.1 + 1.5
	var margin := half_width + 0.8
	if ahead < -half_length or ahead > reach or absf(side) > margin:
		return
	# Pula para o lado mais perto de sair da frente, se não houver parede ali.
	var sign := signf(side) if absf(side) > 0.2 else (1.0 if _rng.randf() < 0.5 else -1.0)
	var needed := margin - sign * side + 0.3
	if _blocked(person.position, right * sign, needed):
		sign = -sign
		needed = margin - sign * side + 0.3
	person.dodge = right * sign * 6.5
	person.dodge_time = clampf(needed / 6.5, 0.12, 0.75)
	person.scared = 2.5
	person.pause = 0.0
	# Depois do susto, corre no mesmo sentido do carro (para longe dele).
	if person.stop < 0:
		var tangent: Vector3 = person.segment.sample(person.s)[1]
		if tangent.dot(forward) * float(person.direction) < 0.0:
			person.direction = -person.direction


func _blocked(from: Vector3, direction: Vector3, distance: float) -> bool:
	var space := get_world_3d().direct_space_state
	var origin := from + Vector3.UP * 0.9
	var query := PhysicsRayQueryParameters3D.create(origin, origin + direction * (distance + 0.3))
	var hit := space.intersect_ray(query)
	return not hit.is_empty() and hit["collider"] is StaticBody3D and not hit["collider"] is AnimatableBody3D
