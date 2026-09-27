--!strict
-- Planta da cidade (dados puros). O MapBuilder transforma isto em Parts e os sistemas
-- de entrega, veículos, trânsito e minimapa leem as mesmas informações daqui.
--
-- Coordenadas: X cresce para o LESTE, Z cresce para o SUL (norte = -Z).
-- A cidade é uma grade de avenidas cercada por uma rodovia (anel) e cortada por um canal.
--
-- Para adicionar uma área nova no futuro: acrescente locais em Locations, prédios em
-- Fillers e, se precisar de ruas novas, coordenadas em Grid.

export type BuildingSpec = {
	Style: string,
	Width: number, -- largura da fachada
	Depth: number, -- profundidade (da fachada até os fundos)
	Height: number,
	Setback: number, -- distância entre o ponto de entrega e a fachada
	Color: Color3,
	Accent: Color3,
	Sign: string?,
}

export type Location = {
	Id: string,
	Name: string,
	Icon: string,
	Position: Vector3, -- centro do ponto de coleta/entrega (y = altura do piso)
	Facing: string, -- "N" | "S" | "E" | "W": para onde a fachada aponta (sempre para a rua)
	Pickup: boolean,
	Dropoff: boolean,
	Building: BuildingSpec,
}

export type Filler = {
	Style: string,
	Center: Vector2,
	Facing: string,
	Width: number,
	Depth: number,
	Height: number,
	Color: Color3,
	Accent: Color3,
}

export type Block = {
	Key: string,
	XMin: number,
	XMax: number,
	ZMin: number,
	ZMax: number,
	Theme: string,
}

export type Rect = { XMin: number, XMax: number, ZMin: number, ZMax: number }

export type AccidentSpot = {
	Id: string,
	Road: string,
	Position: Vector3,
	-- Eixo ao longo do qual a rua corre ("X" = leste-oeste, "Z" = norte-sul).
	Axis: string,
}

export type ShortcutSpec = {
	Id: string,
	DisplayName: string,
	Center: Vector3,
	-- Áreas que precisam estar vazias antes de o atalho fechar de novo.
	ClearanceZones: { { Center: Vector3, Size: Vector3 } },
}

local MapLayout = {}

-- Aumente quando mudar a planta (o servidor avisa se o mapa salvo no lugar estiver velho).
MapLayout.Version = 1

MapLayout.Heights = {
	Ground = 0, -- topo do gramado
	Road = 0.4, -- topo do asfalto
	Block = 0.8, -- topo das calçadas/quarteirões
	Lot = 0.9, -- topo de gramados/praças dentro dos quarteirões
}

MapLayout.GroundHalfSize = 1024
MapLayout.PlayableHalfSize = 1000

MapLayout.Grid = {
	Xs = { -760, -480, -160, 160, 480, 760 },
	Zs = { -760, -480, -160, 160, 480, 760 },
}

MapLayout.RingCoordinate = 760
MapLayout.RingWidth = 56
MapLayout.AvenueWidth = 40
MapLayout.SidewalkWidth = 8

MapLayout.Canal = {
	ZMin = 290,
	ZMax = 350,
	FloorY = -12,
	WaterY = -3,
	XMin = -1000,
	XMax = 1000,
}

-- Como cada rua norte-sul atravessa o canal (entre z = 160 e z = 480).
--   Full   = ponte normal
--   Narrow = pinguela estreita, sem grade (atalho arriscado)
--   Closed = ponte em obras; só abre durante o evento ATALHO
MapLayout.CanalCrossings = {
	[-760] = "Full",
	[-480] = "Full",
	[-160] = "Narrow",
	[160] = "Closed",
	[480] = "Full",
	[760] = "Full",
} :: { [number]: string }

MapLayout.CanalCrossingFrom = 160
MapLayout.CanalCrossingTo = 480
MapLayout.NarrowBridgeWidth = 10

