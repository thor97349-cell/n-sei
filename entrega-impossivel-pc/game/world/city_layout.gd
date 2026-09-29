class_name CityLayout
extends RefCounted
## Planta da cidade em METROS (dados puros). O CityBuilder transforma isto em geometria;
## entregas, trânsito, GPS e minimapa leem as mesmas informações daqui.
##
## Eixos: X cresce para o LESTE, Z cresce para o SUL (norte = -Z), Y para cima.
## A cidade é uma grade de avenidas cercada por uma rodovia em anel e cortada por um canal.

const LINES: Array[float] = [-375.0, -225.0, -75.0, 75.0, 225.0, 375.0]
const RING := 375.0
const RING_WIDTH := 20.0
const AVENUE_WIDTH := 14.0
const SIDEWALK := 4.0
const CURB_HEIGHT := 0.15
const LANE_WIDTH := 3.5

const CANAL_Z_MIN := 135.0
const CANAL_Z_MAX := 165.0
const CANAL_FLOOR := -4.5
const WATER_LEVEL := -1.4
const CROSSING_FROM := 75.0
const CROSSING_TO := 225.0
## Como cada rua norte-sul atravessa o canal: "full" ponte, "narrow" pinguela (atalho
## arriscado, sem grade) e "closed" ponte em obras (só abre no evento ATALHO).
const CROSSINGS := {-375.0: "full", -225.0: "full", -75.0: "narrow", 75.0: "closed", 225.0: "full", 375.0: "full"}
const NARROW_WIDTH := 4.4

const GROUND_HALF := 800.0
const PLAYABLE_HALF := 700.0

const ROAD_NAMES_X := {
	-375.0: "Rodovia Anel Oeste", -225.0: "Av. das Indústrias", -75.0: "Rua da Pinguela",
	75.0: "Av. Aurora", 225.0: "Av. Horizonte", 375.0: "Rodovia Anel Leste",
}
const ROAD_NAMES_Z := {
	-375.0: "Rodovia Anel Norte", -225.0: "Rua dos Ipês", -75.0: "Av. do Comércio",
	75.0: "Av. Liberdade", 225.0: "Rua do Porto", 375.0: "Rodovia Anel Sul",
}

## Tema de cada quarteirão ("coluna,linha"; a linha 3 é dividida pelo canal em 3n/3s).
const THEMES := {
	"0,0": "industrial", "1,0": "commercial", "2,0": "school", "3,0": "residential", "4,0": "residential",
	"0,1": "industrial", "1,1": "commercial", "2,1": "downtown", "3,1": "downtown", "4,1": "apartments",
	"0,2": "commercial", "1,2": "mall", "2,2": "plaza", "3,2": "downtown", "4,2": "park",
	"0,3n": "waterfront", "1,3n": "waterfront", "2,3n": "promenade", "3,3n": "construction", "4,3n": "waterfront",
	"0,3s": "industrial", "1,3s": "residential", "2,3s": "commercial", "3,3s": "residential", "4,3s": "commercial",
	"0,4": "residential", "1,4": "residential", "2,4": "stadium", "3,4": "commercial", "4,4": "commercial",
}

## Estilos de prédio para preencher cada tema: [estilo, peso]; largura/profundidade/altura (mín, máx).
const THEME_RULES := {
	"industrial": {"styles": [["warehouse", 0.7], ["shed", 0.3]], "width": Vector2(26, 44), "depth": Vector2(22, 36), "height": Vector2(7, 13), "setback": 0.0},
	"commercial": {"styles": [["shop", 0.5], ["office", 0.3], ["apartment", 0.2]], "width": Vector2(13, 24), "depth": Vector2(14, 24), "height": Vector2(7, 24), "setback": 0.0},
	"downtown": {"styles": [["office", 0.45], ["glass", 0.35], ["apartment", 0.2]], "width": Vector2(18, 32), "depth": Vector2(18, 28), "height": Vector2(24, 64), "setback": 0.0},
	"residential": {"styles": [["house", 0.8], ["apartment", 0.2]], "width": Vector2(12, 18), "depth": Vector2(10, 14), "height": Vector2(6, 9), "setback": 5.0},
	"apartments": {"styles": [["apartment", 0.85], ["shop", 0.15]], "width": Vector2(20, 30), "depth": Vector2(15, 22), "height": Vector2(16, 40), "setback": 0.0},
	"waterfront": {"styles": [["shop", 0.5], ["apartment", 0.5]], "width": Vector2(14, 22), "depth": Vector2(12, 18), "height": Vector2(8, 20), "setback": 0.0},
	"school": {"styles": [["shop", 0.5], ["house", 0.5]], "width": Vector2(12, 18), "depth": Vector2(10, 14), "height": Vector2(6, 10), "setback": 3.0},
	"mall": {"styles": [["shop", 1.0]], "width": Vector2(14, 22), "depth": Vector2(14, 20), "height": Vector2(8, 14), "setback": 0.0},
}

