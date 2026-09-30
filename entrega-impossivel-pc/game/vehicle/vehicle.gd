class_name Vehicle
extends VehicleBody3D
## Veículo dirigível: motor com curva de torque, câmbio automático (com ré ao segurar
## o freio parado), freio com ABS simples, freio de mão, arrasto aerodinâmico,
## resistência ao rolamento, combustível, faróis/lanternas e som do motor.
##
## Controlado pelo jogador (Input) ou por código (`use_player_input = false` e os
## campos input_*), o que permite testar a física automaticamente.

signal impacted(strength: float)
signal out_of_fuel
signal gear_changed(gear: int)

const DRIVETRAIN_EFFICIENCY := 0.86
const AIR_DENSITY := 1.225
const ROLLING_RESISTANCE := 0.013
const IDLE_FUEL_PER_SECOND := 0.0004
const IMPACT_THRESHOLD := 2.2
## Velocidade máxima de ré (m/s).
const REVERSE_LIMIT := 7.5
## Quanto do limite de aderência o volante todo pede (1 = exatamente o limite: a curva
## mais fechada possível sem o pneu escorregar nem cantar).
const STEER_GRIP_MARGIN := 1.0
## Controle de estabilidade: giro (rad/s) acima do esperado que é tolerado antes de corrigir.
const YAW_TOLERANCE := 0.3
## Depois de uma batida: segundos em que o carro recebe ajuda para não sair girando/capotar.
const IMPACT_ASSIST_SECONDS := 0.9

var id := "van"
var spec: Dictionary = {}
var use_player_input := true
var input_throttle := 0.0
var input_brake := 0.0
var input_steer := 0.0
var input_handbrake := false

## -1 = ré, 1..n = marchas à frente.
var gear := 1
var rpm := 800.0
var fuel := 60.0
var speed := 0.0
var odometer := 0.0
var wheel_slip := 0.0
## 0..1: quanto o pneu está "cantando" (derrapagem lateral, travada ou patinada).
var tire_squeal := 0.0
var braking := false
var headlights_on := false
var headlights_auto := true
## Multiplica a aderência dos pneus (pista molhada < 1).
var grip_factor := 1.0
var ground_offset := 0.5

var _wheels: Array[VehicleWheel3D] = []
var _traction: Array[VehicleWheel3D] = []
var _front: Array[VehicleWheel3D] = []
var _rear: Array[VehicleWheel3D] = []
var _materials := {}
var _headlights: Array[SpotLight3D] = []
var _shift_timer := 0.0
var _reverse_hold := 0.0
var _steer := 0.0
var _last_velocity := Vector3.ZERO
var _impact_cooldown := 0.0
var _frontal_area := 2.0
var _out_of_fuel_sent := false
var _audio: EngineAudio
var _horn: AudioStreamPlayer
var _impact_assist := 0.0
var _yaw_inertia := 1000.0
var _roll_inertia := 500.0


