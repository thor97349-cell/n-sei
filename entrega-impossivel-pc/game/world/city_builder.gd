class_name CityBuilder
extends RefCounted
## Constrói a cidade inteira a partir do CityLayout: terreno, canal, ruas, pontes,
## quarteirões, prédios (BuildingBuilder) e mobiliário urbano (PropsBuilder).

## Resultado da construção, usado por outros sistemas (atalhos, semáforos...).
class CityInfo:
	var root: Node3D
	## id do atalho → {"open": Node3D, "closed": Node3D, "parent": Node3D}
	var shortcuts := {}
	## Materiais das luzes dos semáforos: {"z": {"red":..,"yellow":..,"green":..}, "x": {...}}
	var traffic_light_materials := {}
	var street_lamps: Array[Vector3] = []
	## Pontos para árvores nos quintais (preenchidos pelo BuildingBuilder).
	var yard_trees: Array[Vector3] = []
	## Postes de luz que quebram: [CollisionShape3D, MultiMesh, índice, Transform3D, posição da luz].
	var breakable_lamps: Array = []
	## Cercas vivas dos jardins: [Transform3D (base, direção), tamanho].
	var hedges: Array = []
	## Pontos de ônibus: [lugar onde as pessoas esperam, direção (yaw) olhando para a rua].
	var bus_stops: Array = []
	var building_count := 0

	func set_shortcut_open(id: String, open: bool) -> void:
		var entry: Dictionary = shortcuts.get(id, {})
		if entry.is_empty():
			return
		var parent: Node3D = entry["parent"]
		var open_node: Node3D = entry["open"]
		var closed_node: Node3D = entry["closed"]
		if open:
			if closed_node.get_parent():
				parent.remove_child(closed_node)
			if not open_node.get_parent():
				parent.add_child(open_node)
		else:
			if open_node.get_parent():
				parent.remove_child(open_node)
			if not closed_node.get_parent():
				parent.add_child(closed_node)

	func is_shortcut_open(id: String) -> bool:
		var entry: Dictionary = shortcuts.get(id, {})
		return not entry.is_empty() and (entry["open"] as Node3D).get_parent() != null


const CONCRETE := Color(0.62, 0.61, 0.58)
## Piso da calçada por tema: 0 concreto, 1 bloquete cinza, 2 bloquete de barro,
## 3 pedra portuguesa, 4 granito.
const SIDEWALK_STYLES := {
	"downtown": 4, "commercial": 1, "mall": 1, "apartments": 2, "school": 2,
	"promenade": 3, "waterfront": 3, "plaza": 3,
}

var info := CityInfo.new()
var graph: RoadGraph
var _root: Node3D
var _static: StaticBody3D


func build(parent: Node3D) -> CityInfo:
	graph = RoadGraph.current if RoadGraph.current else RoadGraph.new()
	RoadGraph.current = graph
	_root = Node3D.new()
	_root.name = "City"
	parent.add_child(_root)
	info.root = _root
	_static = StaticBody3D.new()
	_static.name = "StaticColliders"
	_root.add_child(_static)

	_build_ground()
	_build_canal()
	_build_roads()
	_build_bridges()
	_build_blocks()
	_build_boundaries()

	var buildings := BuildingBuilder.new(_root, _static, info)
	info.building_count = buildings.build_all()
	var props := PropsBuilder.new(_root, _static, graph, info)
	props.build_all()
	return info


# --- utilidades -----------------------------------------------------------------

func _collider_box(center: Vector3, size: Vector3, basis: Basis = Basis()) -> CollisionShape3D:
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = size
	shape.shape = box
	shape.transform = Transform3D(basis, center)
	_static.add_child(shape)
	return shape


func _mesh(mesh: Mesh, node_name: String, parent: Node3D = null) -> MeshInstance3D:
	var instance := MeshInstance3D.new()
	instance.name = node_name
	instance.mesh = mesh
	(parent if parent else _root).add_child(instance)
	return instance


## Retângulo plano. `local` = UV em metros a partir do canto (o shader do chão usa isso
## para fazer a transição na beira do gramado/praça; COLOR.r = 0 marca esse modo).
func _flat_quad(kit: MeshKit, xmin: float, xmax: float, zmin: float, zmax: float, y: float, color: Color = Color.WHITE, local: bool = false) -> void:
	var corners: Array[Vector3] = [Vector3(xmin, y, zmin), Vector3(xmax, y, zmin), Vector3(xmax, y, zmax), Vector3(xmin, y, zmax)]
	var uvs: Array[Vector2] = [Vector2(xmin, zmin), Vector2(xmax, zmin), Vector2(xmax, zmax), Vector2(xmin, zmax)]
	if local:
		uvs = [Vector2(0, 0), Vector2(xmax - xmin, 0), Vector2(xmax - xmin, zmax - zmin), Vector2(0, zmax - zmin)]
		color = Color(0, 1, 1, 1)
	kit.add_quad(corners, uvs, Vector3.UP, color, Vector2(xmax - xmin, zmax - zmin))