const WALL_COLORS: Array[Color] = [
	Color(0.62, 0.62, 0.6), Color(0.72, 0.71, 0.68), Color(0.84, 0.78, 0.66), Color(0.9, 0.86, 0.76),
	Color(0.88, 0.88, 0.86), Color(0.72, 0.44, 0.32), Color(0.58, 0.33, 0.25), Color(0.93, 0.82, 0.52),
	Color(0.62, 0.75, 0.85), Color(0.66, 0.8, 0.64), Color(0.9, 0.62, 0.52), Color(0.4, 0.41, 0.43),
]

## Locais de coleta/entrega. O prédio fica no lote "side" do quarteirão "block", na
## posição "t" (0 → 1 ao longo da calçada). A vaga de carga fica na rua em frente.
const LOCATIONS := [
	{"id": "distribution", "name": "Centro de Distribuição", "icon": "📦", "block": "0,0", "side": "E", "t": 0.5, "width": 70.0, "depth": 50.0, "style": "warehouse", "height": 14.0, "color": Color(0.33, 0.52, 0.8), "sign": "CENTRO DE DISTRIBUIÇÃO", "pickup": true, "dropoff": true},
	{"id": "gas_north", "name": "Posto Turbo", "icon": "⛽", "block": "1,0", "side": "S", "t": 0.5, "width": 40.0, "depth": 14.0, "style": "gas_station", "height": 5.0, "color": Color(0.85, 0.2, 0.18), "sign": "POSTO TURBO", "pickup": false, "dropoff": true, "fuel": true, "setback": 20.0},
	{"id": "school", "name": "Escola Municipal", "icon": "🏫", "block": "2,0", "side": "S", "t": 0.5, "width": 70.0, "depth": 24.0, "style": "school", "height": 11.0, "color": Color(0.8, 0.5, 0.35), "sign": "ESCOLA MUNICIPAL", "pickup": false, "dropoff": true, "setback": 6.0},
	{"id": "house_yellow", "name": "Casa Amarela", "icon": "🏠", "block": "3,0", "side": "S", "t": 0.25, "width": 16.0, "depth": 12.0, "style": "house", "height": 7.0, "color": Color(0.95, 0.8, 0.35), "sign": "", "pickup": false, "dropoff": true, "setback": 5.0},
	{"id": "house_blue", "name": "Casa Azul", "icon": "🏠", "block": "3,0", "side": "E", "t": 0.6, "width": 16.0, "depth": 12.0, "style": "house", "height": 7.0, "color": Color(0.5, 0.68, 0.88), "sign": "", "pickup": false, "dropoff": true, "setback": 5.0},
	{"id": "house_green", "name": "Casa Verde", "icon": "🏠", "block": "4,0", "side": "W", "t": 0.3, "width": 16.0, "depth": 12.0, "style": "house", "height": 7.0, "color": Color(0.55, 0.78, 0.55), "sign": "", "pickup": false, "dropoff": true, "setback": 5.0},
	{"id": "junkyard", "name": "Ferro-Velho do Zé", "icon": "🔧", "block": "0,1", "side": "E", "t": 0.5, "width": 30.0, "depth": 20.0, "style": "shed", "height": 6.0, "color": Color(0.5, 0.5, 0.52), "sign": "FERRO-VELHO DO ZÉ", "pickup": false, "dropoff": true},
	{"id": "burger", "name": "Burger Boom", "icon": "🍔", "block": "1,1", "side": "E", "t": 0.25, "width": 20.0, "depth": 18.0, "style": "shop", "height": 8.0, "color": Color(0.95, 0.55, 0.2), "sign": "BURGER BOOM", "pickup": true, "dropoff": false},
	{"id": "pizzaria", "name": "Pizzaria Bella Napoli", "icon": "🍕", "block": "2,1", "side": "S", "t": 0.25, "width": 18.0, "depth": 18.0, "style": "shop", "height": 9.0, "color": Color(0.75, 0.2, 0.18), "sign": "PIZZARIA BELLA NAPOLI", "pickup": true, "dropoff": false},
	{"id": "notary", "name": "Cartório Central", "icon": "📄", "block": "2,1", "side": "S", "t": 0.78, "width": 18.0, "depth": 18.0, "style": "office", "height": 16.0, "color": Color(0.88, 0.85, 0.76), "sign": "CARTÓRIO CENTRAL", "pickup": true, "dropoff": true},
	{"id": "hospital", "name": "Hospital Santa Luz", "icon": "🏥", "block": "3,1", "side": "W", "t": 0.5, "width": 70.0, "depth": 45.0, "style": "hospital", "height": 28.0, "color": Color(0.93, 0.93, 0.92), "sign": "HOSPITAL SANTA LUZ", "pickup": false, "dropoff": true},
	{"id": "apartments", "name": "Residencial Solar", "icon": "🏢", "block": "4,1", "side": "W", "t": 0.3, "width": 26.0, "depth": 20.0, "style": "apartment", "height": 30.0, "color": Color(0.78, 0.7, 0.88), "sign": "RESIDENCIAL SOLAR", "pickup": false, "dropoff": true},
	{"id": "mall", "name": "Shopping Centro", "icon": "🛍️", "block": "1,2", "side": "E", "t": 0.3, "width": 50.0, "depth": 60.0, "style": "mall", "height": 18.0, "color": Color(0.9, 0.9, 0.92), "sign": "SHOPPING CENTRO", "pickup": true, "dropoff": true},
	{"id": "city_hall", "name": "Prefeitura", "icon": "🏛️", "block": "2,2", "side": "N", "t": 0.5, "width": 44.0, "depth": 22.0, "style": "civic", "height": 16.0, "color": Color(0.92, 0.88, 0.78), "sign": "PREFEITURA", "pickup": true, "dropoff": true, "setback": 6.0},
	{"id": "tower", "name": "Torre Empresarial", "icon": "🏙️", "block": "3,2", "side": "W", "t": 0.62, "width": 30.0, "depth": 30.0, "style": "glass", "height": 80.0, "color": Color(0.35, 0.45, 0.55), "sign": "TORRE EMPRESARIAL", "pickup": false, "dropoff": true},
	{"id": "pharmacy", "name": "Farmácia Vida+", "icon": "💊", "block": "3,2", "side": "N", "t": 0.72, "width": 18.0, "depth": 16.0, "style": "shop", "height": 8.0, "color": Color(0.4, 0.78, 0.6), "sign": "FARMÁCIA VIDA+", "pickup": true, "dropoff": true},
	{"id": "park_kiosk", "name": "Quiosque do Parque", "icon": "🌳", "block": "4,2", "side": "W", "t": 0.82, "width": 10.0, "depth": 8.0, "style": "kiosk", "height": 4.0, "color": Color(0.2, 0.62, 0.6), "sign": "QUIOSQUE", "pickup": false, "dropoff": true, "setback": 2.0},
	{"id": "condo", "name": "Condomínio Beira-Rio", "icon": "🏘️", "block": "0,3n", "side": "N", "t": 0.5, "width": 40.0, "depth": 24.0, "style": "apartment", "height": 24.0, "color": Color(0.3, 0.62, 0.62), "sign": "BEIRA-RIO", "pickup": false, "dropoff": true},
	{"id": "bakery", "name": "Padaria Pão de Ouro", "icon": "🎂", "block": "1,3n", "side": "N", "t": 0.35, "width": 16.0, "depth": 16.0, "style": "shop", "height": 8.0, "color": Color(0.95, 0.85, 0.6), "sign": "PADARIA PÃO DE OURO", "pickup": true, "dropoff": false},
	{"id": "docks", "name": "Docas do Porto", "icon": "⚓", "block": "0,3s", "side": "S", "t": 0.5, "width": 45.0, "depth": 30.0, "style": "warehouse", "height": 10.0, "color": Color(0.62, 0.35, 0.28), "sign": "DOCAS DO PORTO", "pickup": false, "dropoff": true},
	{"id": "fire_station", "name": "Corpo de Bombeiros", "icon": "🚒", "block": "2,3s", "side": "S", "t": 0.5, "width": 34.0, "depth": 26.0, "style": "fire_station", "height": 10.0, "color": Color(0.8, 0.15, 0.13), "sign": "CORPO DE BOMBEIROS", "pickup": false, "dropoff": true},
	{"id": "garage_shop", "name": "Oficina do Tonho", "icon": "🔧", "block": "4,3s", "side": "W", "t": 0.5, "width": 24.0, "depth": 20.0, "style": "shed", "height": 7.0, "color": Color(0.45, 0.48, 0.55), "sign": "OFICINA DO TONHO", "pickup": false, "dropoff": true},
	{"id": "house_pink", "name": "Casa Rosa", "icon": "🏠", "block": "1,4", "side": "N", "t": 0.5, "width": 16.0, "depth": 12.0, "style": "house", "height": 7.0, "color": Color(0.95, 0.6, 0.72), "sign": "", "pickup": false, "dropoff": true, "setback": 5.0},
	{"id": "stadium", "name": "Arena Sul", "icon": "🏟️", "block": "2,4", "side": "N", "t": 0.5, "width": 12.0, "depth": 8.0, "style": "kiosk", "height": 5.0, "color": Color(0.25, 0.45, 0.8), "sign": "ARENA SUL", "pickup": false, "dropoff": true, "setback": 2.0},
	{"id": "supermarket", "name": "Supermercado Preço Bom", "icon": "🛒", "block": "3,4", "side": "N", "t": 0.5, "width": 55.0, "depth": 34.0, "style": "supermarket", "height": 9.0, "color": Color(0.35, 0.72, 0.5), "sign": "SUPERMERCADO PREÇO BOM", "pickup": false, "dropoff": true, "setback": 16.0},
	{"id": "gas_east", "name": "Posto Rota 66", "icon": "⛽", "block": "4,4", "side": "E", "t": 0.5, "width": 34.0, "depth": 14.0, "style": "gas_station", "height": 5.0, "color": Color(0.2, 0.45, 0.85), "sign": "POSTO ROTA 66", "pickup": false, "dropoff": true, "fuel": true, "setback": 20.0},
]