## Monta o veículo (malha, rodas, colisão, luzes). Chame antes de adicionar à cena.
func setup(vehicle_id: String, color: Color = Color(0, 0, 0, 0), with_audio: bool = true) -> void:
	id = vehicle_id
	spec = VehicleSpecs.get_spec(vehicle_id)
	var paint: Color = spec["color"] if color.a == 0.0 else color
	mass = spec["mass"]
	var stiffness: float = spec["stiffness"]
	var rest: float = spec["rest_length"]
	var radius: float = spec["wheel_radius"]
	var static_length := rest - 9.8 / (4.0 * stiffness)
	ground_offset = static_length + radius
	var physics_radius := _physics_wheel_radius(radius, rest, static_length)
	center_of_mass_mode = RigidBody3D.CENTER_OF_MASS_MODE_CUSTOM
	center_of_mass = Vector3(0, spec["center_of_mass_y"], 0.05)
	continuous_cd = true
	can_sleep = false
	# Sem o amortecimento padrão do Godot (freava o carro como um paraquedas):
	# arrasto e rolamento são calculados de verdade em _apply_aero/_apply_drive.
	linear_damp_mode = RigidBody3D.DAMP_MODE_REPLACE
	linear_damp = 0.0
	angular_damp_mode = RigidBody3D.DAMP_MODE_REPLACE
	angular_damp = 0.25
	# Pouco atrito com paredes: o carro raspa e desliza em vez de "agarrar" e girar.
	var material := PhysicsMaterial.new()
	material.friction = 0.2
	material.bounce = 0.0
	physics_material_override = material
	# A carroceria nunca encosta no chão (as rodas são raios): qualquer contato dela é
	# batida ou raspada, e liga a ajuda de estabilidade.
	contact_monitor = true
	max_contacts_reported = 4
	var length: float = spec["length"]
	var width: float = spec["width"]
	var height: float = spec["height"]
	_yaw_inertia = mass * (length * length + width * width) / 12.0
	_roll_inertia = mass * (width * width + height * height) / 12.0
	_frontal_area = float(spec["width"]) * float(spec["height"]) * 0.82
	fuel = float(spec["fuel_capacity"])

	var built := CarMesh.build(spec, paint, ground_offset)
	add_child(built["body"])
	_materials = built["materials"]
	var shape := CollisionShape3D.new()
	var convex := ConvexPolygonShape3D.new()
	convex.points = built["collision_points"]
	shape.shape = convex
	add_child(shape)

	var half_track := float(spec["track"]) / 2.0
	var half_base := float(spec["wheelbase"]) / 2.0
	var rear_drive: bool = spec["drive"] == "rear"
	for index in 4:
		var front := index < 2
		var side := 1.0 if index % 2 == 0 else -1.0
		var wheel := VehicleWheel3D.new()
		wheel.name = ("Front" if front else "Rear") + ("Left" if side > 0.0 else "Right")
		wheel.position = Vector3(side * half_track, 0.0, half_base if front else -half_base)
		wheel.wheel_radius = physics_radius
		wheel.wheel_rest_length = spec["rest_length"]
		wheel.suspension_travel = spec["travel"]
		wheel.suspension_stiffness = stiffness
		wheel.suspension_max_force = float(spec["mass"]) * 9.8 * 1.3
		wheel.damping_compression = spec["damping_compression"]
		wheel.damping_relaxation = spec["damping_relaxation"]
		wheel.wheel_friction_slip = spec["grip"]
		wheel.wheel_roll_influence = 0.12
		wheel.use_as_steering = front
		wheel.use_as_traction = front != rear_drive
		var wheel_visual := MeshInstance3D.new()
		wheel_visual.mesh = built["wheel_mesh"]
		wheel.add_child(wheel_visual)
		add_child(wheel)
		_wheels.append(wheel)
		if front:
			_front.append(wheel)
		else:
			_rear.append(wheel)
		if wheel.use_as_traction:
			_traction.append(wheel)

	for position: Vector3 in built["headlights"]:
		var light := SpotLight3D.new()
		light.position = position
		light.rotation.y = PI
		light.rotation.x = deg_to_rad(-4.0)
		light.spot_range = 55.0
		light.spot_angle = 34.0
		light.spot_attenuation = 0.8
		light.light_energy = 0.0
		light.light_color = Color(1.0, 0.95, 0.85)
		light.shadow_enabled = false
		light.visible = false
		add_child(light)
		_headlights.append(light)
	if with_audio:
		_audio = EngineAudio.new()
		_audio.vehicle = self
		add_child(_audio)
		_horn = AudioStreamPlayer.new()
		_horn.bus = "SFX"
		_horn.stream = Sfx.get_stream("horn")
		_horn.volume_db = -6.0
		add_child(_horn)
	rpm = spec["idle_rpm"]


## O raio usado pela física para o pneu encostar no chão com a suspensão em repouso.
## O VehicleBody3D (Godot 4.7) lança o raio da suspensão a partir de um raio acima do
## ponto de fixação e reescala a distância por (repouso + r) / (repouso + 2r); com o raio
## real o pneu afundaria ~5 cm. Resolvendo o equilíbrio para o raio "físico" r':
##     r'² − (r − s)·r' − r·repouso = 0,  com s = comprimento da suspensão parada.
static func _physics_wheel_radius(radius: float, rest: float, static_length: float) -> float:
	var b := radius - static_length
	return (b + sqrt(b * b + 4.0 * radius * rest)) / 2.0


func get_speed_kmh() -> float:
	return absf(speed) * 3.6


func gear_count() -> int:
	return (spec["gears"] as Array).size()


func fuel_fraction() -> float:
	return fuel / float(spec["fuel_capacity"])


