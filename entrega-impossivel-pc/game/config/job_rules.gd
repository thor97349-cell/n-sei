class_name JobRules
extends RefCounted
## Como cada pedido é montado: nível de risco, modificadores e entregas especiais (raras).
##
##   Recompensa = (base + km × per_km do tipo) × risco × modificadores × bônus do nível
##   Prazo      = prazo do tipo × risco × modificadores
##
## Os modificadores "com bônus" só pagam o extra no fim se a condição for cumprida
## (ex.: URGENTE paga +45% se chegar no prazo). Os outros já mudam o valor do pedido.

## Níveis de risco. route = faixa de distância da rota (m; a cidade é compacta: as rotas
## vão de ~420 m a ~1,2 km); modifiers = quantos
## modificadores sorteia; rep = multiplica a reputação ganha; min_rank = nível exigido.
const TIERS := {
	"safe": {
		"icon": "🟢", "name_pt": "SEGURA", "name_en": "SAFE", "color": Color(0.18, 0.7, 0.4),
		"reward": 0.8, "time": 1.2, "route": Vector2(420.0, 760.0), "modifiers": 0, "mild_chance": 0.3,
		"rep": 1.0, "min_rank": 0,
	},
	"hard": {
		"icon": "🟡", "name_pt": "DIFÍCIL", "name_en": "HARD", "color": Color(0.95, 0.66, 0.1),
		"reward": 1.1, "time": 1.0, "route": Vector2(560.0, 99999.0), "modifiers": 1, "mild_chance": 0.0,
		"rep": 1.5, "min_rank": 0,
	},
	"risky": {
		"icon": "🔴", "name_pt": "ARRISCADA", "name_en": "RISKY", "color": Color(0.92, 0.25, 0.25),
		"reward": 1.35, "time": 0.92, "route": Vector2(650.0, 99999.0), "modifiers": 2, "mild_chance": 0.0,
		"rep": 2.2, "min_rank": 1,
	},
}
const TIER_ORDER := ["safe", "hard", "risky"]

## Modificadores. reward/time multiplicam o pedido; bonus = fração da recompensa paga no
## fim se `goal` for cumprido; fragility multiplica o dano das batidas; mild = pode
## aparecer em entregas seguras; skip_types = tipos de encomenda que não combinam.
const MODIFIERS := {
	"urgent": {
		"icon": "⏱", "name_pt": "Urgente", "name_en": "Rush",
		"desc_pt": "Prazo curto. +35% se chegar no prazo.", "desc_en": "Tight deadline. +35% if on time.",
		"reward": 1.0, "time": 0.78, "bonus": 0.35, "goal": "on_time", "mild": false,
		"skip_types": ["urgent", "fridge"],
	},
	"fragile": {
		"icon": "🍷", "name_pt": "Frágil", "name_en": "Fragile",
		"desc_pt": "Batidas estragam bem mais. Paga +15%.", "desc_en": "Crashes hurt a lot more. Pays +15%.",
		"reward": 1.15, "time": 1.0, "bonus": 0.0, "goal": "", "fragility": 1.7, "mild": false,
		"skip_types": ["document", "cake"],
	},
	"long_haul": {
		"icon": "⛽", "name_pt": "Longa distância", "name_en": "Long haul",
		"desc_pt": "Uma das rotas mais longas da cidade: mais combustível. Paga +12%.", "desc_en": "One of the longest routes in town: more fuel. Pays +12%.",
		"reward": 1.12, "time": 1.08, "bonus": 0.0, "goal": "", "min_route": 760.0, "mild": false,
		"skip_types": [],
	},
	"no_fines": {
		"icon": "🚦", "name_pt": "Sem multas", "name_en": "No fines",
		"desc_pt": "+20% se não levar nenhuma multa.", "desc_en": "+20% if you get no fines.",
		"reward": 1.0, "time": 1.0, "bonus": 0.2, "goal": "no_fines", "mild": true,
		"skip_types": [],
	},
	"perfect": {
		"icon": "⭐", "name_pt": "Entrega perfeita", "name_en": "Perfect delivery",
		"desc_pt": "+25% no prazo, com a carga intacta e sem multas.", "desc_en": "+25% on time, cargo intact and no fines.",
		"reward": 1.0, "time": 1.0, "bonus": 0.25, "goal": "perfect", "mild": true,
		"skip_types": [],
	},
}

## Carga "intacta" para ⭐ entrega perfeita e desafios (estado mínimo, %).
const INTACT := 95.0