## Chácara fora da cidade (especial: fica além da rodovia oeste).
const FARM := {"id": "farm", "name": "Chácara Bom Sossego", "icon": "🐄", "zone": Vector3(-383.0, 0.0, 300.0), "house": Vector3(-440.0, 0.0, 300.0), "pickup": false, "dropoff": true}

## Central de Entregas (onde o jogo começa) e sua garagem.
const HQ := {"block": "2,2", "center": Vector3(0.0, 0.0, 32.0), "size": Vector3(50.0, 12.0, 20.0)}
const HQ_PARKING := {"min": Vector2(-40.0, 44.0), "max": Vector2(40.0, 62.0)}
const SPAWN := {"position": Vector3(-10.0, 0.9, 53.0), "yaw": 0.0}

const PLAZA := {"fountain": Vector3(0.0, 0.0, -14.0), "radius": 9.0}

## Áreas dentro dos quarteirões que não recebem prédios.
const RESERVED := [
	{"name": "hq_parking", "min": Vector2(-44.0, 42.0), "max": Vector2(44.0, 64.0)},
	{"name": "plaza", "min": Vector2(-64.0, -34.0), "max": Vector2(64.0, 12.0)},
	{"name": "mall_parking", "min": Vector2(-218.0, 6.0), "max": Vector2(-82.0, 64.0)},
	{"name": "alley_burger", "min": Vector2(-218.0, -154.0), "max": Vector2(-82.0, -146.0)},
	{"name": "alley_pizza", "min": Vector2(-4.0, -218.0), "max": Vector2(4.0, -82.0)},
	{"name": "school_court", "min": Vector2(-26.0, -322.0), "max": Vector2(26.0, -284.0)},
]

