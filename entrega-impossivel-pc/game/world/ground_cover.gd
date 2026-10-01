class_name GroundCover
extends RefCounted
## Vegetação rasteira dos gramados: tufos de grama (mais altos na beira, onde o cortador
## não pega) e touceiras de flores. São folhinhas de verdade (triângulos, sem textura
## transparente), desenhadas em MultiMesh por pedaços da cidade e só perto da câmera.
## A cor acompanha as manchas do gramado embaixo (mesmo ruído do chão) e, com a
## distância, os tufos encolhem para dentro do chão (não "pipocam").
##
## Nada nasce onde há colisão (prédios, muros, cercas vivas, bancos...).

const CHUNK := 40.0
const FADE_START := 30.0
const FADE_END := 44.0
## Até onde um pedaço fica ativo: o fim do "encolher" + meia diagonal do pedaço.
const RANGE_END := FADE_END + CHUNK * 0.75
const CELL := 1.5
const EXTENT := 460.0
## Cores das flores (as mesmas estão no shader grass_tuft): branca, amarela, lilás e coral.
const FLOWER_COLORS := 4

var density := 1.0
var _tufts: Array[Transform3D] = []
var _tuft_custom: Array = []
var _flowers: Array[Transform3D] = []
var _flower_custom: Array = []
var _grid := PackedByteArray()
var _size := 0
var _rng := RandomNumberGenerator.new()

static var _meshes := {}


func _init(static_body: StaticBody3D, quality_density: float) -> void:
	_rng.seed = 4242
	density = quality_density
	_size = int(EXTENT * 2.0 / CELL)
	_grid.resize(_size * _size)
	# Marca as células ocupadas por qualquer caixa de colisão acima do chão.
	for child in static_body.get_children():
		var shape := child as CollisionShape3D
		if shape == null or shape.disabled:
			continue
		var box := shape.shape as BoxShape3D
		if box == null:
			continue
		var xform := shape.transform
		var half := box.size / 2.0
		var top := xform.origin.y + absf(xform.basis.y.y) * half.y
		if top < 0.3 or box.size.x > 200.0 or box.size.z > 200.0:
			continue
		var extent := Vector2(
			absf(xform.basis.x.x) * half.x + absf(xform.basis.z.x) * half.z,
			absf(xform.basis.x.z) * half.x + absf(xform.basis.z.z) * half.z)
		_mark(Vector2(xform.origin.x, xform.origin.z) - extent - Vector2.ONE * 0.3, Vector2(xform.origin.x, xform.origin.z) + extent + Vector2.ONE * 0.3)


func _mark(low: Vector2, high: Vector2) -> void:
	var a := _cell(low)
	var b := _cell(high)
	for y in range(maxi(a.y, 0), mini(b.y, _size - 1) + 1):
		for x in range(maxi(a.x, 0), mini(b.x, _size - 1) + 1):
			_grid[y * _size + x] = 1


func _cell(p: Vector2) -> Vector2i:
	return Vector2i(floori((p.x + EXTENT) / CELL), floori((p.y + EXTENT) / CELL))


func is_free(p: Vector2) -> bool:
	var c := _cell(p)
	if c.x < 0 or c.y < 0 or c.x >= _size or c.y >= _size:
		return true
	return _grid[c.y * _size + c.x] == 0


## Espalha num retângulo de gramado: `interior` tufos/m² no meio e `edge` tufos/m² numa
## faixa de `edge_width` metros junto da borda. `skip(p: Vector2) -> bool` exclui pontos.
func scatter(rect: Rect2, y: float, interior: float, edge: float, edge_width: float, flower_chance: float, skip: Callable = Callable()) -> void:
	# No meio, a maioria nasce em touceiras (2 a 6 juntos) e o resto solto: fica com cara de
	# gramado de verdade, não de pontinhos espalhados por igual.
	var inner := int(rect.get_area() * interior * density)
	var placed := 0
	while placed < inner:
		var p := rect.position + Vector2(_rng.randf(), _rng.randf()) * rect.size
		var clump := 1 if _rng.randf() < 0.3 else _rng.randi_range(2, 6)
		for k in clump:
			var offset := Vector2.from_angle(_rng.randf() * TAU) * _rng.randf() * 0.55 * float(k > 0)
			_try(p + offset, y, false, flower_chance, skip)
		placed += clump
	var perimeter := (rect.size.x + rect.size.y) * 2.0
	var outer := int(perimeter * edge_width * edge * density)
	for i in outer:
		var t := _rng.randf() * perimeter
		var inset := pow(_rng.randf(), 1.6) * edge_width
		var p: Vector2
		if t < rect.size.x:
			p = rect.position + Vector2(t, inset)
		elif t < rect.size.x * 2.0:
			p = Vector2(rect.position.x + t - rect.size.x, rect.end.y - inset)
		elif t < rect.size.x * 2.0 + rect.size.y:
			p = Vector2(rect.position.x + inset, rect.position.y + t - rect.size.x * 2.0)
		else:
			p = Vector2(rect.end.x - inset, rect.position.y + t - rect.size.x * 2.0 - rect.size.y)
		_try(p, y, true, flower_chance * 0.6, skip)


