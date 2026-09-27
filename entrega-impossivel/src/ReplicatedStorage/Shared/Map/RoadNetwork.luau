--!strict
-- Grafo das ruas gerado a partir do MapLayout. Usado para:
--   • calcular a distância de uma rota "segura" (prazo e recompensa dos pedidos);
--   • achar o ponto de rua mais próximo (chamar/resgatar veículo).

local MapLayout = require(script.Parent.MapLayout)

export type Node = {
	Index: number,
	Position: Vector3,
}

export type Edge = {
	Index: number,
	A: number,
	B: number,
	From: Vector3,
	To: Vector3,
	Direction: Vector3,
	Length: number,
	Width: number,
	Name: string,
	Crossing: string?,
	-- Entra no cálculo da rota segura.
	Routable: boolean,
	-- Pode receber um veículo teleportado.
	Spawnable: boolean,
}

export type LaneOptions = {
	-- Retorna true para posições proibidas (ex.: acidente em andamento).
	Exclude: ((Vector3) -> boolean)?,
	-- Direção preferida de viagem (mantém o carro virado para o mesmo lado).
	PreferredDirection: Vector3?,
}

local RoadNetwork = {}

local ROAD_Y = MapLayout.Heights.Road
local INFINITY = math.huge

local nodes: { Node } = {}
local edges: { Edge } = {}
local nodeIndexByKey: { [string]: number } = {}

local function flat(v: Vector3): Vector3
	return Vector3.new(v.X, 0, v.Z)
end

local function nodeKey(x: number, z: number): string
	return x .. "," .. z
end