const ALLEYS := [
	{"name": "Beco do Burger", "min": Vector2(-218.0, -154.0), "max": Vector2(-82.0, -146.0)},
	{"name": "Beco da Pizza", "min": Vector2(-4.0, -218.0), "max": Vector2(4.0, -82.0)},
]

const MALL_PARKING := {"min": Vector2(-214.0, 8.0), "max": Vector2(-86.0, 62.0), "gate_z": Vector2(26.0, 42.0)}

const PARK_TRAIL := {"from": Vector3(236.0, 0.0, -64.0), "to": Vector3(361.0, 0.0, 64.0), "width": 6.0}
const PARK_POND := {"center": Vector3(318.0, 0.0, -28.0), "radius": 13.0}

const STADIUM := {"center": Vector3(0.0, 0.0, 305.0), "size": Vector2(112.0, 96.0), "height": 16.0}

const CONSTRUCTION := {"min": Vector2(82.0, 82.0), "max": Vector2(218.0, 135.0)}
const SCHOOL_COURT := {"center": Vector3(0.0, 0.0, -303.0), "size": Vector2(30.0, 17.0)}

const SHORTCUTS := [
	{"id": "bridge", "name_pt": "Ponte da Obra (Av. Aurora)", "name_en": "Construction Bridge (Av. Aurora)", "center": Vector3(75.0, 0.0, 150.0), "size": Vector3(16.0, 10.0, 44.0)},
	{"id": "mall_gate", "name_pt": "Estacionamento do Shopping", "name_en": "Mall Parking Lot", "center": Vector3(-150.0, 0.0, 34.0), "size": Vector3(140.0, 10.0, 20.0)},
]

