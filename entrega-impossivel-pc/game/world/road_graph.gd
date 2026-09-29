class_name RoadGraph
extends RefCounted
## Grafo das ruas gerado a partir do CityLayout. Usado para:
##   • distância da rota SEGURA (prazo e recompensa dos pedidos);
##   • GPS (caminho até o destino);
##   • trânsito (faixas e cruzamentos);
##   • resgatar o veículo no ponto de rua mais próximo.

class Edge:
	var index := 0
	var a := 0
	var b := 0
	var from := Vector3.ZERO
	var to := Vector3.ZERO
	var dir := Vector3.ZERO
	var length := 0.0
	var width := 0.0
	## "x" = rua leste-oeste; "z" = rua norte-sul.
	var axis := "x"
	var name := ""
	## "", "full" (ponte), "narrow" (pinguela) ou "closed" (ponte em obras).
	var crossing := ""
	## Entra no cálculo da rota segura/prazo.
	var safe := true
	## O trânsito automático pode usar.
	var traffic := true
	## Dinâmico: ponte em obras aberta pelo evento.
	var open := true
	## Dinâmico: bloqueado por acidente.
	var blocked := false
	var highway := false


static var current: RoadGraph

var nodes: Array[Vector3] = []
var edges: Array[Edge] = []
var node_edges: Array = []
var _node_index := {}
var _distances: Array = []


func _init() -> void:
	var lines := CityLayout.LINES
	for x in lines:
		for z in lines:
			_node_index[_key(x, z)] = nodes.size()
			nodes.append(Vector3(x, 0, z))
			node_edges.append([])
	for z in lines:
		for i in lines.size() - 1:
			_add_edge(_node_index[_key(lines[i], z)], _node_index[_key(lines[i + 1], z)], "x", z, "")
	for x in lines:
		for j in lines.size() - 1:
			var crossing := ""
			if is_equal_approx(lines[j], CityLayout.CROSSING_FROM) and is_equal_approx(lines[j + 1], CityLayout.CROSSING_TO):
				crossing = CityLayout.CROSSINGS.get(x, "full")
			_add_edge(_node_index[_key(x, lines[j])], _node_index[_key(x, lines[j + 1])], "z", x, crossing)
	_compute_distances()


func _key(x: float, z: float) -> String:
	return "%d,%d" % [roundi(x), roundi(z)]


func _add_edge(a: int, b: int, axis: String, coordinate: float, crossing: String) -> void:
	var edge := Edge.new()
	edge.index = edges.size()
	edge.a = a
	edge.b = b
	edge.from = nodes[a]
	edge.to = nodes[b]
	edge.length = edge.from.distance_to(edge.to)
	edge.dir = (edge.to - edge.from).normalized()
	edge.width = CityLayout.road_width(coordinate)
	edge.axis = axis
	edge.highway = CityLayout.is_ring(coordinate)
	edge.name = CityLayout.road_name("z" if axis == "x" else "x", coordinate)
	edge.crossing = crossing
	edge.safe = crossing == "" or crossing == "full"
	edge.traffic = edge.safe
	edge.open = crossing != "closed"
	edges.append(edge)
	node_edges[a].append(edge.index)
	node_edges[b].append(edge.index)


func node_at(position: Vector3) -> int:
	return _node_index.get(_key(position.x, position.z), -1)


func other_node(edge: Edge, node: int) -> int:
	return edge.b if edge.a == node else edge.a


func approach_count(node: int) -> int:
	return node_edges[node].size()


func has_traffic_lights(node: int) -> bool:
	return approach_count(node) >= 3


## Largura da rua transversal que cruza este trecho no nó (para linhas de retenção).
func crossing_width(node: int, edge: Edge) -> float:
	for index: int in node_edges[node]:
		var other: Edge = edges[index]
		if other.axis != edge.axis:
			return other.width
	return CityLayout.AVENUE_WIDTH


## Pode ser atravessado agora (GPS)? `allow_risky` inclui a pinguela.
func is_passable(edge: Edge, allow_risky: bool) -> bool:
	if edge.blocked:
		return false
	if edge.crossing == "narrow":
		return allow_risky
	if edge.crossing == "closed":
		return edge.open
	return true


## Projeta um ponto no trecho: [ponto, distância ao longo, distância perpendicular].
func project(position: Vector3, edge: Edge) -> Array:
	var relative := Vector3(position.x - edge.from.x, 0, position.z - edge.from.z)
	var along := clampf(relative.dot(edge.dir), 0.0, edge.length)
	var point := edge.from + edge.dir * along
	var perpendicular := Vector2(position.x - point.x, position.z - point.z).length()
	return [point, along, perpendicular]


func nearest_edge(position: Vector3, filter: Callable = Callable()) -> Array:
	var best: Edge = null
	var best_along := 0.0
	var best_perp := INF
	for edge in edges:
		if filter.is_valid() and not filter.call(edge):
			continue
		var projection := project(position, edge)
		if projection[2] < best_perp:
			best = edge
			best_along = projection[1]
			best_perp = projection[2]
	return [best, best_along, best_perp]


# --- Distância pela rota segura (prazo/recompensa) ---------------------------

func _compute_distances() -> void:
	var count := nodes.size()
	_distances = []
	for i in count:
		var row := []
		row.resize(count)
		row.fill(INF)
		row[i] = 0.0
		_distances.append(row)
	for edge in edges:
		if edge.safe:
			_distances[edge.a][edge.b] = minf(_distances[edge.a][edge.b], edge.length)
			_distances[edge.b][edge.a] = minf(_distances[edge.b][edge.a], edge.length)
	for k in count:
		for i in count:
			var ik: float = _distances[i][k]
			if ik == INF:
				continue
			for j in count:
				var candidate: float = ik + _distances[k][j]
				if candidate < _distances[i][j]:
					_distances[i][j] = candidate