# --- terreno e canal ---------------------------------------------------------------

func _build_ground() -> void:
	var half := CityLayout.GROUND_HALF
	var kit := MeshKit.new()
	_flat_quad(kit, -half, half, -half, CityLayout.CANAL_Z_MIN, -0.03)
	_flat_quad(kit, -half, half, CityLayout.CANAL_Z_MAX, half, -0.03)
	var ground := _mesh(kit.commit(Mats.ground(0)), "Ground")
	ground.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

	var depth := 8.0
	var north_len := CityLayout.CANAL_Z_MIN + half
	var south_len := half - CityLayout.CANAL_Z_MAX
	_collider_box(Vector3(0, -depth / 2.0, -half + north_len / 2.0), Vector3(half * 2.0, depth, north_len))
	_collider_box(Vector3(0, -depth / 2.0, CityLayout.CANAL_Z_MAX + south_len / 2.0), Vector3(half * 2.0, depth, south_len))


func _build_canal() -> void:
	var half := CityLayout.GROUND_HALF
	var zmin := CityLayout.CANAL_Z_MIN
	var zmax := CityLayout.CANAL_Z_MAX
	var floor_y := CityLayout.CANAL_FLOOR
	# Paredes de pedra (vistas de dentro do canal).
	var walls := MeshKit.new()
	var stone := Color(0.5, 0.49, 0.46)
	var north_wall: Array[Vector3] = [Vector3(half, 0, zmin), Vector3(-half, 0, zmin), Vector3(-half, floor_y, zmin), Vector3(half, floor_y, zmin)]
	var south_wall: Array[Vector3] = [Vector3(-half, 0, zmax), Vector3(half, 0, zmax), Vector3(half, floor_y, zmax), Vector3(-half, floor_y, zmax)]
	var wall_uvs: Array[Vector2] = [Vector2(0, 4.5), Vector2(1600, 4.5), Vector2(1600, 0), Vector2(0, 0)]
	walls.add_quad(north_wall, wall_uvs, Vector3(0, 0, 1), stone)
	walls.add_quad(south_wall, wall_uvs, Vector3(0, 0, -1), stone)
	_mesh(walls.commit(Mats.sidewalk()), "CanalWalls")

	var floor_kit := MeshKit.new()
	_flat_quad(floor_kit, -half, half, zmin, zmax, floor_y)
	_mesh(floor_kit.commit(Mats.ground(1)), "CanalFloor")
	_collider_box(Vector3(0, floor_y - 1.0, (zmin + zmax) / 2.0), Vector3(half * 2.0, 2.0, zmax - zmin))

	var water_kit := MeshKit.new()
	_flat_quad(water_kit, -half, half, zmin, zmax, CityLayout.WATER_LEVEL)
	var water := _mesh(water_kit.commit(Mats.water()), "CanalWater")
	water.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF


# --- ruas ---------------------------------------------------------------------------

func _build_roads() -> void:
	var kit := MeshKit.new()
	for edge in graph.edges:
		var half_a := graph.crossing_width(edge.a, edge) / 2.0
		var half_b := graph.crossing_width(edge.b, edge) / 2.0
		var lights_a := graph.has_traffic_lights(edge.a)
		var lights_b := graph.has_traffic_lights(edge.b)
		if edge.crossing == "" or edge.crossing == "full":
			_road_segment(kit, edge, half_a, edge.length - half_b, lights_a, lights_b)
		else:
			# Rua termina nas margens do canal (pinguela/ponte em obras ficam à parte).
			var canal_start := CityLayout.CANAL_Z_MIN - edge.from.z
			var canal_end := CityLayout.CANAL_Z_MAX - edge.from.z
			_road_segment(kit, edge, half_a, canal_start, lights_a, false)
			_road_segment(kit, edge, canal_end, edge.length - half_b, false, lights_b)
	for node in graph.nodes.size():
		var position := graph.nodes[node]
		var size_x := CityLayout.road_width(position.x)
		var size_z := CityLayout.road_width(position.z)
		var corners: Array[Vector3] = [
			Vector3(position.x - size_x / 2.0, 0, position.z - size_z / 2.0),
			Vector3(position.x + size_x / 2.0, 0, position.z - size_z / 2.0),
			Vector3(position.x + size_x / 2.0, 0, position.z + size_z / 2.0),
			Vector3(position.x - size_x / 2.0, 0, position.z + size_z / 2.0),
		]
		var uvs: Array[Vector2] = [Vector2(0, 0), Vector2(size_x, 0), Vector2(size_x, size_z), Vector2(0, size_z)]
		kit.add_quad(corners, uvs, Vector3.UP, Color(0, 0, 1, 0), Vector2(size_x, size_z))
	var roads := _mesh(kit.commit(Mats.road()), "Roads")
	roads.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF


