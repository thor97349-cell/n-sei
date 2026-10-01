class_name PropsBuilder
extends RefCounted
## Mobiliário urbano e áreas especiais: postes, árvores, semáforos, placas de rua,
## vagas de carga, praça com chafariz, estacionamentos, parque, orla, estádio, obra,
## quadra da escola, becos, chácara e o campo/montanhas em volta da cidade.
##
## Objetos repetidos (postes e árvores) usam MultiMesh em pedaços de 200 m, para o
## motor descartar o que está fora da câmera.

const LAMP_SPACING := 36.0
const LAMP_HEIGHT := 7.6
const LAMP_ARM := 2.0
const CHUNK := 200.0
## Árvores em pedaços menores (a troca entre a versão detalhada e a simples é por pedaço).
const TREE_CHUNK := 90.0
const TREE_DETAIL_RANGE := 190.0
const SIGN_GREEN := Color(0.04, 0.34, 0.17)
const STONE := Color(0.7, 0.68, 0.64)
const WOOD := Color(0.42, 0.29, 0.18)
const POLE_GREY := Color(0.24, 0.25, 0.27)
const PAINT_WHITE := Color(0.93, 0.93, 0.9)
const PAINT_YELLOW := Color(0.98, 0.78, 0.1)
## Temas cujas calçadas recebem árvores.
const LEAFY_THEMES := ["residential", "apartments", "school", "park", "promenade", "plaza", "waterfront", "stadium"]

var _root: Node3D
var _static: StaticBody3D
var _graph: RoadGraph
var _info: CityBuilder.CityInfo
var _holder: Node3D
var _rng := RandomNumberGenerator.new()
## Sorteios só de aparência (inclinação das árvores): separado para não mudar a cidade.
var _detail_rng := RandomNumberGenerator.new()
var _blocks: Array[Dictionary] = []
var _detail := MeshKit.new()
var _paint := MeshKit.new()
var _water := MeshKit.new()
var _lights := MeshKit.new()
## Árvores por espécie (FoliageKit.SPECIES): transformações e dados de cor por árvore.
var _trees := {}
var _tree_custom := {}
var _lamps: Array[Transform3D] = []
var _lamp_shapes: Array[CollisionShape3D] = []
## Onde não pode haver poste/árvore (entradas, becos, vagas de carga).
var _keep_clear: Array[Rect2] = []


func _init(root: Node3D, static_body: StaticBody3D, graph: RoadGraph, info: CityBuilder.CityInfo) -> void:
	_root = root
	_static = static_body
	_graph = graph
	_info = info
	_rng.seed = 99_1234
	_detail_rng.seed = 31_337


func build_all() -> void:
	_holder = Node3D.new()
	_holder.name = "Props"
	_root.add_child(_holder)
	_blocks = CityLayout.blocks()
	_collect_keep_clear()
	_bus_stops()
	_street_lamps_and_trees()
	_traffic_lights()
	_loading_bays()
	_plaza()
	_hq_parking()
	_mall_parking()
	_parked_cars()
	_park()
	_promenade()
	_stadium()
	_construction()
	_school_court()
	_alleys()
	_farm()
	_countryside()
	for point in _info.yard_trees:
		_add_tree(Vector3(point.x, _ground_y(point), point.z), false)
	_hedges()
	_ground_cover()
	_commit()


# --- utilidades -----------------------------------------------------------------------

func _collider(center: Vector3, size: Vector3, basis: Basis = Basis()) -> void:
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = size
	shape.shape = box
	shape.transform = Transform3D(basis, center)
	_static.add_child(shape)


func _cylinder_collider(base: Vector3, radius: float, height: float) -> CollisionShape3D:
	var shape := CollisionShape3D.new()
	var cylinder := CylinderShape3D.new()
	cylinder.radius = radius
	cylinder.height = height
	shape.shape = cylinder
	shape.position = base + Vector3(0, height / 2.0, 0)
	_static.add_child(shape)
	return shape


## Caixa num referencial (origem + base): `local` = centro da base da caixa.
func _box(kit: MeshKit, origin: Vector3, basis: Basis, local: Vector3, size: Vector3, color: Color, collide: bool = false) -> void:
	kit.add_box(Transform3D(basis, origin + basis * local), size, color, Vector2.ZERO, false, false)
	if collide:
		_collider(origin + basis * (local + Vector3(0, size.y / 2.0, 0)), size, basis)


## Retângulo plano alinhado aos eixos (pintura no chão, gramados, caminhos).
func _flat(kit: MeshKit, xmin: float, xmax: float, zmin: float, zmax: float, y: float, color: Color = Color.WHITE) -> void:
	var corners: Array[Vector3] = [Vector3(xmin, y, zmin), Vector3(xmax, y, zmin), Vector3(xmax, y, zmax), Vector3(xmin, y, zmax)]
	var uvs: Array[Vector2] = [Vector2(xmin, zmin), Vector2(xmax, zmin), Vector2(xmax, zmax), Vector2(xmin, zmax)]
	kit.add_quad(corners, uvs, Vector3.UP, color, Vector2(xmax - xmin, zmax - zmin))


## Faixa plana entre dois pontos (caminhos diagonais).
func _strip(kit: MeshKit, from: Vector3, to: Vector3, width: float, y: float, color: Color = Color.WHITE) -> void:
	var dir := (to - from)
	dir.y = 0.0
	var side := Vector3(-dir.z, 0, dir.x).normalized() * width / 2.0
	var a := Vector3(from.x, y, from.z)
	var b := Vector3(to.x, y, to.z)
	var corners: Array[Vector3] = [a - side, b - side, b + side, a + side]
	if (corners[1] - corners[0]).cross(corners[2] - corners[0]).y > 0.0:
		corners = [a + side, b + side, b - side, a - side]
	var uvs: Array[Vector2] = []
	for corner in corners:
		uvs.append(Vector2(corner.x, corner.z))
	kit.add_quad(corners, uvs, Vector3.UP, color, Vector2(width, dir.length()))


func _block_at(p: Vector3) -> Dictionary:
	for block in _blocks:
		if CityLayout.in_rect(Vector2(p.x, p.z), block["min"], block["max"]):
			return block
	return {}


func _ground_y(p: Vector3) -> float:
	return CityLayout.CURB_HEIGHT if not _block_at(p).is_empty() else 0.0


func _clear(p: Vector3) -> bool:
	var point := Vector2(p.x, p.z)
	for rect in _keep_clear:
		if rect.has_point(point):
			return false
	return true


func _in_canal(p: Vector3, margin: float = 2.0) -> bool:
	return p.z > CityLayout.CANAL_Z_MIN - margin and p.z < CityLayout.CANAL_Z_MAX + margin


func _yaw_to(direction: Vector3) -> float:
	return atan2(direction.x, direction.z)


## Planta uma árvore. `species` vazio = folhosa sorteada (redonda, alta ou guarda-chuva).
func _add_tree(base: Vector3, pine: bool, collide: bool = true, species: String = "") -> void:
	if pine:
		species = "pine"
	elif species == "":
		var roll := _rng.randf()
		species = "round" if roll < 0.5 else ("tall" if roll < 0.78 else "umbrella")
	var scale := _rng.randf_range(0.8, 1.25)
	if species == "palm":
		scale = _rng.randf_range(0.85, 1.15)
	# Cada árvore um pouco torta (até ~3°) e com proporções levemente diferentes.
	var lean_axis := Vector3.RIGHT.rotated(Vector3.UP, _detail_rng.randf() * TAU)
	var basis := (Basis(lean_axis, _detail_rng.randf_range(0.0, 0.05)) * Basis(Vector3.UP, _rng.randf() * TAU)).scaled(Vector3(scale, scale * _rng.randf_range(0.9, 1.12), scale))
	if not _trees.has(species):
		_trees[species] = [] as Array[Transform3D]
		_tree_custom[species] = []
	(_trees[species] as Array[Transform3D]).append(Transform3D(basis, base))
	# Cor: variação de verde; alguns ipês floridos (amarelos ou rosas) entre as folhosas
	# e alguns arbustos com flor.
	var flowering := 1.0 if (species in ["round", "umbrella"] and _rng.randf() < 0.12) or (species == "bush" and _rng.randf() < 0.25) else 0.0
	(_tree_custom[species] as Array).append(Color(_rng.randf(), flowering, 1.0 if _rng.randf() < 0.5 else 0.0, 0.0))
	if collide:
		_cylinder_collider(base, 0.25 * scale, 3.0)


func _add_lamp(base: Vector3, yaw: float) -> void:
	var xform := Transform3D(Basis(Vector3.UP, yaw), base)
	_lamps.append(xform)
	_info.street_lamps.append(xform * Vector3(0, LAMP_HEIGHT - 0.15, LAMP_ARM))
	_lamp_shapes.append(_cylinder_collider(base, 0.16, LAMP_HEIGHT))


func _bench(center: Vector3, yaw: float) -> void:
	var basis := Basis(Vector3.UP, yaw)
	_box(_detail, center, basis, Vector3(0, 0.42, 0), Vector3(1.8, 0.07, 0.5), WOOD)
	_box(_detail, center, basis, Vector3(0, 0.55, -0.24), Vector3(1.8, 0.4, 0.06), WOOD)
	for x: float in [-0.75, 0.75]:
		_box(_detail, center, basis, Vector3(x, 0, 0), Vector3(0.08, 0.42, 0.45), POLE_GREY)
	_collider(center + Vector3(0, 0.4, 0), Vector3(1.8, 0.8, 0.5), basis)


