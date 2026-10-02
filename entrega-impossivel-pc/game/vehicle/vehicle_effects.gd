class_name VehicleEffects
extends Node3D
## Efeitos do carro do jogador: faíscas, cacos e poeira nas batidas, fumaça dos pneus
## cantando e marcas de pneu no chão (que somem aos poucos). As marcas ficam todas numa
## MultiMesh (um retângulo por trecho de marca) e as partículas são reaproveitadas.

const MAX_MARKS := 1200
const MARK_WIDTH := 0.2
## Segundos até uma marca de pneu sumir.
const MARK_LIFETIME := 45.0
## Trecho mínimo de marca (m): menos que isso espera o pneu andar mais.
const MARK_STEP := 0.3
## Pneu cantando acima disso deixa marca / solta fumaça.
const SQUEAL_MARKS := 0.4
const SQUEAL_SMOKE := 0.55
const BURSTS := 3

var vehicle: Vehicle
## Pista molhada (0..1): menos fumaça e marcas mais fracas.
var wetness := 0.0

var _marks: MultiMesh
var _mark_material: ShaderMaterial
var _mark_next := 0
var _mark_count := 0
## Último ponto de contato de cada roda que está marcando (ou null).
var _mark_from: Array = []
var _smoke: Array[GPUParticles3D] = []
var _bursts: Array = []
var _burst_next := 0
var _time := 0.0
var _soft: Texture2D


func _ready() -> void:
	_soft = _soft_texture()
	_build_marks()
	for i in BURSTS:
		_bursts.append(_build_burst())


## Passa a acompanhar `target` (ou ninguém, com null).
func attach(target: Vehicle) -> void:
	if vehicle and is_instance_valid(vehicle) and vehicle.impacted.is_connected(_on_impact):
		vehicle.impacted.disconnect(_on_impact)
	vehicle = target
	for smoke in _smoke:
		smoke.queue_free()
	_smoke.clear()
	_mark_from.clear()
	if vehicle == null:
		return
	vehicle.impacted.connect(_on_impact)
	for wheel in vehicle.wheels():
		var smoke := _build_smoke()
		add_child(smoke)
		_smoke.append(smoke)
		_mark_from.append(null)


## Apaga as marcas de pneu (novo jogo).
func clear_marks() -> void:
	_mark_count = 0
	_mark_next = 0
	_marks.visible_instance_count = 0


## Faíscas, cacos e poeira no ponto `point`, saindo na direção `normal`.
func burst(point: Vector3, normal: Vector3, strength: float) -> void:
	if strength < 1.5:
		return
	var group: Array = _bursts[_burst_next]
	_burst_next = (_burst_next + 1) % _bursts.size()
	var up := Vector3.UP if absf(normal.dot(Vector3.UP)) < 0.95 else Vector3.RIGHT
	var basis := Basis.looking_at(-normal, up)
	var ratio := clampf(strength / 10.0, 0.25, 1.0)
	for i in group.size():
		var particles: GPUParticles3D = group[i]
		# 0 faíscas (batida de lataria), 1 cacos (só nas fortes), 2 poeira.
		if (i == 0 and strength < 3.0) or (i == 1 and strength < 5.0):
			continue
		particles.global_transform = Transform3D(basis, point + normal * 0.15 + Vector3.UP * 0.1)
		particles.amount_ratio = ratio
		particles.restart()
		particles.emitting = true


func _on_impact(strength: float) -> void:
	if vehicle and is_instance_valid(vehicle):
		burst(vehicle.last_impact_point, vehicle.last_impact_normal, strength)


func _physics_process(delta: float) -> void:
	_time += delta
	_mark_material.set_shader_parameter("now", _time)
	if vehicle == null or not is_instance_valid(vehicle):
		return
	var wheels := vehicle.wheels()
	var squeal := vehicle.tire_squeal
	var speed := vehicle.linear_velocity.length()
	for i in wheels.size():
		var wheel := wheels[i]
		var contact := wheel.is_in_contact()
		var point := wheel.get_contact_point() if contact else Vector3.ZERO
		# Marcas: rodas de trás sempre que cantam; as da frente só travadas no freio.
		var rear := i >= 2
		var marking := contact and speed > 2.0 and squeal > SQUEAL_MARKS and (rear or vehicle.braking)
		if marking:
			if _mark_from[i] == null:
				_mark_from[i] = point
			elif point.distance_to(_mark_from[i]) >= MARK_STEP:
				_add_mark(_mark_from[i], point, wheel.get_contact_normal(), clampf((squeal - SQUEAL_MARKS) * 2.5, 0.25, 1.0))
				_mark_from[i] = point
		else:
			_mark_from[i] = null
		var smoke := _smoke[i]
		var smoking := rear and contact and speed > 3.0 and squeal > SQUEAL_SMOKE and wetness < 0.6
		if smoking:
			smoke.global_position = point + Vector3.UP * 0.15
			smoke.amount_ratio = clampf((squeal - SQUEAL_SMOKE) * 2.5, 0.2, 1.0) * (1.0 - wetness)
		smoke.emitting = smoking


