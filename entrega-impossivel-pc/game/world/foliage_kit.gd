class_name FoliageKit
extends RefCounted
## Árvores geradas por código.
##
## Perto da câmera: tronco + galhos + dezenas de "cartões" de folhas (placas com uma
## textura de ramos com folhinhas, recortada pelo contorno) espalhados pela copa, com as
## normais apontando para fora da copa (sombreado macio) e um miolo escuro para a copa
## não ficar vazada. Longe: versão simples (tronco + copa lisa) para economizar.
##
## Espécies: "round" (copa redonda), "tall" (copa alta), "umbrella" (copa larga, tipo
## ipê/flamboyant), "pine" (pinheiro) e "palm" (palmeira).

const SPECIES := ["round", "tall", "umbrella", "pine", "palm"]
const BROADLEAF := ["round", "tall", "umbrella"]

## Forma de cada espécie: altura do tronco, raio do tronco, centro e raios da copa,
## número de cartões e tamanho (mín., máx.) dos cartões em metros.
const SHAPES := {
	"round": {"trunk": 3.0, "trunk_radius": 0.17, "crown": Vector3(0, 4.7, 0), "radii": Vector3(2.5, 2.1, 2.5), "cards": 78, "card": Vector2(1.3, 1.9)},
	"tall": {"trunk": 3.6, "trunk_radius": 0.15, "crown": Vector3(0, 5.9, 0), "radii": Vector3(1.7, 3.0, 1.7), "cards": 70, "card": Vector2(1.1, 1.6)},
	"umbrella": {"trunk": 3.3, "trunk_radius": 0.2, "crown": Vector3(0, 5.0, 0), "radii": Vector3(3.3, 1.25, 3.3), "cards": 86, "card": Vector2(1.4, 2.0)},
	# Arbusto (sem tronco), para jardins e parque.
	"bush": {"trunk": 0.0, "trunk_radius": 0.0, "crown": Vector3(0, 0.55, 0), "radii": Vector3(0.85, 0.62, 0.85), "cards": 30, "card": Vector2(0.5, 0.8)},
}

static var _cache := {}


# --- texturas ---------------------------------------------------------------------------

static func _blank(width: int, height: int) -> Image:
	var image := Image.create(width, height, false, Image.FORMAT_RGBA8)
	image.fill(Color(0.5, 0.5, 0.5, 0.0))
	return image


## Desenha uma folha (elipse pontuda com nervura) no atlas.
static func _leaf(image: Image, center: Vector2, length: float, width: float, angle: float, shade: float) -> void:
	var direction := Vector2(cos(angle), sin(angle))
	var side := Vector2(-direction.y, direction.x)
	var reach := int(ceil(length * 0.5 + 2.0))
	var size := image.get_size()
	for y in range(int(center.y) - reach, int(center.y) + reach + 1):
		if y < 0 or y >= size.y:
			continue
		for x in range(int(center.x) - reach, int(center.x) + reach + 1):
			if x < 0 or x >= size.x:
				continue
			var offset := Vector2(x + 0.5, y + 0.5) - center
			var u := offset.dot(direction) / (length * 0.5)
			var v := offset.dot(side) / (width * 0.5)
			# Folha mais larga no meio e pontuda nas pontas.
			var profile := 1.0 - u * u
			if profile <= 0.0:
				continue
			var edge := absf(v) - sqrt(profile) * (1.0 - 0.25 * u)
			if edge > 0.08:
				continue
			var alpha := clampf((0.08 - edge) / 0.16, 0.0, 1.0)
			var tone := shade * (0.85 + 0.25 * (1.0 - absf(v)))
			if absf(v) < 0.07:
				tone *= 0.8
			var previous := image.get_pixel(x, y)
			var value := lerpf(previous.r if previous.a > 0.0 else tone, tone, alpha)
			image.set_pixel(x, y, Color(value, value, value, maxf(previous.a, alpha)))


static func _line(image: Image, from: Vector2, to: Vector2, thickness: float, tone: float) -> void:
	var steps := int(from.distance_to(to))
	for i in steps + 1:
		var p := from.lerp(to, float(i) / maxf(steps, 1))
		for dy in range(-int(thickness), int(thickness) + 1):
			for dx in range(-int(thickness), int(thickness) + 1):
				var x := int(p.x) + dx
				var y := int(p.y) + dy
				if x >= 0 and y >= 0 and x < image.get_width() and y < image.get_height():
					image.set_pixel(x, y, Color(tone, tone, tone, 1.0))