## Trecho de rua entre as distâncias `start` e `end` (a partir do nó A).
func _road_segment(kit: MeshKit, edge: RoadGraph.Edge, start: float, end: float, crosswalk_start: bool, crosswalk_end: bool) -> void:
	var length := end - start
	if length <= 0.5:
		return
	var w := edge.width
	var color := Color(1.0 if edge.highway else 0.0, 1.0 if crosswalk_start else 0.0, 0.0, 1.0 if crosswalk_end else 0.0)
	var p0 := edge.from + edge.dir * start
	var p1 := edge.from + edge.dir * end
	var corners: Array[Vector3]
	var uvs: Array[Vector2]
	if edge.axis == "x":
		corners = [Vector3(p0.x, 0, p0.z - w / 2.0), Vector3(p1.x, 0, p1.z - w / 2.0), Vector3(p1.x, 0, p1.z + w / 2.0), Vector3(p0.x, 0, p0.z + w / 2.0)]
		uvs = [Vector2(0, 0), Vector2(0, length), Vector2(w, length), Vector2(w, 0)]
	else:
		corners = [Vector3(p0.x - w / 2.0, 0, p0.z), Vector3(p0.x + w / 2.0, 0, p0.z), Vector3(p1.x + w / 2.0, 0, p1.z), Vector3(p1.x - w / 2.0, 0, p1.z)]
		uvs = [Vector2(w, 0), Vector2(0, 0), Vector2(0, length), Vector2(w, length)]
	kit.add_quad(corners, uvs, Vector3.UP, color, Vector2(w, length))


# --- pontes ----------------------------------------------------------------------------

func _build_bridges() -> void:
	var zmin := CityLayout.CANAL_Z_MIN
	var zmax := CityLayout.CANAL_Z_MAX
	var concrete := MeshKit.new()
	for x: float in CityLayout.CROSSINGS.keys():
		var kind: String = CityLayout.CROSSINGS[x]
		var width := CityLayout.road_width(x)
		if kind == "full":
			_bridge(concrete, x, width, _static)
		elif kind == "narrow":
			_plank(x)
	_mesh(concrete.commit(Mats.vertex_colored("concrete", 0.85)), "Bridges")
	_closed_bridge(75.0, CityLayout.road_width(75.0))


## Laje de concreto sob a rua + mureta dos dois lados.
func _bridge(kit: MeshKit, x: float, width: float, body: Node3D) -> void:
	var zmin := CityLayout.CANAL_Z_MIN - 1.0
	var zmax := CityLayout.CANAL_Z_MAX + 1.0
	var span := zmax - zmin
	var center_z := (zmin + zmax) / 2.0
	kit.add_box(Transform3D(Basis(), Vector3(x, -1.2, center_z)), Vector3(width + 1.0, 1.2, span), CONCRETE, Vector2.ZERO, false, true)
	for side: float in [-1.0, 1.0]:
		var rail_x := x + side * (width / 2.0 + 0.25)
		kit.add_box(Transform3D(Basis(), Vector3(rail_x, 0.0, center_z)), Vector3(0.5, 1.0, span), CONCRETE, Vector2.ZERO, true, false)
		var shape := CollisionShape3D.new()
		var box := BoxShape3D.new()
		box.size = Vector3(0.5, 1.0, span)
		shape.shape = box
		shape.position = Vector3(rail_x, 0.5, center_z)
		body.add_child(shape)
	var deck := CollisionShape3D.new()
	var deck_box := BoxShape3D.new()
	deck_box.size = Vector3(width + 1.0, 1.2, span)
	deck.shape = deck_box
	deck.position = Vector3(x, -0.6, center_z)
	body.add_child(deck)