func _add_mark(from: Vector3, to: Vector3, normal: Vector3, strength: float) -> void:
	var along := to - from
	var length := along.length()
	if length < 0.01 or length > 3.0:
		return
	var direction := along / length
	var side := direction.cross(normal).normalized()
	var basis := Basis(side * MARK_WIDTH, normal, direction * (length + 0.04))
	var xform := Transform3D(basis, (from + to) / 2.0 + normal * 0.012)
	_marks.set_instance_transform(_mark_next, xform)
	_marks.set_instance_custom_data(_mark_next, Color(_time, strength * (1.0 - wetness * 0.5), 0.0, 0.0))
	_mark_next = (_mark_next + 1) % MAX_MARKS
	_mark_count = mini(_mark_count + 1, MAX_MARKS)
	_marks.visible_instance_count = _mark_count


# --- montagem -------------------------------------------------------------------------------

func _build_marks() -> void:
	var plane := PlaneMesh.new()
	plane.size = Vector2.ONE
	_mark_material = ShaderMaterial.new()
	_mark_material.shader = load("res://game/vehicle/shaders/skid_mark.gdshader")
	_mark_material.set_shader_parameter("lifetime", MARK_LIFETIME)
	plane.material = _mark_material
	_marks = MultiMesh.new()
	_marks.transform_format = MultiMesh.TRANSFORM_3D
	_marks.use_custom_data = true
	_marks.mesh = plane
	_marks.instance_count = MAX_MARKS
	_marks.visible_instance_count = 0
	# Caixa fixa (a cidade toda): sem recalcular os limites a cada marca nova.
	_marks.custom_aabb = AABB(Vector3(-3000, -50, -3000), Vector3(6000, 200, 6000))
	var instance := MultiMeshInstance3D.new()
	instance.name = "SkidMarks"
	instance.multimesh = _marks
	instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(instance)


## Fumaça de pneu: bolas macias que sobem devagar, crescem e somem.
func _build_smoke() -> GPUParticles3D:
	var particles := GPUParticles3D.new()
	particles.amount = 40
	particles.lifetime = 1.8
	particles.local_coords = false
	particles.emitting = false
	particles.visibility_aabb = AABB(Vector3(-12, -2, -12), Vector3(24, 10, 24))
	var process := ParticleProcessMaterial.new()
	process.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
	process.emission_sphere_radius = 0.2
	process.direction = Vector3.UP
	process.spread = 50.0
	process.initial_velocity_min = 0.3
	process.initial_velocity_max = 1.1
	process.gravity = Vector3(0, 0.35, 0)
	process.damping_min = 0.4
	process.damping_max = 0.8
	process.scale_min = 0.7
	process.scale_max = 1.1
	process.scale_curve = _curve_texture([Vector2(0.0, 0.45), Vector2(1.0, 2.8)])
	process.color_ramp = _gradient_texture([[0.0, Color(0.85, 0.85, 0.86, 0.0)], [0.12, Color(0.85, 0.85, 0.86, 0.32)], [1.0, Color(0.8, 0.8, 0.82, 0.0)]])
	particles.process_material = process
	particles.draw_pass_1 = _billboard_quad(1.3, _soft, false)
	return particles


