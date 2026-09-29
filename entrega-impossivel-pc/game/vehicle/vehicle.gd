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
	var material := PhysicsMaterial.new()
	material.friction = 0.35
	material.bounce = 0.05
	physics_material_override = material
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
	_apply_aero()
	_use_fuel(delta, drive)
	_detect_impacts(delta)
	_update_lights(brake_input)


func _read_player_input(delta: float) -> void:
	input_throttle = Input.get_action_strength("accelerate")
	input_brake = Input.get_action_strength("brake")
	input_handbrake = Input.is_action_pressed("handbrake")
	var target := Input.get_action_strength("steer_right") - Input.get_action_strength("steer_left")
	target = clampf(target, -1.0, 1.0)
	# Teclado: o volante gira aos poucos e volta sozinho; controle analógico é direto.
	var rate := 3.2 if absf(target) > absf(input_steer) else 5.5
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
		wheel.wheel_friction_slip = float(spec["grip"]) * grip_factor * (0.5 if input_handbrake and not front else 1.0)
	var slip := 0.0
	for wheel in _wheels:
		slip = maxf(slip, 1.0 - wheel.get_skidinfo())
	wheel_slip = slip if not abs_active else slip * 0.5


func _apply_steering(delta: float) -> void:
	var sensitivity := clampf(absf(speed) / 32.0, 0.0, 1.0)
	var max_angle := float(spec["steer_angle"]) * lerpf(1.0, 0.3, sensitivity)
	var target := -input_steer * max_angle
	_steer = move_toward(_steer, target, delta * 2.6)
	steering = _steer


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
	if change - expected > IMPACT_THRESHOLD and _impact_cooldown <= 0.0:
		_impact_cooldown = 0.35
		var strength := change - expected
		impacted.emit(strength)
		Sfx.play("impact", linear_to_db(clampf(strength / 12.0, 0.15, 1.0)), randf_range(0.85, 1.1))
	_last_velocity = linear_velocity


func _update_lights(brake_input: float) -> void:
	var tail_energy := 0.6 + (0.9 if headlights_on else 0.0)
	(_materials["brake"] as StandardMaterial3D).emission_energy_multiplier = 5.0 if brake_input > 0.05 else tail_energy
	(_materials["reverse"] as StandardMaterial3D).emission_energy_multiplier = 3.0 if gear < 0 else 0.0