MapLayout.RoadNames = {
	X = {
		[-760] = "Rodovia Anel Oeste",
		[-480] = "Av. das Indústrias",
		[-160] = "Rua da Pinguela",
		[160] = "Av. Aurora",
		[480] = "Av. Horizonte",
		[760] = "Rodovia Anel Leste",
	} :: { [number]: string },
	Z = {
		[-760] = "Rodovia Anel Norte",
		[-480] = "Rua dos Ipês",
		[-160] = "Av. do Comércio",
		[160] = "Av. Liberdade",
		[480] = "Rua do Porto",
		[760] = "Rodovia Anel Sul",
	} :: { [number]: string },
}

MapLayout.Palette = {
	Grass = Color3.fromRGB(111, 196, 84),
	GrassDark = Color3.fromRGB(86, 168, 68),
	Road = Color3.fromRGB(62, 64, 76),
	Highway = Color3.fromRGB(52, 54, 64),
	Sidewalk = Color3.fromRGB(208, 210, 216),
	Curb = Color3.fromRGB(170, 172, 180),
	Plaza = Color3.fromRGB(232, 214, 184),
	Asphalt = Color3.fromRGB(96, 98, 110),
	Dirt = Color3.fromRGB(176, 128, 82),
	LaneYellow = Color3.fromRGB(255, 205, 50),
	LaneWhite = Color3.fromRGB(245, 245, 245),
	Water = Color3.fromRGB(45, 170, 230),
	CanalFloor = Color3.fromRGB(66, 104, 116),
	CanalWall = Color3.fromRGB(150, 150, 160),
	Wood = Color3.fromRGB(160, 110, 70),
	Glass = Color3.fromRGB(70, 110, 160),
	Coral = Color3.fromRGB(255, 107, 107),
	Red = Color3.fromRGB(220, 60, 55),
	Sunny = Color3.fromRGB(255, 206, 84),
	Mint = Color3.fromRGB(72, 219, 170),
	Sky = Color3.fromRGB(84, 160, 255),
	Lilac = Color3.fromRGB(165, 132, 255),
	Orange = Color3.fromRGB(255, 159, 67),
	Pink = Color3.fromRGB(255, 133, 192),
	Teal = Color3.fromRGB(32, 191, 190),
	Cream = Color3.fromRGB(250, 240, 220),
	White = Color3.fromRGB(245, 245, 245),
	Brick = Color3.fromRGB(201, 96, 70),
	Navy = Color3.fromRGB(52, 73, 120),
	Slate = Color3.fromRGB(120, 130, 150),
	Dark = Color3.fromRGB(40, 42, 52),
}

local P = MapLayout.Palette
local H = MapLayout.Heights

MapLayout.FacingVectors = {
	N = Vector3.new(0, 0, -1),
	S = Vector3.new(0, 0, 1),
	E = Vector3.new(1, 0, 0),
	W = Vector3.new(-1, 0, 0),
} :: { [string]: Vector3 }

function MapLayout.RoadWidth(coordinate: number): number
	if math.abs(coordinate) == MapLayout.RingCoordinate then
		return MapLayout.RingWidth
	end
	return MapLayout.AvenueWidth
end

-- Tema do piso de cada quarteirão ("coluna,linha"; a linha 4 é dividida pelo canal).
MapLayout.BlockThemes = {
	["1,1"] = "Asphalt",
	["2,1"] = "Concrete",
	["3,1"] = "Grass",
	["4,1"] = "Grass",
	["5,1"] = "Grass",
	["1,2"] = "Dirt",
	["2,2"] = "Concrete",
	["3,2"] = "Concrete",
	["4,2"] = "Grass",
	["5,2"] = "Grass",
	["1,3"] = "Concrete",
	["2,3"] = "Concrete",
	["3,3"] = "Plaza",
	["4,3"] = "Concrete",
	["5,3"] = "Grass",
	["1,4a"] = "Grass",
	["2,4a"] = "Plaza",
	["3,4a"] = "Grass",
	["4,4a"] = "Dirt",
	["5,4a"] = "Grass",
	["1,4b"] = "Asphalt",
	["2,4b"] = "Grass",
	["3,4b"] = "Concrete",
	["4,4b"] = "Grass",
	["5,4b"] = "Asphalt",
	["1,5"] = "Grass",
	["2,5"] = "Grass",
	["3,5"] = "Grass",
	["4,5"] = "Concrete",
	["5,5"] = "Concrete",
} :: { [string]: string }