## [faíscas, cacos, poeira], disparados juntos numa batida.
func _build_burst() -> Array:
	var sparks := GPUParticles3D.new()
	sparks.amount = 64
	sparks.lifetime = 0.55
	sparks.one_shot = true
	sparks.explosiveness = 0.92
	sparks.emitting = false
	sparks.local_coords = false
	sparks.transform_align = GPUParticles3D.TRANSFORM_ALIGN_Z_BILLBOARD_Y_TO_VELOCITY
	var spark_process := ParticleProcessMaterial.new()
	# Para cima e para os lados (a "frente" do emissor aponta para fora da batida, mas ali
	# costuma ter lataria: faísca de raspão espirra de lado).
	spark_process.direction = Vector3(0, 0.9, 0.45)
	spark_process.spread = 80.0
	spark_process.initial_velocity_min = 3.0
	spark_process.initial_velocity_max = 10.0
	spark_process.gravity = Vector3(0, -9.8, 0)
	spark_process.scale_curve = _curve_texture([Vector2(0.0, 1.0), Vector2(1.0, 0.2)])
	spark_process.color_ramp = _gradient_texture([[0.0, Color(1.0, 0.95, 0.75)], [0.35, Color(1.0, 0.62, 0.18)], [1.0, Color(0.9, 0.25, 0.05, 0.0)]])
	sparks.process_material = spark_process
	var streak := QuadMesh.new()
	streak.size = Vector2(0.035, 0.3)
	var spark_material := StandardMaterial3D.new()
	spark_material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	spark_material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	spark_material.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	spark_material.vertex_color_use_as_albedo = true
	spark_material.albedo_color = Color(4.0, 2.6, 1.2)
	spark_material.cull_mode = BaseMaterial3D.CULL_DISABLED
	streak.material = spark_material
	sparks.draw_pass_1 = streak

	var debris := GPUParticles3D.new()
	debris.amount = 18
	debris.lifetime = 0.8
	debris.one_shot = true
	debris.explosiveness = 0.95
	debris.emitting = false
	debris.local_coords = false
	var debris_process := ParticleProcessMaterial.new()
	debris_process.direction = Vector3(0, 1.0, 0.4)
	debris_process.spread = 70.0
	debris_process.initial_velocity_min = 1.5
	debris_process.initial_velocity_max = 4.5
	debris_process.gravity = Vector3(0, -9.8, 0)
	debris_process.scale_min = 0.5
	debris_process.scale_max = 1.3
	# Pedaços de plástico escuro e alguns cacos de vidro (claros).
	debris_process.color_initial_ramp = _gradient_texture([[0.0, Color(0.06, 0.06, 0.065)], [0.65, Color(0.12, 0.12, 0.13)], [0.7, Color(0.7, 0.8, 0.85)], [1.0, Color(0.85, 0.9, 0.95)]])
	debris.process_material = debris_process
	var chip := BoxMesh.new()
	chip.size = Vector3(0.06, 0.015, 0.045)
	var chip_material := StandardMaterial3D.new()
	chip_material.vertex_color_use_as_albedo = true
	chip_material.roughness = 0.35
	chip_material.metallic = 0.2
	chip.material = chip_material
	debris.draw_pass_1 = chip

	var dust := GPUParticles3D.new()
	dust.amount = 12
	dust.lifetime = 1.5
	dust.one_shot = true
	dust.explosiveness = 0.85
	dust.emitting = false
	dust.local_coords = false
	var dust_process := ParticleProcessMaterial.new()
	dust_process.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
	dust_process.emission_sphere_radius = 0.3
	dust_process.direction = Vector3(0, 0.5, 0.4)
	dust_process.spread = 90.0
	dust_process.initial_velocity_min = 0.4
	dust_process.initial_velocity_max = 1.6
	dust_process.gravity = Vector3(0, 0.2, 0)
	dust_process.damping_min = 0.8
	dust_process.damping_max = 1.5
	dust_process.scale_curve = _curve_texture([Vector2(0.0, 0.5), Vector2(1.0, 2.2)])
	dust_process.color_ramp = _gradient_texture([[0.0, Color(0.62, 0.6, 0.56, 0.0)], [0.1, Color(0.62, 0.6, 0.56, 0.4)], [1.0, Color(0.6, 0.58, 0.55, 0.0)]])
	dust.process_material = dust_process
	dust.draw_pass_1 = _billboard_quad(1.0, _soft, false)

	for particles: GPUParticles3D in [sparks, debris, dust]:
		particles.visibility_aabb = AABB(Vector3(-8, -4, -8), Vector3(16, 10, 16))
		add_child(particles)
	return [sparks, debris, dust]


func _billboard_quad(size: float, texture: Texture2D, unshaded: bool) -> QuadMesh:
	var quad := QuadMesh.new()
	quad.size = Vector2(size, size)
	var material := StandardMaterial3D.new()
	material.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.vertex_color_use_as_albedo = true
	material.albedo_texture = texture
	material.roughness = 1.0
	if unshaded:
		material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	quad.material = material
	return quad


## Círculo macio (centro opaco, borda transparente).
func _soft_texture() -> Texture2D:
	var gradient := Gradient.new()
	gradient.set_color(0, Color(1, 1, 1, 1))
	gradient.set_color(1, Color(1, 1, 1, 0))
	gradient.add_point(0.45, Color(1, 1, 1, 0.55))
	var texture := GradientTexture2D.new()
	texture.gradient = gradient
	texture.fill = GradientTexture2D.FILL_RADIAL
	texture.fill_from = Vector2(0.5, 0.5)
	texture.fill_to = Vector2(1.0, 0.5)
	texture.width = 64
	texture.height = 64
	return texture


static func _curve_texture(points: Array) -> CurveTexture:
	var curve := Curve.new()
	curve.max_value = 4.0
	for p: Vector2 in points:
		curve.add_point(p)
	var texture := CurveTexture.new()
	texture.curve = curve
	return texture


## [[posição, cor], ...]
static func _gradient_texture(stops: Array) -> GradientTexture1D:
	var gradient := Gradient.new()
	gradient.offsets = PackedFloat32Array(stops.map(func(stop: Array) -> float: return float(stop[0])))
	gradient.colors = PackedColorArray(stops.map(func(stop: Array) -> Color: return stop[1]))
	var texture := GradientTexture1D.new()
	texture.gradient = gradient
	return texture
