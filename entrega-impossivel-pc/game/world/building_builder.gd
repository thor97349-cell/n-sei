class_name BuildingBuilder
extends RefCounted
## Prédios: primeiro os locais do jogo (com letreiro e detalhes próprios), depois os
## lotes comuns de cada quarteirão conforme o tema (CityLayout.THEME_RULES).
##
## Cada quarteirão vira poucas malhas (fachadas + detalhes + placas) para o motor
## descartar o que está fora da câmera. Todo prédio tem colisão.
##
## Convenção local de um prédio: +Z = frente (virada para a rua), X = ao longo da
## calçada. `size` = (largura ao longo da rua, altura, profundidade).

const STYLE_ALPHA := {
	"office": 0.0, "apartment": 0.2, "house": 0.4, "glass": 0.6, "warehouse": 0.8, "shed": 0.8, "shop": 1.0,
}
## Térreo e altura de andar usados pelo shader de fachada, por estilo.
const FLOORS := {
	"office": Vector2(4.2, 3.2), "apartment": Vector2(3.2, 3.2), "house": Vector2(3.0, 3.0),
	"glass": Vector2(5.0, 3.6), "warehouse": Vector2(0.0, 7.0), "shed": Vector2(0.0, 7.0), "shop": Vector2(3.6, 3.2),
}
const HOUSE_COLORS: Array[Color] = [
	Color(0.95, 0.88, 0.7), Color(0.9, 0.93, 0.95), Color(0.98, 0.8, 0.62), Color(0.72, 0.85, 0.75),
	Color(0.8, 0.82, 0.92), Color(0.96, 0.72, 0.7), Color(0.93, 0.9, 0.84), Color(0.78, 0.65, 0.52),
]
const GLASS_COLORS: Array[Color] = [
	Color(0.3, 0.42, 0.52), Color(0.26, 0.36, 0.33), Color(0.44, 0.5, 0.56), Color(0.22, 0.28, 0.4),
]
const INDUSTRIAL_COLORS: Array[Color] = [
	Color(0.58, 0.6, 0.62), Color(0.7, 0.68, 0.62), Color(0.48, 0.55, 0.62), Color(0.64, 0.58, 0.5), Color(0.75, 0.76, 0.76),
]
const AWNING_COLORS: Array[Color] = [
	Color(0.75, 0.15, 0.12), Color(0.1, 0.4, 0.25), Color(0.12, 0.3, 0.6), Color(0.9, 0.55, 0.1), Color(0.35, 0.2, 0.45),
]
const SHOP_NAMES: Array[String] = [
	"MERCADINHO SOL", "LANCHONETE TOP", "BARBEARIA NAVALHA", "ÓTICA VISÃO", "LOJA DO REAL",
	"PAPELARIA LÁPIS", "SORVETERIA GELATO", "AÇAÍ DA PRAÇA", "PET SHOP AMIGO", "FLORICULTURA",
	"ACADEMIA FORÇA", "LAVANDERIA", "CAFÉ AROMA", "DOCERIA MEL", "ELETRÔNICOS VOLT",
	"CALÇADOS PASSO", "BAZAR TUDO", "CHAVEIRO", "AUTOPEÇAS", "RESTAURANTE SABOR",
	"SALÃO BELEZA", "LIVRARIA", "ÓTICA CENTRAL", "CONSERTOS", "HORTIFRUTI",
]
const DARK_GLASS := Color(0.07, 0.09, 0.11)
const DOOR_WOOD := Color(0.36, 0.22, 0.13)
const CONCRETE := Color(0.66, 0.65, 0.62)
const TRIM := Color(0.9, 0.9, 0.88)
const METAL_GREY := Color(0.55, 0.57, 0.6)
const WATER_TANK := Color(0.25, 0.48, 0.72)
const SIGN_RANGE := 240.0

var _root: Node3D
var _static: StaticBody3D
var _info: CityBuilder.CityInfo
var _holder: Node3D
var _rng := RandomNumberGenerator.new()
## Sorteios só de enfeites (ar-condicionado...): separado para não mudar a cidade.
var _detail_rng := RandomNumberGenerator.new()
## chave → {"facade": MeshKit, "detail": MeshKit, "signs": Node3D}
var _chunks := {}
var _occupied: Array[Rect2] = []
var _count := 0
var _base_y := CityLayout.CURB_HEIGHT


func _init(root: Node3D, static_body: StaticBody3D, info: CityBuilder.CityInfo) -> void:
	_root = root
	_static = static_body
	_info = info
	_rng.seed = 7_2024
	_detail_rng.seed = 9_1337


func build_all() -> int:
	_holder = Node3D.new()
	_holder.name = "Buildings"
	_root.add_child(_holder)

	for area: Dictionary in CityLayout.RESERVED:
		_occupied.append(_rect(area["min"], area["max"]))
	var hq_center: Vector3 = CityLayout.HQ["center"]
	var hq_size: Vector3 = CityLayout.HQ["size"]
	_occupied.append(Rect2(hq_center.x - hq_size.x / 2.0, hq_center.z - hq_size.z / 2.0, hq_size.x, hq_size.z))
	for loc: Dictionary in CityLayout.LOCATIONS:
		_occupied.append(_location_rect(loc))

	for loc: Dictionary in CityLayout.LOCATIONS:
		_build_location(loc)
	_build_hq()
	_build_farm()
	for block in CityLayout.blocks():
		_fill_block(block)
	_commit()
	return _count


# --- infraestrutura -----------------------------------------------------------------

func _rect(rmin: Vector2, rmax: Vector2) -> Rect2:
	return Rect2(rmin, rmax - rmin)


func _blocked(rect: Rect2) -> bool:
	for other in _occupied:
		if rect.intersects(other):
			return true
	return false


func _chunk(key: String) -> Dictionary:
	if not _chunks.has(key):
		var signs := Node3D.new()
		signs.name = "Signs_" + key.replace(",", "_")
		_holder.add_child(signs)
		_chunks[key] = {"facade": MeshKit.new(), "detail": MeshKit.new(), "signs": signs}
	return _chunks[key]


func _commit() -> void:
	for key: String in _chunks:
		var chunk: Dictionary = _chunks[key]
		var facade: MeshKit = chunk["facade"]
		var detail: MeshKit = chunk["detail"]
		var safe_key := key.replace(",", "_")
		if not facade.is_empty():
			var mesh := MeshInstance3D.new()
			mesh.name = "Facades_" + safe_key
			mesh.mesh = facade.commit(Mats.facade())
			_holder.add_child(mesh)
		if not detail.is_empty():
			var mesh := MeshInstance3D.new()
			mesh.name = "Details_" + safe_key
			mesh.mesh = detail.commit(Mats.vertex_colored("building_detail", 0.7))
			mesh.visibility_range_end = 700.0
			_holder.add_child(mesh)