func _bin(center: Vector3, color: Color) -> void:
	_box(_detail, center, Basis(), Vector3.ZERO, Vector3(0.55, 0.95, 0.55), color, true)


# --- áreas livres ---------------------------------------------------------------------

func _collect_keep_clear() -> void:
	for loc: Dictionary in CityLayout.all_locations():
		var zone: Vector3 = loc["zone"]
		_keep_clear.append(Rect2(zone.x - 9.0, zone.z - 9.0, 18.0, 18.0))
	for loc: Dictionary in CityLayout.LOCATIONS:
		var setback: float = loc.get("setback", 0.0)
		if setback < 10.0:
			continue
		var info := CityLayout.location_info(loc)
		var center: Vector3 = info["center"]
		var facing: Vector3 = info["facing"]
		var footprint: Vector2 = info["footprint"]
		var front := center + facing * (float(loc["depth"]) / 2.0 + setback + 3.0)
		var size := Vector2(footprint.x + 4.0, 12.0) if info["zone_along_x"] else Vector2(12.0, footprint.y + 4.0)
		_keep_clear.append(Rect2(Vector2(front.x, front.z) - size / 2.0, size))
	var gate_z: Vector2 = CityLayout.MALL_PARKING["gate_z"]
	_keep_clear.append(Rect2(-46.0, 60.0, 92.0, 14.0))
	_keep_clear.append(Rect2(-226.0, gate_z.x - 3.0, 16.0, gate_z.y - gate_z.x + 6.0))
	_keep_clear.append(Rect2(-90.0, gate_z.x - 3.0, 16.0, gate_z.y - gate_z.x + 6.0))
	for alley: Dictionary in CityLayout.ALLEYS:
		var amin: Vector2 = alley["min"]
		var amax: Vector2 = alley["max"]
		if amax.x - amin.x > amax.y - amin.y:
			_keep_clear.append(Rect2(amin.x - 8.0, amin.y - 4.0, 16.0, amax.y - amin.y + 8.0))
			_keep_clear.append(Rect2(amax.x - 8.0, amin.y - 4.0, 16.0, amax.y - amin.y + 8.0))
		else:
			_keep_clear.append(Rect2(amin.x - 4.0, amin.y - 8.0, amax.x - amin.x + 8.0, 16.0))
			_keep_clear.append(Rect2(amin.x - 4.0, amax.y - 8.0, amax.x - amin.x + 8.0, 16.0))
	_keep_clear.append(Rect2(136.0, 72.0, 28.0, 16.0))
	_keep_clear.append(Rect2(-392.0, 292.0, 14.0, 16.0))


# --- postes e árvores de rua -----------------------------------------------------------

func _street_lamps_and_trees() -> void:
	for edge in _graph.edges:
		var right := Vector3(-edge.dir.z, 0, edge.dir.x)
		var start_margin := _graph.crossing_width(edge.a, edge) / 2.0 + 7.0
		var end_margin := _graph.crossing_width(edge.b, edge) / 2.0 + 7.0
		for side: float in [1.0, -1.0]:
			var outward := right * side
			var along := start_margin + (0.0 if side > 0.0 else LAMP_SPACING / 2.0)
			while along < edge.length - end_margin:
				var p := edge.from + edge.dir * along + outward * (edge.width / 2.0 + 0.7)
				if not (edge.axis == "z" and _in_canal(p)) and _clear(p):
					p.y = _ground_y(p)
					_add_lamp(p, _yaw_to(-outward))
				for extra: float in [LAMP_SPACING / 3.0, LAMP_SPACING * 2.0 / 3.0]:
					var t := edge.from + edge.dir * (along + extra) + outward * (edge.width / 2.0 + 2.0)
					if along + extra > edge.length - end_margin or (edge.axis == "z" and _in_canal(t, 4.0)) or not _clear(t):
						continue
					var block := _block_at(t)
					if block.is_empty() or not LEAFY_THEMES.has(block["theme"]):
						continue
					t.y = CityLayout.CURB_HEIGHT
					_add_tree(t, false)
				along += LAMP_SPACING


# --- pontos de ônibus ------------------------------------------------------------------------

## Um abrigo de ônibus no meio de cada trecho de avenida (um lado só), nos bairros com
## movimento. Os pedestres esperam ali (Pedestrians). Postes e árvores não ocupam o lugar.
func _bus_stops() -> void:
	var ads: Array[Color] = [Color(0.95, 0.5, 0.1), Color(0.2, 0.5, 0.85), Color(0.85, 0.22, 0.3), Color(0.3, 0.65, 0.35)]
	for edge in _graph.edges:
		if edge.highway or edge.crossing != "" or edge.length < 100.0:
			continue
		var side := 1.0 if edge.index % 2 == 0 else -1.0
		var outward := Vector3(-edge.dir.z, 0, edge.dir.x) * side
		var along := edge.length * (0.5 + (0.1 if edge.index % 3 == 0 else -0.08))
		var origin := edge.from + edge.dir * along + outward * (edge.width / 2.0)
		var block := _block_at(origin + outward * 2.0)
		if block.is_empty() or block["theme"] in ["industrial", "construction"]:
			continue
		var fits := true
		for offset: float in [-5.0, 0.0, 5.0]:
			var probe := origin + outward * 2.0 + edge.dir * offset
			if not _clear(probe) or _in_canal(probe, 6.0):
				fits = false
		if not fits:
			continue
		origin.y = CityLayout.CURB_HEIGHT
		var basis := Basis(Vector3.UP, _yaw_to(outward))
		var roof := Color(0.2, 0.22, 0.25)
		_box(_detail, origin, basis, Vector3(0, 2.4, 1.7), Vector3(3.5, 0.09, 1.6), roof)
		_box(_detail, origin, basis, Vector3(0, 0.25, 2.42), Vector3(3.3, 2.15, 0.06), Color(0.56, 0.68, 0.74), true)
		_box(_detail, origin, basis, Vector3(0, 0.0, 2.42), Vector3(3.3, 0.25, 0.1), roof)
		_box(_detail, origin, basis, Vector3(1.62, 0.25, 1.8), Vector3(0.07, 2.15, 1.2), ads[edge.index % ads.size()], true)
		_box(_detail, origin, basis, Vector3(-1.62, 0.0, 2.3), Vector3(0.08, 2.4, 0.08), roof)
		_box(_detail, origin, basis, Vector3(0, 0.45, 2.1), Vector3(2.4, 0.07, 0.42), WOOD)
		for x: float in [-1.0, 1.0]:
			_box(_detail, origin, basis, Vector3(x, 0.0, 2.1), Vector3(0.07, 0.45, 0.35), POLE_GREY)
		_collider(origin + basis * Vector3(0, 0.25, 2.1), Vector3(2.4, 0.5, 0.42), basis)
		# Placa de ônibus pendurada na ponta do teto.
		_box(_detail, origin, basis, Vector3(-1.9, 2.0, 1.1), Vector3(0.05, 0.45, 0.55), Color(0.1, 0.3, 0.7))
		_box(_detail, origin, basis, Vector3(-1.9, 2.05, 1.1), Vector3(0.06, 0.08, 0.56), PAINT_YELLOW)
		_bin(origin + basis * Vector3(2.15, 0, 2.0), Color(0.2, 0.42, 0.25))
		var corners: Array[Vector3] = [origin + edge.dir * 5.5, origin - edge.dir * 5.5 + outward * 4.0]
		var low := Vector2(minf(corners[0].x, corners[1].x), minf(corners[0].z, corners[1].z))
		var high := Vector2(maxf(corners[0].x, corners[1].x), maxf(corners[0].z, corners[1].z))
		_keep_clear.append(Rect2(low, high - low))
		_info.bus_stops.append([origin + basis * Vector3(0, 0, 1.25), _yaw_to(-outward)])


# --- semáforos ---------------------------------------------------------------------------

