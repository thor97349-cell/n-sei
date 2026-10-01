class_name Atmosphere
extends Node3D
## Céu, sol, lua, neblina, pós-processamento e ciclo dia/noite + chuva.
## Atualiza os parâmetros globais dos shaders: "night" (0 dia → 1 noite) e "wetness".

signal lightning

var environment: Environment
var sun: DirectionalLight3D
var moon: DirectionalLight3D
var sky_material: PhysicalSkyMaterial

## Minutos desde a meia-noite (o relógio avança se `clock_running`).
var minutes := 9.0 * 60.0
var clock_running := true
var raining := false
var night_factor := 0.0
var wetness := 0.0

var _rain_amount := 0.0
var _next_lightning := 8.0
var _flash := 0.0
var _stars: ImageTexture


func _ready() -> void:
	sky_material = PhysicalSkyMaterial.new()
	sky_material.rayleigh_coefficient = 2.0
	sky_material.mie_coefficient = 0.004
	sky_material.mie_eccentricity = 0.8
	sky_material.turbidity = 5.0
	sky_material.sun_disk_scale = 1.4
	sky_material.ground_color = Color(0.22, 0.2, 0.18)
	sky_material.energy_multiplier = 1.0
	sky_material.use_debanding = true
	_stars = _star_texture()
	var sky := Sky.new()
	sky.sky_material = sky_material
	sky.radiance_size = Sky.RADIANCE_SIZE_256

	environment = Environment.new()
	environment.background_mode = Environment.BG_SKY
	environment.sky = sky
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	environment.ambient_light_sky_contribution = 1.0
	environment.ambient_light_energy = 1.0
	environment.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	environment.tonemap_mode = Environment.TONE_MAPPER_AGX
	environment.tonemap_exposure = 1.0
	environment.ssao_radius = 1.4
	environment.ssao_intensity = 1.8
	environment.ssao_power = 1.4
	environment.ssil_radius = 4.0
	environment.ssil_intensity = 0.8
	environment.ssr_max_steps = 56
	environment.ssr_fade_in = 0.15
	environment.ssr_fade_out = 2.0
	environment.ssr_depth_tolerance = 0.3
	environment.sdfgi_use_occlusion = true
	environment.sdfgi_cascades = 4
	environment.sdfgi_min_cell_size = 0.4
	environment.glow_enabled = true
	environment.glow_intensity = 0.3
	environment.glow_bloom = 0.04
	environment.glow_hdr_threshold = 1.2
	environment.glow_blend_mode = Environment.GLOW_BLEND_MODE_SOFTLIGHT
	environment.fog_enabled = true
	environment.fog_light_color = Color(0.62, 0.68, 0.78)
	environment.fog_density = 0.00035
	environment.fog_aerial_perspective = 0.3
	environment.fog_sky_affect = 0.12
	environment.volumetric_fog_density = 0.004
	environment.volumetric_fog_albedo = Color(0.85, 0.88, 0.92)
	environment.volumetric_fog_length = 120.0
	environment.volumetric_fog_anisotropy = 0.6
	environment.volumetric_fog_sky_affect = 0.0
	environment.adjustment_enabled = true
	environment.adjustment_contrast = 1.08
	environment.adjustment_saturation = 1.08

	var world_environment := WorldEnvironment.new()
	world_environment.environment = environment
	add_child(world_environment)

	sun = DirectionalLight3D.new()
	sun.name = "Sun"
	sun.shadow_enabled = true
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_4_SPLITS
	sun.directional_shadow_blend_splits = true
	sun.shadow_blur = 1.2
	sun.light_angular_distance = 0.6
	sun.shadow_normal_bias = 1.4
	sun.light_temperature = 5600.0
	add_child(sun)

	moon = DirectionalLight3D.new()
	moon.name = "Moon"
	moon.light_color = Color(0.55, 0.65, 0.95)
	moon.light_energy = 0.0
	moon.shadow_enabled = false
	moon.sky_mode = DirectionalLight3D.SKY_MODE_LIGHT_ONLY
	add_child(moon)

	apply_quality()
	Bus.settings_changed.connect(apply_quality)
	_update_sky(0.0)


func apply_quality() -> void:
	var q := Settings.quality()
	environment.ssao_enabled = q["ssao"]
	environment.ssil_enabled = q["ssil"]
	environment.ssr_enabled = q["ssr"]
	environment.sdfgi_enabled = q["sdfgi"]
	environment.volumetric_fog_enabled = q["volumetric_fog"]
	sun.directional_shadow_max_distance = q["shadow_distance"]


func set_rain(active: bool) -> void:
	raining = active
	_next_lightning = randf_range(6.0, 14.0)