-- Retângulos dos quarteirões (incluindo a calçada), entre as ruas.
function MapLayout.GetBlocks(): { Block }
	local xs, zs = MapLayout.Grid.Xs, MapLayout.Grid.Zs
	local canal = MapLayout.Canal
	local blocks: { Block } = {}
	for i = 1, #xs - 1 do
		local xMin = xs[i] + MapLayout.RoadWidth(xs[i]) / 2
		local xMax = xs[i + 1] - MapLayout.RoadWidth(xs[i + 1]) / 2
		for j = 1, #zs - 1 do
			local zMin = zs[j] + MapLayout.RoadWidth(zs[j]) / 2
			local zMax = zs[j + 1] - MapLayout.RoadWidth(zs[j + 1]) / 2
			if zs[j] == MapLayout.CanalCrossingFrom and zs[j + 1] == MapLayout.CanalCrossingTo then
				local northKey = i .. "," .. j .. "a"
				local southKey = i .. "," .. j .. "b"
				table.insert(blocks, {
					Key = northKey,
					XMin = xMin,
					XMax = xMax,
					ZMin = zMin,
					ZMax = canal.ZMin,
					Theme = MapLayout.BlockThemes[northKey] or "Concrete",
				})
				table.insert(blocks, {
					Key = southKey,
					XMin = xMin,
					XMax = xMax,
					ZMin = canal.ZMax,
					ZMax = zMax,
					Theme = MapLayout.BlockThemes[southKey] or "Concrete",
				})
			else
				local key = i .. "," .. j
				table.insert(blocks, {
					Key = key,
					XMin = xMin,
					XMax = xMax,
					ZMin = zMin,
					ZMax = zMax,
					Theme = MapLayout.BlockThemes[key] or "Concrete",
				})
			end
		end
	end
	return blocks
end

local function building(
	style: string,
	width: number,
	depth: number,
	height: number,
	setback: number,
	color: Color3,
	accent: Color3,
	sign: string?
): BuildingSpec
	return {
		Style = style,
		Width = width,
		Depth = depth,
		Height = height,
		Setback = setback,
		Color = color,
		Accent = accent,
		Sign = sign,
	}
end

local function location(
	id: string,
	name: string,
	icon: string,
	x: number,
	z: number,
	facing: string,
	pickup: boolean,
	dropoff: boolean,
	spec: BuildingSpec,
	y: number?
): Location
	return {
		Id = id,
		Name = name,
		Icon = icon,
		Position = Vector3.new(x, y or H.Block, z),
		Facing = facing,
		Pickup = pickup,
		Dropoff = dropoff,
		Building = spec,
	}
end