func _traffic_lights() -> void:
	var colors := {"red": Color(1.0, 0.1, 0.06), "yellow": Color(1.0, 0.66, 0.04), "green": Color(0.1, 1.0, 0.5)}
	var heights := {"red": 0.36, "yellow": 0.0, "green": -0.36}
	var materials := {}
	var lamp_kits := {}
	for axis: String in ["x", "z"]:
		materials[axis] = {}
		for color_name: String in colors:
			var color: Color = colors[color_name]
			var material := StandardMaterial3D.new()
			material.albedo_color = color.darkened(0.8)
			material.emission_enabled = true
			material.emission = color
			material.emission_energy_multiplier = 0.0
			material.roughness = 0.2
			materials[axis][color_name] = material
			lamp_kits[axis + ":" + color_name] = MeshKit.new()
	_info.traffic_light_materials = materials

	var metal := MeshKit.new()
	var signs := Node3D.new()
	signs.name = "StreetSigns"
	_holder.add_child(signs)
	for node in _graph.nodes.size():
		if not _graph.has_traffic_lights(node):
			continue
		var center := _graph.nodes[node]
		for index: int in _graph.node_edges[node]:
			var edge: RoadGraph.Edge = _graph.edges[index]
			var approach := (center - _graph.nodes[_graph.other_node(edge, node)]).normalized()
			var right := Vector3(-approach.z, 0, approach.x)
			var cross_half := _graph.crossing_width(node, edge) / 2.0
			var pole := center - approach * (cross_half + 1.4) + right * (edge.width / 2.0 + 0.8)
			pole.y = _ground_y(pole)
			# Base local: +Z aponta para o motorista que chega, +X para a direita dele.
			var basis := Basis(Vector3.UP, _yaw_to(-approach))
			var arm := edge.width / 4.0 + 0.8
			metal.add_cylinder(Transform3D(basis, pole), 0.13, 6.3, 10, POLE_GREY)
			_box(metal, pole, basis, Vector3(-arm / 2.0, 5.95, 0), Vector3(arm, 0.16, 0.16), POLE_GREY)
			_box(metal, pole, basis, Vector3(-arm, 4.55, -0.03), Vector3(0.72, 1.44, 0.05), Color(0.05, 0.05, 0.05))
			_box(metal, pole, basis, Vector3(-arm, 4.65, 0), Vector3(0.42, 1.22, 0.34), Color(0.09, 0.09, 0.1))
			_collider(pole + Vector3(0, 3.15, 0), Vector3(0.3, 6.3, 0.3), basis)
			for color_name: String in colors:
				var kit: MeshKit = lamp_kits[edge.axis + ":" + color_name]
				var y := 5.26 + float(heights[color_name]) - 0.12
				_box(kit, pole, basis, Vector3(-arm, y, 0.17), Vector3(0.25, 0.25, 0.05), Color.WHITE)
				# Pala sobre cada luz.
				_box(metal, pole, basis, Vector3(-arm, y + 0.27, 0.27), Vector3(0.3, 0.03, 0.22), Color(0.09, 0.09, 0.1))
			# Placa com o nome da rua transversal.
			var cross_name := CityLayout.road_name("x", center.x) if edge.axis == "x" else CityLayout.road_name("z", center.z)
			_box(metal, pole, basis, Vector3(-1.9, 6.15, 0.02), Vector3(3.0, 0.5, 0.04), SIGN_GREEN)
			var label := Label3D.new()
			label.text = cross_name
			label.font = Mats.sign_font()
			label.font_size = 64
			label.pixel_size = 0.26 / 64.0
			label.double_sided = false
			label.alpha_cut = Label3D.ALPHA_CUT_OPAQUE_PREPASS
			label.position = pole + basis * Vector3(-1.9, 6.4, 0.07)
			label.rotation.y = _yaw_to(-approach)
			label.visibility_range_end = 110.0
			label.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			signs.add_child(label)
	_mesh(metal.commit(Mats.vertex_colored("traffic_metal", 0.5, 0.6)), "TrafficPoles")
	for key: String in lamp_kits:
		var parts := key.split(":")
		var kit: MeshKit = lamp_kits[key]
		if not kit.is_empty():
			var mesh := _mesh(kit.commit(materials[parts[0]][parts[1]]), "TrafficLamps_" + key.replace(":", "_"))
			mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF


func _mesh(mesh: Mesh, node_name: String) -> MeshInstance3D:
	var instance := MeshInstance3D.new()
	instance.name = node_name
	instance.mesh = mesh
	_holder.add_child(instance)
	return instance


# --- vagas de carga -----------------------------------------------------------------------

func _loading_bays() -> void:
	var labels := Node3D.new()
	labels.name = "BayLabels"
	_holder.add_child(labels)
	for loc: Dictionary in CityLayout.all_locations():
		var zone: Vector3 = loc["zone"]
		var along_x: bool = loc["zone_along_x"]
		var half := Vector2(6.5, 1.5) if along_x else Vector2(1.5, 6.5)
		var y := 0.022
		var t := 0.16
		var xmin := zone.x - half.x
		var xmax := zone.x + half.x
		var zmin := zone.z - half.y
		var zmax := zone.z + half.y
		_flat(_paint, xmin, xmax, zmin, zmin + t, y, PAINT_YELLOW)
		_flat(_paint, xmin, xmax, zmax - t, zmax, y, PAINT_YELLOW)
		_flat(_paint, xmin, xmin + t, zmin, zmax, y, PAINT_YELLOW)
		_flat(_paint, xmax - t, xmax, zmin, zmax, y, PAINT_YELLOW)
		# Sentido do trânsito na faixa da vaga (mão direita): o texto fica de pé para quem chega.
		var projection := _graph.nearest_edge(zone)
		var edge: RoadGraph.Edge = projection[0]
		var on_road := edge.from + edge.dir * float(projection[1])
		var outward := Vector3(zone.x - on_road.x, 0, zone.z - on_road.z).normalized()
		var travel := Vector3(outward.z, 0, -outward.x)
		var label := Label3D.new()
		label.text = "CARGA"
		label.font = Mats.sign_font()
		label.font_size = 96
		label.pixel_size = 1.1 / 96.0
		label.modulate = PAINT_YELLOW
		label.double_sided = false
		label.alpha_cut = Label3D.ALPHA_CUT_OPAQUE_PREPASS
		label.shaded = true
		label.position = Vector3(zone.x, 0.03, zone.z)
		label.basis = Basis(Vector3.UP, atan2(-travel.x, -travel.z)) * Basis(Vector3.RIGHT, -PI / 2.0)
		label.visibility_range_end = 120.0
		label.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		labels.add_child(label)


# --- praça, Central e estacionamentos ------------------------------------------------------

func _plaza() -> void:
	var curb := CityLayout.CURB_HEIGHT
	var fountain: Vector3 = CityLayout.PLAZA["fountain"]
	fountain.y = curb
	var radius: float = CityLayout.PLAZA["radius"]
	_detail.add_cylinder(Transform3D(Basis(), fountain), radius, 0.7, 40, STONE)
	_water.add_cylinder(Transform3D(Basis(), fountain + Vector3(0, 0.7, 0)), radius - 0.45, 0.03, 40, Color.WHITE)
	_detail.add_cylinder(Transform3D(Basis(), fountain + Vector3(0, 0.7, 0)), 1.0, 1.4, 16, STONE)
	_detail.add_cylinder(Transform3D(Basis(), fountain + Vector3(0, 2.1, 0)), 2.6, 0.35, 24, STONE)
	_water.add_cylinder(Transform3D(Basis(), fountain + Vector3(0, 2.45, 0)), 2.3, 0.02, 24, Color.WHITE)
	_detail.add_cylinder(Transform3D(Basis(), fountain + Vector3(0, 2.45, 0)), 0.3, 1.0, 10, STONE)
	_cylinder_collider(fountain, radius, 0.7)
	_cylinder_collider(fountain, 1.4, 3.4)
	_fountain_spray(fountain + Vector3(0, 3.4, 0))

	# Canteiros com árvores nos quatro cantos e bancos em volta do chafariz.
	var grass := MeshKit.new()
	for bed: Rect2 in [Rect2(-58, -31, 30, 17), Rect2(28, -31, 30, 17), Rect2(-58, -9, 30, 17), Rect2(28, -9, 30, 17)]:
		_flat(grass, bed.position.x, bed.end.x, bed.position.y, bed.end.y, curb + 0.13)
		_box(_detail, Vector3(bed.get_center().x, curb, bed.get_center().y), Basis(), Vector3.ZERO, Vector3(bed.size.x + 0.4, 0.12, bed.size.y + 0.4), STONE.darkened(0.1))
		for i in 4:
			var p := Vector3(_rng.randf_range(bed.position.x + 3, bed.end.x - 3), curb, _rng.randf_range(bed.position.y + 3, bed.end.y - 3))
			_add_tree(p, false, true, "palm" if i % 2 == 0 else "")
	var cover := _mesh(grass.commit(Mats.ground(0)), "PlazaGrass")
	cover.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	for i in 10:
		var angle := TAU * i / 10.0
		var direction := Vector3(sin(angle), 0, cos(angle))
		_bench(fountain + direction * 13.5, _yaw_to(-direction))
	for i in 6:
		var angle := TAU * (i + 0.5) / 6.0
		var direction := Vector3(sin(angle), 0, cos(angle))
		_add_lamp(fountain + direction * 17.0, _yaw_to(-direction))


func _fountain_spray(origin: Vector3) -> void:
	var particles := GPUParticles3D.new()
	particles.name = "FountainSpray"
	particles.amount = 260
	particles.lifetime = 1.3
	particles.position = origin
	particles.visibility_aabb = AABB(Vector3(-4, -4, -4), Vector3(8, 8, 8))
	var process := ParticleProcessMaterial.new()
	process.direction = Vector3.UP
	process.spread = 9.0
	process.initial_velocity_min = 4.2
	process.initial_velocity_max = 5.0
	process.gravity = Vector3(0, -9.8, 0)
	process.scale_min = 0.5
	process.scale_max = 1.0
	particles.process_material = process
	var quad := QuadMesh.new()
	quad.size = Vector2(0.14, 0.14)
	var material := StandardMaterial3D.new()
	material.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.albedo_color = Color(0.85, 0.93, 1.0, 0.45)
	quad.material = material
	particles.draw_pass_1 = quad
	particles.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_holder.add_child(particles)