static func _texture(image: Image) -> ImageTexture:
	image.generate_mipmaps()
	return ImageTexture.create_from_image(image)


## Ramo de folhas largas (tons de cinza: a cor vem do material, por árvore).
static func leaf_texture() -> ImageTexture:
	if _cache.has("tex:leaf"):
		return _cache["tex:leaf"]
	var rng := RandomNumberGenerator.new()
	rng.seed = 881
	var image := _blank(256, 256)
	var center := Vector2(128, 128)
	# Raminhos finos por baixo das folhas.
	for i in 5:
		var angle := rng.randf() * TAU
		_line(image, center, center + Vector2(cos(angle), sin(angle)) * rng.randf_range(60, 100), 1.0, 0.25)
	for i in 95:
		var angle := rng.randf() * TAU
		var distance := sqrt(rng.randf()) * 104.0
		var p := center + Vector2(cos(angle), sin(angle)) * distance
		_leaf(image, p, rng.randf_range(20.0, 32.0), rng.randf_range(9.0, 14.0), rng.randf() * TAU, rng.randf_range(0.45, 0.75))
	var texture := _texture(image)
	_cache["tex:leaf"] = texture
	return texture


## Ramo de pinheiro: agulhas saindo de um galhinho central.
static func needle_texture() -> ImageTexture:
	if _cache.has("tex:needle"):
		return _cache["tex:needle"]
	var rng := RandomNumberGenerator.new()
	rng.seed = 412
	var image := _blank(256, 256)
	var base := Vector2(128, 250)
	var tip := Vector2(128, 12)
	_line(image, base, tip, 1.0, 0.3)
	for i in 70:
		var t := rng.randf_range(0.05, 0.95)
		var p := base.lerp(tip, t)
		var spread := (1.0 - t) * 70.0 + 18.0
		for sign_value: float in [-1.0, 1.0]:
			var end := p + Vector2(sign_value * spread * rng.randf_range(0.6, 1.0), -rng.randf_range(8.0, 22.0))
			_line(image, p, end, 1.0, rng.randf_range(0.45, 0.7))
	var texture := _texture(image)
	_cache["tex:needle"] = texture
	return texture


## Folha de palmeira: nervura central com folíolos dos dois lados, afinando na ponta.
static func frond_texture() -> ImageTexture:
	if _cache.has("tex:frond"):
		return _cache["tex:frond"]
	var rng := RandomNumberGenerator.new()
	rng.seed = 97
	var image := _blank(256, 64)
	_line(image, Vector2(0, 32), Vector2(255, 32), 1.0, 0.35)
	for i in 46:
		var x := 6.0 + i * 5.4
		var length := 26.0 * (1.0 - float(i) / 52.0) + 4.0
		for sign_value: float in [-1.0, 1.0]:
			var end := Vector2(x + 10.0, 32.0 + sign_value * length)
			_line(image, Vector2(x, 32), end, 1.0, rng.randf_range(0.5, 0.72))
	var texture := _texture(image)
	_cache["tex:frond"] = texture
	return texture


# --- materiais --------------------------------------------------------------------------

static func leaf_material(kind: String) -> ShaderMaterial:
	var key := "mat:" + kind
	if _cache.has(key):
		return _cache[key]
	var material := ShaderMaterial.new()
	material.shader = load("res://game/world/shaders/leaves.gdshader")
	match kind:
		"pine":
			material.set_shader_parameter("leaf_texture", needle_texture())
			material.set_shader_parameter("color_a", Color(0.07, 0.17, 0.08))
			material.set_shader_parameter("color_b", Color(0.14, 0.26, 0.11))
		"palm":
			material.set_shader_parameter("leaf_texture", frond_texture())
			material.set_shader_parameter("color_a", Color(0.2, 0.34, 0.1))
			material.set_shader_parameter("color_b", Color(0.36, 0.44, 0.14))
		"hedge":
			# Cerca viva (malha comum, sem dados por árvore): um verde médio fixo.
			material.set_shader_parameter("leaf_texture", leaf_texture())
			material.set_shader_parameter("color_a", Color(0.22, 0.38, 0.11))
			material.set_shader_parameter("color_b", Color(0.22, 0.38, 0.11))
		_:
			material.set_shader_parameter("leaf_texture", leaf_texture())
			material.set_shader_parameter("color_a", Color(0.16, 0.33, 0.09))
			material.set_shader_parameter("color_b", Color(0.38, 0.5, 0.14))
	_cache[key] = material
	return material