const ACCIDENT_SPOTS := [
	{"road": "Rua dos Ipês", "position": Vector3(-110.0, 0.0, -225.0), "axis": "x"},
	{"road": "Av. das Indústrias", "position": Vector3(-225.0, 0.0, -10.0), "axis": "z"},
	{"road": "Av. Horizonte", "position": Vector3(225.0, 0.0, -110.0), "axis": "z"},
	{"road": "Rua do Porto", "position": Vector3(120.0, 0.0, 225.0), "axis": "x"},
	{"road": "Av. Liberdade", "position": Vector3(-190.0, 0.0, 75.0), "axis": "x"},
	{"road": "Av. Aurora", "position": Vector3(75.0, 0.0, -190.0), "axis": "z"},
]


static func road_width(coordinate: float) -> float:
	return RING_WIDTH if absf(absf(coordinate) - RING) < 0.1 else AVENUE_WIDTH


static func is_ring(coordinate: float) -> bool:
	return absf(absf(coordinate) - RING) < 0.1


static func road_name(axis: String, coordinate: float) -> String:
	var table: Dictionary = ROAD_NAMES_X if axis == "x" else ROAD_NAMES_Z
	return table.get(coordinate, "Rua")


## Retângulos dos quarteirões (incluindo a calçada), entre as ruas.
static func blocks() -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for i in LINES.size() - 1:
		var xmin := LINES[i] + road_width(LINES[i]) / 2.0
		var xmax := LINES[i + 1] - road_width(LINES[i + 1]) / 2.0
		for j in LINES.size() - 1:
			var zmin := LINES[j] + road_width(LINES[j]) / 2.0
			var zmax := LINES[j + 1] - road_width(LINES[j + 1]) / 2.0
			if is_equal_approx(LINES[j], CROSSING_FROM) and is_equal_approx(LINES[j + 1], CROSSING_TO):
				var north_key := "%d,%dn" % [i, j]
				var south_key := "%d,%ds" % [i, j]
				result.append({"key": north_key, "min": Vector2(xmin, zmin), "max": Vector2(xmax, CANAL_Z_MIN), "theme": THEMES.get(north_key, "commercial"), "canal_side": "S"})
				result.append({"key": south_key, "min": Vector2(xmin, CANAL_Z_MAX), "max": Vector2(xmax, zmax), "theme": THEMES.get(south_key, "commercial"), "canal_side": "N"})
			else:
				var key := "%d,%d" % [i, j]
				result.append({"key": key, "min": Vector2(xmin, zmin), "max": Vector2(xmax, zmax), "theme": THEMES.get(key, "commercial"), "canal_side": ""})
	return result