## Pinguela: tábuas estreitas, sem grade. Atalho arriscado de verdade.
func _plank(x: float) -> void:
	var zmin := CityLayout.CANAL_Z_MIN - 1.0
	var zmax := CityLayout.CANAL_Z_MAX + 1.0
	var width := CityLayout.NARROW_WIDTH
	var kit := MeshKit.new()
	var wood := Color(0.42, 0.3, 0.2)
	kit.add_box(Transform3D(Basis(), Vector3(x, -0.35, (zmin + zmax) / 2.0)), Vector3(width, 0.35, zmax - zmin), wood, Vector2.ZERO, false, false)
	for z in range(int(zmin) + 4, int(zmax) - 2, 7):
		for side: float in [-1.0, 1.0]:
			kit.add_box(Transform3D(Basis(), Vector3(x + side * (width / 2.0 - 0.3), CityLayout.CANAL_FLOOR, float(z))), Vector3(0.35, -CityLayout.CANAL_FLOOR - 0.35, 0.35), wood.darkened(0.3))
	_mesh(kit.commit(Mats.vertex_colored("wood", 0.9)), "Pinguela")
	_collider_box(Vector3(x, -0.175, (zmin + zmax) / 2.0), Vector3(width, 0.35, zmax - zmin))


## Ponte em obras: fica fechada (barreiras) e só abre durante o evento ATALHO.
func _closed_bridge(x: float, width: float) -> void:
	var holder := Node3D.new()
	holder.name = "Shortcut_bridge"
	_root.add_child(holder)

	var open_node := Node3D.new()
	open_node.name = "Open"
	var open_body := StaticBody3D.new()
	open_node.add_child(open_body)
	var deck := MeshKit.new()
	_bridge(deck, x, width, open_body)
	var steel := MeshKit.new()
	var zmin := CityLayout.CANAL_Z_MIN - 1.0
	var zmax := CityLayout.CANAL_Z_MAX + 1.0
	for side: float in [-1.0, 1.0]:
		steel.add_box(Transform3D(Basis(), Vector3(x + side * (width / 2.0 + 0.25), 1.0, (zmin + zmax) / 2.0)), Vector3(0.12, 0.12, zmax - zmin), Color(1.0, 0.75, 0.1))
	var deck_mesh := MeshInstance3D.new()
	deck_mesh.mesh = deck.commit(Mats.vertex_colored("concrete_new", 0.7))
	open_node.add_child(deck_mesh)
	var steel_mesh := MeshInstance3D.new()
	steel_mesh.mesh = steel.commit(Mats.vertex_colored("steel", 0.4, 0.8))
	open_node.add_child(steel_mesh)
	# Asfalto novo da ponte (sem faixa) por cima da laje.
	var road := MeshKit.new()
	var corners: Array[Vector3] = [Vector3(x - width / 2.0, 0.01, zmin), Vector3(x + width / 2.0, 0.01, zmin), Vector3(x + width / 2.0, 0.01, zmax), Vector3(x - width / 2.0, 0.01, zmax)]
	var uvs: Array[Vector2] = [Vector2(0, 0), Vector2(width, 0), Vector2(width, zmax - zmin), Vector2(0, zmax - zmin)]
	road.add_quad(corners, uvs, Vector3.UP, Color(0, 0, 1, 0), Vector2(width, zmax - zmin))
	var road_mesh := MeshInstance3D.new()
	road_mesh.mesh = road.commit(Mats.road())
	open_node.add_child(road_mesh)

	var closed_node := Node3D.new()
	closed_node.name = "Closed"
	var closed_body := StaticBody3D.new()
	closed_node.add_child(closed_body)
	var barriers := MeshKit.new()
	for z: float in [CityLayout.CANAL_Z_MIN - 6.0, CityLayout.CANAL_Z_MAX + 6.0]:
		var segments := 6
		for i in segments:
			var segment_width := width / segments
			var bx := x - width / 2.0 + segment_width * (i + 0.5)
			var color := Color(0.95, 0.45, 0.1) if i % 2 == 0 else Color(0.95, 0.95, 0.95)
			barriers.add_box(Transform3D(Basis(), Vector3(bx, 0.0, z)), Vector3(segment_width - 0.1, 1.1, 0.5), color, Vector2.ZERO, true, false)
		var shape := CollisionShape3D.new()
		var box := BoxShape3D.new()
		box.size = Vector3(width, 1.2, 0.6)
		shape.shape = box
		shape.position = Vector3(x, 0.6, z)
		closed_body.add_child(shape)
		var sign := Label3D.new()
		sign.text = "PONTE EM OBRAS"
		sign.font_size = 96
		sign.pixel_size = 0.012
		sign.outline_size = 18
		sign.modulate = Color(1.0, 0.8, 0.2)
		sign.position = Vector3(x, 2.4, z)
		sign.rotation.y = 0.0 if z < 150.0 else PI
		closed_node.add_child(sign)
	var barrier_mesh := MeshInstance3D.new()
	barrier_mesh.mesh = barriers.commit(Mats.vertex_colored("barrier", 0.6))
	closed_node.add_child(barrier_mesh)

	holder.add_child(closed_node)
	info.shortcuts["bridge"] = {"parent": holder, "open": open_node, "closed": closed_node}