static func core_material(kind: String) -> ShaderMaterial:
	var key := "core:" + kind
	if _cache.has(key):
		return _cache[key]
	var material := (Mats.foliage_pine() if kind == "pine" else Mats.foliage()).duplicate() as ShaderMaterial
	material.set_shader_parameter("darken", 0.72)
	if kind == "hedge":
		material.set_shader_parameter("darken", 0.98)
		material.set_shader_parameter("color_a", Color(0.15, 0.27, 0.08))
	_cache[key] = material
	return material


# --- malhas ------------------------------------------------------------------------------

## Malha da árvore. `detailed` = versão de perto (cartões de folhas).
static func tree_mesh(species: String, detailed: bool) -> ArrayMesh:
	var key := "mesh:%s:%s" % [species, detailed]
	if _cache.has(key):
		return _cache[key]
	var mesh: ArrayMesh
	match species:
		"pine":
			mesh = _pine(detailed)
		"palm":
			mesh = _palm(detailed)
		_:
			mesh = _broadleaf(species, detailed)
	_cache[key] = mesh
	return mesh


static func _bark_kit(trunk: float, radius: float) -> MeshKit:
	var kit := MeshKit.new()
	kit.add_cylinder(Transform3D(), radius, trunk + 0.6, 8, Color(0.3, 0.22, 0.16), false)
	return kit


static func _branch(kit: MeshKit, from: Vector3, to: Vector3, radius: float) -> void:
	var direction := to - from
	var up := direction.normalized()
	var side := up.cross(Vector3.FORWARD if absf(up.z) < 0.9 else Vector3.RIGHT).normalized()
	var basis := Basis(side, up, side.cross(up).normalized())
	kit.add_cylinder(Transform3D(basis, from), radius, direction.length(), 6, Color(0.29, 0.21, 0.15), false)


static func _broadleaf(species: String, detailed: bool) -> ArrayMesh:
	var shape: Dictionary = SHAPES[species]
	var trunk: float = shape["trunk"]
	var center: Vector3 = shape["crown"]
	var radii: Vector3 = shape["radii"]
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(species)
	var mesh := ArrayMesh.new()
	if trunk > 0.0:
		var bark := _bark_kit(trunk, shape["trunk_radius"])
		# Galhos saindo do alto do tronco para dentro da copa.
		for i in 4:
			var angle := TAU * i / 4.0 + rng.randf_range(-0.4, 0.4)
			var tip := center + Vector3(cos(angle) * radii.x * 0.6, radii.y * rng.randf_range(-0.1, 0.35), sin(angle) * radii.z * 0.6)
			_branch(bark, Vector3(0, trunk * 0.85, 0), tip, float(shape["trunk_radius"]) * 0.55)
		mesh = bark.commit(Mats.vertex_colored("bark", 0.9))
	# Miolo (esconde o vazio entre os cartões e dá volume).
	var core_scale := radii * (0.72 if detailed else 1.0)
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var sphere := SphereMesh.new()
	sphere.radial_segments = 10 if detailed else 12
	sphere.rings = 6
	sphere.radius = 1.0
	sphere.height = 2.0
	st.append_from(sphere, 0, Transform3D(Basis().scaled(core_scale), center))
	if not detailed:
		# Longe: alguns volumes extras para a silhueta não ficar uma bola perfeita.
		for i in 4:
			var angle := TAU * i / 4.0 + 0.5
			var offset := Vector3(cos(angle) * radii.x * 0.45, rng.randf_range(-0.2, 0.3) * radii.y, sin(angle) * radii.z * 0.45)
			st.append_from(sphere, 0, Transform3D(Basis().scaled(radii * 0.6), center + offset))
	st.set_material(core_material("broadleaf") if detailed else Mats.foliage())
	st.commit(mesh)
	if detailed:
		var cards := SurfaceTool.new()
		cards.begin(Mesh.PRIMITIVE_TRIANGLES)
		_crown_cards(cards, center, radii, shape["cards"], shape["card"], rng)
		cards.set_material(leaf_material("broadleaf"))
		cards.commit(mesh)
	return mesh