static func get_block(key: String) -> Dictionary:
	for block in blocks():
		if block["key"] == key:
			return block
	return {}


static func facing_vector(side: String) -> Vector3:
	match side:
		"N":
			return Vector3(0, 0, -1)
		"S":
			return Vector3(0, 0, 1)
		"E":
			return Vector3(1, 0, 0)
		_:
			return Vector3(-1, 0, 0)


## Dados completos de um local: prédio (centro/tamanho/rotação) e vaga de carga.
static func location_info(loc: Dictionary) -> Dictionary:
	var block := get_block(loc["block"])
	var bmin: Vector2 = block["min"]
	var bmax: Vector2 = block["max"]
	var side: String = loc["side"]
	var setback: float = loc.get("setback", 0.0)
	var width: float = loc["width"]
	var depth: float = loc["depth"]
	var t: float = loc["t"]
	var inner_min := bmin + Vector2(SIDEWALK, SIDEWALK)
	var inner_max := bmax - Vector2(SIDEWALK, SIDEWALK)
	var center := Vector3.ZERO
	var zone := Vector3.ZERO
	var along := 0.0
	match side:
		"N":
			along = lerpf(inner_min.x, inner_max.x, t)
			center = Vector3(along, 0, inner_min.y + setback + depth / 2.0)
			zone = Vector3(along, 0, bmin.y - 1.9)
		"S":
			along = lerpf(inner_min.x, inner_max.x, t)
			center = Vector3(along, 0, inner_max.y - setback - depth / 2.0)
			zone = Vector3(along, 0, bmax.y + 1.9)
		"W":
			along = lerpf(inner_min.y, inner_max.y, t)
			center = Vector3(inner_min.x + setback + depth / 2.0, 0, along)
			zone = Vector3(bmin.x - 1.9, 0, along)
		_:
			along = lerpf(inner_min.y, inner_max.y, t)
			center = Vector3(inner_max.x - setback - depth / 2.0, 0, along)
			zone = Vector3(bmax.x + 1.9, 0, along)
	var facing := facing_vector(side)
	var footprint := Vector2(width, depth) if side == "N" or side == "S" else Vector2(depth, width)
	return {
		"center": center,
		"footprint": footprint,
		"facing": facing,
		"yaw": atan2(facing.x, facing.z),
		"zone": zone,
		"zone_along_x": side == "N" or side == "S",
	}


## Todos os locais de coleta/entrega com posição da vaga (incluindo a chácara).
static func all_locations() -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for loc: Dictionary in LOCATIONS:
		var info := location_info(loc)
		var entry := loc.duplicate()
		entry["zone"] = info["zone"]
		entry["zone_along_x"] = loc["side"] == "N" or loc["side"] == "S"
		result.append(entry)
	var farm := FARM.duplicate()
	farm["zone_along_x"] = false
	result.append(farm)
	return result


static func find_location(id: String) -> Dictionary:
	for loc in all_locations():
		if loc["id"] == id:
			return loc
	return {}


static func fuel_stations() -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for loc: Dictionary in LOCATIONS:
		if loc.get("fuel", false):
			var info := location_info(loc)
			var facing: Vector3 = info["facing"]
			var building_center: Vector3 = info["center"]
			var pump_area := building_center + facing * (float(loc["depth"]) / 2.0 + float(loc.get("setback", 0.0)) / 2.0)
			result.append({"id": loc["id"], "name": loc["name"], "pumps": pump_area, "along_x": loc["side"] == "N" or loc["side"] == "S"})
	return result


static func in_rect(p: Vector2, rmin: Vector2, rmax: Vector2, margin: float = 0.0) -> bool:
	return p.x >= rmin.x - margin and p.x <= rmax.x + margin and p.y >= rmin.y - margin and p.y <= rmax.y + margin


static func rects_overlap(amin: Vector2, amax: Vector2, bmin: Vector2, bmax: Vector2, margin: float = 0.0) -> bool:
	return amin.x < bmax.x + margin and bmin.x < amax.x + margin and amin.y < bmax.y + margin and bmin.y < amax.y + margin
