class_name World
extends Node3D
## O mundo do jogo: céu/clima (Atmosphere), cidade (CityBuilder), semáforos, trânsito,
## pedestres, luz dos postes perto da câmera e chuva. Criado uma vez e reaproveitado entre o
## menu (fundo animado) e o jogo.

const STREET_LIGHTS := 14
## Luz dos postes: forte o bastante para fazer uma "poça" de luz na calçada e na rua.
const STREET_LIGHT_RANGE := 18.0
const STREET_LIGHT_ENERGY := 4.0
const STREET_LIGHT_ATTENUATION := 1.0

var atmosphere: Atmosphere
var info: CityBuilder.CityInfo
var graph: RoadGraph
var lights: TrafficLights
var traffic: TrafficSystem
var breakables: Breakables
var pedestrians: Pedestrians
## Faíscas, fumaça e marcas de pneu do carro do jogador.
var effects: VehicleEffects
var camera: Camera3D

var _pool: Array[OmniLight3D] = []
var _pool_timer := 0.0
var _rain: GPUParticles3D
var _rain_audio: AudioStreamPlayer
var _thunder_delay := -1.0


func _ready() -> void:
	atmosphere = Atmosphere.new()
	atmosphere.name = "Atmosphere"
	add_child(atmosphere)
	info = CityBuilder.new().build(self)
	graph = RoadGraph.current
	lights = TrafficLights.new()
	lights.name = "TrafficLights"
	lights.materials = info.traffic_light_materials
	add_child(lights)
	traffic = TrafficSystem.new()
	traffic.name = "Traffic"
	add_child(traffic)
	traffic.setup(graph, lights)
	breakables = Breakables.new()
	breakables.name = "Breakables"
	add_child(breakables)
	breakables.setup(info.breakable_lamps)
	# Poste derrubado não acende; volta a acender quando é recolocado.
	breakables.broken.connect(func(light: Vector3) -> void: info.street_lamps.erase(light))
	breakables.restored.connect(func(light: Vector3) -> void: info.street_lamps.append(light))
	pedestrians = Pedestrians.new()
	pedestrians.name = "Pedestrians"
	add_child(pedestrians)
	pedestrians.setup(info)
	effects = VehicleEffects.new()
	effects.name = "VehicleEffects"
	add_child(effects)
	traffic.crash.connect(effects.burst)
	for i in STREET_LIGHTS:
		var light := OmniLight3D.new()
		light.light_color = Color(1.0, 0.8, 0.58)
		light.omni_range = STREET_LIGHT_RANGE
		light.omni_attenuation = STREET_LIGHT_ATTENUATION
		light.light_energy = 0.0
		light.shadow_enabled = false
		light.visible = false
		add_child(light)
		_pool.append(light)
	_build_rain()
	atmosphere.lightning.connect(_on_lightning)


func set_camera(value: Camera3D) -> void:
	camera = value
	traffic.camera = value
	breakables.camera = value
	pedestrians.camera = value


func _process(delta: float) -> void:
	traffic.night = atmosphere.night_factor > 0.5
	pedestrians.night = traffic.night
	pedestrians.rain = atmosphere.rain_amount()
	pedestrians.player = traffic.player if is_instance_valid(traffic.player) else null
	pedestrians.wrecks = traffic.wrecks()
	if effects.vehicle != pedestrians.player:
		effects.attach(pedestrians.player)
	effects.wetness = atmosphere.wetness
	_pool_timer -= delta
	if _pool_timer <= 0.0:
		_pool_timer = 0.4
		_update_street_lights()
	_update_rain(delta)


## Liga luzes de verdade só nos postes mais próximos da câmera (os outros só "brilham").
func _update_street_lights() -> void:
	var night := atmosphere.night_factor
	if camera == null or night < 0.05:
		for light in _pool:
			light.visible = false
		return
	var origin := camera.global_position
	var nearest: Array = []
	for lamp in info.street_lamps:
		var distance := lamp.distance_squared_to(origin)
		if distance > 140.0 * 140.0:
			continue
		nearest.append([distance, lamp])
	nearest.sort_custom(func(a: Array, b: Array) -> bool: return a[0] < b[0])
	for i in _pool.size():
		var light := _pool[i]
		if i < nearest.size():
			light.global_position = (nearest[i][1] as Vector3) + Vector3.DOWN * 0.4
			light.light_energy = STREET_LIGHT_ENERGY * night
			light.visible = true
		else:
			light.visible = false


func _build_rain() -> void:
	_rain = GPUParticles3D.new()
	_rain.name = "Rain"
	_rain.amount = 5000
	_rain.lifetime = 1.1
	_rain.emitting = false
	_rain.visibility_aabb = AABB(Vector3(-30, -30, -30), Vector3(60, 60, 60))
	_rain.local_coords = false
	var process := ParticleProcessMaterial.new()
	process.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	process.emission_box_extents = Vector3(24, 1, 24)
	process.direction = Vector3(0.08, -1, 0.05)
	process.spread = 3.0
	process.initial_velocity_min = 20.0
	process.initial_velocity_max = 24.0
	process.gravity = Vector3(0, -9.8, 0)
	_rain.process_material = process
	var streak := QuadMesh.new()
	streak.size = Vector2(0.018, 0.55)
	var material := StandardMaterial3D.new()
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.billboard_mode = BaseMaterial3D.BILLBOARD_FIXED_Y
	material.albedo_color = Color(0.75, 0.8, 0.9, 0.35)
	streak.material = material
	_rain.draw_pass_1 = streak
	_rain.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_rain)
	_rain_audio = AudioStreamPlayer.new()
	_rain_audio.stream = Sfx.get_stream("rain")
	_rain_audio.bus = "Ambient"
	_rain_audio.volume_db = -80.0
	add_child(_rain_audio)


func _update_rain(_delta: float) -> void:
	var amount := atmosphere.rain_amount()
	_rain.emitting = amount > 0.05 and camera != null
	if camera:
		_rain.global_position = camera.global_position + Vector3.UP * 14.0 + camera.global_basis.z * -8.0
	_rain.amount_ratio = clampf(amount, 0.05, 1.0)
	if amount > 0.01:
		if not _rain_audio.playing:
			_rain_audio.play()
		_rain_audio.volume_db = linear_to_db(clampf(amount, 0.0001, 1.0)) - 3.0
	elif _rain_audio.playing:
		_rain_audio.stop()
	if _thunder_delay > 0.0:
		_thunder_delay -= _delta
		if _thunder_delay <= 0.0:
			Sfx.play("thunder", -4.0, randf_range(0.8, 1.1))


func _on_lightning() -> void:
	_thunder_delay = randf_range(0.6, 2.5)