func _process(delta: float) -> void:
	if clock_running:
		minutes = fmod(minutes + delta * GameConfig.CLOCK_SPEED, 1440.0)
	_rain_amount = move_toward(_rain_amount, 1.0 if raining else 0.0, delta / (8.0 if raining else 25.0))
	wetness = move_toward(wetness, 1.0 if raining else 0.0, delta / (20.0 if raining else 70.0))
	if raining:
		_next_lightning -= delta
		if _next_lightning <= 0.0:
			_next_lightning = randf_range(9.0, 20.0)
			_flash = 1.0
			lightning.emit()
	_flash = maxf(_flash - delta * 5.0, 0.0)
	_update_sky(delta)


## Ângulo do sol ao longo do dia: nasce 6h, meio-dia no alto, põe-se 18h30.
func sun_elevation_degrees() -> float:
	var day_fraction := (minutes - 360.0) / 750.0
	if day_fraction >= 0.0 and day_fraction <= 1.0:
		return sin(day_fraction * PI) * 68.0
	# Noite: das 18h30 (1110 min) às 6h do dia seguinte (690 min).
	var night_minutes := minutes - 1110.0 if minutes >= 1110.0 else minutes + 330.0
	return -sin(clampf(night_minutes / 690.0, 0.0, 1.0) * PI) * 20.0


func _update_sky(_delta: float) -> void:
	var elevation := sun_elevation_degrees()
	var azimuth := lerpf(100.0, 260.0, clampf((minutes - 360.0) / 750.0, 0.0, 1.0))
	sun.rotation_degrees = Vector3(-maxf(elevation, 2.0), azimuth, 0.0)
	moon.rotation_degrees = Vector3(-45.0, azimuth + 180.0, 0.0)

	night_factor = 1.0 - smoothstep(-6.0, 8.0, elevation)
	var day := 1.0 - night_factor
	var golden := 1.0 - smoothstep(4.0, 22.0, elevation)
	var storm := _rain_amount

	sun.light_energy = day * lerpf(1.55, 0.35, storm) + _flash * 2.5
	# Sol levemente quente de dia, alaranjado no fim de tarde.
	sun.light_color = Color(1.0, 0.96, 0.9).lerp(Color(1.0, 0.7, 0.42), golden * day)
	sun.shadow_opacity = lerpf(1.0, 0.45, storm)
	sun.visible = day > 0.01 or _flash > 0.0
	moon.light_energy = night_factor * 0.12
	moon.visible = night_factor > 0.01

	sky_material.energy_multiplier = lerpf(1.0, 0.08, night_factor) * lerpf(1.0, 0.45, storm) + _flash * 2.0
	sky_material.turbidity = lerpf(5.0, 30.0, storm)
	sky_material.rayleigh_color = Color(0.22, 0.42, 0.78).lerp(Color(0.36, 0.38, 0.42), storm)
	environment.ambient_light_energy = lerpf(1.0, 0.35, night_factor) + _flash
	# De dia: luz do céu misturada com um ambiente neutro (sombras menos azuladas).
	# À noite o céu quase não ilumina: um ambiente azulado fraco mantém a rua legível.
	environment.ambient_light_sky_contribution = lerpf(0.72, 0.0, night_factor) * lerpf(1.0, 0.85, storm)
	environment.ambient_light_color = Color(0.5, 0.5, 0.47).lerp(Color(0.09, 0.11, 0.18), night_factor).lerp(Color(0.36, 0.38, 0.42), storm * day)
	environment.fog_density = lerpf(0.00035, 0.006, storm) + night_factor * 0.0006
	environment.fog_light_color = Color(0.62, 0.68, 0.78).lerp(Color(0.06, 0.07, 0.1), night_factor).lerp(Color(0.4, 0.43, 0.48), storm * day)
	environment.volumetric_fog_density = lerpf(0.003, 0.02, storm)
	environment.tonemap_exposure = lerpf(1.02, 1.6, night_factor)

	# Estrelas só à noite e sem chuva (o céu físico soma a textura sempre).
	var show_stars := night_factor > 0.6 and storm < 0.3
	if show_stars != (sky_material.night_sky != null):
		sky_material.night_sky = _stars if show_stars else null
	RenderingServer.global_shader_parameter_set("night", night_factor)
	RenderingServer.global_shader_parameter_set("wetness", wetness)


## Céu estrelado (textura equirretangular gerada uma vez).
func _star_texture() -> ImageTexture:
	var width := 2048
	var height := 1024
	var image := Image.create(width, height, false, Image.FORMAT_RGB8)
	image.fill(Color(0.004, 0.006, 0.012))
	var rng := RandomNumberGenerator.new()
	rng.seed = 1789
	for i in 2600:
		var x := rng.randi_range(0, width - 1)
		# Só na metade de cima (acima do horizonte).
		var y := rng.randi_range(0, height / 2 - 8)
		var brightness := pow(rng.randf(), 3.0) * 0.6 + 0.08
		var tint := Color(0.85, 0.9, 1.0).lerp(Color(1.0, 0.9, 0.75), rng.randf())
		image.set_pixel(x, y, tint * brightness)
	return ImageTexture.create_from_image(image)


func rain_amount() -> float:
	return _rain_amount


func clock_text() -> String:
	var total := int(minutes)
	return "%02d:%02d" % [total / 60, total % 60]