-- Locais de coleta (Pickup) e entrega (Dropoff).
MapLayout.Locations = {
	location(
		"Distribuicao",
		"Centro de Distribuição",
		"📦",
		-506,
		-610,
		"E",
		true,
		true,
		building("Warehouse", 140, 120, 30, 14, P.Sky, P.Sunny, "📦 CENTRO DE DISTRIBUIÇÃO")
	),
	location(
		"PostoTurbo",
		"Posto Turbo",
		"⛽",
		-320,
		-506,
		"S",
		false,
		true,
		building("GasStation", 60, 30, 12, 44, P.Coral, P.White, "⛽ POSTO TURBO")
	),
	location(
		"Escola",
		"Escola Municipal",
		"🏫",
		0,
		-506,
		"S",
		false,
		true,
		building("School", 150, 60, 20, 30, P.Brick, P.Cream, "🏫 ESCOLA MUNICIPAL")
	),
	location(
		"CasaAmarela",
		"Casa Amarela",
		"🏠",
		250,
		-506,
		"S",
		false,
		true,
		building("House", 34, 28, 13, 14, P.Sunny, P.White)
	),
	location(
		"CasaAzul",
		"Casa Azul",
		"🏠",
		454,
		-640,
		"E",
		false,
		true,
		building("House", 34, 28, 13, 14, P.Sky, P.White)
	),
	location(
		"CasaVerde",
		"Casa Verde",
		"🏠",
		506,
		-560,
		"W",
		false,
		true,
		building("House", 34, 28, 13, 14, P.Mint, P.White)
	),
	location(
		"FerroVelho",
		"Ferro-Velho do Zé",
		"🔧",
		-506,
		-320,
		"E",
		false,
		true,
		building("Shed", 36, 28, 12, 18, P.Slate, P.Orange, "🔧 FERRO-VELHO DO ZÉ")
	),
	location(
		"BurgerBoom",
		"Burger Boom",
		"🍔",
		-186,
		-380,
		"E",
		true,
		false,
		building("Shop", 44, 40, 16, 12, P.Orange, P.Coral, "🍔 BURGER BOOM")
	),
	location(
		"Pizzaria",
		"Pizzaria Bella Napoli",
		"🍕",
		-70,
		-186,
		"S",
		true,
		false,
		building("Shop", 50, 40, 14, 12, P.Red, P.White, "🍕 BELLA NAPOLI")
	),
	location(
		"Cartorio",
		"Cartório Central",
		"📄",
		70,
		-186,
		"S",
		true,
		true,
		building("Office", 50, 40, 18, 12, P.Cream, P.Navy, "📄 CARTÓRIO CENTRAL")
	),
	location(
		"Hospital",
		"Hospital Santa Luz",
		"🏥",
		186,
		-320,
		"W",
		false,
		true,
		building("Hospital", 140, 110, 36, 20, P.White, P.Coral, "🏥 HOSPITAL SANTA LUZ")
	),
	location(
		"ResidencialSolar",
		"Residencial Solar",
		"🏢",
		506,
		-250,
		"W",
		false,
		true,
		building("Apartment", 60, 50, 40, 14, P.Lilac, P.White, "🏢 RESIDENCIAL SOLAR")
	),
	location(
		"Shopping",
		"Shopping Centro",
		"🛍️",
		-186,
		-60,
		"E",
		true,
		true,
		building("Mall", 110, 110, 24, 22, P.Pink, P.Sky, "🛍️ SHOPPING CENTRO")
	),
	location(
		"Prefeitura",
		"Prefeitura",
		"🏛️",
		0,
		-134,
		"N",
		true,
		true,
		building("Civic", 100, 46, 28, 12, P.Cream, P.Sky, "🏛️ PREFEITURA")
	),
	location(
		"TorreEmpresarial",
		"Torre Empresarial",
		"🏙️",
		186,
		60,
		"W",
		false,
		true,
		building("Tower", 60, 60, 110, 16, P.Navy, P.Teal, "🏙️ TORRE EMPRESARIAL")
	),
	location(
		"Farmacia",
		"Farmácia Vida+",
		"💊",
		380,
		-134,
		"N",
		true,
		true,
		building("Shop", 50, 40, 14, 12, P.Mint, P.White, "💊 FARMÁCIA VIDA+")
	),
	location(
		"Parque",
		"Quiosque do Parque",
		"🌳",
		506,
		100,
		"W",
		false,
		true,
		building("Kiosk", 20, 16, 10, 8, P.Teal, P.Sunny, "🌳 QUIOSQUE")
	),
	location(
		"BeiraRio",
		"Condomínio Beira-Rio",
		"🏘️",
		-616,
		186,
		"N",
		false,
		true,
		building("Apartment", 80, 46, 30, 12, P.Teal, P.Cream, "🏘️ BEIRA-RIO")
	),
	location(
		"Docas",
		"Docas do Porto",
		"⚓",
		-616,
		454,
		"S",
		false,
		true,
		building("Warehouse", 90, 46, 18, 12, P.Brick, P.Sunny, "⚓ DOCAS DO PORTO")
	),
	location(
		"Bombeiros",
		"Corpo de Bombeiros",
		"🚒",
		0,
		454,
		"S",
		false,
		true,
		building("FireStation", 70, 46, 18, 12, P.Red, P.White, "🚒 BOMBEIROS")
	),
	location(
		"Oficina",
		"Oficina do Tonho",
		"🔧",
		506,
		405,
		"W",
		false,
		true,
		building("Shed", 50, 44, 14, 14, P.Slate, P.Sunny, "🔧 OFICINA DO TONHO")
	),
	location(
		"CasaRosa",
		"Casa Rosa",
		"🏠",
		-320,
		506,
		"N",
		false,
		true,
		building("House", 34, 28, 13, 14, P.Pink, P.White)
	),
	location(
		"ArenaSul",
		"Arena Sul",
		"🏟️",
		0,
		506,
		"N",
		false,
		true,
		building("Stadium", 200, 180, 22, 14, P.Sky, P.White, "🏟️ ARENA SUL")
	),
	location(
		"Supermercado",
		"Supermercado Preço Bom",
		"🛒",
		320,
		506,
		"N",
		false,
		true,
		building("Supermarket", 110, 60, 16, 36, P.Mint, P.Coral, "🛒 PREÇO BOM")
	),
	location(
		"PostoRota66",
		"Posto Rota 66",
		"⛽",
		726,
		616,
		"E",
		false,
		true,
		building("GasStation", 50, 26, 12, 44, P.Sky, P.Sunny, "⛽ ROTA 66")
	),
	location(
		"Chacara",
		"Chácara Bom Sossego",
		"🐄",
		-795,
		600,
		"E",
		false,
		true,
		building("Farm", 40, 30, 14, 22, P.Brick, P.Cream, "🐄 CHÁCARA BOM SOSSEGO"),
		H.Ground
	),
} :: { Location }

