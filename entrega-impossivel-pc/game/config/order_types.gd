class_name OrderTypes
extends RefCounted
## Tipos de encomenda.
##   Recompensa = base + km da rota × per_km
##   Prazo      = (metros da rota ÷ GameConfig.REFERENCE_SPEED) × time_factor + time_buffer
## size: "S" pequena, "M" média, "L" grande (só cabe em veículos com carga suficiente).
## fragility: multiplica o dano à carga em batidas e buracos (bolo = muito frágil).

const ORDER := ["pizza", "burger", "document", "medicine", "package", "urgent", "cake", "fridge"]

const DATA := {
	"pizza": {
		"icon": "🍕", "name_pt": "Pizza", "name_en": "Pizza", "tag_pt": "RÁPIDA", "tag_en": "QUICK",
		"tag_color": Color(1.0, 0.62, 0.26), "size": "S", "fragility": 1.2,
		"base": 60, "per_km": 110, "time_factor": 1.35, "time_buffer": 22.0, "weight": 3.0,
		"pickups": ["pizzaria"], "destinations": [],
	},
	"burger": {
		"icon": "🍔", "name_pt": "Hambúrguer", "name_en": "Burger", "tag_pt": "RÁPIDA", "tag_en": "QUICK",
		"tag_color": Color(1.0, 0.62, 0.26), "size": "S", "fragility": 0.8,
		"base": 55, "per_km": 100, "time_factor": 1.4, "time_buffer": 22.0, "weight": 3.0,
		"pickups": ["burger"], "destinations": [],
	},
	"document": {
		"icon": "📄", "name_pt": "Documentos", "name_en": "Documents", "tag_pt": "NORMAL", "tag_en": "STANDARD",
		"tag_color": Color(0.33, 0.63, 1.0), "size": "S", "fragility": 0.1,
		"base": 90, "per_km": 130, "time_factor": 1.7, "time_buffer": 30.0, "weight": 2.0,
		"pickups": ["notary", "city_hall"], "destinations": [],
	},
	"medicine": {
		"icon": "💊", "name_pt": "Remédio", "name_en": "Medicine", "tag_pt": "PRIORIDADE", "tag_en": "PRIORITY",
		"tag_color": Color(1.0, 0.42, 0.5), "size": "S", "fragility": 0.5,
		"base": 110, "per_km": 150, "time_factor": 1.35, "time_buffer": 22.0, "weight": 2.0,
		"pickups": ["pharmacy"],
		"destinations": ["hospital", "house_yellow", "house_blue", "house_green", "house_pink", "apartments", "condo", "farm", "fire_station", "school"],
	},
	"package": {
		"icon": "📦", "name_pt": "Pacote", "name_en": "Parcel", "tag_pt": "TRANQUILA", "tag_en": "RELAXED",
		"tag_color": Color(0.18, 0.84, 0.45), "size": "M", "fragility": 0.6,
		"base": 80, "per_km": 110, "time_factor": 1.95, "time_buffer": 40.0, "weight": 3.0,
		"pickups": ["distribution", "mall"], "destinations": [],
	},
	"urgent": {
		"icon": "⚡", "name_pt": "Pacote urgente", "name_en": "Urgent parcel", "tag_pt": "URGENTE", "tag_en": "URGENT",
		"tag_color": Color(1.0, 0.28, 0.34), "size": "M", "fragility": 0.6,
		"base": 200, "per_km": 260, "time_factor": 1.12, "time_buffer": 14.0, "weight": 1.2,
		"pickups": ["distribution"], "destinations": [],
	},
	"cake": {
		"icon": "🎂", "name_pt": "Bolo de festa", "name_en": "Party cake", "tag_pt": "FRÁGIL", "tag_en": "FRAGILE",
		"tag_color": Color(0.8, 0.5, 1.0), "size": "S", "fragility": 2.6,
		"base": 150, "per_km": 170, "time_factor": 1.6, "time_buffer": 30.0, "weight": 1.5,
		"pickups": ["bakery"], "destinations": [],
	},
	"fridge": {
		"icon": "🧊", "name_pt": "Geladeira", "name_en": "Fridge", "tag_pt": "CARGA GRANDE", "tag_en": "LARGE LOAD",
		"tag_color": Color(0.55, 0.85, 0.95), "size": "L", "fragility": 1.0,
		"base": 380, "per_km": 320, "time_factor": 2.0, "time_buffer": 60.0, "weight": 1.4,
		"pickups": ["distribution", "mall"], "destinations": ["house_yellow", "house_blue", "house_green", "house_pink", "apartments", "condo", "farm", "garage_shop"],
	},
}


static func get_type(id: String) -> Dictionary:
	return DATA.get(id, DATA["package"])


static func display_name(id: String) -> String:
	var data := get_type(id)
	return data["name_pt"] if Loc.language == "pt" else data["name_en"]


static func tag(id: String) -> String:
	var data := get_type(id)
	return data["tag_pt"] if Loc.language == "pt" else data["tag_en"]


## Quanto a encomenda aguenta batidas: 0 resistente (documentos), 1 normal,
## 2 sensível (comida, geladeira), 3 muito frágil (bolo).
static func fragility_level(id: String) -> int:
	var fragility := float(get_type(id)["fragility"])
	if fragility <= 0.2:
		return 0
	if fragility <= 0.7:
		return 1
	if fragility <= 1.5:
		return 2
	return 3


static func fragility_color(level: int) -> Color:
	return [Color(0.2, 0.72, 0.4), Color(0.45, 0.62, 0.85), Color(1.0, 0.6, 0.2), Color(1.0, 0.33, 0.38)][clampi(level, 0, 3)]