func _collider(center: Vector3, size: Vector3, yaw: float = 0.0) -> void:
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = size
	shape.shape = box
	shape.transform = Transform3D(Basis(Vector3.UP, yaw), center)
	_static.add_child(shape)


## Ponto no espaço do prédio (x ao longo da rua, y altura, z para a frente).
func _at(center: Vector3, yaw: float, local: Vector3) -> Vector3:
	return center + Basis(Vector3.UP, yaw) * local


func _detail_box(chunk: Dictionary, center: Vector3, yaw: float, local: Vector3, size: Vector3, color: Color, tilt: float = 0.0) -> void:
	var basis := Basis(Vector3.UP, yaw)
	if tilt != 0.0:
		basis = basis * Basis(Vector3.RIGHT, tilt)
	(chunk["detail"] as MeshKit).add_box(Transform3D(basis, _at(center, yaw, local)), size, color, Vector2.ZERO, false, false)


## Altura "arredondada" em andares, com folga no topo para as janelas do último andar.
func _snap_height(style: String, height: float) -> float:
	var floors: Vector2 = FLOORS.get(style, Vector2(3.2, 3.2))
	var count := maxi(roundi((height - floors.x) / floors.y), 1)
	return floors.x + count * floors.y + 0.9


## Caixa principal do prédio (fachada procedural) + colisão.
func _body(chunk: Dictionary, center: Vector3, yaw: float, size: Vector3, color: Color, style: String, collide: bool = true) -> void:
	var c := color
	c.a = STYLE_ALPHA.get(style, 0.0)
	var xform := Transform3D(Basis(Vector3.UP, yaw), center)
	(chunk["facade"] as MeshKit).add_box(xform, size, c, Vector2(_rng.randf(), size.y), true, false)
	if collide:
		_collider(center + Vector3(0, size.y / 2.0, 0), size, yaw)
		_count += 1


## Mureta no topo e equipamentos (ar-condicionado, caixa d'água) em telhado plano.
func _roof(chunk: Dictionary, center: Vector3, yaw: float, size: Vector3, color: Color, units: bool = true) -> void:
	var top := size.y
	var t := 0.3
	var h := 0.8
	var trim := color.darkened(0.18)
	_detail_box(chunk, center, yaw, Vector3(0, top, size.z / 2.0 - t / 2.0), Vector3(size.x, h, t), trim)
	_detail_box(chunk, center, yaw, Vector3(0, top, -size.z / 2.0 + t / 2.0), Vector3(size.x, h, t), trim)
	_detail_box(chunk, center, yaw, Vector3(size.x / 2.0 - t / 2.0, top, 0), Vector3(t, h, size.z - t * 2.0), trim)
	_detail_box(chunk, center, yaw, Vector3(-size.x / 2.0 + t / 2.0, top, 0), Vector3(t, h, size.z - t * 2.0), trim)
	if not units or size.x < 7.0 or size.z < 7.0:
		return
	var count := clampi(int(size.x * size.z / 220.0), 1, 5)
	for i in count:
		var local := Vector3(_rng.randf_range(-size.x / 2.0 + 2.5, size.x / 2.0 - 2.5), top, _rng.randf_range(-size.z / 2.0 + 2.5, size.z / 2.0 - 2.5))
		if _rng.randf() < 0.3:
			var tank_basis := Basis(Vector3.UP, yaw)
			(chunk["detail"] as MeshKit).add_cylinder(Transform3D(tank_basis, _at(center, yaw, local)), 1.1, 1.8, 12, WATER_TANK)
		else:
			var grey := _rng.randf_range(0.5, 0.72)
			_detail_box(chunk, center, yaw, local, Vector3(_rng.randf_range(1.4, 3.4), _rng.randf_range(1.0, 2.0), _rng.randf_range(1.4, 3.0)), Color(grey, grey, grey * 1.02))


## Porta na fachada da frente (x = deslocamento ao longo da parede).
func _door(chunk: Dictionary, center: Vector3, yaw: float, depth: float, x: float, size: Vector2, color: Color) -> void:
	_detail_box(chunk, center, yaw, Vector3(x, 0, depth / 2.0), Vector3(size.x + 0.3, size.y + 0.2, 0.1), TRIM)
	_detail_box(chunk, center, yaw, Vector3(x, 0, depth / 2.0 + 0.04), Vector3(size.x, size.y, 0.1), color)


## Toldo listrado inclinado sobre a vitrine.
func _awning(chunk: Dictionary, center: Vector3, yaw: float, depth: float, x: float, width: float, y: float, color: Color) -> void:
	var stripes := maxi(int(width / 0.9), 2)
	var stripe_width := width / stripes
	for i in stripes:
		var local_x := x - width / 2.0 + stripe_width * (i + 0.5)
		var c := color if i % 2 == 0 else Color(0.95, 0.94, 0.9)
		_detail_box(chunk, center, yaw, Vector3(local_x, y, depth / 2.0 + 0.72), Vector3(stripe_width, 0.07, 1.6), c, 0.33)


## Letreiro: placa colorida + texto 3D. `y` = altura do centro do texto.
func _sign(chunk: Dictionary, text: String, center: Vector3, yaw: float, depth: float, y: float, max_width: float, board_color: Color, text_color: Color = Color.WHITE, board: bool = true, x: float = 0.0, max_height: float = 1.8) -> void:
	if text == "":
		return
	var lines := text.split("\n")
	var longest := 3
	for line in lines:
		longest = maxi(longest, line.length())
	var chars := float(longest)
	var height := clampf(max_width * 0.9 / (chars * 0.62), 0.3, max_height)
	var label := Label3D.new()
	label.text = text
	label.font = Mats.sign_font()
	label.font_size = 96
	label.pixel_size = height / 96.0
	label.outline_size = 0
	label.modulate = text_color
	label.double_sided = false
	label.alpha_cut = Label3D.ALPHA_CUT_OPAQUE_PREPASS
	label.position = _at(center, yaw, Vector3(x, y, depth / 2.0 + 0.2))
	label.rotation.y = yaw
	label.visibility_range_end = SIGN_RANGE
	label.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	(chunk["signs"] as Node3D).add_child(label)
	if board:
		var board_width := minf(chars * 0.62 * height + height * 1.2, max_width + 0.6)
		var board_height := height * (1.7 + (lines.size() - 1) * 1.2)
		_detail_box(chunk, center, yaw, Vector3(x, y - board_height / 2.0, depth / 2.0 + 0.07), Vector3(board_width, board_height, 0.16), board_color)


func _pick_style(styles: Array) -> String:
	var total := 0.0
	for entry: Array in styles:
		total += float(entry[1])
	var roll := _rng.randf() * total
	for entry: Array in styles:
		roll -= float(entry[1])
		if roll <= 0.0:
			return entry[0]
	return styles[0][0]


func _pick(colors: Array[Color]) -> Color:
	return colors[_rng.randi() % colors.size()]


# --- lotes comuns ------------------------------------------------------------------------