## Fileira de vagas: linhas perpendiculares à fileira, de `start` (x ou z) a `end`.
func _stalls(along_x: bool, start: float, end: float, row_from: float, row_to: float, y: float, spacing: float = 2.7) -> void:
	var position := start
	while position <= end + 0.01:
		if along_x:
			_flat(_paint, position - 0.06, position + 0.06, minf(row_from, row_to), maxf(row_from, row_to), y, PAINT_WHITE)
		else:
			_flat(_paint, minf(row_from, row_to), maxf(row_from, row_to), position - 0.06, position + 0.06, y, PAINT_WHITE)
		position += spacing


func _hq_parking() -> void:
	var curb := CityLayout.CURB_HEIGHT
	var pmin: Vector2 = CityLayout.HQ_PARKING["min"]
	var pmax: Vector2 = CityLayout.HQ_PARKING["max"]
	var asphalt := MeshKit.new()
	_flat(asphalt, pmin.x - 2.0, pmax.x + 2.0, pmin.y - 2.0, 68.0, curb + 0.03)
	var cover := _mesh(asphalt.commit(Mats.ground(2)), "HQParking")
	cover.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var y := curb + 0.05
	_stalls(true, pmin.x + 1.0, pmax.x - 1.0, pmin.y, pmin.y + 5.5, y, 3.0)
	# Faixa laranja de "saída da frota".
	_flat(_paint, pmin.x, pmax.x, 66.6, 66.9, y, Color(0.96, 0.5, 0.1))


func _mall_parking() -> void:
	var curb := CityLayout.CURB_HEIGHT
	var pmin: Vector2 = CityLayout.MALL_PARKING["min"]
	var pmax: Vector2 = CityLayout.MALL_PARKING["max"]
	var gate_z: Vector2 = CityLayout.MALL_PARKING["gate_z"]
	var y := curb + 0.04
	for row: Vector2 in [Vector2(pmin.y, pmin.y + 5.5), Vector2(pmin.y + 5.5, pmin.y + 11.0), Vector2(gate_z.y + 1.0, gate_z.y + 6.5), Vector2(gate_z.y + 6.5, gate_z.y + 12.0)]:
		_stalls(true, pmin.x + 4.0, pmax.x - 4.0, row.x, row.y, y)
	# Faixa central (o "atalho" entre as duas avenidas quando os portões abrem).
	var x := pmin.x + 6.0
	while x < pmax.x - 6.0:
		_flat(_paint, x, x + 3.0, (gate_z.x + gate_z.y) / 2.0 - 0.08, (gate_z.x + gate_z.y) / 2.0 + 0.08, y, PAINT_YELLOW)
		x += 6.0
	# Muretas em volta (com os vãos dos portões nos lados oeste e leste).
	var wall := Color(0.62, 0.62, 0.6)
	var h := 0.9
	for spec: Array in [
		[Vector3((pmin.x + pmax.x) / 2.0, curb, pmin.y - 0.2), Vector3(pmax.x - pmin.x, h, 0.3)],
		[Vector3((pmin.x + pmax.x) / 2.0, curb, pmax.y + 0.2), Vector3(pmax.x - pmin.x, h, 0.3)],
	]:
		_box(_detail, spec[0], Basis(), Vector3.ZERO, spec[1], wall, true)
	for wall_x: float in [pmin.x - 0.2, pmax.x + 0.2]:
		for span: Vector2 in [Vector2(pmin.y, gate_z.x), Vector2(gate_z.y, pmax.y)]:
			_box(_detail, Vector3(wall_x, curb, (span.x + span.y) / 2.0), Basis(), Vector3.ZERO, Vector3(0.3, h, span.y - span.x), wall, true)

	# Portões: fechados (cancela abaixada + colisão) ou abertos (cancela levantada).
	var holder := Node3D.new()
	holder.name = "Shortcut_mall_gate"
	_holder.add_child(holder)
	var open_node := Node3D.new()
	open_node.name = "Open"
	var closed_node := Node3D.new()
	closed_node.name = "Closed"
	var closed_body := StaticBody3D.new()
	closed_node.add_child(closed_body)
	var open_kit := MeshKit.new()
	var closed_kit := MeshKit.new()
	var gate_width := gate_z.y - gate_z.x
	for gate_x: float in [pmin.x - 0.2, pmax.x + 0.2]:
		for kit: MeshKit in [open_kit, closed_kit]:
			_box(kit, Vector3(gate_x, curb, gate_z.x - 0.6), Basis(), Vector3.ZERO, Vector3(0.9, 1.2, 0.9), Color(0.95, 0.75, 0.1))
			_box(kit, Vector3(gate_x, curb, gate_z.y + 1.4), Basis(), Vector3.ZERO, Vector3(2.0, 2.6, 2.0), Color(0.85, 0.86, 0.88))
		for i in 8:
			var color := Color(0.9, 0.1, 0.1) if i % 2 == 0 else Color.WHITE
			var segment := gate_width / 8.0
			_box(closed_kit, Vector3(gate_x, curb + 1.0, gate_z.x + segment * (i + 0.5)), Basis(), Vector3.ZERO, Vector3(0.12, 0.12, segment), color)
			_box(open_kit, Vector3(gate_x, curb + 1.3 + segment * i, gate_z.x - 0.6), Basis(), Vector3.ZERO, Vector3(0.12, segment, 0.12), color)
		var shape := CollisionShape3D.new()
		var box := BoxShape3D.new()
		box.size = Vector3(0.4, 1.6, gate_width)
		shape.shape = box
		shape.position = Vector3(gate_x, curb + 0.8, (gate_z.x + gate_z.y) / 2.0)
		closed_body.add_child(shape)
		var sign := Label3D.new()
		sign.text = "ESTACIONAMENTO FECHADO"
		sign.font = Mats.sign_font()
		sign.font_size = 64
		sign.pixel_size = 0.009
		sign.modulate = Color(1.0, 0.85, 0.3)
		sign.position = Vector3(gate_x + (-0.3 if gate_x < -150.0 else 0.3), curb + 2.1, (gate_z.x + gate_z.y) / 2.0)
		sign.rotation.y = -PI / 2.0 if gate_x < -150.0 else PI / 2.0
		sign.visibility_range_end = 120.0
		closed_node.add_child(sign)
	var open_mesh := MeshInstance3D.new()
	open_mesh.mesh = open_kit.commit(Mats.vertex_colored("gate", 0.5))
	open_node.add_child(open_mesh)
	var closed_mesh := MeshInstance3D.new()
	closed_mesh.mesh = closed_kit.commit(Mats.vertex_colored("gate", 0.5))
	closed_node.add_child(closed_mesh)
	holder.add_child(closed_node)
	_info.shortcuts["mall_gate"] = {"parent": holder, "open": open_node, "closed": closed_node}


## Alguns carros parados no estacionamento do shopping (nas vagas ao lado da faixa
## central, que continua livre para o atalho).
func _parked_cars() -> void:
	var pmin: Vector2 = CityLayout.MALL_PARKING["min"]
	var pmax: Vector2 = CityLayout.MALL_PARKING["max"]
	var gate_z: Vector2 = CityLayout.MALL_PARKING["gate_z"]
	var y := CityLayout.CURB_HEIGHT + 0.04
	var holder := Node3D.new()
	holder.name = "ParkedCars"
	_holder.add_child(holder)
	var used := {}
	for i in 12:
		var row := _rng.randi() % 2
		var stall := _rng.randi_range(1, int((pmax.x - pmin.x - 8.0) / 2.7) - 2)
		if used.has("%d:%d" % [row, stall]):
			continue
		used["%d:%d" % [row, stall]] = true
		var x := pmin.x + 4.0 + 2.7 * (float(stall) + 0.5)
		# Fila norte (de frente para o muro norte) ou fila sul.
		var z := pmin.y + 8.3 if row == 0 else gate_z.y + 3.7
		var forward := Vector3(0, 0, -1) if row == 0 else Vector3(0, 0, 1)
		var car := TrafficCar.new()
		car.setup(TrafficCar.random_style(_rng) if _rng.randf() < 0.8 else "hatch", _rng.randi() % TrafficCar.COLORS.size())
		holder.add_child(car)
		car.place(Vector3(x, y, z), forward)


# --- parque e orla -----------------------------------------------------------------------------

