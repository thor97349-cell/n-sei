class_name Mats
extends RefCounted
## Materiais compartilhados (criados uma vez e reaproveitados).

static var _cache := {}


static func _shader(path: String) -> Shader:
	var key := "shader:" + path
	if not _cache.has(key):
		_cache[key] = load(path)
	return _cache[key]


static func _shader_material(key: String, path: String) -> ShaderMaterial:
	if not _cache.has(key):
		var material := ShaderMaterial.new()
		material.shader = _shader(path)
		_cache[key] = material
	return _cache[key]


static func road() -> ShaderMaterial:
	return _shader_material("road", "res://game/world/shaders/road.gdshader")


static func sidewalk() -> ShaderMaterial:
	return _shader_material("sidewalk", "res://game/world/shaders/sidewalk.gdshader")


static func facade() -> ShaderMaterial:
	return _shader_material("facade", "res://game/world/shaders/facade.gdshader")


static func water() -> ShaderMaterial:
	return _shader_material("water", "res://game/world/shaders/water.gdshader")


static func foliage() -> ShaderMaterial:
	return _shader_material("foliage", "res://game/world/shaders/foliage.gdshader")


## Folhagem escura de pinheiro.
static func foliage_pine() -> ShaderMaterial:
	if not _cache.has("foliage_pine"):
		var material := ShaderMaterial.new()
		material.shader = _shader("res://game/world/shaders/foliage.gdshader")
		material.set_shader_parameter("color_a", Color(0.05, 0.14, 0.07))
		material.set_shader_parameter("color_b", Color(0.14, 0.24, 0.1))
		_cache["foliage_pine"] = material
	return _cache["foliage_pine"]


## kind: 0 grama, 1 terra, 2 asfalto de pátio, 3 praça de pedra.
static func ground(kind: int) -> ShaderMaterial:
	var key := "ground:%d" % kind
	if not _cache.has(key):
		var material := ShaderMaterial.new()
		material.shader = _shader("res://game/world/shaders/ground.gdshader")
		material.set_shader_parameter("kind", kind)
		_cache[key] = material
	return _cache[key]


static func standard(key: String, color: Color, roughness: float = 0.8, metallic: float = 0.0) -> StandardMaterial3D:
	var cache_key := "std:" + key
	if not _cache.has(cache_key):
		var material := StandardMaterial3D.new()
		material.albedo_color = color
		material.roughness = roughness
		material.metallic = metallic
		_cache[cache_key] = material
	return _cache[cache_key]


## Material que usa a cor de cada vértice (várias peças numa malha só).
static func vertex_colored(key: String, roughness: float = 0.8, metallic: float = 0.0) -> StandardMaterial3D:
	var cache_key := "vc:" + key
	if not _cache.has(cache_key):
		var material := StandardMaterial3D.new()
		material.vertex_color_use_as_albedo = true
		material.roughness = roughness
		material.metallic = metallic
		_cache[cache_key] = material
	return _cache[cache_key]


## Pintura automotiva com verniz (clearcoat): reflexo realista.
static func car_paint(color: Color) -> StandardMaterial3D:
	var cache_key := "paint:" + color.to_html()
	if not _cache.has(cache_key):
		var material := StandardMaterial3D.new()
		material.albedo_color = color
		material.metallic = 0.45
		material.roughness = 0.32
		material.clearcoat_enabled = true
		material.clearcoat = 1.0
		material.clearcoat_roughness = 0.06
		_cache[cache_key] = material
	return _cache[cache_key]


static func glass() -> StandardMaterial3D:
	if not _cache.has("glass"):
		var material := StandardMaterial3D.new()
		material.albedo_color = Color(0.05, 0.07, 0.09)
		material.metallic = 0.6
		material.roughness = 0.04
		_cache["glass"] = material
	return _cache["glass"]


static func rubber() -> StandardMaterial3D:
	return standard("rubber", Color(0.04, 0.04, 0.045), 0.9)


static func chrome() -> StandardMaterial3D:
	return standard("chrome", Color(0.8, 0.82, 0.85), 0.12, 1.0)


static func dark_plastic() -> StandardMaterial3D:
	return standard("dark_plastic", Color(0.06, 0.06, 0.065), 0.6)


static func metal(color: Color = Color(0.45, 0.46, 0.48)) -> StandardMaterial3D:
	return standard("metal:" + color.to_html(), color, 0.45, 0.8)


## Luz emissiva sempre acesa (faróis de freio, letreiros).
static func light(color: Color, energy: float = 2.0) -> StandardMaterial3D:
	var cache_key := "light:%s:%s" % [color.to_html(), energy]
	if not _cache.has(cache_key):
		var material := StandardMaterial3D.new()
		material.albedo_color = color
		material.emission_enabled = true
		material.emission = color
		material.emission_energy_multiplier = energy
		material.roughness = 0.3
		_cache[cache_key] = material
	return _cache[cache_key]


## Luz de poste/janela que só acende à noite (usa o parâmetro global "night").
static func night_light(color: Color, energy: float = 4.0) -> ShaderMaterial:
	var cache_key := "nightlight:%s:%s" % [color.to_html(), energy]
	if not _cache.has(cache_key):
		var shader := Shader.new()
		shader.code = """
shader_type spatial;
global uniform float night;
uniform vec3 color : source_color;
uniform float energy;
void fragment() {
	ALBEDO = mix(vec3(0.75), color, 0.4);
	ROUGHNESS = 0.3;
	EMISSION = color * energy * night;
}
"""
		var material := ShaderMaterial.new()
		material.shader = shader
		material.set_shader_parameter("color", color)
		material.set_shader_parameter("energy", energy)
		_cache[cache_key] = material
	return _cache[cache_key]


## Fonte das placas 3D (MSDF: nítida de perto e de longe).
static func sign_font() -> FontFile:
	if not _cache.has("sign_font"):
		var base: FontFile = load("res://assets/fonts/LiberationSans-Bold.ttf")
		var font: FontFile = base.duplicate()
		font.multichannel_signed_distance_field = true
		font.msdf_pixel_range = 16
		font.msdf_size = 48
		_cache["sign_font"] = font
	return _cache["sign_font"]