func _location_rect(loc: Dictionary) -> Rect2:
	var info := CityLayout.location_info(loc)
	var center: Vector3 = info["center"]
	var footprint: Vector2 = info["footprint"]
	var facing: Vector3 = info["facing"]
	var rect := Rect2(center.x - footprint.x / 2.0, center.z - footprint.y / 2.0, footprint.x, footprint.y)
	var front := float(loc["depth"]) / 2.0 + float(loc.get("setback", 0.0)) + 1.0
	rect = rect.expand(Vector2(center.x, center.z) + Vector2(facing.x, facing.z) * front)
	return rect.grow(1.5)


func _fill_block(block: Dictionary) -> void:
	var theme: String = block["theme"]
	if not CityLayout.THEME_RULES.has(theme):
		return
	var rule: Dictionary = CityLayout.THEME_RULES[theme]
	var bmin: Vector2 = block["min"]
	var bmax: Vector2 = block["max"]
	var imin := bmin + Vector2.ONE * CityLayout.SIDEWALK
	var imax := bmax - Vector2.ONE * CityLayout.SIDEWALK
	match block["canal_side"]:
		"S":
			imax.y = bmax.y - 5.0
		"N":
			imin.y = bmin.y + 5.0
	var chunk := _chunk(block["key"])
	for side: String in ["N", "S", "W", "E"]:
		_fill_side(chunk, theme, rule, side, imin, imax)
	if theme == "downtown":
		_downtown_core(chunk, imin, imax)


func _fill_side(chunk: Dictionary, theme: String, rule: Dictionary, side: String, imin: Vector2, imax: Vector2) -> void:
	var along_x := side == "N" or side == "S"
	var start := imin.x if along_x else imin.y
	var end := imax.x if along_x else imax.y
	var facing := CityLayout.facing_vector(side)
	var yaw := atan2(facing.x, facing.z)
	var width_range: Vector2 = rule["width"]
	var depth_range: Vector2 = rule["depth"]
	var cursor := start + _rng.randf_range(0.0, 2.0)
	var guard := 0
	while cursor < end - width_range.x * 0.6 and guard < 300:
		guard += 1
		var style := _pick_style(rule["styles"])
		var width := _rng.randf_range(width_range.x, width_range.y)
		var depth := _rng.randf_range(depth_range.x, depth_range.y)
		var setback: float = rule["setback"]
		if style == "apartment" and theme == "residential":
			width = _rng.randf_range(16.0, 22.0)
			depth = _rng.randf_range(12.0, 16.0)
		width = minf(width, end - cursor)
		if width < width_range.x * 0.6:
			break
		if setback > 0.0:
			setback += _rng.randf_range(0.0, 2.5)
		var along := cursor + width / 2.0
		var perp := setback + depth / 2.0
		var center := Vector3.ZERO
		match side:
			"N":
				center = Vector3(along, _base_y, imin.y + perp)
			"S":
				center = Vector3(along, _base_y, imax.y - perp)
			"W":
				center = Vector3(imin.x + perp, _base_y, along)
			_:
				center = Vector3(imax.x - perp, _base_y, along)
		var footprint := Vector2(width, depth) if along_x else Vector2(depth, width)
		var lot := Rect2(center.x - footprint.x / 2.0, center.z - footprint.y / 2.0, footprint.x, footprint.y)
		lot = lot.expand(Vector2(center.x, center.z) + Vector2(facing.x, facing.z) * (depth / 2.0 + setback))
		if _blocked(lot.grow(0.4)):
			cursor += 3.0
			continue
		_occupied.append(lot)
		_filler(chunk, style, theme, rule, center, yaw, width, depth, setback)
		var gap := 0.3 if rule["setback"] == 0.0 else _rng.randf_range(3.0, 6.0)
		cursor += width + gap


func _filler(chunk: Dictionary, style: String, theme: String, rule: Dictionary, center: Vector3, yaw: float, width: float, depth: float, setback: float) -> void:
	var height_range: Vector2 = rule["height"]
	match style:
		"house":
			_house(chunk, center, yaw, width * _rng.randf_range(0.7, 0.9), depth, _rng.randf() < 0.45, _pick(HOUSE_COLORS), setback, width)
		"shop":
			var floors := _rng.randi_range(1, 3) if theme != "downtown" else _rng.randi_range(3, 6)
			var height := _snap_height("shop", 3.6 + floors * 3.2)
			_shop(chunk, center, yaw, Vector3(width, height, depth), _pick(CityLayout.WALL_COLORS), SHOP_NAMES[_rng.randi() % SHOP_NAMES.size()] if _rng.randf() < 0.6 else "")
		"apartment":
			var height := _snap_height("apartment", _rng.randf_range(height_range.x, height_range.y) if theme != "residential" else _rng.randf_range(10.0, 16.0))
			_apartment(chunk, center, yaw, Vector3(width, height, depth), _pick(CityLayout.WALL_COLORS))
		"office":
			var height := _snap_height("office", _rng.randf_range(height_range.x, height_range.y))
			_office(chunk, center, yaw, Vector3(width, height, depth), _pick(CityLayout.WALL_COLORS))
		"glass":
			var height := _snap_height("glass", _rng.randf_range(maxf(height_range.x, 30.0), height_range.y + 12.0))
			_glass_tower(chunk, center, yaw, Vector3(width, height, depth), _pick(GLASS_COLORS))
		"warehouse", "shed":
			var height := _rng.randf_range(height_range.x, height_range.y)
			if style == "shed":
				height *= 0.7
			_warehouse(chunk, center, yaw, Vector3(width, height, depth), _pick(INDUSTRIAL_COLORS), style == "shed")


## Torre no miolo dos quarteirões do centro (o miolo ficaria vazio).
func _downtown_core(chunk: Dictionary, imin: Vector2, imax: Vector2) -> void:
	var middle := (imin + imax) / 2.0
	for attempt in 6:
		var size := Vector2(_rng.randf_range(24.0, 34.0), _rng.randf_range(24.0, 34.0))
		var offset := Vector2(_rng.randf_range(-12.0, 12.0), _rng.randf_range(-12.0, 12.0))
		var center2 := middle + offset
		var rect := Rect2(center2 - size / 2.0, size)
		if _blocked(rect.grow(3.0)):
			continue
		_occupied.append(rect)
		var center := Vector3(center2.x, _base_y, center2.y)
		var yaw := [0.0, PI / 2.0, PI, -PI / 2.0][_rng.randi() % 4] as float
		if _rng.randf() < 0.5:
			_glass_tower(chunk, center, yaw, Vector3(size.x, _snap_height("glass", _rng.randf_range(50.0, 86.0)), size.y), _pick(GLASS_COLORS))
		else:
			_office(chunk, center, yaw, Vector3(size.x, _snap_height("office", _rng.randf_range(40.0, 70.0)), size.y), _pick(CityLayout.WALL_COLORS))
		return


# --- tipos de prédio -----------------------------------------------------------------------