local locationsById: { [string]: Location } = {}
for _, loc in MapLayout.Locations do
	assert(locationsById[loc.Id] == nil, "Local duplicado: " .. loc.Id)
	locationsById[loc.Id] = loc
end

function MapLayout.GetLocation(id: string): Location?
	return locationsById[id]
end

-- Centro (no chão) do prédio de um local: atrás do ponto de entrega, olhando para a rua.
function MapLayout.GetBuildingCenter(loc: Location): Vector3
	local facing = MapLayout.FacingVectors[loc.Facing]
	local offset = loc.Building.Setback + loc.Building.Depth / 2
	return loc.Position - facing * offset
end

-- Tamanho no mundo (X, Z) de uma construção, considerando a direção da fachada.
function MapLayout.GetFootprint(facing: string, width: number, depth: number): Vector2
	if facing == "E" or facing == "W" then
		return Vector2.new(depth, width)
	end
	return Vector2.new(width, depth)
end

local function filler(
	style: string,
	x: number,
	z: number,
	facing: string,
	width: number,
	depth: number,
	height: number,
	color: Color3,
	accent: Color3
): Filler
	return {
		Style = style,
		Center = Vector2.new(x, z),
		Facing = facing,
		Width = width,
		Depth = depth,
		Height = height,
		Color = color,
		Accent = accent,
	}
end