func _try(p: Vector2, y: float, tall: bool, flower_chance: float, skip: Callable) -> void:
	if not is_free(p) or (skip.is_valid() and skip.call(p)):
		return
	var scale := _rng.randf_range(0.75, 1.15) * (1.35 if tall else 1.0)
	var basis := Basis(Vector3.UP, _rng.randf() * TAU).scaled(Vector3(scale, scale * _rng.randf_range(0.85, 1.2), scale))
	var xform := Transform3D(basis, Vector3(p.x, y, p.y))
	if _rng.randf() < flower_chance:
		_flowers.append(xform)
		_flower_custom.append(Color(_rng.randf(), _rng.randf(), (float(_rng.randi() % FLOWER_COLORS) + 0.5) / FLOWER_COLORS, 0))
	else:
		_tufts.append(xform)
		_tuft_custom.append(Color(_rng.randf(), _rng.randf() * (0.8 if tall else 0.4), 0, 0))


func count() -> int:
	return _tufts.size() + _flowers.size()


## Cria os pedaços de MultiMesh embaixo de `parent`.
func commit(parent: Node3D) -> void:
	var material := ShaderMaterial.new()
	material.shader = load("res://game/world/shaders/grass_tuft.gdshader")
	material.set_shader_parameter("macro", Mats.texture("macro_noise"))
	material.set_shader_parameter("fade_start", FADE_START)
	material.set_shader_parameter("fade_end", FADE_END)
	_chunks(parent, "Tufts", tuft_mesh(), _tufts, _tuft_custom, material)
	_chunks(parent, "Flowers", flower_mesh(), _flowers, _flower_custom, material)


func _chunks(parent: Node3D, prefix: String, mesh: Mesh, transforms: Array[Transform3D], custom: Array, material: Material) -> void:
	var cells := {}
	for i in transforms.size():
		var origin := transforms[i].origin
		var key := Vector2i(floori(origin.x / CHUNK), floori(origin.z / CHUNK))
		if not cells.has(key):
			cells[key] = []
		(cells[key] as Array).append(i)
	for key: Vector2i in cells:
		var indices: Array = cells[key]
		var multimesh := MultiMesh.new()
		multimesh.transform_format = MultiMesh.TRANSFORM_3D
		multimesh.use_custom_data = true
		multimesh.mesh = mesh
		multimesh.instance_count = indices.size()
		for j in indices.size():
			multimesh.set_instance_transform(j, transforms[indices[j]])
			multimesh.set_instance_custom_data(j, custom[indices[j]])
		var instance := MultiMeshInstance3D.new()
		instance.name = "%s_%d_%d" % [prefix, key.x, key.y]
		instance.multimesh = multimesh
		instance.material_override = material
		instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		instance.visibility_range_end = RANGE_END
		parent.add_child(instance)


# --- malhas ---------------------------------------------------------------------------

## Tufo: 11 folhinhas curvas saindo do centro. COLOR.r = sombra (escuro embaixo).
static func tuft_mesh() -> ArrayMesh:
	if _meshes.has("tuft"):
		return _meshes["tuft"]
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	for i in 14:
		var angle := TAU * i / 14.0 + rng.randf_range(-0.35, 0.35)
		_blade(st, angle, rng.randf_range(0.0, 0.08), rng.randf_range(0.11, 0.27), rng.randf_range(0.024, 0.036), rng.randf_range(0.07, 0.2), 0.0)
	st.index()
	_meshes["tuft"] = st.commit()
	return _meshes["tuft"]


## Touceira de flores: folhinhas + hastes com florzinhas (COLOR.a = 1 na flor).
static func flower_mesh() -> ArrayMesh:
	if _meshes.has("flower"):
		return _meshes["flower"]
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var rng := RandomNumberGenerator.new()
	rng.seed = 11
	for i in 7:
		_blade(st, TAU * i / 7.0 + rng.randf_range(-0.3, 0.3), 0.02, rng.randf_range(0.1, 0.18), 0.02, 0.08, 0.0)
	for i in 5:
		var angle := TAU * i / 5.0 + rng.randf_range(-0.4, 0.4)
		var lean := rng.randf_range(0.03, 0.1)
		var height := rng.randf_range(0.2, 0.32)
		_blade(st, angle, 0.02, height, 0.008, lean, 0.0)
		var tip := Vector3(cos(angle) * (0.02 + lean), height, sin(angle) * (0.02 + lean))
		for k in 2:
			var spin := k * PI / 2.0 + angle
			var right := Vector3(cos(spin), 0, sin(spin)) * 0.03
			var forward := Vector3(-sin(spin), 0, cos(spin)) * 0.03
			var corners := [tip - right - forward, tip + right - forward, tip + right + forward, tip - right + forward]
			for index: int in [0, 1, 2, 0, 2, 3]:
				st.set_color(Color(1, 1, 1, 1))
				st.set_normal(Vector3.UP)
				st.add_vertex(corners[index] + Vector3(0, 0.005 * k, 0))
	st.index()
	_meshes["flower"] = st.commit()
	return _meshes["flower"]


## Uma folhinha: base larga, meio e ponta, inclinada para fora (3 triângulos).
static func _blade(st: SurfaceTool, angle: float, offset: float, height: float, width: float, lean: float, flag: float) -> void:
	var out := Vector3(cos(angle), 0, sin(angle))
	var side := Vector3(-out.z, 0, out.x)
	var base := out * offset
	var mid := base + out * lean * 0.45 + Vector3.UP * height * 0.55
	var tip := base + out * lean + Vector3.UP * height
	var points := [base - side * width / 2.0, base + side * width / 2.0, mid + side * width * 0.35, mid - side * width * 0.35, tip]
	var shades := [0.35, 0.35, 0.75, 0.75, 1.0]
	var normal := (Vector3.UP + out * 0.45).normalized()
	for index: int in [0, 1, 2, 0, 2, 3, 3, 2, 4]:
		st.set_color(Color(shades[index], shades[index], shades[index], flag))
		st.set_normal(normal)
		st.add_vertex(points[index])