func _house(chunk: Dictionary, center: Vector3, yaw: float, width: float, depth: float, two_floors: bool, color: Color, setback: float, lot_width: float) -> void:
	var wall_height := 6.3 if two_floors else 3.3
	var size := Vector3(width, wall_height, depth)
	_body(chunk, center, yaw, size, color, "house")
	var roof_color := color
	roof_color.a = STYLE_ALPHA["house"]
	var roof_height := minf(depth * 0.32, 3.2)
	(chunk["facade"] as MeshKit).add_gable_roof(Transform3D(Basis(Vector3.UP, yaw), center + Vector3(0, wall_height, 0)), width, depth, roof_height, 0.5, roof_color, Vector2(_rng.randf(), wall_height))
	# Calhas (tubos de descida) nas quinas da frente.
	for corner: float in [-1.0, 1.0]:
		_detail_box(chunk, center, yaw, Vector3(corner * (width / 2.0 - 0.12), 0, depth / 2.0 + 0.08), Vector3(0.09, wall_height, 0.09), Color(0.85, 0.85, 0.82))
	# Porta, varandinha e (às vezes) garagem.
	var door_x := _rng.randf_range(-width * 0.25, width * 0.25)
	_door(chunk, center, yaw, depth, door_x, Vector2(1.0, 2.2), DOOR_WOOD)
	_detail_box(chunk, center, yaw, Vector3(door_x, 2.55, depth / 2.0 + 0.7), Vector3(2.6, 0.12, 1.4), TRIM)
	if width > 11.0 and _rng.randf() < 0.6:
		var garage_x := width / 2.0 - 2.0 if door_x < 0.0 else -width / 2.0 + 2.0
		_detail_box(chunk, center, yaw, Vector3(garage_x, 0, depth / 2.0 + 0.02), Vector3(2.8, 2.4, 0.1), Color(0.82, 0.82, 0.8))
	# Cerca viva na divisa com a calçada (com passagem).
	if setback > 2.0:
		var hedge_z := depth / 2.0 + setback - 0.5
		var gap_x := door_x
		var left := -lot_width / 2.0 + 0.3
		var right := lot_width / 2.0 - 0.3
		for span: Vector2 in [Vector2(left, gap_x - 1.6), Vector2(gap_x + 1.6, right)]:
			var length := span.y - span.x
			if length < 0.8:
				continue
			var local := Vector3((span.x + span.y) / 2.0, 0, hedge_z)
			# A folhagem é montada pelo PropsBuilder (cartões de folhas); aqui só o lugar.
			_info.hedges.append([Transform3D(Basis(Vector3.UP, yaw), _at(center, yaw, local)), Vector3(length, 0.95, 0.7)])
			_collider(_at(center, yaw, local) + Vector3(0, 0.47, 0), Vector3(length, 0.95, 0.7), yaw)
		_info.yard_trees.append(_at(center, yaw, Vector3(-door_x * 0.3 + (lot_width * 0.3 if door_x < 0.0 else -lot_width * 0.3), 0, depth / 2.0 + setback * 0.45)))
	if _rng.randf() < 0.6:
		_info.yard_trees.append(_at(center, yaw, Vector3(_rng.randf_range(-width * 0.3, width * 0.3), 0, -depth / 2.0 - 3.5)))


func _shop(chunk: Dictionary, center: Vector3, yaw: float, size: Vector3, color: Color, sign_text: String) -> void:
	_body(chunk, center, yaw, size, color, "shop")
	_roof(chunk, center, yaw, size, color)
	_door(chunk, center, yaw, size.z, _rng.randf_range(-size.x * 0.3, size.x * 0.3), Vector2(1.6, 2.5), DARK_GLASS)
	var awning_color := _pick(AWNING_COLORS)
	if _rng.randf() < 0.7:
		_awning(chunk, center, yaw, size.z, 0.0, size.x * 0.85, 3.1, awning_color)
	if sign_text != "":
		_sign(chunk, sign_text, center, yaw, size.z, 4.1, size.x * 0.8, awning_color.darkened(0.2))


func _apartment(chunk: Dictionary, center: Vector3, yaw: float, size: Vector3, color: Color) -> void:
	_body(chunk, center, yaw, size, color, "apartment")
	_ac_units(chunk, center, yaw, size, 3.4, 3.2)
	_roof(chunk, center, yaw, size, color)
	_door(chunk, center, yaw, size.z, 0.0, Vector2(2.2, 2.5), DARK_GLASS)
	_detail_box(chunk, center, yaw, Vector3(0, 2.9, size.z / 2.0 + 1.0), Vector3(4.0, 0.2, 2.0), TRIM)
	# Sacadas na frente: laje + guarda-corpo, colunas alternadas.
	var floors := int((size.y - 3.2 - 0.9) / 3.2)
	var columns := int(size.x / 3.4)
	var offset := -columns * 3.4 / 2.0
	for floor_index in floors:
		var y := 3.2 + floor_index * 3.2
		for col in columns:
			if (col + floor_index) % 2 == 1 and columns > 2:
				continue
			var x := offset + 3.4 * (col + 0.5)
			_detail_box(chunk, center, yaw, Vector3(x, y, size.z / 2.0 + 0.6), Vector3(3.0, 0.16, 1.2), TRIM)
			_detail_box(chunk, center, yaw, Vector3(x, y + 0.16, size.z / 2.0 + 1.17), Vector3(3.0, 0.95, 0.06), Color(0.2, 0.24, 0.28))


## Aparelhos de ar-condicionado nas laterais, entre as janelas (mesma grade de janelas
## do shader de fachada: colunas de `column` m, andares de 3,2 m a partir de `ground`).
func _ac_units(chunk: Dictionary, center: Vector3, yaw: float, size: Vector3, column: float, ground: float) -> void:
	var floors := int((size.y - ground - 0.8) / 3.2)
	var piers := int(size.z / column) - 1
	for side: float in [-1.0, 1.0]:
		for floor_index in floors:
			for pier in piers:
				if _detail_rng.randf() > 0.12:
					continue
				var z := size.z / 2.0 - (pier + 1) * column
				var y := ground + floor_index * 3.2 + 1.1
				var shade := _detail_rng.randf_range(0.78, 0.9)
				_detail_box(chunk, center, yaw, Vector3(side * (size.x / 2.0 + 0.16), y, z), Vector3(0.3, 0.55, 0.8), Color(shade, shade, shade * 0.98))