-- Construções decorativas (não são locais de entrega).
MapLayout.Fillers = {
	-- Distrito industrial (noroeste)
	filler("Containers", -690, -640, "E", 60, 40, 10, P.Coral, P.Sky),
	filler("Containers", -690, -560, "E", 60, 40, 10, P.Mint, P.Orange),
	filler("Shop", -415, -600, "W", 60, 50, 12, P.Sunny, P.Coral),
	filler("Shop", -220, -620, "E", 70, 50, 14, P.Teal, P.White),
	filler("Apartment", -330, -680, "N", 90, 40, 24, P.Cream, P.Brick),
	filler("Office", 0, -690, "N", 120, 36, 14, P.Cream, P.Brick),
	-- Jardim das Palmeiras (residencial norte)
	filler("House", 320, -534, "S", 34, 28, 13, P.Coral, P.White),
	filler("House", 390, -534, "S", 34, 28, 13, P.Lilac, P.White),
	filler("House", 230, -690, "N", 34, 28, 13, P.Mint, P.White),
	filler("House", 300, -690, "N", 34, 28, 13, P.Orange, P.White),
	filler("House", 370, -690, "N", 34, 28, 13, P.Pink, P.White),
	filler("House", 206, -620, "W", 34, 28, 13, P.Cream, P.Brick),
	filler("House", 534, -640, "W", 34, 28, 13, P.Coral, P.White),
	filler("House", 600, -534, "S", 34, 28, 13, P.Sky, P.White),
	filler("House", 670, -534, "S", 34, 28, 13, P.Sunny, P.White),
	filler("House", 600, -690, "N", 34, 28, 13, P.Lilac, P.White),
	filler("House", 670, -690, "N", 34, 28, 13, P.Teal, P.White),
	filler("House", 698, -620, "E", 34, 28, 13, P.Orange, P.White),
	-- Ferro-velho
	filler("JunkPile", -620, -400, "N", 30, 30, 8, P.Slate, P.Orange),
	filler("JunkPile", -680, -330, "N", 30, 30, 8, P.Brick, P.Sky),
	filler("JunkPile", -620, -250, "N", 30, 30, 8, P.Slate, P.Coral),
	-- Quarteirão do Burger Boom (com beco)
	filler("Office", -420, -380, "W", 60, 50, 22, P.Sky, P.White),
	filler("Apartment", -320, -420, "N", 80, 46, 28, P.Coral, P.Cream),
	filler("Shop", -400, -225, "S", 60, 46, 12, P.Mint, P.White),
	filler("Shop", -305, -225, "S", 70, 46, 16, P.Lilac, P.Sunny),
	filler("Shop", -212, -235, "E", 40, 36, 12, P.Sunny, P.Coral),
	-- Quarteirão da pizzaria (com beco)
	filler("Shop", -75, -420, "N", 90, 46, 20, P.Teal, P.White),
	filler("Shop", 75, -420, "N", 90, 46, 20, P.Orange, P.White),
	filler("Office", -75, -310, "N", 80, 56, 45, P.Sky, P.White),
	filler("Office", 75, -310, "N", 80, 56, 60, P.Lilac, P.White),
	-- Quarteirão do hospital
	filler("Office", 420, -320, "E", 80, 50, 26, P.Cream, P.Sky),
	filler("Shop", 340, -430, "N", 60, 28, 14, P.Mint, P.White),
	filler("Shop", 340, -212, "S", 60, 30, 14, P.Pink, P.White),
	-- Residencial Solar
	filler("Apartment", 545, -380, "W", 70, 50, 32, P.Sunny, P.White),
	filler("Apartment", 690, -320, "E", 90, 50, 28, P.Teal, P.White),
	filler("Shop", 630, -430, "N", 50, 28, 18, P.Coral, P.White),
	filler("Shop", 630, -210, "S", 50, 28, 18, P.Sky, P.White),
	-- Mercado (oeste)
	filler("Supermarket", -560, 0, "E", 120, 60, 18, P.Orange, P.Cream),
	filler("Shop", -680, -60, "W", 60, 46, 14, P.Pink, P.White),
	filler("Shop", -680, 60, "W", 60, 46, 14, P.Mint, P.White),
	-- Ao lado do shopping
	filler("Office", -420, -60, "W", 100, 50, 20, P.Slate, P.White),
	-- Centro empresarial (leste)
	filler("Office", 420, 60, "E", 80, 50, 34, P.Sky, P.White),
	filler("Office", 260, -100, "N", 70, 46, 26, P.Coral, P.White),
	filler("Shop", 330, 110, "S", 60, 30, 12, P.Sunny, P.White),
	-- Beira do canal (norte)
	filler("Apartment", -695, 225, "N", 30, 40, 22, P.Coral, P.White),
	filler("Apartment", -535, 225, "N", 30, 40, 22, P.Sunny, P.White),
	filler("Shop", -420, 215, "N", 50, 30, 12, P.Pink, P.White),
	filler("Shop", -340, 215, "N", 60, 30, 12, P.Mint, P.White),
	filler("Shop", -240, 215, "N", 60, 30, 12, P.Orange, P.White),
	filler("Apartment", 560, 220, "N", 70, 40, 26, P.Lilac, P.White),
	filler("Apartment", 670, 220, "N", 70, 40, 26, P.Sky, P.White),
	-- Beira do canal (sul)
	filler("Containers", -700, 410, "S", 20, 50, 10, P.Sky, P.Coral),
	filler("House", -420, 430, "S", 34, 28, 13, P.Sunny, P.White),
	filler("House", -350, 430, "S", 34, 28, 13, P.Coral, P.White),
	filler("House", -280, 430, "S", 34, 28, 13, P.Mint, P.White),
	filler("House", -210, 430, "S", 34, 28, 13, P.Lilac, P.White),
	filler("Shop", -95, 415, "S", 50, 40, 12, P.Sky, P.White),
	filler("Shop", 95, 415, "S", 50, 40, 12, P.Sunny, P.White),
	filler("House", 220, 430, "S", 34, 28, 13, P.Pink, P.White),
	filler("House", 290, 430, "S", 34, 28, 13, P.Sky, P.White),
	filler("House", 360, 430, "S", 34, 28, 13, P.Orange, P.White),
	filler("House", 430, 430, "S", 34, 28, 13, P.Mint, P.White),
	filler("Warehouse", 660, 405, "E", 60, 50, 16, P.Slate, P.Sunny),
	-- Vila Sul
	filler("House", -690, 534, "N", 34, 28, 13, P.Sky, P.White),
	filler("House", -620, 534, "N", 34, 28, 13, P.Coral, P.White),
	filler("House", -550, 534, "N", 34, 28, 13, P.Sunny, P.White),
	filler("House", -690, 698, "S", 34, 28, 13, P.Mint, P.White),
	filler("House", -620, 698, "S", 34, 28, 13, P.Lilac, P.White),
	filler("House", -550, 698, "S", 34, 28, 13, P.Orange, P.White),
	filler("House", -698, 616, "W", 34, 28, 13, P.Pink, P.White),
	filler("House", -534, 616, "E", 34, 28, 13, P.Teal, P.White),
	filler("House", -410, 534, "N", 34, 28, 13, P.Mint, P.White),
	filler("House", -230, 534, "N", 34, 28, 13, P.Sunny, P.White),
	filler("House", -410, 698, "S", 34, 28, 13, P.Sky, P.White),
	filler("House", -320, 698, "S", 34, 28, 13, P.Coral, P.White),
	filler("House", -230, 698, "S", 34, 28, 13, P.Lilac, P.White),
	-- Sul/sudeste
	filler("Shop", 250, 690, "S", 80, 40, 14, P.Coral, P.White),
	filler("Shop", 390, 690, "S", 80, 40, 14, P.Teal, P.White),
	filler("Apartment", 560, 560, "N", 60, 40, 16, P.Pink, P.White),
	filler("Apartment", 560, 680, "S", 60, 40, 16, P.Sunny, P.White),
} :: { Filler }