func _park() -> void:
	var block := CityLayout.get_block("4,2")
	var bmin: Vector2 = block["min"]
	var bmax: Vector2 = block["max"]
	var curb := CityLayout.CURB_HEIGHT
	var trail_from: Vector3 = CityLayout.PARK_TRAIL["from"]
	var trail_to: Vector3 = CityLayout.PARK_TRAIL["to"]
	var trail_width: float = CityLayout.PARK_TRAIL["width"]
	var dirt := MeshKit.new()
	_strip(dirt, trail_from, trail_to, trail_width, curb + 0.04)
	var trail := _mesh(dirt.commit(Mats.ground(1)), "ParkTrail")
	trail.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

	var pond: Vector3 = CityLayout.PARK_POND["center"]
	var pond_radius: float = CityLayout.PARK_POND["radius"]
	pond.y = curb
	_detail.add_cylinder(Transform3D(Basis(), pond), pond_radius + 0.8, 0.45, 36, Color(0.45, 0.43, 0.4))
	_water.add_cylinder(Transform3D(Basis(), pond + Vector3(0, 0.45, 0)), pond_radius, 0.02, 36, Color.WHITE)
	_cylinder_collider(pond, pond_radius + 0.8, 0.9)

	var kiosk := CityLayout.find_location("park_kiosk")
	var kiosk_zone: Vector3 = kiosk["zone"]
	var placed: Array[Vector2] = []
	for attempt in 260:
		var p := Vector2(_rng.randf_range(bmin.x + 7.0, bmax.x - 7.0), _rng.randf_range(bmin.y + 7.0, bmax.y - 7.0))
		var p3 := Vector3(p.x, curb, p.y)
		if _distance_to_segment(p3, trail_from, trail_to) < trail_width / 2.0 + 3.0:
			continue
		if Vector2(pond.x, pond.z).distance_to(p) < pond_radius + 4.0:
			continue
		if Vector2(kiosk_zone.x, kiosk_zone.z).distance_to(p) < 22.0:
			continue
		var crowded := false
		for other in placed:
			if other.distance_to(p) < 7.0:
				crowded = true
				break
		if crowded:
			continue
		placed.append(p)
		_add_tree(p3, _rng.randf() < 0.25)
	# Bancos e postes ao longo da trilha.
	var length := trail_from.distance_to(trail_to)
	var dir := (trail_to - trail_from).normalized()
	var side := Vector3(-dir.z, 0, dir.x)
	var distance := 14.0
	while distance < length - 10.0:
		var p := trail_from + dir * distance
		p.y = curb
		_bench(p + side * (trail_width / 2.0 + 1.2), _yaw_to(-side))
		_add_lamp(p - side * (trail_width / 2.0 + 0.8), _yaw_to(side))
		distance += 26.0


# --- vegetação dos jardins -----------------------------------------------------------------

## Cercas vivas (lugares vindos do BuildingBuilder): miolo + cartões de folhas por pedaço
## da cidade; de longe fica só o miolo. Alguns arbustos do lado de dentro do jardim.
func _hedges() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 515
	var chunks := {}
	for entry: Array in _info.hedges:
		var xform: Transform3D = entry[0]
		var size: Vector3 = entry[1]
		var key := Vector2i(floori(xform.origin.x / CHUNK), floori(xform.origin.z / CHUNK))
		if not chunks.has(key):
			var st := SurfaceTool.new()
			st.begin(Mesh.PRIMITIVE_TRIANGLES)
			chunks[key] = [st, MeshKit.new()]
		FoliageKit.add_hedge(chunks[key][0], chunks[key][1], xform, size, rng)
		if rng.randf() < 0.45 and size.x > 2.0:
			_add_tree(xform * Vector3(rng.randf_range(-0.35, 0.35) * size.x, 0, -1.2), false, false, "bush")
	for key: Vector2i in chunks:
		var core := _mesh((chunks[key][1] as MeshKit).commit(FoliageKit.core_material("hedge")), "HedgeCore_%d_%d" % [key.x, key.y])
		core.visibility_range_end = 700.0
		var st: SurfaceTool = chunks[key][0]
		st.set_material(FoliageKit.leaf_material("hedge"))
		var cards := _mesh(st.commit(), "HedgeLeaves_%d_%d" % [key.x, key.y])
		cards.visibility_range_end = 170.0


## Tufos de grama e flores nos gramados (jardins, parque, escola) e arbustos no parque.
func _ground_cover() -> void:
	var cover := GroundCover.new(_static, float(Settings.quality().get("grass", 1.0)))
	var y := CityLayout.CURB_HEIGHT + 0.02
	var trail_from: Vector3 = CityLayout.PARK_TRAIL["from"]
	var trail_to: Vector3 = CityLayout.PARK_TRAIL["to"]
	var trail_half: float = float(CityLayout.PARK_TRAIL["width"]) / 2.0
	var pond: Vector3 = CityLayout.PARK_POND["center"]
	var pond_radius: float = CityLayout.PARK_POND["radius"]
	var park_skip := func(p: Vector2) -> bool:
		return _distance_to_segment(Vector3(p.x, 0, p.y), trail_from, trail_to) < trail_half + 0.3 \
			or Vector2(pond.x, pond.z).distance_to(p) < pond_radius + 1.2
	for block in _blocks:
		var theme: String = block["theme"]
		if not theme in ["residential", "park", "school"]:
			continue
		var bmin: Vector2 = block["min"]
		var bmax: Vector2 = block["max"]
		var imin := bmin + Vector2.ONE * CityLayout.SIDEWALK
		var imax := bmax - Vector2.ONE * CityLayout.SIDEWALK
		if block["canal_side"] == "S":
			imax.y = bmax.y - 1.0
		elif block["canal_side"] == "N":
			imin.y = bmin.y + 1.0
		var rect := Rect2(imin, imax - imin)
		match theme:
			"residential":
				cover.scatter(rect, y, 0.6, 2.0, 1.0, 0.05)
			"park":
				cover.scatter(rect, y, 0.5, 1.8, 1.0, 0.07, park_skip)
				# Arbustos soltos e em grupinhos pelo gramado.
				for i in 70:
					var p := rect.position + Vector2(_rng.randf(), _rng.randf()) * rect.size
					if cover.is_free(p) and not park_skip.call(p):
						for k in (1 if _rng.randf() < 0.6 else 3):
							var q := p + Vector2(_rng.randf_range(-1.2, 1.2), _rng.randf_range(-1.2, 1.2)) * float(k > 0)
							_add_tree(Vector3(q.x, CityLayout.CURB_HEIGHT, q.y), false, false, "bush")
			_:
				cover.scatter(rect, y, 0.0, 1.6, 0.8, 0.03)
	var holder := Node3D.new()
	holder.name = "GroundCover"
	_holder.add_child(holder)
	cover.commit(holder)


func _distance_to_segment(p: Vector3, a: Vector3, b: Vector3) -> float:
	var ab := Vector2(b.x - a.x, b.z - a.z)
	var ap := Vector2(p.x - a.x, p.z - a.z)
	var t := clampf(ap.dot(ab) / ab.length_squared(), 0.0, 1.0)
	return (ap - ab * t).length()


func _promenade() -> void:
	var block := CityLayout.get_block("2,3n")
	var bmin: Vector2 = block["min"]
	var bmax: Vector2 = block["max"]
	var curb := CityLayout.CURB_HEIGHT
	var walk := MeshKit.new()
	var walk_min := bmax.y - 13.0
	_flat(walk, bmin.x + 4.0, bmax.x - 4.0, walk_min, bmax.y - 1.0, curb + 0.035)
	var middle := (bmin.x + bmax.x) / 2.0
	_flat(walk, middle - 3.0, middle + 3.0, bmin.y + 4.0, walk_min, curb + 0.035)
	var cover := _mesh(walk.commit(Mats.ground(3)), "PromenadeWalk")
	cover.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var x := bmin.x + 10.0
	var i := 0
	while x < bmax.x - 8.0:
		if absf(x - middle) > 6.0:
			_bench(Vector3(x, curb, bmax.y - 3.2), 0.0)
			_add_tree(Vector3(x + 5.0, curb, walk_min - 3.0), false, true, "palm")
			if i % 2 == 0:
				_add_lamp(Vector3(x + 5.0, curb, walk_min + 0.8), 0.0)
		x += 12.0
		i += 1
	for j in 18:
		var p := Vector3(_rng.randf_range(bmin.x + 8.0, bmax.x - 8.0), curb, _rng.randf_range(bmin.y + 8.0, walk_min - 8.0))
		if absf(p.x - middle) > 7.0:
			_add_tree(p, false)


# --- estádio, obra, quadra, becos -----------------------------------------------------------