func _office(chunk: Dictionary, center: Vector3, yaw: float, size: Vector3, color: Color) -> void:
	_body(chunk, center, yaw, size, color, "office")
	_ac_units(chunk, center, yaw, size, 3.0, 4.2)
	_door(chunk, center, yaw, size.z, 0.0, Vector2(3.2, 3.0), DARK_GLASS)
	_detail_box(chunk, center, yaw, Vector3(0, 3.4, size.z / 2.0 + 1.2), Vector3(6.0, 0.25, 2.4), color.darkened(0.3))
	if size.y > 30.0 and size.x > 16.0 and size.z > 16.0:
		# Coroamento recuado (casa de máquinas).
		var crown := Vector3(size.x * 0.6, 4.5, size.z * 0.6)
		_body(chunk, center + Vector3(0, size.y, 0), yaw, crown, color.darkened(0.1), "office", false)
		_roof(chunk, center + Vector3(0, size.y, 0), yaw, crown, color, false)
		_roof(chunk, center, yaw, size, color, false)
	else:
		_roof(chunk, center, yaw, size, color)


func _glass_tower(chunk: Dictionary, center: Vector3, yaw: float, size: Vector3, color: Color) -> void:
	_body(chunk, center, yaw, size, color, "glass")
	_door(chunk, center, yaw, size.z, 0.0, Vector2(4.0, 3.5), DARK_GLASS)
	_detail_box(chunk, center, yaw, Vector3(0, 4.2, size.z / 2.0 + 1.5), Vector3(size.x * 0.5, 0.3, 3.0), Color(0.75, 0.76, 0.78))
	var top := size.y
	_detail_box(chunk, center, yaw, Vector3(0, top, 0), Vector3(size.x + 0.3, 1.4, size.z + 0.3), color.darkened(0.35))
	if size.y > 50.0:
		_detail_box(chunk, center, yaw, Vector3(0, top + 1.4, 0), Vector3(size.x * 0.5, 3.5, size.z * 0.5), Color(0.5, 0.52, 0.55))
		(chunk["detail"] as MeshKit).add_cylinder(Transform3D(Basis(), center + Vector3(0, top + 4.9, 0)), 0.18, 9.0, 6, Color(0.7, 0.7, 0.72))


func _warehouse(chunk: Dictionary, center: Vector3, yaw: float, size: Vector3, color: Color, small: bool) -> void:
	_body(chunk, center, yaw, size, color, "shed" if small else "warehouse")
	_roof(chunk, center, yaw, size, color, false)
	# Portas de enrolar e porta de pedestre.
	var doors := clampi(int(size.x / 9.0), 1, 6)
	var spacing := size.x / doors
	for i in doors:
		var x := -size.x / 2.0 + spacing * (i + 0.5)
		_detail_box(chunk, center, yaw, Vector3(x, 0, size.z / 2.0 + 0.02), Vector3(minf(4.2, spacing - 1.2), minf(4.6, size.y - 1.0), 0.12), Color(0.68, 0.7, 0.72))
		_detail_box(chunk, center, yaw, Vector3(x, minf(4.6, size.y - 1.0), size.z / 2.0 + 0.4), Vector3(minf(4.8, spacing - 0.8), 0.15, 0.8), Color(0.3, 0.32, 0.34))
	# Exaustores no telhado.
	for i in clampi(int(size.x * size.z / 300.0), 1, 6):
		var local := Vector3(_rng.randf_range(-size.x / 2.0 + 3.0, size.x / 2.0 - 3.0), size.y, _rng.randf_range(-size.z / 2.0 + 3.0, size.z / 2.0 - 3.0))
		(chunk["detail"] as MeshKit).add_cylinder(Transform3D(Basis(), _at(center, yaw, local)), 0.5, 1.2, 8, METAL_GREY)


# --- locais do jogo ------------------------------------------------------------------------

func _build_location(loc: Dictionary) -> void:
	var info := CityLayout.location_info(loc)
	var chunk := _chunk(loc["block"])
	var center: Vector3 = info["center"]
	center.y = _base_y
	var yaw: float = info["yaw"]
	var width: float = loc["width"]
	var depth: float = loc["depth"]
	var height: float = loc["height"]
	var color: Color = loc["color"]
	var sign_text: String = loc["sign"]
	var setback: float = loc.get("setback", 0.0)
	match loc["style"]:
		"warehouse":
			var size := Vector3(width, height, depth)
			_warehouse(chunk, center, yaw, size, Color(0.72, 0.73, 0.74), false)
			_detail_box(chunk, center, yaw, Vector3(0, height - 2.6, depth / 2.0 + 0.03), Vector3(width, 1.2, 0.08), color)
			_sign(chunk, sign_text, center, yaw, depth, height + 1.6, width * 0.75, color.darkened(0.25))
		"gas_station":
			_gas_station(chunk, center, yaw, width, depth, setback, color, sign_text)
		"school":
			var size := Vector3(width, _snap_height("apartment", height), depth)
			_body(chunk, center, yaw, size, Color(0.93, 0.86, 0.72), "apartment")
			_roof(chunk, center, yaw, size, color)
			_detail_box(chunk, center, yaw, Vector3(0, 0, depth / 2.0 + 0.02), Vector3(width, 1.0, 0.12), color)
			_door(chunk, center, yaw, depth, 0.0, Vector2(3.0, 2.6), DARK_GLASS)
			_detail_box(chunk, center, yaw, Vector3(0, 3.0, depth / 2.0 + 1.6), Vector3(7.0, 0.25, 3.2), color.darkened(0.2))
			_sign(chunk, sign_text, center, yaw, depth, 5.2, width * 0.5, color.darkened(0.3))
			_flag_poles(chunk, center, yaw, depth + setback * 1.2, 3)
		"house":
			_house(chunk, center, yaw, width * 0.85, depth, true, color, setback, width)
		"shed":
			var size := Vector3(width, height, depth)
			_warehouse(chunk, center, yaw, size, Color(0.6, 0.61, 0.63), true)
			_sign(chunk, sign_text, center, yaw, depth, height + 1.2, width * 0.8, color.darkened(0.2))
			if loc["id"] == "junkyard":
				_junk_piles(chunk, center, yaw, width, depth)
		"shop":
			var size := Vector3(width, _snap_height("shop", height), depth)
			_body(chunk, center, yaw, size, Color(0.92, 0.9, 0.86), "shop")
			_roof(chunk, center, yaw, size, color)
			_door(chunk, center, yaw, depth, 0.0, Vector2(2.2, 2.6), DARK_GLASS)
			_awning(chunk, center, yaw, depth, 0.0, width * 0.9, 3.1, color)
			_sign(chunk, sign_text, center, yaw, depth, 4.3, width * 0.9, color.darkened(0.15))
		"office":
			var size := Vector3(width, _snap_height("office", height), depth)
			_office(chunk, center, yaw, size, color)
			_sign(chunk, sign_text, center, yaw, depth, 4.6, width * 0.8, Color(0.2, 0.22, 0.26))
		"hospital":
			_hospital(chunk, center, yaw, width, depth, height, color, sign_text)
		"apartment":
			var size := Vector3(width, _snap_height("apartment", height), depth)
			_apartment(chunk, center, yaw, size, color)
			_sign(chunk, sign_text, center, yaw, depth + 3.6, 3.45, 8.0, color.darkened(0.4), Color.WHITE, false, 0.0, 0.5)
		"mall":
			_mall(chunk, center, yaw, width, depth, height, color, sign_text)
		"civic":
			_city_hall(chunk, center, yaw, width, depth, height, color, sign_text)
		"glass":
			var size := Vector3(width, _snap_height("glass", height), depth)
			_glass_tower(chunk, center, yaw, size, color)
			_sign(chunk, sign_text, center, yaw, depth + 3.2, 5.0, width * 0.6, Color(0.1, 0.12, 0.14), Color.WHITE, false)
		"kiosk":
			var size := Vector3(width, height, depth)
			_body(chunk, center, yaw, size, Color(0.95, 0.93, 0.88), "shop")
			_detail_box(chunk, center, yaw, Vector3(0, height, 0), Vector3(width + 2.4, 0.35, depth + 2.4), color)
			_sign(chunk, sign_text, center, yaw, depth + 2.4, height + 0.9, width, color.darkened(0.3))
		"fire_station":
			_fire_station(chunk, center, yaw, width, depth, height, color, sign_text)
		"supermarket":
			_supermarket(chunk, center, yaw, width, depth, height, setback, color, sign_text)