local function addNode(x: number, z: number): number
	local node: Node = { Index = #nodes + 1, Position = Vector3.new(x, ROAD_Y, z) }
	table.insert(nodes, node)
	nodeIndexByKey[nodeKey(x, z)] = node.Index
	return node.Index
end

local function addEdge(a: number, b: number, width: number, name: string, crossing: string?)
	local from = nodes[a].Position
	local to = nodes[b].Position
	local delta = to - from
	local passable = crossing == nil or crossing == "Full"
	table.insert(edges, {
		Index = #edges + 1,
		A = a,
		B = b,
		From = from,
		To = to,
		Direction = delta.Unit,
		Length = delta.Magnitude,
		Width = width,
		Name = name,
		Crossing = crossing,
		Routable = passable,
		Spawnable = passable,
	})
end

do
	local xs, zs = MapLayout.Grid.Xs, MapLayout.Grid.Zs
	for _, x in xs do
		for _, z in zs do
			addNode(x, z)
		end
	end
	-- Ruas leste-oeste
	for _, z in zs do
		for i = 1, #xs - 1 do
			local a = nodeIndexByKey[nodeKey(xs[i], z)]
			local b = nodeIndexByKey[nodeKey(xs[i + 1], z)]
			addEdge(a, b, MapLayout.RoadWidth(z), MapLayout.RoadNames.Z[z] or "Rua", nil)
		end
	end
	-- Ruas norte-sul
	for _, x in xs do
		for j = 1, #zs - 1 do
			local a = nodeIndexByKey[nodeKey(x, zs[j])]
			local b = nodeIndexByKey[nodeKey(x, zs[j + 1])]
			local crossing: string? = nil
			if zs[j] == MapLayout.CanalCrossingFrom and zs[j + 1] == MapLayout.CanalCrossingTo then
				crossing = MapLayout.CanalCrossings[x] or "Full"
			end
			addEdge(a, b, MapLayout.RoadWidth(x), MapLayout.RoadNames.X[x] or "Rua", crossing)
		end
	end
end

-- Menores distâncias entre todos os cruzamentos (Floyd–Warshall; ~36 nós, custo desprezível).
local distances: { { number } } = {}
do
	local count = #nodes
	for i = 1, count do
		distances[i] = table.create(count, INFINITY)
		distances[i][i] = 0
	end
	for _, edge in edges do
		if edge.Routable then
			distances[edge.A][edge.B] = math.min(distances[edge.A][edge.B], edge.Length)
			distances[edge.B][edge.A] = math.min(distances[edge.B][edge.A], edge.Length)
		end
	end
	for k = 1, count do
		local rowK = distances[k]
		for i = 1, count do
			local rowI = distances[i]
			local ik = rowI[k]
			if ik < INFINITY then
				for j = 1, count do
					local candidate = ik + rowK[j]
					if candidate < rowI[j] then
						rowI[j] = candidate
					end
				end
			end
		end
	end
end

function RoadNetwork.GetNodes(): { Node }
	return nodes
end

function RoadNetwork.GetEdges(): { Edge }
	return edges
end

-- Projeta um ponto no segmento da rua. Retorna (ponto, distância ao longo, distância perpendicular).
function RoadNetwork.Project(position: Vector3, edge: Edge): (Vector3, number, number)
	local relative = flat(position - edge.From)
	local along = math.clamp(relative:Dot(flat(edge.Direction)), 0, edge.Length)
	local point = edge.From + edge.Direction * along
	local perpendicular = (flat(position) - flat(point)).Magnitude
	return point, along, perpendicular
end

local function nearestRoutableEdge(position: Vector3): (Edge?, number, number)
	local bestEdge: Edge? = nil
	local bestAlong, bestPerpendicular = 0, INFINITY
	for _, edge in edges do
		if edge.Routable then
			local _, along, perpendicular = RoadNetwork.Project(position, edge)
			if perpendicular < bestPerpendicular then
				bestEdge, bestAlong, bestPerpendicular = edge, along, perpendicular
			end
		end
	end
	return bestEdge, bestAlong, bestPerpendicular
end

-- Distância aproximada (em studs) dirigindo pelo caminho SEGURO (sem pinguela e sem a
-- ponte em obras). Atalhos fazem o jogador chegar antes disso — é essa a graça.
function RoadNetwork.RouteDistance(from: Vector3, to: Vector3): number
	local edgeA, alongA, perpA = nearestRoutableEdge(from)
	local edgeB, alongB, perpB = nearestRoutableEdge(to)
	if not edgeA or not edgeB then
		return (flat(to) - flat(from)).Magnitude
	end
	local legs = perpA + perpB
	if edgeA == edgeB then
		return legs + math.abs(alongA - alongB)
	end
	local fromCosts = { [edgeA.A] = alongA, [edgeA.B] = edgeA.Length - alongA }
	local toCosts = { [edgeB.A] = alongB, [edgeB.B] = edgeB.Length - alongB }
	local best = INFINITY
	for fromNode, fromCost in fromCosts do
		for toNode, toCost in toCosts do
			local total = fromCost + distances[fromNode][toNode] + toCost
			if total < best then
				best = total
			end
		end
	end
	if best == INFINITY then
		return (flat(to) - flat(from)).Magnitude
	end
	return legs + best
end

-- Direita de quem viaja na direção dada (mão de direção brasileira).
function RoadNetwork.RightOf(direction: Vector3): Vector3
	return Vector3.new(-direction.Z, 0, direction.X)
end

-- Ponto no meio da faixa mais próxima, já virado no sentido do trânsito daquela faixa.
function RoadNetwork.NearestLanePoint(position: Vector3, options: LaneOptions?): CFrame?
	local exclude = options and options.Exclude
	local preferred = options and options.PreferredDirection
	local bestCFrame: CFrame? = nil
	local bestScore = INFINITY

	for _, edge in edges do
		if edge.Spawnable then
			local _, along = RoadNetwork.Project(position, edge)
			-- Fica longe dos cruzamentos (metade da rua transversal + folga).
			local margin = MapLayout.RingWidth / 2 + 8
			if edge.Length > margin * 2 then
				local offsets = { 0, 30, -30, 60, -60, 90, -90 }
				for _, shift in offsets do
					local distanceAlong = math.clamp(along + shift, margin, edge.Length - margin)
					local center = edge.From + edge.Direction * distanceAlong
					local laneOffset = edge.Width / 4
					for _, sign in { 1, -1 } do
						local travel = edge.Direction * sign
						local lanePoint = center + RoadNetwork.RightOf(travel) * laneOffset
						lanePoint = Vector3.new(lanePoint.X, ROAD_Y, lanePoint.Z)
						if not (exclude and exclude(lanePoint)) then
							local score = (flat(lanePoint) - flat(position)).Magnitude
							if
								preferred
								and flat(preferred).Magnitude > 0.01
								and travel:Dot(flat(preferred).Unit) < 0
							then
								score += 8
							end
							if score < bestScore then
								bestScore = score
								bestCFrame = CFrame.lookAt(lanePoint, lanePoint + travel)
							end
						end
					end
				end
			end
		end
	end
	return bestCFrame
end

return RoadNetwork