func _stadium() -> void:
	var center: Vector3 = CityLayout.STADIUM["center"]
	var size: Vector2 = CityLayout.STADIUM["size"]
	var height: float = CityLayout.STADIUM["height"]
	var curb := CityLayout.CURB_HEIGHT
	center.y = curb
	var concrete := Color(0.72, 0.71, 0.68)
	var stand_depth := 22.0
	var tiers := 6
	# Arquibancadas: uma por lado, em degraus que descem para o campo.
	for side in 4:
		var yaw := side * PI / 2.0
		var basis := Basis(Vector3.UP, yaw)
		var half_along := (size.x if side % 2 == 0 else size.y) / 2.0
		var half_across := (size.y if side % 2 == 0 else size.x) / 2.0
		for tier in tiers:
			var depth := stand_depth - tier * (stand_depth - 4.0) / tiers
			var tier_height := height * (tier + 1) / tiers
			var local := Vector3(0, 0, half_across - depth / 2.0)
			var length := half_along * 2.0 - (stand_depth - depth) * 2.0
			_box(_detail, center, basis, local - Vector3(0, 0, 0), Vector3(length, tier_height, depth), concrete if tier < tiers - 1 else concrete.darkened(0.15))
			# Faixa de cadeiras coloridas na borda de cada degrau.
			var seat_color := Color(0.15, 0.3, 0.7) if (tier + side) % 2 == 0 else Color(0.9, 0.9, 0.92)
			_box(_detail, center, basis, Vector3(0, tier_height, half_across - depth + 0.6), Vector3(length, 0.35, 1.2), seat_color)
		_collider(center + basis * Vector3(0, height / 2.0, half_across - stand_depth / 2.0), Vector3(half_along * 2.0, height, stand_depth), basis)
	# Campo com as linhas.
	var field := MeshKit.new()
	var fx := size.x / 2.0 - stand_depth + 1.0
	var fz := size.y / 2.0 - stand_depth + 1.0
	_flat(field, center.x - fx, center.x + fx, center.z - fz, center.z + fz, curb + 0.04)
	var field_mesh := _mesh(field.commit(Mats.ground(0)), "StadiumField")
	field_mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var lx := fx - 4.0
	var lz := fz - 4.0
	var y := curb + 0.06
	_flat(_paint, center.x - lx, center.x + lx, center.z - lz, center.z - lz + 0.15, y, PAINT_WHITE)
	_flat(_paint, center.x - lx, center.x + lx, center.z + lz - 0.15, center.z + lz, y, PAINT_WHITE)
	_flat(_paint, center.x - lx, center.x - lx + 0.15, center.z - lz, center.z + lz, y, PAINT_WHITE)
	_flat(_paint, center.x + lx - 0.15, center.x + lx, center.z - lz, center.z + lz, y, PAINT_WHITE)
	_flat(_paint, center.x - 0.075, center.x + 0.075, center.z - lz, center.z + lz, y, PAINT_WHITE)
	# Torres de iluminação nos cantos.
	for corner: Vector2 in [Vector2(-1, -1), Vector2(1, -1), Vector2(-1, 1), Vector2(1, 1)]:
		var base := center + Vector3(corner.x * (size.x / 2.0 + 3.0), 0, corner.y * (size.y / 2.0 + 3.0))
		_detail.add_cylinder(Transform3D(Basis(), base), 0.6, 34.0, 10, Color(0.6, 0.62, 0.64))
		var toward := (center - base)
		toward.y = 0.0
		var head_basis := Basis(Vector3.UP, _yaw_to(toward.normalized()))
		_box(_detail, base, head_basis, Vector3(0, 34.0, 0), Vector3(6.0, 3.0, 0.8), Color(0.3, 0.31, 0.33))
		_box(_lights, base, head_basis, Vector3(0, 34.2, 0.42), Vector3(5.6, 2.6, 0.05), Color.WHITE)
		_cylinder_collider(base, 0.6, 34.0)
	var label := Label3D.new()
	label.text = "ARENA SUL"
	label.font = Mats.sign_font()
	label.font_size = 128
	label.pixel_size = 3.2 / 128.0
	label.modulate = Color(0.2, 0.35, 0.8)
	label.outline_size = 0
	label.double_sided = false
	label.position = center + Vector3(0, height + 2.2, -size.y / 2.0 - 0.3)
	label.rotation.y = PI
	label.visibility_range_end = 600.0
	_holder.add_child(label)


func _construction() -> void:
	var cmin: Vector2 = CityLayout.CONSTRUCTION["min"] + Vector2(4.0, 4.0)
	var cmax: Vector2 = CityLayout.CONSTRUCTION["max"] - Vector2(4.0, 4.0)
	var curb := CityLayout.CURB_HEIGHT
	var fence := Color(0.16, 0.36, 0.62)
	var fence_h := 2.3
	var gate := Vector2(140.0, 160.0)
	# Tapume em volta (com portão no lado norte).
	for span: Vector2 in [Vector2(cmin.x, gate.x), Vector2(gate.y, cmax.x)]:
		_box(_detail, Vector3((span.x + span.y) / 2.0, curb, cmin.y), Basis(), Vector3.ZERO, Vector3(span.y - span.x, fence_h, 0.12), fence, true)
	_box(_detail, Vector3((cmin.x + cmax.x) / 2.0, curb, cmax.y), Basis(), Vector3.ZERO, Vector3(cmax.x - cmin.x, fence_h, 0.12), fence, true)
	for x: float in [cmin.x, cmax.x]:
		_box(_detail, Vector3(x, curb, (cmin.y + cmax.y) / 2.0), Basis(), Vector3.ZERO, Vector3(0.12, fence_h, cmax.y - cmin.y), fence, true)
	var sign := Label3D.new()
	sign.text = "OBRA — USE CAPACETE"
	sign.font = Mats.sign_font()
	sign.font_size = 64
	sign.pixel_size = 0.012
	sign.modulate = Color(1.0, 0.9, 0.3)
	sign.double_sided = false
	sign.position = Vector3(122.0, curb + 1.4, cmin.y - 0.1)
	sign.rotation.y = PI
	sign.visibility_range_end = 120.0
	_holder.add_child(sign)

	# Esqueleto de prédio: pilares e lajes.
	var grey := Color(0.6, 0.6, 0.58)
	var origin := Vector3(172.0, curb, 108.0)
	for i in 5:
		for j in 4:
			var p := origin + Vector3(-20.0 + i * 10.0, 0, -12.0 + j * 8.0)
			_box(_detail, p, Basis(), Vector3.ZERO, Vector3(0.6, 12.4, 0.6), grey, true)
	for level in 3:
		var y := 4.0 * (level + 1)
		_box(_detail, origin, Basis(), Vector3(0, y, 0), Vector3(41.0, 0.35, 25.0), grey.lightened(0.05))
		_collider(origin + Vector3(0, y + 0.17, 0), Vector3(41.0, 0.35, 25.0))
	# Grua.
	var crane := Vector3(128.0, curb, 116.0)
	var yellow := Color(0.95, 0.72, 0.08)
	_box(_detail, crane, Basis(), Vector3.ZERO, Vector3(1.8, 44.0, 1.8), yellow, true)
	var jib_basis := Basis(Vector3.UP, 0.5)
	_box(_detail, crane, jib_basis, Vector3(0, 44.0, 22.0), Vector3(1.2, 1.4, 52.0), yellow)
	_box(_detail, crane, jib_basis, Vector3(0, 44.0, -9.0), Vector3(1.4, 1.4, 12.0), yellow)
	_box(_detail, crane, jib_basis, Vector3(0, 41.5, -13.0), Vector3(3.0, 2.5, 3.0), Color(0.5, 0.5, 0.5))
	_box(_detail, crane, jib_basis, Vector3(0, 42.0, 1.5), Vector3(2.2, 2.0, 2.4), Color(0.9, 0.9, 0.9))
	_box(_detail, crane, jib_basis, Vector3(0, 45.4, 0), Vector3(0.8, 6.0, 0.8), yellow)
	# Contêineres do escritório da obra e rampa de terra.
	_box(_detail, Vector3(100.0, curb, 94.0), Basis(), Vector3.ZERO, Vector3(12.0, 2.7, 2.5), Color(0.9, 0.9, 0.88), true)
	_box(_detail, Vector3(100.0, curb, 98.0), Basis(), Vector3.ZERO, Vector3(6.0, 2.6, 2.4), Color(0.7, 0.25, 0.15), true)
	_ramp(Vector3(116.0, curb, 100.0), 0.0, Vector3(6.0, 1.6, 10.0), Color(0.42, 0.33, 0.22))
	# Tubos empilhados.
	for i in 4:
		var pipe_basis := Basis(Vector3.FORWARD, PI / 2.0)
		_detail.add_cylinder(Transform3D(pipe_basis, Vector3(106.0, curb + 0.5 + (i / 2) * 0.9, 118.0 + (i % 2) * 1.0 + (i / 2) * 0.5)), 0.45, 8.0, 12, Color(0.3, 0.32, 0.36))
	_collider(Vector3(102.0, curb + 0.9, 118.8), Vector3(8.0, 1.8, 2.4))
	# Cones e tambores soltos (empurráveis).
	for i in 14:
		_loose_prop(Vector3(_rng.randf_range(96.0, 150.0), curb + 0.05, _rng.randf_range(104.0, 126.0)), i % 3 == 0)


## Rampa de terra (cunha): sobe de trás para a frente ao longo de +Z local.
func _ramp(base: Vector3, yaw: float, size: Vector3, color: Color) -> void:
	var basis := Basis(Vector3.UP, yaw)
	var hx := size.x / 2.0
	var hz := size.z / 2.0
	var p := func(v: Vector3) -> Vector3: return base + basis * v
	var a: Vector3 = p.call(Vector3(-hx, 0, -hz))
	var b: Vector3 = p.call(Vector3(hx, 0, -hz))
	var c: Vector3 = p.call(Vector3(hx, size.y, hz))
	var d: Vector3 = p.call(Vector3(-hx, size.y, hz))
	var e: Vector3 = p.call(Vector3(hx, 0, hz))
	var f: Vector3 = p.call(Vector3(-hx, 0, hz))
	var slope: Array[Vector3] = [d, c, b, a]
	var uv4: Array[Vector2] = [Vector2(0, 0), Vector2(1, 0), Vector2(1, 1), Vector2(0, 1)]
	var slope_normal := (c - d).cross(a - d).normalized()
	if slope_normal.y < 0.0:
		slope = [a, b, c, d]
		slope_normal = -slope_normal
	_detail.add_quad(slope, uv4, slope_normal, color)
	var front: Array[Vector3] = [d, c, e, f]
	var front_normal := basis * Vector3(0, 0, 1)
	if (c - d).cross(f - d).dot(front_normal) > 0.0:
		front = [c, d, f, e]
	_detail.add_quad(front, uv4, front_normal, color)
	var tri: Array[Vector2] = [Vector2(0, 0), Vector2(1, 1), Vector2(1, 0)]
	_detail.add_triangle(a, d, f, tri, color)
	_detail.add_triangle(b, e, c, tri, color)
	var shape := CollisionShape3D.new()
	var convex := ConvexPolygonShape3D.new()
	convex.points = PackedVector3Array([a, b, c, d, e, f])
	shape.shape = convex
	_static.add_child(shape)