func _gas_station(chunk: Dictionary, center: Vector3, yaw: float, width: float, depth: float, setback: float, color: Color, sign_text: String) -> void:
	# Loja de conveniência no fundo do lote.
	var store := Vector3(width * 0.55, 4.6, depth)
	var store_center := _at(center, yaw, Vector3(-width * 0.2, 0, 0))
	_body(chunk, store_center, yaw, store, Color(0.94, 0.94, 0.93), "shop")
	_roof(chunk, store_center, yaw, store, color, false)
	_door(chunk, store_center, yaw, depth, 0.0, Vector2(2.0, 2.4), DARK_GLASS)
	_sign(chunk, "CONVENIÊNCIA", store_center, yaw, depth, 3.9, store.x * 0.7, color.darkened(0.2))
	# Cobertura das bombas.
	var canopy_z := depth / 2.0 + setback / 2.0
	var canopy := Vector3(width * 0.8, 0.9, setback * 0.72)
	var canopy_y := 5.2
	_detail_box(chunk, center, yaw, Vector3(0, canopy_y, canopy_z), canopy, Color(0.95, 0.95, 0.95))
	_detail_box(chunk, center, yaw, Vector3(0, canopy_y + 0.25, canopy_z), canopy + Vector3(0.08, -0.5, 0.08), color)
	for column: Vector2 in [Vector2(-1, -1), Vector2(1, -1), Vector2(-1, 1), Vector2(1, 1)]:
		var local := Vector3(column.x * canopy.x * 0.36, 0, canopy_z + column.y * canopy.z * 0.28)
		_detail_box(chunk, center, yaw, local, Vector3(0.45, canopy_y, 0.45), Color(0.85, 0.86, 0.88))
		_collider(_at(center, yaw, local) + Vector3(0, canopy_y / 2.0, 0), Vector3(0.45, canopy_y, 0.45), yaw)
	# Ilhas com bombas.
	for island_z: float in [-2.4, 2.4]:
		var local := Vector3(0, 0, canopy_z + island_z)
		_detail_box(chunk, center, yaw, local, Vector3(9.0, 0.22, 1.3), CONCRETE)
		_collider(_at(center, yaw, local) + Vector3(0, 0.11, 0), Vector3(9.0, 0.22, 1.3), yaw)
		for pump_x: float in [-2.6, 2.6]:
			var pump := local + Vector3(pump_x, 0.22, 0)
			_detail_box(chunk, center, yaw, pump, Vector3(0.9, 1.9, 0.55), Color(0.95, 0.95, 0.95))
			_detail_box(chunk, center, yaw, pump + Vector3(0, 1.2, 0), Vector3(0.94, 0.5, 0.58), color)
			_collider(_at(center, yaw, pump) + Vector3(0, 0.95, 0), Vector3(0.9, 1.9, 0.55), yaw)
	# Luzes sob a cobertura (acendem à noite).
	var lights := MeshKit.new()
	for i in 4:
		for j in 2:
			var local := Vector3((i - 1.5) * canopy.x * 0.22, canopy_y - 0.05, canopy_z + (j - 0.5) * canopy.z * 0.5)
			lights.add_box(Transform3D(Basis(Vector3.UP, yaw), _at(center, yaw, local)), Vector3(1.6, 0.06, 0.5), Color.WHITE)
	var light_mesh := MeshInstance3D.new()
	light_mesh.mesh = lights.commit(Mats.night_light(Color(1.0, 0.97, 0.9), 6.0))
	light_mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	(chunk["signs"] as Node3D).add_child(light_mesh)
	_sign(chunk, sign_text, center, yaw, canopy_z * 2.0 + canopy.z, canopy_y + 0.45, canopy.x * 0.8, color, Color.WHITE, false, 0.0, 0.7)
	# Totem com preços perto da calçada.
	var totem := Vector3(width / 2.0 - 1.5, 0, depth / 2.0 + setback - 1.2)
	_detail_box(chunk, center, yaw, totem, Vector3(1.8, 6.5, 0.5), color)
	_collider(_at(center, yaw, totem) + Vector3(0, 3.25, 0), Vector3(1.8, 6.5, 0.5), yaw)
	_sign(chunk, "GASOLINA\nR$ 5,79", center, yaw, (totem.z + 0.1) * 2.0, 5.2, 1.6, color, Color(1.0, 0.95, 0.4), false, totem.x, 0.32)


func _hospital(chunk: Dictionary, center: Vector3, yaw: float, width: float, depth: float, height: float, color: Color, sign_text: String) -> void:
	var podium_depth := depth * 0.42
	var podium := Vector3(width, _snap_height("office", 9.0), podium_depth)
	var podium_center := _at(center, yaw, Vector3(0, 0, depth / 2.0 - podium_depth / 2.0))
	_body(chunk, podium_center, yaw, podium, color, "office")
	_roof(chunk, podium_center, yaw, podium, color)
	var tower := Vector3(width * 0.62, _snap_height("office", height), depth - podium_depth)
	var tower_center := _at(center, yaw, Vector3(0, 0, -podium_depth / 2.0))
	_body(chunk, tower_center, yaw, tower, color, "office")
	_roof(chunk, tower_center, yaw, tower, color)
	# Cruz vermelha no alto da torre.
	var cross_z := tower.z / 2.0 + 0.1
	var red := Color(0.85, 0.08, 0.08)
	_detail_box(chunk, tower_center, yaw, Vector3(0, tower.y - 6.5, cross_z), Vector3(1.4, 4.6, 0.2), red)
	_detail_box(chunk, tower_center, yaw, Vector3(0, tower.y - 4.9, cross_z), Vector3(4.6, 1.4, 0.2), red)
	# Marquise da emergência.
	var entrance := Vector3(-width * 0.25, 0, depth / 2.0)
	_detail_box(chunk, center, yaw, entrance + Vector3(0, 3.8, 3.0), Vector3(12.0, 0.4, 6.0), Color(0.92, 0.92, 0.92))
	for post_x: float in [-5.5, 5.5]:
		var post := entrance + Vector3(post_x, 0, 5.6)
		_detail_box(chunk, center, yaw, post, Vector3(0.35, 3.8, 0.35), Color(0.8, 0.8, 0.82))
		_collider(_at(center, yaw, post) + Vector3(0, 1.9, 0), Vector3(0.35, 3.8, 0.35), yaw)
	_door(chunk, center, yaw, depth, entrance.x, Vector2(4.0, 2.8), DARK_GLASS)
	_sign(chunk, "EMERGÊNCIA", center, yaw, depth + 12.0, 4.7, 7.0, red, Color.WHITE, false, entrance.x)
	_sign(chunk, sign_text, center, yaw, depth, podium.y - 2.0, width * 0.45, Color(0.1, 0.35, 0.6), Color.WHITE, true, width * 0.2)