func set_headlights(on: bool) -> void:
	headlights_on = on
	for light in _headlights:
		light.visible = on
		light.light_energy = 6.0 if on else 0.0
	(_materials["headlight"] as StandardMaterial3D).emission_energy_multiplier = 6.0 if on else 0.4


## Teleporta (resgate/guincho/início) zerando o movimento.
func place(xform: Transform3D) -> void:
	var lifted := xform
	lifted.origin.y += ground_offset + 0.05
	global_transform = lifted
	linear_velocity = Vector3.ZERO
	angular_velocity = Vector3.ZERO
	_last_velocity = Vector3.ZERO
	gear = 1
	_steer = 0.0
	reset_physics_interpolation()


## Virado de ponta-cabeça ou de lado.
func is_flipped() -> bool:
	return global_basis.y.y < 0.35


func _physics_process(delta: float) -> void:
	if spec.is_empty():
		return
	if use_player_input:
		_read_player_input(delta)
	var forward := global_basis.z
	speed = linear_velocity.dot(forward)
	odometer += absf(speed) * delta
	_update_direction(delta)
	var drive := input_throttle if gear > 0 else input_brake
	var brake_input := input_brake if gear > 0 else input_throttle
	_update_engine(delta, drive)
	_apply_drive(delta, drive, brake_input)
	_apply_steering(delta)
	_apply_stability(delta)
	_apply_aero()
	_use_fuel(delta, drive)
	_check_breakables(delta)
	_detect_impacts(delta)
	_update_squeal(delta)
	_update_lights(brake_input)


func _read_player_input(delta: float) -> void:
	input_throttle = Input.get_action_strength("accelerate")
	input_brake = Input.get_action_strength("brake")
	input_handbrake = Input.is_action_pressed("handbrake")
	var target := Input.get_action_strength("steer_right") - Input.get_action_strength("steer_left")
	target = clampf(target, -1.0, 1.0)
	# Teclado: o volante gira aos poucos (mais calmo em alta velocidade) e volta sozinho
	# ao centro; ao trocar de lado passa rápido pelo meio. Controle analógico quase direto.
	var fast := clampf(absf(speed) / 25.0, 0.0, 1.0)
	var rate := lerpf(4.5, 2.6, fast)
	if absf(target) < absf(input_steer) or signf(target) != signf(input_steer):
		rate = 6.5
	input_steer = move_toward(input_steer, target, rate * delta)
	if Input.is_action_just_pressed("headlights"):
		headlights_auto = false
		set_headlights(not headlights_on)
	if _horn:
		if Input.is_action_pressed("horn"):
			if not _horn.playing:
				_horn.play()
		elif _horn.playing:
			_horn.stop()


## Câmbio: ré ao segurar o freio parado; volta para a 1ª ao acelerar parado.
func _update_direction(delta: float) -> void:
	if gear > 0:
		if input_brake > 0.2 and input_throttle < 0.1 and speed < 0.5:
			_reverse_hold += delta
			if _reverse_hold > 0.35:
				_set_gear(-1)
		else:
			_reverse_hold = 0.0
	elif input_throttle > 0.2 and speed > -0.6:
		_set_gear(1)
		_reverse_hold = 0.0


func _set_gear(value: int) -> void:
	if gear == value:
		return
	gear = value
	gear_changed.emit(gear)


func _ratio(for_gear: int) -> float:
	if for_gear < 0:
		return spec["reverse_gear"]
	var gears: Array = spec["gears"]
	return gears[clampi(for_gear, 1, gears.size()) - 1]


func _rpm_from_wheels(for_gear: int) -> float:
	var wheel_rad_per_s := absf(speed) / float(spec["wheel_radius"])
	return wheel_rad_per_s * _ratio(for_gear) * float(spec["final_drive"]) * 60.0 / TAU