func route_distance(from: Vector3, to: Vector3) -> float:
	var safe_filter := func(edge: Edge) -> bool: return edge.safe
	var start := nearest_edge(from, safe_filter)
	var finish := nearest_edge(to, safe_filter)
	var edge_a: Edge = start[0]
	var edge_b: Edge = finish[0]
	if edge_a == null or edge_b == null:
		return Vector2(to.x - from.x, to.z - from.z).length()
	var legs: float = start[2] + finish[2]
	if edge_a == edge_b:
		return legs + absf(float(start[1]) - float(finish[1]))
	var from_costs := {edge_a.a: start[1], edge_a.b: edge_a.length - float(start[1])}
	var to_costs := {edge_b.a: finish[1], edge_b.b: edge_b.length - float(finish[1])}
	var best := INF
	for from_node: int in from_costs:
		for to_node: int in to_costs:
			best = minf(best, float(from_costs[from_node]) + float(_distances[from_node][to_node]) + float(to_costs[to_node]))
	return legs + best


# --- GPS ----------------------------------------------------------------------

## Caminho (lista de pontos no chão) de `from` até `to` pelas ruas transitáveis agora.
func find_path(from: Vector3, to: Vector3, allow_risky: bool = false) -> PackedVector3Array:
	var passable := func(edge: Edge) -> bool: return is_passable(edge, allow_risky)
	var start := nearest_edge(from, passable)
	var finish := nearest_edge(to, passable)
	var result := PackedVector3Array()
	var edge_a: Edge = start[0]
	var edge_b: Edge = finish[0]
	if edge_a == null or edge_b == null:
		result.append(from)
		result.append(to)
		return result
	var start_point: Vector3 = edge_a.from + edge_a.dir * float(start[1])
	var end_point: Vector3 = edge_b.from + edge_b.dir * float(finish[1])
	result.append(from)
	result.append(start_point)
	if edge_a == edge_b:
		result.append(end_point)
		result.append(to)
		return result

	# Dijkstra a partir das duas pontas do trecho inicial.
	var count := nodes.size()
	var dist := []
	dist.resize(count)
	dist.fill(INF)
	var previous := []
	previous.resize(count)
	previous.fill(-1)
	var visited := []
	visited.resize(count)
	visited.fill(false)
	dist[edge_a.a] = float(start[1])
	dist[edge_a.b] = edge_a.length - float(start[1])
	while true:
		var current_node := -1
		var current_dist := INF
		for i in count:
			if not visited[i] and dist[i] < current_dist:
				current_dist = dist[i]
				current_node = i
		if current_node == -1:
			break
		visited[current_node] = true
		for index: int in node_edges[current_node]:
			var edge: Edge = edges[index]
			if not is_passable(edge, allow_risky):
				continue
			var neighbor := other_node(edge, current_node)
			var candidate := current_dist + edge.length
			if candidate < dist[neighbor]:
				dist[neighbor] = candidate
				previous[neighbor] = current_node

	var end_a: float = float(dist[edge_b.a]) + float(finish[1])
	var end_b: float = float(dist[edge_b.b]) + edge_b.length - float(finish[1])
	var last := edge_b.a if end_a <= end_b else edge_b.b
	if dist[last] == INF:
		result.append(end_point)
		result.append(to)
		return result
	var chain: Array[int] = []
	var node := last
	while node != -1:
		chain.push_front(node)
		node = previous[node]
	for n in chain:
		result.append(nodes[n])
	result.append(end_point)
	result.append(to)
	return result


# --- Resgate/guincho -----------------------------------------------------------

## Ponto no meio da faixa (mão direita) mais próximo, virado no sentido do trânsito.
func nearest_lane_transform(position: Vector3, prefer_direction: Vector3, exclude: Callable = Callable()) -> Transform3D:
	var best_transform := Transform3D(Basis(), CityLayout.SPAWN["position"])
	var best_score := INF
	for edge in edges:
		if not edge.traffic or edge.blocked:
			continue
		var margin := 16.0
		if edge.length <= margin * 2.0:
			continue
		var projection := project(position, edge)
		for shift: float in [0.0, 25.0, -25.0, 50.0, -50.0]:
			var along := clampf(float(projection[1]) + shift, margin, edge.length - margin)
			var center := edge.from + edge.dir * along
			for sign_value: float in [1.0, -1.0]:
				var travel := edge.dir * sign_value
				var right := Vector3(-travel.z, 0, travel.x)
				var lane_center := center + right * (edge.width / 4.0)
				if exclude.is_valid() and exclude.call(lane_center):
					continue
				var score := Vector2(lane_center.x - position.x, lane_center.z - position.z).length()
				if prefer_direction.length() > 0.1 and travel.dot(prefer_direction.normalized()) < 0.0:
					score += 10.0
				if score < best_score:
					best_score = score
					# O veículo tem a frente em +Z local: basis olhando para `travel` com +Z à frente.
					var basis := Basis.looking_at(-travel, Vector3.UP)
					best_transform = Transform3D(basis, lane_center)
	return best_transform


func set_edge_blocked_near(position: Vector3, blocked: bool) -> Edge:
	var result := nearest_edge(position)
	var edge: Edge = result[0]
	if edge:
		edge.blocked = blocked
	return edge


func closed_crossing_edge() -> Edge:
	for edge in edges:
		if edge.crossing == "closed":
			return edge
	return null
