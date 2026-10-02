class_name TrafficWreck
extends RigidBody3D
## Carro do trânsito depois de uma batida forte: deixa de andar "em trilhos" e vira um
## corpo solto com a massa do modelo. Desliza com atrito de pneu (pouco no sentido das
## rodas, muito de lado), gira, a carroceria balança com a pancada e o pisca-alerta fica
## ligado. Se escorregar para cima de outro carro do trânsito, passa a pancada adiante
## (TrafficSystem.ram).

## Desaceleração (m/s²) rolando (motorista pisando no freio) e escorregando de lado, e
## do giro (rad/s²).
const ROLL_DECEL := 3.5
const SLIDE_DECEL := 7.5
const SPIN_DECEL := 2.2
## Mola do balanço da carroceria (frequência em rad/s e amortecimento).
const TILT_FREQUENCY := 10.0
const TILT_DAMPING := 0.3

var spec: Dictionary
var length := 4.0
var lights: CarLights
var night := false
## Segundos parado e segundos desde a batida (o TrafficSystem tira de cena depois).
var still_time := 0.0
var age := 0.0

var _body: Node3D
var _wheels: Array = []
var _wheel_radius := 0.33
var _ground_offset := 0.5
var _spin := 0.0
## Balanço da carroceria: x = arfagem (em volta de X), y = rolagem (em volta de Z).
var _tilt := Vector2.ZERO
var _tilt_speed := Vector2.ZERO
var _lean := Vector2.ZERO
var _last_velocity := Vector3.ZERO


## Pega a carroceria, as rodas e as luzes de `car` (que sai de cena logo depois).
## Chame depois de adicionar à árvore.
func setup_from(car: TrafficCar) -> void:
	spec = car.spec
	length = car.length
	_ground_offset = car.ground_offset
	var xform := car.global_transform
	var parts := car.detach_visuals()
	_body = parts["body"]
	_wheels = parts["wheels"]
	_wheel_radius = parts["wheel_radius"]
	lights = parts["lights"]
	add_child(_body)
	for wheel: MeshInstance3D in _wheels:
		add_child(wheel)
	mass = float(spec.get("mass", 1300.0))
	var material := PhysicsMaterial.new()
	material.friction = 0.0
	material.bounce = 0.1
	physics_material_override = material
	# Fica sempre de pé (sem capotar): só gira em volta do eixo vertical.
	axis_lock_angular_x = true
	axis_lock_angular_z = true
	continuous_cd = true
	contact_monitor = true
	max_contacts_reported = 6
	linear_damp_mode = RigidBody3D.DAMP_MODE_REPLACE
	linear_damp = 0.05
	angular_damp_mode = RigidBody3D.DAMP_MODE_REPLACE
	angular_damp = 0.3
	var width: float = spec["width"]
	var height: float = spec["height"]
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(width, height - 0.35, length)
	shape.shape = box
	shape.position.y = (height - 0.35) / 2.0 + 0.35 - _ground_offset
	add_child(shape)
	# Uma esfera em cada roda: apoia no chão e sobe no meio-fio em vez de travar nele.
	for wheel: MeshInstance3D in _wheels:
		var ball := CollisionShape3D.new()
		var sphere := SphereShape3D.new()
		sphere.radius = _wheel_radius
		ball.shape = sphere
		ball.position = wheel.position
		add_child(ball)
	global_transform = xform
	reset_physics_interpolation()


## A pancada: velocidade e giro novos e o tranco na carroceria (`push` = variação de
## velocidade causada pela batida, em m/s).
func hit(velocity: Vector3, spin: float, push: Vector3) -> void:
	linear_velocity = velocity
	angular_velocity = Vector3(0.0, spin, 0.0)
	_last_velocity = velocity
	var local := global_basis.inverse() * push
	# A carroceria "fica para trás": inclina no sentido do empurrão (pouco, alguns graus).
	_tilt_speed += Vector2(local.z, -local.x) * 0.08


func _integrate_forces(state: PhysicsDirectBodyState3D) -> void:
	var dt := state.step
	var basis := state.transform.basis
	var bottom := state.transform.origin.y - _ground_offset * 0.4
	var grounded := false
	for i in state.get_contact_count():
		var other := state.get_contact_collider_object(i)
		if other is TrafficCar:
			if TrafficSystem.current:
				var result := TrafficSystem.current.ram(self, _last_velocity, mass, other as TrafficCar, state.get_contact_collider_position(i))
				if not result.is_empty():
					var corrected: Vector3 = result["velocity"]
					state.linear_velocity = Vector3(corrected.x, state.linear_velocity.y, corrected.z)
		elif state.get_contact_local_position(i).y < bottom:
			grounded = true
	if grounded:
		var v := state.linear_velocity
		var local := basis.inverse() * v
		var before := local
		local.z = move_toward(local.z, 0.0, ROLL_DECEL * dt)
		local.x = move_toward(local.x, 0.0, SLIDE_DECEL * dt)
		# Inércia: freando, o nariz abaixa; escorregando de lado, a carroceria deita para fora.
		var accel := (local - before) / dt
		_lean = Vector2(-accel.z, accel.x) * 0.006
		state.linear_velocity = basis * Vector3(local.x, before.y, local.z)
		var spin := state.angular_velocity
		spin.y = move_toward(spin.y, 0.0, SPIN_DECEL * dt)
		state.angular_velocity = spin
	else:
		_lean = Vector2.ZERO
	_last_velocity = state.linear_velocity


func _physics_process(delta: float) -> void:
	age += delta
	still_time = still_time + delta if linear_velocity.length() < 0.25 else 0.0


func _process(delta: float) -> void:
	delta = minf(delta, 0.05)
	var target := _lean if still_time < 0.5 else Vector2.ZERO
	var accel := -(_tilt - target) * TILT_FREQUENCY * TILT_FREQUENCY - _tilt_speed * 2.0 * TILT_DAMPING * TILT_FREQUENCY
	_tilt_speed += accel * delta
	_tilt += _tilt_speed * delta
	_tilt = _tilt.clamp(Vector2(-0.12, -0.12), Vector2(0.12, 0.12))
	_body.rotation = Vector3(_tilt.x, 0.0, _tilt.y)
	var forward_speed := linear_velocity.dot(global_basis.z)
	_spin = fmod(_spin + forward_speed * delta / _wheel_radius, TAU)
	for wheel: MeshInstance3D in _wheels:
		wheel.basis = Basis(Vector3.RIGHT, _spin)
	lights.show_brake(true, night)
	lights.show_signal(CarLights.Blinker.HAZARD, CarLights.blink_lit())
