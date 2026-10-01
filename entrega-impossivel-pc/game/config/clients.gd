class_name Clients
extends RefCounted
## Clientes e empresas da cidade (recorrentes), os contratos que oferecem e as falas que
## dão personalidade aos pedidos. É também o ponto de partida para a história do jogo:
## cada cliente tem uma pessoa ("person") e falas; o progresso com cada um fica salvo em
## Career.clients (entregas feitas, nível do relacionamento).
##
## location = local do mapa (CityLayout) ligado ao cliente; role "pickup" = as encomendas
## saem de lá, "dropoff" = vão para lá; types = tipos de encomenda (OrderTypes);
## contracts = oferece contratos; min_rank = nível de reputação para aparecer.

const DATA := {
	"bella_napoli": {
		"name": "Pizzaria Bella Napoli", "icon": "🍕", "kind": "restaurant", "person": "Dona Giulia",
		"location": "pizzaria", "role": "pickup", "types": ["pizza"], "contracts": true, "min_rank": 0,
		"lines_pt": ["A pizza tem que chegar quentinha!", "Capricha, que esse cliente é exigente."],
		"lines_en": ["The pizza has to arrive hot!", "Do it right, this customer is picky."],
	},
	"burger_boom": {
		"name": "Burger Boom", "icon": "🍔", "kind": "restaurant", "person": "Beto",
		"location": "burger", "role": "pickup", "types": ["burger"], "contracts": true, "min_rank": 0,
		"lines_pt": ["Hambúrguer frio ninguém merece.", "Sexta-feira é dia de pedido sem parar!"],
		"lines_en": ["Nobody deserves a cold burger.", "Fridays never stop!"],
	},
	"pao_de_ouro": {
		"name": "Padaria Pão de Ouro", "icon": "🎂", "kind": "shop", "person": "Dona Lurdes",
		"location": "bakery", "role": "pickup", "types": ["cake"], "contracts": true, "min_rank": 0,
		"lines_pt": ["Esse bolo é de casamento. Cuidado nas curvas!", "Três andares de chantilly, meu filho."],
		"lines_en": ["This is a wedding cake. Careful on the turns!", "Three tiers of whipped cream, dear."],
	},
	"vida_mais": {
		"name": "Farmácia Vida+", "icon": "💊", "kind": "shop", "person": "Dr. Sérgio",
		"location": "pharmacy", "role": "pickup", "types": ["medicine"], "contracts": true, "min_rank": 0,
		"lines_pt": ["Tem gente esperando por esse remédio.", "Receita urgente, não pode atrasar."],
		"lines_en": ["Someone is waiting for this medicine.", "Urgent prescription, can't be late."],
	},
	"cartorio": {
		"name": "Cartório Central", "icon": "📄", "kind": "office", "person": "Seu Amadeu",
		"location": "notary", "role": "pickup", "types": ["document"], "contracts": true, "min_rank": 0,
		"lines_pt": ["Precisa de assinatura ainda hoje.", "Documento original, não amasse."],
		"lines_en": ["Needs a signature today.", "Original document, don't crease it."],
	},
	"distribuicao": {
		"name": "Centro de Distribuição", "icon": "📦", "kind": "company", "person": "Marta",
		"location": "distribution", "role": "pickup", "types": ["package", "urgent"], "contracts": true, "min_rank": 0,
		"lines_pt": ["O caminhão atrasou, conto com você.", "Pico de pedidos hoje!"],
		"lines_en": ["The truck is late, I'm counting on you.", "Peak orders today!"],
	},
	"shopping": {
		"name": "Shopping Centro", "icon": "🛍", "kind": "store", "person": "Gerente Paulo",
		"location": "mall", "role": "pickup", "types": ["package", "fridge"], "contracts": true, "min_rank": 1,
		"lines_pt": ["Liquidação! Os pedidos não param.", "Cliente comprou e quer receber hoje."],
		"lines_en": ["Big sale! Orders keep coming.", "Customer bought it and wants it today."],
	},
	"preco_bom": {
		"name": "Supermercado Preço Bom", "icon": "🛒", "kind": "market", "person": "Seu Joaquim",
		"location": "supermarket", "role": "dropoff", "types": ["package", "urgent"], "contracts": true, "min_rank": 1,
		"lines_pt": ["Estoque acabando, manda rápido!", "A prateleira está vazia."],
		"lines_en": ["We're running out of stock, hurry!", "The shelf is empty."],
	},
	"valente": {
		"name": "Sr. Valente", "icon": "👑", "kind": "vip", "person": "Sr. Valente",
		"location": "tower", "role": "dropoff", "types": ["document", "urgent", "package"], "contracts": true, "min_rank": 2,
		"lines_pt": ["Cliente VIP — pagamento alto, exigência mais alta ainda.", "O Sr. Valente não gosta de esperar."],
		"lines_en": ["VIP client — high pay, higher standards.", "Mr. Valente doesn't like to wait."],
	},
	"anonymous": {
		"name": "Remetente anônimo", "icon": "🕶", "kind": "mystery", "person": "???",
		"location": "", "role": "pickup", "types": ["package"], "contracts": false, "min_rank": 1,
		"lines_pt": ["Não abra esta encomenda.", "Não faça perguntas. Não chame atenção."],
		"lines_en": ["Do not open this package.", "Ask no questions. Draw no attention."],
	},
}

