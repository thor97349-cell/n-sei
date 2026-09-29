class_name Breakables
extends Node3D
## Objetos da rua que quebram quando o carro bate (postes de luz): somem do desenho fixo
## da cidade (MultiMesh), a colisão é desligada e no lugar cai uma peça solta.
## Depois de um tempo, longe da câmera, o poste volta ao lugar.

signal broken(light_position: Vector3)
signal restored(light_position: Vector3)

static var current: Breakables

const CELL := 24.0
const RESPAWN_SECONDS := 120.0
const MAX_PIECES := 16
const POLE_HEIGHT := 7.6

var camera: Camera3D
var _grid := {}
var _broken: Array[Dictionary] = []
var _pieces: Array[RigidBody3D] = []
var _check_timer := 0.0


func _enter_tree() -> void:
	current = self


func _exit_tree() -> void:
	if current == self:
		current = null


## entries: [[CollisionShape3D, MultiMesh, índice, Transform3D, posição da luz], ...]
func setup(entries: Array) -> void:
	for entry: Array in entries:
		var xform: Transform3D = entry[3]
		var data := {"shape": entry[0], "multimesh": entry[1], "index": entry[2], "xform": xform, "light": entry[4], "active": true}
		var key := _cell(xform.origin)
		if not _grid.has(key):
			_grid[key] = []
		_grid[key].append(data)


func _cell(p: Vector3) -> Vector2i:
	return Vector2i(floori(p.x / CELL), floori(p.z / CELL))


## Algum poste dentro da caixa do carro (meia largura x, meio comprimento + folga z)?
## Se sim, derruba e devolve a velocidade do impacto (0 = nada atingido).
func hit_test(car: Transform3D, half: Vector2, velocity: Vector3) -> float:
	var center := _cell(car.origin)
	var inverse := car.affine_inverse()
	for dx in range(-1, 2):
		for dz in range(-1, 2):
			var list: Array = _grid.get(center + Vector2i(dx, dz), [])
			for data: Dictionary in list:
				if not data["active"]:
					continue
				var local := inverse * (data["xform"] as Transform3D).origin
				if absf(local.x) < half.x and absf(local.z) < half.y and local.y > -3.0 and local.y < 3.0:
					_break(data, velocity)
					return velocity.length()
	return 0.0


func _break(data: Dictionary, velocity: Vector3) -> void:
	data["active"] = false
	data["time"] = 0.0
	(data["shape"] as CollisionShape3D).disabled = true
	var multimesh: MultiMesh = data["multimesh"]
	var xform: Transform3D = data["xform"]
	multimesh.set_instance_transform(data["index"], Transform3D(Basis().scaled(Vector3.ONE * 0.001), xform.origin + Vector3.DOWN * 40.0))
	_broken.append(data)
	broken.emit(data["light"])
	# Peça solta que tomba na direção da batida.
	var body := RigidBody3D.new()
	body.mass = 70.0
	body.center_of_mass_mode = RigidBody3D.CENTER_OF_MASS_MODE_CUSTOM
	body.center_of_mass = Vector3(0, 2.2, 0)
	var mesh := MeshInstance3D.new()
	mesh.mesh = multimesh.mesh
	body.add_child(mesh)
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(0.3, POLE_HEIGHT, 0.3)
	shape.shape = box
	shape.position.y = POLE_HEIGHT / 2.0
	body.add_child(shape)
	add_child(body)
	body.global_transform = xform
	var push := Vector3(velocity.x, 0.0, velocity.z)
	var strength := minf(push.length(), 16.0)
	if push.length() > 0.1:
		body.apply_impulse(push.normalized() * body.mass * strength * 0.45 + Vector3.UP * body.mass * 1.5, Vector3(0, 0.6, 0))
	_pieces.append(body)
	while _pieces.size() > MAX_PIECES:
		var old: RigidBody3D = _pieces.pop_front()
		old.queue_free()


func _process(delta: float) -> void:
	if _broken.is_empty():
		return
	_check_timer -= delta
	for data in _broken:
		data["time"] = float(data["time"]) + delta
	if _check_timer > 0.0:
		return
	_check_timer = 2.0
	# Recoloca postes quebrados há tempo, se a câmera estiver longe.
	for data in _broken.duplicate():
		var xform: Transform3D = data["xform"]
		if float(data["time"]) < RESPAWN_SECONDS:
			continue
		if camera and camera.global_position.distance_to(xform.origin) < 120.0:
			continue
		data["active"] = true
		(data["shape"] as CollisionShape3D).disabled = false
		(data["multimesh"] as MultiMesh).set_instance_transform(data["index"], xform)
		_broken.erase(data)
		restored.emit(data["light"])
	for piece in _pieces.duplicate():
		if camera and camera.global_position.distance_to(piece.global_position) > 150.0:
			_pieces.erase(piece)
			piece.queue_free()