func _update_engine(delta: float, drive: float) -> void:
	var idle: float = spec["idle_rpm"]
	var max_rpm: float = spec["max_rpm"]
	_shift_timer = maxf(_shift_timer - delta, 0.0)
	if gear > 0 and _shift_timer <= 0.0:
		var up_rpm := lerpf(0.5, 0.9, drive) * max_rpm
		var down_rpm := lerpf(0.26, 0.5, drive) * max_rpm
		var wheel_rpm := _rpm_from_wheels(gear)
		if wheel_rpm > up_rpm and gear < gear_count():
			_set_gear(gear + 1)
			_shift_timer = 0.3
		elif gear > 1 and wheel_rpm < down_rpm and _rpm_from_wheels(gear - 1) < max_rpm * 0.82:
			_set_gear(gear - 1)
			_shift_timer = 0.22
	# Embreagem patinando em baixa: o motor sobe de giro mesmo com o carro devagar.
	var launch_rpm := minf(float(spec["torque_peak_rpm"]) * 0.85, max_rpm * 0.55)
	var target := maxf(_rpm_from_wheels(gear), idle + drive * (launch_rpm - idle))
	if fuel <= 0.0:
		target = 0.0
	rpm = move_toward(rpm, clampf(target, 0.0, max_rpm * 1.02), 12000.0 * delta)


func torque_at(engine_rpm: float) -> float:
	var idle: float = spec["idle_rpm"]
	var peak: float = spec["torque_peak_rpm"]
	var max_rpm: float = spec["max_rpm"]
	var factor := 1.0
	if engine_rpm <= peak:
		factor = 0.62 + 0.38 * sin(clampf((engine_rpm - idle) / (peak - idle), 0.0, 1.0) * PI / 2.0)
	else:
		var x := clampf((engine_rpm - peak) / (max_rpm - peak), 0.0, 1.0)
		factor = 1.0 - 0.3 * x * x
	return float(spec["torque"]) * factor


func _apply_drive(delta: float, drive: float, brake_input: float) -> void:
	var force := 0.0
	var limiter := float(spec["limiter_kmh"]) / 3.6
	if gear < 0:
		limiter = REVERSE_LIMIT
	if drive > 0.01 and brake_input < 0.05 and fuel > 0.0 and rpm < float(spec["max_rpm"]) and absf(speed) < limiter:
		force = torque_at(rpm) * drive * _ratio(gear) * float(spec["final_drive"]) * DRIVETRAIN_EFFICIENCY / float(spec["wheel_radius"])
		if _shift_timer > 0.0:
			force *= 0.15
		# Controle de tração simples: alivia se as rodas motrizes patinam.
		var worst := 1.0
		for wheel in _traction:
			worst = minf(worst, wheel.get_skidinfo())
		if worst < 0.5:
			force *= 0.65
		if gear < 0:
			force = -force
	var per_wheel := force / maxf(_traction.size(), 1)
	for wheel in _wheels:
		wheel.engine_force = per_wheel if _traction.has(wheel) else 0.0

	# Freio: impulso máximo por passo (ver VehicleBody3D). Dianteira freia um pouco mais.
	var step := delta
	var quarter := mass * step / 4.0
	braking = brake_input > 0.05
	var abs_active := false
	for wheel in _wheels:
		var front := _front.has(wheel)
		var decel := 0.0
		if braking:
			decel = float(spec["brake_decel"]) * brake_input * (1.2 if front else 0.8)
			if wheel.get_skidinfo() < 0.55:
				decel *= 0.6
				abs_active = true
		elif force == 0.0:
			if absf(speed) < 0.35 and drive < 0.01:
				decel = 3.0
			else:
				var engine_brake := 0.0
				if gear != 0 and rpm > float(spec["idle_rpm"]) * 1.2:
					engine_brake = 0.9 * clampf((rpm - float(spec["idle_rpm"])) / (float(spec["max_rpm"]) - float(spec["idle_rpm"])), 0.0, 1.0)
				decel = ROLLING_RESISTANCE * 9.8 + engine_brake
		if input_handbrake and not front:
			decel = maxf(decel, 9.0)
		if decel > 0.0:
			wheel.engine_force = 0.0
		wheel.brake = quarter * decel
		# Traseira com um pouco mais de aderência: o carro tende a sair de frente (seguro).
		var bias := 1.0 if front else 1.08
		wheel.wheel_friction_slip = float(spec["grip"]) * grip_factor * (0.5 if input_handbrake and not front else bias)
	var slip := 0.0
	for wheel in _wheels:
		slip = maxf(slip, 1.0 - wheel.get_skidinfo())
	wheel_slip = slip if not abs_active else slip * 0.5