## Adicionais pagos no fim (fração da recompensa): chuva durante boa parte da viagem e
## madrugada (22h–5h), como o "adicional noturno" dos entregadores.
const RAIN_BONUS := 0.15
const RAIN_MIN_FRACTION := 0.4
const NIGHT_BONUS := 0.1
const NIGHT_FROM := 22.0 * 60.0
const NIGHT_TO := 5.0 * 60.0

## Entregas especiais (raras). Aparecem depois de uma entrega, ficam no celular por
## SPECIAL_SECONDS e somem se ninguém aceitar. reward multiplica o pedido (min_reward =
## piso, para a especial nunca pagar como um pedido comum); client = quem
## pede (Clients); any_pickup = a coleta pode ser em qualquer lugar da cidade;
## mission = tipo de missão (por enquanto todas são "delivery"; ver Mission).
const SPECIALS := {
	"rush": {
		"icon": "🚨", "title_pt": "ENTREGA ESPECIAL", "title_en": "SPECIAL DELIVERY",
		"reward": 2.0, "min_reward": 400, "time": 1.0, "modifiers": ["urgent"], "tier": "hard", "min_rank": 0, "weight": 3.0,
		"client": "", "deadline": true, "any_pickup": false, "mission": "delivery",
	},
	"vip": {
		"icon": "👑", "title_pt": "CLIENTE VIP", "title_en": "VIP CLIENT",
		"reward": 2.2, "min_reward": 500, "time": 1.05, "modifiers": ["perfect"], "tier": "hard", "min_rank": 1, "weight": 2.5,
		"client": "valente", "deadline": false, "any_pickup": true, "mission": "delivery",
	},
	"confidential": {
		"icon": "🕶", "title_pt": "CARGA CONFIDENCIAL", "title_en": "CONFIDENTIAL CARGO",
		"reward": 2.0, "min_reward": 550, "time": 1.0, "modifiers": ["no_fines"], "tier": "risky", "min_rank": 1, "weight": 2.0,
		"client": "anonymous", "deadline": false, "any_pickup": true, "mission": "delivery",
	},
	"unique": {
		"icon": "💰", "title_pt": "OPORTUNIDADE ÚNICA", "title_en": "ONE-TIME OPPORTUNITY",
		"reward": 2.4, "min_reward": 700, "time": 1.0, "modifiers": ["long_haul", "fragile"], "tier": "risky", "min_rank": 2, "weight": 1.0,
		"client": "", "deadline": false, "any_pickup": false, "mission": "delivery",
	},
}
const SPECIAL_SECONDS := 150.0
## Chance de aparecer uma especial depois de cada entrega: base + "azar acumulado" por
## entrega sem especial, vezes o fator do nível de reputação. Nunca passa de SPECIAL_MAX.
const SPECIAL_BASE := 0.01
const SPECIAL_PER_DELIVERY := 0.012
const SPECIAL_MAX := 0.25
## Nenhuma especial nas primeiras entregas do jogo (o jogador ainda está aprendendo).
const SPECIAL_MIN_DELIVERIES := 4

## Chance de um evento (acidente na rota, tempestade, trânsito pesado) acontecer durante
## a entrega, por nível de risco.
const EVENT_CHANCE := {"safe": 0.12, "hard": 0.28, "risky": 0.45}


static func tier(id: String) -> Dictionary:
	return TIERS.get(id, TIERS["safe"])


static func tier_name(id: String) -> String:
	var data := tier(id)
	return data["name_pt"] if Loc.language == "pt" else data["name_en"]


static func modifier(id: String) -> Dictionary:
	return MODIFIERS.get(id, {})


static func modifier_name(id: String) -> String:
	var data := modifier(id)
	return data.get("name_pt" if Loc.language == "pt" else "name_en", id)


static func modifier_desc(id: String) -> String:
	var data := modifier(id)
	return data.get("desc_pt" if Loc.language == "pt" else "desc_en", "")


static func special(id: String) -> Dictionary:
	return SPECIALS.get(id, {})


static func special_title(id: String) -> String:
	var data := special(id)
	return data.get("title_pt" if Loc.language == "pt" else "title_en", "")


## O modificador combina com esse tipo de encomenda?
static func fits_type(modifier_id: String, type_id: String) -> bool:
	return not (modifier(modifier_id).get("skip_types", []) as Array).has(type_id)


static func is_night(clock_minutes: float) -> bool:
	return clock_minutes >= NIGHT_FROM or clock_minutes < NIGHT_TO
