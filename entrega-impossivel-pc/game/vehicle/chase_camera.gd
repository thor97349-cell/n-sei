class_name ChaseCamera
extends Camera3D
## Câmera que segue o veículo: modo perseguição (distância ajustável pelo tamanho do
## veículo), modo "capô" (visão do motorista) e olhar em volta com o analógico
## direito ou o mouse (botão direito). Evita atravessar paredes e treme nas batidas.

const MODES: Array[String] = ["chase", "far", "cockpit"]

var target: Vehicle
var mode := 0
var _heading := Vector3.FORWARD
var _offset := Vector3.ZERO
var _look_yaw := 0.0
var _look_pitch := 0.0
var _mouse_look := Vector2.ZERO
var _shake := 0.0
var _rng := RandomNumberGenerator.new()


func _ready() -> void:
	# A câmera se move em _process a partir da posição já interpolada do carro.
	physics_interpolation_mode = Node.PHYSICS_INTERPOLATION_MODE_OFF
	far = 3200.0
	near = 0.08
	fov = 70.0


func follow(vehicle: Vehicle) -> void:
	target = vehicle
	if target:
		_heading = _flat(target.global_basis.z)
		_offset = Vector3.ZERO
		if not target.impacted.is_connected(_on_impact):
			target.impacted.connect(_on_impact)


func _on_impact(strength: float) -> void:
	_shake = maxf(_shake, clampf(strength / 10.0, 0.1, 0.8))


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT):
		var motion: Vector2 = event.relative
		var invert := -1.0 if Settings.get_value("controls/invert_y") else 1.0
		_mouse_look += Vector2(-motion.x * 0.005, -motion.y * 0.004 * invert)
	if event.is_action_pressed("camera_toggle"):
		mode = (mode + 1) % MODES.size()
		_offset = Vector3.ZERO


func _flat(v: Vector3) -> Vector3:
	var flat := Vector3(v.x, 0.0, v.z)
	return flat.normalized() if flat.length() > 0.01 else Vector3.FORWARD


func _process(delta: float) -> void:
	if target == null or not is_instance_valid(target):
		return
	var xform := target.get_global_transform_interpolated()
	var spec := target.spec
	var length: float = spec.get("length", 4.5)
	var height: float = spec.get("height", 1.5)

	# Olhar em volta: analógico direito (volta ao centro ao soltar) ou mouse.
	var stick := Vector2(Input.get_axis("look_left", "look_right"), Input.get_axis("look_down", "look_up"))
	if not Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT):
		_mouse_look = _mouse_look.move_toward(Vector2.ZERO, delta * 3.0)
	_mouse_look.x = clampf(_mouse_look.x, -PI, PI)
	_mouse_look.y = clampf(_mouse_look.y, -0.5, 0.6)
	_look_yaw = lerpf(_look_yaw, -stick.x * PI * 0.75 + _mouse_look.x, 1.0 - exp(-delta * 8.0))
	_look_pitch = lerpf(_look_pitch, stick.y * 0.4 + _mouse_look.y, 1.0 - exp(-delta * 8.0))

	var speed := absf(target.speed)
	_shake = maxf(_shake - delta * 1.8, 0.0)
	var shake := Vector3(_rng.randf_range(-1, 1), _rng.randf_range(-1, 1), 0) * _shake * 0.15

	if MODES[mode] == "cockpit":
		var eye := xform * Vector3(0.36, height - target.ground_offset - 0.42, length * 0.08)
		global_position = eye + shake
		var forward := xform.basis.z.rotated(xform.basis.y, _look_yaw)
		look_at(eye + forward * 10.0 + xform.basis.y * (_look_pitch * 6.0 - 0.4), xform.basis.y)
		fov = lerpf(fov, 72.0 + clampf(speed / 40.0, 0.0, 1.0) * 8.0, 1.0 - exp(-delta * 3.0))
		return

	# Perseguição: a direção acompanha o carro com um pequeno atraso (sente as curvas).
	var desired_heading := _flat(xform.basis.z)
	if target.speed < -2.0:
		desired_heading = _flat(xform.basis.z)
	_heading = _heading.slerp(desired_heading, 1.0 - exp(-delta * (3.5 + speed * 0.08))).normalized()
	var far_mode := MODES[mode] == "far"
	var distance := length * (1.35 if not far_mode else 2.1) + 3.2 + speed * 0.03
	var lift := height * (0.9 if not far_mode else 1.4) + 1.1
	var pivot := xform.origin + Vector3.UP * (height * 0.55)
	var direction := (-_heading).rotated(Vector3.UP, _look_yaw)
	var wanted := direction * distance * cos(_look_pitch) + Vector3.UP * (lift + distance * sin(_look_pitch))
	_offset = wanted if _offset == Vector3.ZERO else _offset.lerp(wanted, 1.0 - exp(-delta * 10.0))

	# Não atravessar prédios/paredes.
	var space := get_world_3d().direct_space_state
	var query := PhysicsRayQueryParameters3D.create(pivot, pivot + _offset)
	query.exclude = [target.get_rid()]
	var hit := space.intersect_ray(query)
	var camera_position := pivot + _offset
	if not hit.is_empty():
		camera_position = hit["position"] + hit["normal"] * 0.35
	global_position = camera_position + shake
	look_at(pivot + _heading.rotated(Vector3.UP, _look_yaw) * 3.0 + Vector3.UP * 0.4, Vector3.UP)
	fov = lerpf(fov, 68.0 + clampf(speed / 40.0, 0.0, 1.0) * 14.0, 1.0 - exp(-delta * 3.0))