## Cone ou tambor com física (pode ser derrubado pelo carro).
func _loose_prop(position: Vector3, barrel: bool) -> void:
	var body := RigidBody3D.new()
	body.mass = 18.0 if barrel else 3.0
	body.position = position
	body.can_sleep = true
	body.sleeping = true
	var mesh := MeshInstance3D.new()
	var shape := CollisionShape3D.new()
	var cylinder_shape := CylinderShape3D.new()
	var material := StandardMaterial3D.new()
	material.roughness = 0.6
	if barrel:
		var cylinder := CylinderMesh.new()
		cylinder.top_radius = 0.3
		cylinder.bottom_radius = 0.3
		cylinder.height = 0.9
		cylinder.radial_segments = 14
		mesh.mesh = cylinder
		material.albedo_color = Color(0.95, 0.4, 0.08)
		cylinder_shape.radius = 0.3
		cylinder_shape.height = 0.9
		mesh.position.y = 0.45
		shape.position.y = 0.45
	else:
		var cone := CylinderMesh.new()
		cone.top_radius = 0.03
		cone.bottom_radius = 0.2
		cone.height = 0.7
		cone.radial_segments = 12
		mesh.mesh = cone
		material.albedo_color = Color(1.0, 0.35, 0.05)
		cylinder_shape.radius = 0.16
		cylinder_shape.height = 0.7
		mesh.position.y = 0.35
		shape.position.y = 0.35
	mesh.material_override = material
	shape.shape = cylinder_shape
	body.add_child(mesh)
	body.add_child(shape)
	_holder.add_child(body)


func _school_court() -> void:
	var center: Vector3 = CityLayout.SCHOOL_COURT["center"]
	var size: Vector2 = CityLayout.SCHOOL_COURT["size"]
	var curb := CityLayout.CURB_HEIGHT
	var y := curb + 0.04
	var hx := size.x / 2.0
	var hz := size.y / 2.0
	var court := MeshKit.new()
	_flat(court, center.x - hx - 1.5, center.x + hx + 1.5, center.z - hz - 1.5, center.z + hz + 1.5, y)
	var court_mesh := _mesh(court.commit(Mats.standard("court", Color(0.16, 0.4, 0.36), 0.8)), "SchoolCourt")
	court_mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var ly := y + 0.01
	_flat(_paint, center.x - hx, center.x + hx, center.z - hz, center.z - hz + 0.1, ly, PAINT_WHITE)
	_flat(_paint, center.x - hx, center.x + hx, center.z + hz - 0.1, center.z + hz, ly, PAINT_WHITE)
	_flat(_paint, center.x - hx, center.x - hx + 0.1, center.z - hz, center.z + hz, ly, PAINT_WHITE)
	_flat(_paint, center.x + hx - 0.1, center.x + hx, center.z - hz, center.z + hz, ly, PAINT_WHITE)
	_flat(_paint, center.x - 0.05, center.x + 0.05, center.z - hz, center.z + hz, ly, PAINT_WHITE)
	# Traves nas duas pontas.
	for side: float in [-1.0, 1.0]:
		var goal := Vector3(center.x + side * hx, curb, center.z)
		for z: float in [-1.5, 1.5]:
			_box(_detail, goal + Vector3(0, 0, z), Basis(), Vector3.ZERO, Vector3(0.1, 2.0, 0.1), Color.WHITE, true)
		_box(_detail, goal, Basis(), Vector3(0, 2.0, 0), Vector3(0.1, 0.1, 3.1), Color.WHITE)
	# Alambrado: postes e travessa em cima.
	var fence := Color(0.2, 0.3, 0.22)
	var fx := hx + 3.0
	var fz := hz + 3.0
	var x := -fx
	while x <= fx + 0.01:
		for z: float in [-fz, fz]:
			_box(_detail, center + Vector3(x, 0, z), Basis(), Vector3.ZERO, Vector3(0.08, 3.0, 0.08), fence)
		x += 3.0
	for z: float in [-fz, fz]:
		_box(_detail, center + Vector3(0, 2.95, z), Basis(), Vector3.ZERO, Vector3(fx * 2.0, 0.06, 0.06), fence)
		_box(_detail, center + Vector3(0, 0, z), Basis(), Vector3.ZERO, Vector3(fx * 2.0, 0.6, 0.06), fence, true)


func _alleys() -> void:
	var curb := CityLayout.CURB_HEIGHT
	var dumpster := Color(0.12, 0.35, 0.2)
	# Beco do Burger (leste-oeste) e Beco da Pizza (norte-sul): caçambas e caixotes nas beiradas.
	for spec: Array in [[Vector3(-190.0, curb, -153.0), 0.0], [Vector3(-120.0, curb, -153.0), 0.0], [Vector3(-3.2, curb, -180.0), PI / 2.0], [Vector3(-3.2, curb, -120.0), PI / 2.0]]:
		var p: Vector3 = spec[0]
		var basis := Basis(Vector3.UP, spec[1])
		_box(_detail, p, basis, Vector3.ZERO, Vector3(2.0, 1.3, 1.2), dumpster, true)
		_box(_detail, p, basis, Vector3(0, 1.3, -0.1), Vector3(2.05, 0.08, 1.3), dumpster.darkened(0.3))
		_box(_detail, p, basis, Vector3(2.0, 0, 0.1), Vector3(0.8, 0.8, 0.8), WOOD, true)
		_box(_detail, p, basis, Vector3(2.1, 0.8, 0.1), Vector3(0.7, 0.6, 0.7), WOOD.lightened(0.1))


# --- chácara e campo ---------------------------------------------------------------------------

func _farm() -> void:
	var house: Vector3 = CityLayout.FARM["house"]
	var road_edge := -CityLayout.RING - CityLayout.RING_WIDTH / 2.0
	var dirt := MeshKit.new()
	_flat(dirt, house.x + 7.0, road_edge, house.z - 4.0, house.z + 4.0, 0.005)
	# Plantação: terra arada com fileiras verdes.
	_flat(dirt, -520.0, -462.0, 222.0, 276.0, 0.004)
	var fields := _mesh(dirt.commit(Mats.ground(1)), "FarmDirt")
	fields.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var z := 224.0
	while z < 275.0:
		_box(_detail, Vector3(-491.0, 0.0, z), Basis(), Vector3.ZERO, Vector3(56.0, 0.45, 0.5), Color(0.2, 0.38, 0.1))
		z += 1.6
	# Cerca de madeira com porteira (vão) no caminho.
	var fmin := Vector2(-540.0, 214.0)
	var fmax := Vector2(road_edge - 8.0, 386.0)
	var rails: Array = [
		[Vector3((fmin.x + fmax.x) / 2.0, 0, fmin.y), Vector3(fmax.x - fmin.x, 0, 0)],
		[Vector3((fmin.x + fmax.x) / 2.0, 0, fmax.y), Vector3(fmax.x - fmin.x, 0, 0)],
		[Vector3(fmin.x, 0, (fmin.y + fmax.y) / 2.0), Vector3(0, 0, fmax.y - fmin.y)],
		[Vector3(fmax.x, 0, (fmin.y + house.z - 5.0) / 2.0), Vector3(0, 0, house.z - 5.0 - fmin.y)],
		[Vector3(fmax.x, 0, (house.z + 5.0 + fmax.y) / 2.0), Vector3(0, 0, fmax.y - house.z - 5.0)],
	]
	for rail: Array in rails:
		var center: Vector3 = rail[0]
		var extent: Vector3 = rail[1]
		var along_x := extent.x > 0.0
		var length := extent.x if along_x else extent.z
		var size := Vector3(length, 0.1, 0.08) if along_x else Vector3(0.08, 0.1, length)
		for rail_y: float in [0.5, 1.0]:
			_box(_detail, center + Vector3(0, rail_y, 0), Basis(), Vector3.ZERO, size, WOOD)
		var posts := int(length / 4.0)
		for i in posts + 1:
			var offset := -length / 2.0 + i * length / posts
			var post := center + (Vector3(offset, 0, 0) if along_x else Vector3(0, 0, offset))
			_box(_detail, post, Basis(), Vector3.ZERO, Vector3(0.14, 1.2, 0.14), WOOD.darkened(0.2))
		_collider(center + Vector3(0, 0.6, 0), Vector3(maxf(size.x, 0.15), 1.2, maxf(size.z, 0.15)))
	# Vaquinhas no pasto.
	for i in 6:
		var p := Vector3(_rng.randf_range(-525.0, -470.0), 0, _rng.randf_range(320.0, 375.0))
		var basis := Basis(Vector3.UP, _rng.randf() * TAU)
		var hide := Color(0.95, 0.95, 0.93) if i % 2 == 0 else Color(0.35, 0.22, 0.15)
		_box(_detail, p, basis, Vector3(0, 0.75, 0), Vector3(0.7, 0.75, 1.7), hide)
		_box(_detail, p, basis, Vector3(0, 1.1, 1.0), Vector3(0.4, 0.45, 0.55), hide.darkened(0.3))
		for leg: Vector2 in [Vector2(-0.25, -0.65), Vector2(0.25, -0.65), Vector2(-0.25, 0.65), Vector2(0.25, 0.65)]:
			_box(_detail, p, basis, Vector3(leg.x, 0, leg.y), Vector3(0.14, 0.75, 0.14), hide.darkened(0.4))
		_collider(p + Vector3(0, 0.75, 0), Vector3(0.8, 1.5, 1.9), basis)
	# Fardos de feno.
	for i in 5:
		var p := Vector3(-455.0 + i * 3.0, 0.7, 250.0 + (i % 2) * 2.0)
		_detail.add_cylinder(Transform3D(Basis(Vector3.RIGHT, PI / 2.0), p + Vector3(0, 0, -0.7)), 0.7, 1.4, 14, Color(0.78, 0.66, 0.34))
	for i in 10:
		_add_tree(house + Vector3(_rng.randf_range(-30.0, 10.0), 0, _rng.randf_range(-45.0, 45.0)) * Vector3(1, 0, 1) + Vector3(-12.0, 0, 0), i % 3 == 0)