## Espalha cartões de folhas pela copa (mais na superfície do que no miolo).
static func _crown_cards(st: SurfaceTool, center: Vector3, radii: Vector3, count: int, card: Vector2, rng: RandomNumberGenerator) -> void:
	for i in count:
		var direction := Vector3(rng.randf_range(-1, 1), rng.randf_range(-0.75, 1.0), rng.randf_range(-1, 1)).normalized()
		var depth := lerpf(0.55, 1.02, sqrt(rng.randf()))
		var point := center + direction * radii * depth
		var outward := ((point - center) / (radii * radii)).normalized()
		var facing := (outward + Vector3(rng.randf_range(-0.6, 0.6), rng.randf_range(-0.3, 0.6), rng.randf_range(-0.6, 0.6))).normalized()
		var size := rng.randf_range(card.x, card.y)
		var ao := lerpf(0.62, 1.0, (depth - 0.55) / 0.47) * (0.82 + 0.18 * maxf(outward.y, 0.0))
		_card(st, point, facing, outward, size, size, rng.randf() * TAU, ao)


## Um cartão quadrado centrado em `point`, virado para `facing`, com a normal da copa.
static func _card(st: SurfaceTool, point: Vector3, facing: Vector3, normal: Vector3, width: float, height: float, spin: float, ao: float, uv_rect: Rect2 = Rect2(0, 0, 1, 1)) -> void:
	var helper := Vector3.UP if absf(facing.y) < 0.9 else Vector3.RIGHT
	var right := facing.cross(helper).normalized().rotated(facing, spin)
	var up := right.cross(facing).normalized()
	var hw := right * width / 2.0
	var hh := up * height / 2.0
	var corners := [point - hw + hh, point + hw + hh, point + hw - hh, point - hw - hh]
	var uvs := [uv_rect.position, Vector2(uv_rect.end.x, uv_rect.position.y), uv_rect.end, Vector2(uv_rect.position.x, uv_rect.end.y)]
	for index: int in [0, 1, 2, 0, 2, 3]:
		st.set_normal(normal)
		st.set_color(Color(ao, ao, ao))
		st.set_uv(uvs[index])
		st.add_vertex(corners[index])


static func _pine(detailed: bool) -> ArrayMesh:
	var bark := _bark_kit(2.2, 0.2)
	var mesh := bark.commit(Mats.vertex_colored("bark", 0.9))
	var layers := [[1.6, 2.8, 3.6], [3.4, 2.3, 3.2], [5.0, 1.7, 2.8], [6.5, 1.1, 2.3]]
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for layer: Array in layers:
		var cone := CylinderMesh.new()
		cone.top_radius = 0.0
		cone.bottom_radius = float(layer[1]) * (0.8 if detailed else 1.0)
		cone.height = layer[2]
		cone.radial_segments = 10
		cone.rings = 1
		cone.cap_top = false
		st.append_from(cone, 0, Transform3D(Basis(), Vector3(0, float(layer[0]) + float(layer[2]) / 2.0, 0)))
	st.set_material(core_material("pine") if detailed else Mats.foliage_pine())
	st.commit(mesh)
	if detailed:
		var rng := RandomNumberGenerator.new()
		rng.seed = 5501
		var cards := SurfaceTool.new()
		cards.begin(Mesh.PRIMITIVE_TRIANGLES)
		for layer: Array in layers:
			var base_y: float = layer[0]
			var radius: float = layer[1]
			var height: float = layer[2]
			var count := int(radius * 5.0) + 4
			for i in count:
				var angle := TAU * i / count + rng.randf_range(-0.2, 0.2)
				var out := Vector3(cos(angle), 0, sin(angle))
				var y := base_y + rng.randf_range(0.1, 0.45) * height
				var reach := radius * (1.0 - (y - base_y) / height) * 0.75
				var point := out * reach * 0.6 + Vector3(0, y, 0)
				# Ramo inclinado para baixo, virado para fora.
				var facing := (out * 0.35 + Vector3.UP).normalized()
				var normal := (out + Vector3.UP * 0.4).normalized()
				var along := out.rotated(Vector3.UP, 0.0)
				_frond(cards, point, along, facing, normal, maxf(reach * 1.1, 0.8), 0.9, -0.35, Rect2(0, 0, 1, 1), 0.8)
		cards.set_material(leaf_material("pine"))
		cards.commit(mesh)
	return mesh