# --- quarteirões ------------------------------------------------------------------------

func _build_blocks() -> void:
	var slabs := MeshKit.new()
	var covers := {0: MeshKit.new(), 2: MeshKit.new(), 3: MeshKit.new(), 1: MeshKit.new(), 4: MeshKit.new()}
	var rails := MeshKit.new()
	var curb := CityLayout.CURB_HEIGHT
	for block in CityLayout.blocks():
		var bmin: Vector2 = block["min"]
		var bmax: Vector2 = block["max"]
		var size := Vector3(bmax.x - bmin.x, curb, bmax.y - bmin.y)
		var center := Vector3((bmin.x + bmax.x) / 2.0, 0.0, (bmin.y + bmax.y) / 2.0)
		# Piso da calçada conforme o bairro (veja sidewalk.gdshader); UV2 = tamanho da quadra.
		var style: int = SIDEWALK_STYLES.get(block["theme"], 0)
		slabs.add_box(Transform3D(Basis(), center), size, Color(style / 4.0, 1, 1, 1), Vector2(size.x, size.z), true, false)
		_collider_box(center + Vector3(0, curb / 2.0, 0), size)

		var theme: String = block["theme"]
		var kind := 2
		match theme:
			"residential", "school", "park", "promenade", "stadium":
				kind = 0
			"plaza":
				kind = 3
			"construction":
				kind = 1
			"downtown", "commercial", "mall", "apartments", "waterfront":
				kind = 4
		var inset := CityLayout.SIDEWALK
		var imin := bmin + Vector2(inset, inset)
		var imax := bmax - Vector2(inset, inset)
		var canal_side: String = block["canal_side"]
		if canal_side == "S":
			imax.y = bmax.y - 1.0
		elif canal_side == "N":
			imin.y = bmin.y + 1.0
		_flat_quad(covers[kind], imin.x, imax.x, imin.y, imax.y, curb + 0.02, Color.WHITE, true)

		# Grade na beira do canal.
		if canal_side != "":
			var z := bmax.y - 0.3 if canal_side == "S" else bmin.y + 0.3
			rails.add_box(Transform3D(Basis(), Vector3(center.x, curb, z)), Vector3(size.x, 1.0, 0.08), Color(0.2, 0.22, 0.24), Vector2.ZERO, true, false)
			_collider_box(Vector3(center.x, curb + 0.5, z), Vector3(size.x, 1.0, 0.2))

	# Grade do canal fora do anel (campo).
	var ring_outer := CityLayout.RING + CityLayout.RING_WIDTH / 2.0
	var playable := CityLayout.PLAYABLE_HALF
	for side: float in [-1.0, 1.0]:
		var cx := side * (ring_outer + playable) / 2.0
		var length := playable - ring_outer
		for z: float in [CityLayout.CANAL_Z_MIN - 0.3, CityLayout.CANAL_Z_MAX + 0.3]:
			rails.add_box(Transform3D(Basis(), Vector3(cx, 0.0, z)), Vector3(length, 1.0, 0.08), Color(0.2, 0.22, 0.24), Vector2.ZERO, true, false)
			_collider_box(Vector3(cx, 0.5, z), Vector3(length, 1.0, 0.2))

	_mesh(slabs.commit(Mats.sidewalk()), "Sidewalks")
	for kind: int in covers.keys():
		var kit: MeshKit = covers[kind]
		if not kit.is_empty():
			var cover := _mesh(kit.commit(Mats.ground(kind)), "BlockGround_%d" % kind)
			cover.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_mesh(rails.commit(Mats.vertex_colored("rail", 0.4, 0.7)), "CanalRails")


func _build_boundaries() -> void:
	var half := CityLayout.PLAYABLE_HALF
	for spec: Array in [
		[Vector3(half, 20, 0), Vector3(2, 60, half * 2.0)],
		[Vector3(-half, 20, 0), Vector3(2, 60, half * 2.0)],
		[Vector3(0, 20, half), Vector3(half * 2.0, 60, 2)],
		[Vector3(0, 20, -half), Vector3(half * 2.0, 60, 2)],
	]:
		_collider_box(spec[0], spec[1])