func _mall(chunk: Dictionary, center: Vector3, yaw: float, width: float, depth: float, height: float, color: Color, sign_text: String) -> void:
	var size := Vector3(width, height, depth)
	_body(chunk, center, yaw, size, color, "shop")
	_roof(chunk, center, yaw, size, color)
	# Entrada de vidro saliente com marquise.
	var entrance := Vector3(0, 0, depth / 2.0 + 2.0)
	_detail_box(chunk, center, yaw, entrance, Vector3(16.0, 9.0, 4.0), Color(0.12, 0.16, 0.2))
	_collider(_at(center, yaw, entrance) + Vector3(0, 4.5, 0), Vector3(16.0, 9.0, 4.0), yaw)
	_detail_box(chunk, center, yaw, entrance + Vector3(0, 9.0, 0.4), Vector3(18.0, 0.8, 5.0), Color(0.85, 0.86, 0.88))
	_detail_box(chunk, center, yaw, Vector3(0, 0, depth / 2.0 + 4.05), Vector3(4.0, 2.8, 0.1), Color(0.02, 0.03, 0.04))
	_sign(chunk, sign_text, center, yaw, depth, 13.0, 22.0, Color(0.15, 0.2, 0.35), Color.WHITE, true, 0.0, 2.2)


func _city_hall(chunk: Dictionary, center: Vector3, yaw: float, width: float, depth: float, height: float, color: Color, sign_text: String) -> void:
	var size := Vector3(width, _snap_height("office", height), depth)
	_body(chunk, center, yaw, size, color, "office")
	_roof(chunk, center, yaw, size, color)
	# Escadaria, colunas e frontão.
	var front := depth / 2.0
	for step in 3:
		var local := Vector3(0, step * 0.3, front + 3.4 - step * 0.8)
		_detail_box(chunk, center, yaw, local, Vector3(22.0 - step * 1.0, 0.3, 1.6 + step * 0.0), CONCRETE.lightened(0.15))
	_collider(_at(center, yaw, Vector3(0, 0, front + 2.6)) + Vector3(0, 0.45, 0), Vector3(22.0, 0.9, 3.6), yaw)
	var column_height := 9.0
	for i in 6:
		var x := -8.75 + 3.5 * i
		var local := Vector3(x, 0.9, front + 2.0)
		(chunk["detail"] as MeshKit).add_cylinder(Transform3D(Basis(), _at(center, yaw, local)), 0.5, column_height, 12, Color(0.95, 0.94, 0.9))
		_collider(_at(center, yaw, local) + Vector3(0, column_height / 2.0, 0), Vector3(1.0, column_height, 1.0), yaw)
	_detail_box(chunk, center, yaw, Vector3(0, 0.9 + column_height, front + 1.6), Vector3(21.0, 1.3, 3.6), Color(0.95, 0.94, 0.9))
	var pediment := Basis(Vector3.UP, yaw + PI / 2.0)
	(chunk["detail"] as MeshKit).add_gable_roof(Transform3D(pediment, _at(center, yaw, Vector3(0, 2.2 + column_height, front + 1.6))), 3.6, 21.0, 3.2, 0.0, Color(0.93, 0.92, 0.88))
	_sign(chunk, sign_text, center, yaw, depth + 6.9, 0.9 + column_height + 0.65, 12.0, Color.WHITE, Color(0.2, 0.2, 0.22), false, 0.0, 0.9)
	_flag_poles(chunk, center, yaw, depth + 12.0, 3)


func _fire_station(chunk: Dictionary, center: Vector3, yaw: float, width: float, depth: float, height: float, color: Color, sign_text: String) -> void:
	var size := Vector3(width, _snap_height("office", height), depth)
	_body(chunk, center, yaw, size, Color(0.72, 0.36, 0.28), "office")
	_roof(chunk, center, yaw, size, color)
	for i in 3:
		var x := -width / 2.0 + width * (i + 0.5) / 3.0 - 2.0
		_detail_box(chunk, center, yaw, Vector3(x, 0, depth / 2.0 + 0.02), Vector3(4.6, 4.4, 0.14), Color(0.9, 0.9, 0.9))
		_detail_box(chunk, center, yaw, Vector3(x, 4.4, depth / 2.0 + 0.02), Vector3(5.2, 0.4, 0.2), color)
	# Torre de secagem de mangueiras.
	var tower := _at(center, yaw, Vector3(width / 2.0 - 3.5, 0, -depth / 2.0 + 3.5))
	var tower_size := Vector3(6.0, size.y + 8.0, 6.0)
	_body(chunk, tower, yaw, tower_size, Color(0.72, 0.36, 0.28), "office")
	_roof(chunk, tower, yaw, tower_size, color, false)
	_sign(chunk, sign_text, center, yaw, depth, 6.2, width * 0.8, color)


func _supermarket(chunk: Dictionary, center: Vector3, yaw: float, width: float, depth: float, height: float, setback: float, color: Color, sign_text: String) -> void:
	var size := Vector3(width, height, depth)
	_body(chunk, center, yaw, size, Color(0.93, 0.93, 0.9), "shop")
	_roof(chunk, center, yaw, size, color)
	_detail_box(chunk, center, yaw, Vector3(0, height - 2.2, depth / 2.0 + 0.03), Vector3(width, 2.2, 0.1), color)
	_detail_box(chunk, center, yaw, Vector3(0, 3.4, depth / 2.0 + 2.0), Vector3(width * 0.7, 0.3, 4.0), Color(0.88, 0.88, 0.9))
	for x: float in [-width * 0.2, width * 0.2]:
		_door(chunk, center, yaw, depth, x, Vector2(3.2, 2.6), DARK_GLASS)
	_sign(chunk, sign_text, center, yaw, depth + 0.2, height + 1.2, width * 0.8, color.darkened(0.2))
	# Vagas do estacionamento em frente (faixas brancas no pátio).
	var lines := MeshKit.new()
	var stall := 2.6
	var rows := [depth / 2.0 + 4.5, depth / 2.0 + setback - 4.2]
	for row: float in rows:
		var count := int(width * 0.8 / stall)
		for i in count + 1:
			var x := -count * stall / 2.0 + i * stall
			lines.add_box(Transform3D(Basis(Vector3.UP, yaw), _at(center, yaw, Vector3(x, 0.04, row))), Vector3(0.12, 0.01, 4.8), Color(0.92, 0.92, 0.9), Vector2.ZERO, true, false)
	var mesh := MeshInstance3D.new()
	mesh.mesh = lines.commit(Mats.vertex_colored("paint", 0.6))
	mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mesh.visibility_range_end = 250.0
	(chunk["signs"] as Node3D).add_child(mesh)