-- Central de Entregas (onde os jogadores nascem) e seu estacionamento.
MapLayout.HQ = {
	Center = Vector3.new(0, H.Block, 45),
	Width = 90,
	Depth = 26,
	Height = 16,
	Facing = "S",
	ParkingArea = { XMin = -120, XMax = 120, ZMin = 90, ZMax = 132 } :: Rect,
}

MapLayout.Spawn = {
	Position = Vector3.new(0, H.Block, 78),
	Size = Vector3.new(24, 1, 8),
}

-- Vagas onde o veículo inicial aparece (virado para o sul, saída pela Av. Liberdade).
MapLayout.ParkingSlots = {} :: { CFrame }
for index = -4, 4 do
	local position = Vector3.new(index * 24, H.Lot, 110)
	table.insert(MapLayout.ParkingSlots, CFrame.lookAt(position, position + Vector3.new(0, 0, 1)))
end

MapLayout.Plaza = {
	FountainCenter = Vector3.new(0, H.Block, -22),
	FountainRadius = 16,
}

-- Becos: atalhos estreitos dentro dos quarteirões.
MapLayout.Alleys = {
	{
		Name = "Beco do Burger",
		Area = { XMin = -460, XMax = -180, ZMin = -308, ZMax = -292 } :: Rect,
		Obstacles = {
			Vector3.new(-400, H.Block, -303),
			Vector3.new(-310, H.Block, -297),
			Vector3.new(-230, H.Block, -303),
		},
	},
	{
		Name = "Beco da Pizza",
		Area = { XMin = -8, XMax = 8, ZMin = -460, ZMax = -180 } :: Rect,
		Obstacles = { Vector3.new(3, H.Block, -400), Vector3.new(-3, H.Block, -320), Vector3.new(3, H.Block, -250) },
	},
}