func _countryside() -> void:
	var inner := CityLayout.RING + CityLayout.RING_WIDTH / 2.0 + 14.0
	var outer := CityLayout.PLAYABLE_HALF - 6.0
	var farm_rect := Rect2(-545.0, 208.0, 160.0, 184.0)
	for attempt in 1500:
		var p := Vector3(_rng.randf_range(-outer, outer), 0.0, _rng.randf_range(-outer, outer))
		if absf(p.x) < inner and absf(p.z) < inner:
			continue
		if _in_canal(p, 5.0) or farm_rect.has_point(Vector2(p.x, p.z)):
			continue
		# Bosques: mais árvores onde o "ruído" é alto.
		var cluster := sin(p.x * 0.013) * cos(p.z * 0.011) + sin((p.x + p.z) * 0.007)
		if cluster < 0.1 and _rng.randf() < 0.75:
			continue
		_add_tree(p, _rng.randf() < 0.55)
	# Árvores além do limite jogável (só visual, sem colisão).
	for attempt in 900:
		var angle := _rng.randf() * TAU
		var distance := _rng.randf_range(CityLayout.PLAYABLE_HALF + 20.0, 1400.0)
		var p := Vector3(cos(angle) * distance, 0.0, sin(angle) * distance)
		if _in_canal(p, 5.0):
			continue
		_add_tree(p, _rng.randf() < 0.6, false)
	_outer_ground()
	_mountains()


## Chão além da borda do mapa e morros no horizonte (sem colisão).
func _outer_ground() -> void:
	var kit := MeshKit.new()
	var half := CityLayout.GROUND_HALF
	var far := 2600.0
	_flat(kit, -far, far, -far, -half, -0.05)
	_flat(kit, -far, far, half, far, -0.05)
	_flat(kit, -far, -half, -half, half, -0.05)
	_flat(kit, half, far, -half, half, -0.05)
	var mesh := _mesh(kit.commit(Mats.ground(0)), "OuterGround")
	mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF


func _mountains() -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var segments := 120
	var radii := [1500.0, 1850.0, 2200.0, 2500.0]
	var noise := FastNoiseLite.new()
	noise.seed = 4242
	noise.frequency = 1.6
	noise.fractal_octaves = 4
	var rings: Array = []
	for r_index in radii.size():
		var ring: Array[Vector3] = []
		for i in segments:
			var angle := TAU * i / segments
			var direction := Vector2(cos(angle), sin(angle))
			var n := (noise.get_noise_2d(direction.x, direction.y) + 1.0) * 0.5
			var height := 0.0
			match r_index:
				0:
					height = -2.0
				1:
					height = 60.0 + n * 170.0
				2:
					height = 110.0 + n * 260.0
				3:
					height = 20.0 + n * 90.0
			var radius: float = radii[r_index] + (noise.get_noise_2d(direction.x * 3.0, direction.y * 3.0 + 7.0)) * 120.0
			ring.append(Vector3(direction.x * radius, height, direction.y * radius))
		rings.append(ring)
	for r_index in radii.size() - 1:
		var near: Array[Vector3] = rings[r_index]
		var far: Array[Vector3] = rings[r_index + 1]
		for i in segments:
			var j := (i + 1) % segments
			for tri: Array in [[near[i], far[i], far[j]], [near[i], far[j], near[j]]]:
				for vertex: Vector3 in tri:
					var t := clampf(vertex.y / 320.0, 0.0, 1.0)
					st.set_color(Color(0.16, 0.22, 0.13).lerp(Color(0.34, 0.35, 0.3), t))
					st.add_vertex(vertex)
	st.generate_normals()
	var material := StandardMaterial3D.new()
	material.vertex_color_use_as_albedo = true
	material.roughness = 1.0
	material.cull_mode = BaseMaterial3D.CULL_DISABLED
	st.set_material(material)
	var mesh := _mesh(st.commit(), "Mountains")
	mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF


# --- malhas finais -----------------------------------------------------------------------------

func _commit() -> void:
	if not _detail.is_empty():
		_mesh(_detail.commit(Mats.vertex_colored("props", 0.75)), "PropsDetail")
	if not _paint.is_empty():
		var paint := _mesh(_paint.commit(Mats.vertex_colored("paint", 0.6)), "GroundPaint")
		paint.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	if not _water.is_empty():
		var water := _mesh(_water.commit(Mats.water()), "PropsWater")
		water.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	if not _lights.is_empty():
		var lights := _mesh(_lights.commit(Mats.night_light(Color(1.0, 0.97, 0.9), 10.0)), "FloodLights")
		lights.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var lamp_places := _multimesh_chunks("Lamps", _lamp_mesh(), _lamps, 0.0, 900.0, CHUNK)
	for i in _lamps.size():
		var place: Array = lamp_places[i]
		_info.breakable_lamps.append([_lamp_shapes[i], place[0], place[1], _lamps[i], _info.street_lamps[i]])
	# Árvores: versão com folhas de perto e versão simples de longe (troca suave).
	for species: String in _trees:
		var transforms: Array[Transform3D] = _trees[species]
		var custom: Array = _tree_custom[species]
		_multimesh_chunks("Trees_%s" % species, FoliageKit.tree_mesh(species, true), transforms, 0.0, TREE_DETAIL_RANGE, TREE_CHUNK, custom, 25.0)
		_multimesh_chunks("TreesFar_%s" % species, FoliageKit.tree_mesh(species, false), transforms, TREE_DETAIL_RANGE - 25.0, 1300.0, TREE_CHUNK, custom, 25.0)


## Divide instâncias em pedaços (para o motor descartar o que está fora da câmera).
## Devolve, para cada transformação de entrada, [MultiMesh, índice] onde ela ficou.
func _multimesh_chunks(prefix: String, mesh: Mesh, transforms: Array[Transform3D], range_begin: float, range_end: float, cell: float, custom: Array = [], fade: float = 0.0) -> Array:
	var cells := {}
	for i in transforms.size():
		var xform := transforms[i]
		var key := Vector2i(floori(xform.origin.x / cell), floori(xform.origin.z / cell))
		if not cells.has(key):
			cells[key] = []
		cells[key].append(i)
	var placements := []
	placements.resize(transforms.size())
	for key: Vector2i in cells:
		var list: Array = cells[key]
		var multimesh := MultiMesh.new()
		multimesh.transform_format = MultiMesh.TRANSFORM_3D
		multimesh.use_custom_data = not custom.is_empty()
		multimesh.mesh = mesh
		multimesh.instance_count = list.size()
		for j in list.size():
			var index: int = list[j]
			multimesh.set_instance_transform(j, transforms[index])
			if not custom.is_empty():
				multimesh.set_instance_custom_data(j, custom[index])
			placements[index] = [multimesh, j]
		var instance := MultiMeshInstance3D.new()
		instance.name = "%s_%d_%d" % [prefix, key.x, key.y]
		instance.multimesh = multimesh
		instance.visibility_range_begin = range_begin
		instance.visibility_range_end = range_end
		if fade > 0.0:
			instance.visibility_range_begin_margin = fade if range_begin > 0.0 else 0.0
			instance.visibility_range_end_margin = fade
			instance.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF
		_holder.add_child(instance)
	return placements


func _lamp_mesh() -> ArrayMesh:
	var pole := MeshKit.new()
	pole.add_cylinder(Transform3D(), 0.2, 0.6, 10, POLE_GREY)
	pole.add_cylinder(Transform3D(), 0.1, LAMP_HEIGHT, 10, POLE_GREY)
	pole.add_box(Transform3D(Basis(), Vector3(0, LAMP_HEIGHT - 0.1, LAMP_ARM / 2.0)), Vector3(0.1, 0.1, LAMP_ARM), POLE_GREY)
	pole.add_box(Transform3D(Basis(), Vector3(0, LAMP_HEIGHT - 0.12, LAMP_ARM)), Vector3(0.45, 0.2, 0.9), POLE_GREY, Vector2.ZERO, false, false)
	var mesh := pole.commit(Mats.vertex_colored("lamp_pole", 0.5, 0.5))
	var bulb := MeshKit.new()
	bulb.add_box(Transform3D(Basis(), Vector3(0, LAMP_HEIGHT - 0.16, LAMP_ARM)), Vector3(0.36, 0.05, 0.7), Color.WHITE, Vector2.ZERO, false, false)
	return bulb.commit(Mats.night_light(Color(1.0, 0.82, 0.6), 9.0), mesh)