## Tira em dois pedaços (ramo de pinheiro ou folha de palmeira) que se curva para baixo.
static func _frond(st: SurfaceTool, base: Vector3, direction: Vector3, _facing: Vector3, normal: Vector3, length: float, width: float, droop: float, _uv: Rect2, ao: float) -> void:
	var side := direction.cross(Vector3.UP).normalized()
	if side.length() < 0.1:
		side = Vector3.RIGHT
	var mid := base + direction * length * 0.5 + Vector3.UP * length * 0.08
	var tip := base + direction * length + Vector3.UP * droop * length
	var points := [base, mid, tip]
	var widths := [width * 0.35, width * 0.5, width * 0.15]
	for segment in 2:
		var a: Vector3 = points[segment]
		var b: Vector3 = points[segment + 1]
		var wa: float = widths[segment]
		var wb: float = widths[segment + 1]
		var u0 := segment * 0.5
		var u1 := u0 + 0.5
		var corners := [a + side * wa, b + side * wb, b - side * wb, a - side * wa]
		var uvs := [Vector2(u0, 0.0), Vector2(u1, 0.0), Vector2(u1, 1.0), Vector2(u0, 1.0)]
		for index: int in [0, 1, 2, 0, 2, 3]:
			st.set_normal(normal)
			st.set_color(Color(ao, ao, ao))
			st.set_uv(uvs[index])
			st.add_vertex(corners[index])


static func _palm(detailed: bool) -> ArrayMesh:
	# Tronco levemente curvo, em anéis.
	var bark := MeshKit.new()
	var height := 7.4
	var segments := 6
	var previous := Vector3.ZERO
	for i in segments:
		var t := float(i + 1) / segments
		var point := Vector3(0.35 * t * t, height * t, 0)
		_branch(bark, previous, point, lerpf(0.24, 0.16, t))
		previous = point
	var top := previous
	var mesh := bark.commit(Mats.vertex_colored("palm_bark", 0.85))
	if not detailed:
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		var sphere := SphereMesh.new()
		sphere.radial_segments = 10
		sphere.rings = 5
		st.append_from(sphere, 0, Transform3D(Basis().scaled(Vector3(2.8, 0.55, 2.8)), top + Vector3(0, -0.2, 0)))
		st.set_material(Mats.foliage())
		st.commit(mesh)
		return mesh
	var rng := RandomNumberGenerator.new()
	rng.seed = 7070
	var cards := SurfaceTool.new()
	cards.begin(Mesh.PRIMITIVE_TRIANGLES)
	var count := 11
	for i in count:
		var angle := TAU * i / count + rng.randf_range(-0.15, 0.15)
		var out := Vector3(cos(angle), 0, sin(angle))
		var lift := rng.randf_range(-0.15, 0.35)
		var direction := (out + Vector3.UP * lift).normalized()
		_frond(cards, top, direction, Vector3.UP, (out + Vector3.UP).normalized(), rng.randf_range(3.6, 4.6), 1.5, rng.randf_range(-0.55, -0.3), Rect2(0, 0, 1, 1), 0.95)
	cards.set_material(leaf_material("palm"))
	cards.commit(mesh)
	return mesh


## Folhas de uma cerca viva (caixa `size`, base no chão, em `xform`): cartões no topo e
## nas duas faces compridas. `cards` recebe os cartões e `core` a caixa de miolo.
static func add_hedge(cards: SurfaceTool, core: MeshKit, xform: Transform3D, size: Vector3, rng: RandomNumberGenerator) -> void:
	core.add_box(Transform3D(xform.basis, xform.origin), Vector3(size.x - 0.08, size.y - 0.06, size.z - 0.1), Color.WHITE)
	var count := int(size.x * 15.0)
	for i in count:
		# 1/4 no alto, o resto dividido entre os dois lados compridos.
		var face := 0 if rng.randf() < 0.25 else (1 if rng.randf() < 0.5 else 2)
		var local: Vector3
		var normal: Vector3
		if face == 0:
			local = Vector3(rng.randf_range(-0.5, 0.5) * size.x, size.y - 0.02, rng.randf_range(-0.45, 0.45) * size.z)
			normal = Vector3.UP
		else:
			var side := 1.0 if face == 1 else -1.0
			local = Vector3(rng.randf_range(-0.5, 0.5) * size.x, rng.randf_range(0.15, 0.95) * size.y, side * size.z * 0.5)
			normal = Vector3(0, 0.25, side).normalized()
		var point := xform * local
		var world_normal := (xform.basis * normal).normalized()
		var facing := (world_normal + Vector3(rng.randf_range(-0.5, 0.5), rng.randf_range(-0.2, 0.5), rng.randf_range(-0.5, 0.5))).normalized()
		var card := rng.randf_range(0.45, 0.7)
		_card(cards, point, facing, world_normal, card, card, rng.randf() * TAU, rng.randf_range(0.75, 1.0))