-- Trilha de terra que corta o Parque da Cidade na diagonal (atalho esburacado).
MapLayout.ParkTrail = {
	From = Vector3.new(504, H.Lot, -136),
	To = Vector3.new(728, H.Lot, 136),
	Width = 14,
}

MapLayout.ConstructionZone = { XMin = 180, XMax = 460, ZMin = 180, ZMax = 290 } :: Rect

MapLayout.ShoppingLot = {
	Area = { XMin = -460, XMax = -180, ZMin = 20, ZMax = 130 } :: Rect,
	GateZMin = 58,
	GateZMax = 92,
}

MapLayout.Shortcuts = {
	{
		Id = "PonteObra",
		DisplayName = "Ponte da Obra (Av. Aurora)",
		Center = Vector3.new(160, H.Road, 320),
		ClearanceZones = {
			{ Center = Vector3.new(160, 6, 320), Size = Vector3.new(44, 20, 84) },
		},
	},
	{
		Id = "PortaoShopping",
		DisplayName = "Estacionamento do Shopping",
		Center = Vector3.new(-320, H.Block, 75),
		ClearanceZones = {
			{ Center = Vector3.new(-458, 6, 75), Size = Vector3.new(14, 20, 40) },
			{ Center = Vector3.new(-182, 6, 75), Size = Vector3.new(14, 20, 40) },
		},
	},
} :: { ShortcutSpec }

-- Trechos onde o evento ACIDENTE pode bloquear a rua (fora das rotas do trânsito).
MapLayout.AccidentSpots = {
	{ Id = "IpesCentro", Road = "Rua dos Ipês", Position = Vector3.new(-80, H.Road, -480), Axis = "X" },
	{ Id = "IndustriasCentro", Road = "Av. das Indústrias", Position = Vector3.new(-480, H.Road, -60), Axis = "Z" },
	{ Id = "HorizonteNorte", Road = "Av. Horizonte", Position = Vector3.new(480, H.Road, -330), Axis = "Z" },
	{ Id = "PortoLeste", Road = "Rua do Porto", Position = Vector3.new(240, H.Road, 480), Axis = "X" },
	{ Id = "LiberdadeOeste", Road = "Av. Liberdade", Position = Vector3.new(-320, H.Road, 160), Axis = "X" },
	{ Id = "AuroraNorte", Road = "Av. Aurora", Position = Vector3.new(160, H.Road, -400), Axis = "Z" },
} :: { AccidentSpot }

-- Lombadas (redutores de velocidade) atravessando a rua.
MapLayout.SpeedBumps = {
	{ Position = Vector3.new(320, H.Road, -480), Axis = "X" },
	{ Position = Vector3.new(620, H.Road, -480), Axis = "X" },
	{ Position = Vector3.new(-320, H.Road, 480), Axis = "X" },
	{ Position = Vector3.new(-620, H.Road, 480), Axis = "X" },
}

-- Áreas sem árvores/postes (entradas de becos, portões, postos, estacionamentos).
MapLayout.ClearZones = {
	{ XMin = -470, XMax = -170, ZMin = -316, ZMax = -284 },
	{ XMin = -16, XMax = 16, ZMin = -470, ZMax = -170 },
	{ XMin = -470, XMax = -450, ZMin = 50, ZMax = 100 },
	{ XMin = -190, XMax = -170, ZMin = 50, ZMax = 100 },
	{ XMin = -360, XMax = -280, ZMin = -520, ZMax = -490 },
	{ XMin = 715, XMax = 740, ZMin = 580, ZMax = 652 },
	{ XMin = -130, XMax = 130, ZMin = 128, ZMax = 145 },
	{ XMin = 490, XMax = 740, ZMin = -150, ZMax = 150 },
	{ XMin = 260, XMax = 380, ZMin = 495, ZMax = 545 },
} :: { Rect }

return MapLayout