## Direção previsível: o volante todo sempre pede a curva mais fechada que os pneus
## aguentam naquela velocidade (um pouco além, para sentir o limite). Assim meio volante
## é meia curva em qualquer velocidade, em vez de "tudo ou nada" em alta.
func max_steer_angle() -> float:
	var base: float = spec["steer_angle"]
	var v := absf(speed)
	if input_handbrake or v < 1.0:
		return base
	var lateral_limit := float(spec["grip"]) * grip_factor * 9.8
	var radius := v * v / lateral_limit
	return clampf(atan(float(spec["wheelbase"]) / radius) * STEER_GRIP_MARGIN, 0.03, base)


func _apply_steering(delta: float) -> void:
	var limit := max_steer_angle()
	var target := -input_steer * limit
	# As rodas acompanham o volante rápido (a suavização fica no volante).
	_steer = move_toward(_steer, target, delta * maxf(limit, 0.25) * 8.0)
	steering = _steer


func _wheels_on_ground() -> int:
	var count := 0
	for wheel in _wheels:
		if wheel.is_in_contact():
			count += 1
	return count


## Ajudas discretas (arcade): controle de estabilidade, carro nivelado no ar e
## amortecimento depois de batidas para o carro não sair rodopiando ou capotar.
func _apply_stability(delta: float) -> void:
	var up := global_basis.y
	var local_spin := global_basis.inverse() * angular_velocity
	var on_ground := _wheels_on_ground()
	var v := linear_velocity.length()
	if on_ground >= 3 and v > 3.0:
		# Giro esperado para o ângulo das rodas; o que passar disso é derrapagem de traseira.
		var expected := speed * tan(steering) / float(spec["wheelbase"])
		var tolerance := YAW_TOLERANCE + (1.4 if input_handbrake else 0.0)
		var excess := local_spin.y - expected
		if absf(excess) > tolerance:
			var correction := (absf(excess) - tolerance) * signf(excess)
			apply_torque(-up * correction * _yaw_inertia * 5.0)
	# Tombando (> 20°) ou no ar: puxa de volta para ficar de pé. Carro já deitado ou de
	# rodas para cima (> 75°) não se desvira sozinho: aí é o resgate (R).
	var tilt := up.angle_to(Vector3.UP)
	if (tilt > deg_to_rad(20.0) or on_ground == 0) and tilt < deg_to_rad(75.0):
		var axis := up.cross(Vector3.UP)
		if axis.length() > 0.001:
			apply_torque(axis.normalized() * tilt * _roll_inertia * 6.0)
		apply_torque(-(global_basis.x * local_spin.x + global_basis.z * local_spin.z) * _roll_inertia * 3.0)
	# Encostando em algo ou logo depois de uma batida: tira o excesso de giro e de balanço.
	if get_contact_count() > 0:
		_impact_assist = maxf(_impact_assist, 0.5)
	if _impact_assist > 0.0:
		_impact_assist -= delta
		# Raspando/batendo: segura a carroceria de pé (sem aquele tombo de lado).
		if tilt > deg_to_rad(4.0) and tilt < deg_to_rad(75.0):
			var level_axis := up.cross(Vector3.UP)
			if level_axis.length() > 0.001:
				apply_torque(level_axis.normalized() * tilt * _roll_inertia * 14.0)
		local_spin.x *= exp(-delta * 8.0)
		local_spin.z *= exp(-delta * 8.0)
		local_spin.y = clampf(local_spin.y, -1.1, 1.1) * exp(-delta * 2.5)
		angular_velocity = global_basis * local_spin


func _apply_aero() -> void:
	var velocity := linear_velocity
	var v := velocity.length()
	if v < 0.5:
		return
	var drag := 0.5 * AIR_DENSITY * float(spec["drag"]) * _frontal_area * v * v
	apply_central_force(-velocity / v * drag)
	# Um pouco de pressão aerodinâmica deixa o carro estável em alta.
	apply_central_force(-global_basis.y * 0.15 * mass * clampf(v / 40.0, 0.0, 1.0))


func _use_fuel(delta: float, drive: float) -> void:
	if fuel <= 0.0:
		return
	var liters := float(spec["consumption"]) * absf(speed) * delta / 1000.0 * (0.35 + 0.65 * drive) + IDLE_FUEL_PER_SECOND * delta
	fuel = maxf(fuel - liters, 0.0)
	if fuel <= 0.0 and not _out_of_fuel_sent:
		_out_of_fuel_sent = true
		out_of_fuel.emit()