const KINDS := {
	"restaurant": ["Restaurante", "Restaurant"], "shop": ["Comércio", "Shop"], "office": ["Escritório", "Office"],
	"company": ["Empresa", "Company"], "store": ["Loja", "Store"], "market": ["Mercado", "Market"],
	"vip": ["Cliente VIP", "VIP client"], "mystery": ["Desconhecido", "Unknown"],
}

## Objetivos de contrato e a partir de que nível de contrato aparecem.
##   count: entregas concluídas • on_time: no prazo • intact: carga ≥ CONTRACT_INTACT%
##   region: entregas numa região • perfect: no prazo, intacta e sem multa
##   streak: entregas seguidas no prazo (atraso/falha zera o progresso)
const GOALS := {
	"count": 1, "on_time": 2, "intact": 2, "region": 3, "perfect": 3, "streak": 4,
}
const CONTRACT_INTACT := 90.0
## Por nível do contrato (1..4): entregas pedidas, pagamento por entrega e reputação.
const LEVEL_TARGET := [0, 3, 4, 5, 6]
const LEVEL_PAY := [0, 55, 80, 110, 150]
const LEVEL_REP := [0, 20, 35, 55, 80]
const MAX_LEVEL := 4


static func get_client(id: String) -> Dictionary:
	return DATA.get(id, {})


static func display_name(id: String) -> String:
	return get_client(id).get("name", id)


static func kind_name(id: String) -> String:
	var pair: Array = KINDS.get(get_client(id).get("kind", ""), ["", ""])
	return pair[0] if Loc.language == "pt" else pair[1]


static func line(id: String, rng: RandomNumberGenerator) -> String:
	var lines: Array = get_client(id).get("lines_pt" if Loc.language == "pt" else "lines_en", [])
	return "" if lines.is_empty() else lines[rng.randi() % lines.size()]


## Clientes que oferecem contratos para este nível de reputação.
static func contract_clients(rank: int) -> Array[String]:
	var result: Array[String] = []
	for id: String in DATA:
		var client: Dictionary = DATA[id]
		if client["contracts"] and int(client["min_rank"]) <= rank:
			result.append(id)
	return result


## A encomenda `offer` conta para este cliente?
static func matches(id: String, offer: Dictionary) -> bool:
	var client := get_client(id)
	if client.is_empty() or not (client["types"] as Array).has(offer.get("type", "")):
		return false
	if client["role"] == "dropoff":
		return offer.get("dropoff_id", "") == client["location"]
	return offer.get("pickup_id", "") == client["location"]


## O que o contrato pede, em texto ("Faça 4 entregas no prazo").
static func goal_text(contract: Dictionary) -> String:
	var region := CityLayout.region_name(contract.get("region", "")) if contract.get("region", "") != "" else ""
	return Loc.t("goal." + str(contract["goal"]), [contract["target"], display_name(contract["client"]), roundi(CONTRACT_INTACT), region])


## Monta um contrato de `level` (1..4) para o cliente.
static func make_contract(id: String, level: int, rng: RandomNumberGenerator, serial: int) -> Dictionary:
	level = clampi(level, 1, MAX_LEVEL)
	var goals: Array[String] = []
	for goal: String in GOALS:
		if int(GOALS[goal]) <= level:
			goals.append(goal)
	# Contratos mais altos preferem objetivos mais exigentes.
	var goal: String = goals[rng.randi() % goals.size()]
	if level >= 3 and goal == "count":
		goal = goals[goals.size() - 1 - rng.randi() % 2]
	var target: int = LEVEL_TARGET[level]
	if goal == "perfect" or goal == "streak":
		target = maxi(target - 1, 2)
	var region := ""
	if goal == "region":
		var regions := CityLayout.REGIONS.keys().filter(func(r: String) -> bool: return r != "rural")
		# Clientes que recebem (mercado, VIP) não escolhem a região do destino.
		if get_client(id)["role"] == "dropoff":
			goal = "on_time"
		else:
			region = regions[rng.randi() % regions.size()]
	var pay_factor := 1.0 + (0.25 if goal in ["perfect", "streak", "region"] else 0.0)
	return {
		"id": "c%d" % serial,
		"client": id,
		"level": level,
		"goal": goal,
		"target": target,
		"region": region,
		"progress": 0,
		"reward": int(snappedf(float(LEVEL_PAY[level]) * target * pay_factor, 10.0)),
		"rep": int(LEVEL_REP[level]),
	}