func _junk_piles(chunk: Dictionary, center: Vector3, yaw: float, width: float, depth: float) -> void:
	# Pilhas de carros velhos no pátio atrás do galpão.
	for i in 5:
		var base := Vector3(_rng.randf_range(-width * 0.4, width * 0.4), 0, -depth / 2.0 - _rng.randf_range(6.0, 16.0))
		var levels := _rng.randi_range(1, 3)
		for level in levels:
			var tint := Color(_rng.randf_range(0.2, 0.55), _rng.randf_range(0.18, 0.4), _rng.randf_range(0.15, 0.35))
			_detail_box(chunk, center, yaw + _rng.randf_range(-0.4, 0.4), base + Vector3(0, level * 1.35, 0), Vector3(4.2, 1.3, 1.8), tint)
		_collider(_at(center, yaw, base) + Vector3(0, levels * 0.67, 0), Vector3(4.4, levels * 1.35, 2.4), yaw)


func _flag_poles(chunk: Dictionary, center: Vector3, yaw: float, distance: float, count: int) -> void:
	var flags: Array[Color] = [Color(0.1, 0.55, 0.25), Color(0.95, 0.85, 0.2), Color(0.15, 0.3, 0.65)]
	for i in count:
		var local := Vector3((i - (count - 1) / 2.0) * 3.0, 0, distance / 2.0)
		(chunk["detail"] as MeshKit).add_cylinder(Transform3D(Basis(), _at(center, yaw, local)), 0.07, 9.0, 6, Color(0.85, 0.85, 0.86))
		_detail_box(chunk, center, yaw, local + Vector3(0.9, 7.6, 0), Vector3(1.8, 1.2, 0.04), flags[i % flags.size()])
		_collider(_at(center, yaw, local) + Vector3(0, 4.5, 0), Vector3(0.2, 9.0, 0.2), yaw)


# --- Central de Entregas e chácara ------------------------------------------------------

func _build_hq() -> void:
	var chunk := _chunk(CityLayout.HQ["block"])
	var center: Vector3 = CityLayout.HQ["center"]
	center.y = _base_y
	var size: Vector3 = CityLayout.HQ["size"]
	var orange := Color(0.96, 0.5, 0.1)
	size.y = _snap_height("office", size.y)
	_body(chunk, center, 0.0, size, Color(0.92, 0.92, 0.9), "office")
	_roof(chunk, center, 0.0, size, orange)
	_detail_box(chunk, center, 0.0, Vector3(0, 4.3, size.z / 2.0 + 0.04), Vector3(size.x, 0.7, 0.1), orange)
	# Portões da garagem da frota e porta de pedestres.
	for x: float in [-16.0, -8.0, 8.0, 16.0]:
		_detail_box(chunk, center, 0.0, Vector3(x, 0, size.z / 2.0 + 0.03), Vector3(5.2, 3.9, 0.12), Color(0.78, 0.8, 0.82))
	_door(chunk, center, 0.0, size.z, 0.0, Vector2(3.0, 2.8), DARK_GLASS)
	_detail_box(chunk, center, 0.0, Vector3(0, 3.2, size.z / 2.0 + 1.3), Vector3(6.0, 0.25, 2.6), orange)
	_sign(chunk, "ENTREGAJÁ", center, 0.0, size.z, size.y + 1.9, 26.0, orange)
	_sign(chunk, "CENTRAL DE ENTREGAS", center, 0.0, size.z + 0.2, 6.2, 16.0, Color(0.2, 0.22, 0.25), Color.WHITE, false)


func _build_farm() -> void:
	var chunk := _chunk("farm")
	var house: Vector3 = CityLayout.FARM["house"]
	var yaw := PI / 2.0
	var cream := Color(0.96, 0.93, 0.84)
	_house(chunk, house, yaw, 14.0, 10.0, false, cream, 0.0, 14.0)
	# Varanda na frente da casa.
	_detail_box(chunk, house, yaw, Vector3(0, 3.0, 6.5), Vector3(12.0, 0.2, 3.0), Color(0.45, 0.3, 0.2))
	for x: float in [-5.5, 0.0, 5.5]:
		_detail_box(chunk, house, yaw, Vector3(x, 0, 7.8), Vector3(0.25, 3.0, 0.25), Color(0.45, 0.3, 0.2))
	# Celeiro vermelho e silo.
	var barn := house + Vector3(-12.0, 0, -32.0)
	var barn_size := Vector3(18.0, 7.0, 12.0)
	_body(chunk, barn, yaw, barn_size, Color(0.62, 0.16, 0.12), "shed")
	var roof_color := Color(0.35, 0.33, 0.32)
	roof_color.a = 0.8
	(chunk["facade"] as MeshKit).add_gable_roof(Transform3D(Basis(Vector3.UP, yaw), barn + Vector3(0, barn_size.y, 0)), barn_size.x, barn_size.z, 4.0, 0.6, roof_color, Vector2(0.3, 7.0))
	_detail_box(chunk, barn, yaw, Vector3(0, 0, barn_size.z / 2.0 + 0.03), Vector3(5.0, 5.0, 0.12), Color(0.95, 0.93, 0.9))
	var silo := house + Vector3(-14.0, 0, -14.0)
	(chunk["detail"] as MeshKit).add_cylinder(Transform3D(Basis(), silo), 3.2, 13.0, 16, Color(0.75, 0.76, 0.78))
	_collider(silo + Vector3(0, 6.5, 0), Vector3(6.0, 13.0, 6.0))
	var gate := house + Vector3(46.0, 0, -9.0)
	_sign(chunk, "CHÁCARA BOM SOSSEGO", gate, yaw, 0.0, 2.6, 6.0, Color(0.4, 0.26, 0.15), Color(1.0, 0.95, 0.8))
	for post_x: float in [-3.2, 3.2]:
		_detail_box(chunk, gate, yaw, Vector3(post_x, 0, 0), Vector3(0.25, 3.2, 0.25), Color(0.35, 0.24, 0.15))
		_collider(_at(gate, yaw, Vector3(post_x, 1.6, 0)), Vector3(0.25, 3.2, 0.25), yaw)