func refuel(liters: float) -> void:
	fuel = minf(fuel + liters, float(spec["fuel_capacity"]))
	if fuel > 0.0:
		_out_of_fuel_sent = false


func _detect_impacts(delta: float) -> void:
	_impact_cooldown = maxf(_impact_cooldown - delta, 0.0)
	var change := (linear_velocity - _last_velocity).length()
	# Frear forte muda ~0,1 m/s por passo; batidas mudam muito mais de uma vez.
	var expected := 25.0 * delta
	if change - expected > IMPACT_THRESHOLD:
		_impact_assist = IMPACT_ASSIST_SECONDS
		if _impact_cooldown <= 0.0:
			_impact_cooldown = 0.35
			var strength := change - expected
			impacted.emit(strength)
			Sfx.play("impact", linear_to_db(clampf(strength / 12.0, 0.15, 1.0)), randf_range(0.85, 1.1))
	_last_velocity = linear_velocity


## Pneu cantando: derrapagem lateral de verdade (ângulo entre para onde o carro aponta e
## para onde ele vai), roda travada freando ou patinando. Curva normal não canta.
func _update_squeal(delta: float) -> void:
	var target := 0.0
	var v := Vector2(linear_velocity.x, linear_velocity.z).length()
	if v > 5.0 and _wheels_on_ground() >= 2:
		# Derrapagem em cada eixo: ângulo entre para onde a roda aponta e para onde ela
		# realmente anda. Rolando normal (mesmo em curva fechada) fica perto de zero.
		var half_base := float(spec["wheelbase"]) / 2.0
		var forward := global_basis.z
		var rear_slip := _axle_slip(-half_base, forward)
		var front_slip := _axle_slip(half_base, forward.rotated(global_basis.y, steering))
		target = smoothstep(8.0, 18.0, maxf(rear_slip, front_slip))
		# Rodas travadas (freio além do ABS) ou patinando na arrancada.
		target = maxf(target, smoothstep(0.35, 0.8, wheel_slip) * (0.7 if braking or input_throttle > 0.5 else 0.0))
		target *= clampf((v - 5.0) / 6.0, 0.0, 1.0)
	# Sobe rápido e desce devagar (sem liga-desliga a cada quadro).
	tire_squeal = move_toward(tire_squeal, target, delta * (6.0 if target > tire_squeal else 2.5))


func _axle_slip(offset: float, heading: Vector3) -> float:
	var point := global_basis * Vector3(0, 0, offset)
	var velocity := linear_velocity + angular_velocity.cross(point)
	velocity.y = 0.0
	heading.y = 0.0
	if velocity.length() < 2.0 or heading.length() < 0.01:
		return 0.0
	var angle := rad_to_deg(heading.normalized().angle_to(velocity.normalized()))
	return 180.0 - angle if angle > 90.0 else angle


## Postes de luz quebram quando o carro chega neles: o poste cai e o carro perde só parte
## da velocidade (em vez de parar seco). Verificado antes do contato acontecer.
func _check_breakables(delta: float) -> void:
	if Breakables.current == null or linear_velocity.length() < 3.0:
		return
	var reach := absf(speed) * delta * 2.0 + 0.3
	var half := Vector2(float(spec["width"]) / 2.0 + 0.3, float(spec["length"]) / 2.0 + reach)
	var hit := Breakables.current.hit_test(global_transform, half, linear_velocity)
	if hit <= 0.0:
		return
	var before := linear_velocity
	linear_velocity = before * 0.8
	_last_velocity = linear_velocity
	_impact_assist = IMPACT_ASSIST_SECONDS
	var strength := before.length() * 0.2
	impacted.emit(strength)
	Sfx.play("impact", linear_to_db(clampf(strength / 10.0, 0.2, 0.9)), randf_range(1.15, 1.35))


func _update_lights(brake_input: float) -> void:
	var tail_energy := 0.6 + (0.9 if headlights_on else 0.0)
	(_materials["brake"] as StandardMaterial3D).emission_energy_multiplier = 5.0 if brake_input > 0.05 else tail_energy
	(_materials["reverse"] as StandardMaterial3D).emission_energy_multiplier = 3.0 if gear < 0 else 0.0
