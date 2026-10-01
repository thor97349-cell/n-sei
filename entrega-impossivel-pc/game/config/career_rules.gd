class_name CareerRules
extends RefCounted
## Reputação (níveis), combo de entregas e o que cada nível libera.
##
## A reputação sobe com entregas (mais nas difíceis/arriscadas), entregas perfeitas,
## contratos e combos; cai com falhas, carga muito danificada e multas. Ela nunca cai
## abaixo do começo do nível já alcançado: o jogador não perde o que desbloqueou.

## rep = reputação mínima; reward_bonus = extra em todos os pedidos; offers = pedidos no
## celular; contract_level = contrato mais alto oferecido; contracts = contratos ativos ao
## mesmo tempo; challenges = desafios ativos; special_factor = multiplica a chance de
## aparecer entrega especial; farm = libera entregas na Chácara (zona rural).
const RANKS := [
	{
		"id": "rookie", "name_pt": "Novato", "name_en": "Rookie", "rep": 0,
		"reward_bonus": 0.0, "offers": 3, "contract_level": 1, "contracts": 1, "challenges": 2,
		"special_factor": 1.0, "farm": false,
		"unlocks_pt": "", "unlocks_en": "",
	},
	{
		"id": "trusted", "name_pt": "Confiável", "name_en": "Trusted", "rep": 120,
		"reward_bonus": 0.02, "offers": 3, "contract_level": 2, "contracts": 1, "challenges": 2,
		"special_factor": 1.15, "farm": true,
		"unlocks_pt": "Entregas arriscadas, Chácara (zona rural), cliente VIP, carga confidencial e +2% em tudo",
		"unlocks_en": "Risky jobs, the Farm (countryside), VIP client, confidential cargo and +2% on everything",
	},
	{
		"id": "pro", "name_pt": "Profissional", "name_en": "Professional", "rep": 400,
		"reward_bonus": 0.04, "offers": 4, "contract_level": 3, "contracts": 2, "challenges": 3,
		"special_factor": 1.3, "farm": true,
		"unlocks_pt": "4 pedidos no celular, 2 contratos ao mesmo tempo, 3 desafios, oportunidades únicas e +4% em tudo",
		"unlocks_en": "4 orders on the phone, 2 contracts at once, 3 challenges, one-time opportunities and +4% on everything",
	},
	{
		"id": "expert", "name_pt": "Especialista", "name_en": "Expert", "rep": 1000,
		"reward_bonus": 0.07, "offers": 4, "contract_level": 4, "contracts": 2, "challenges": 3,
		"special_factor": 1.45, "farm": true,
		"unlocks_pt": "Os melhores contratos, mais entregas especiais e +7% em tudo",
		"unlocks_en": "The best contracts, more special deliveries and +7% on everything",
	},
]

## Reputação por entrega concluída (vezes o "rep" do nível de risco).
const REP_DELIVERY := 10
const REP_LATE_DELIVERY := 2
const REP_PERFECT := 4
const REP_FAILED := -15
## Carga entregue abaixo deste estado (%) conta como "muito danificada".
const SEVERE_DAMAGE := 50.0
const REP_SEVERE_DAMAGE := -6
const REP_FINE := -4
## Cancelar com a encomenda já no carro conta como falha.
const REP_CANCEL_LOADED := -10
const REP_CONTRACT_ABANDON := -3
## Reputação extra ao chegar nestes combos.
const COMBO_MILESTONES := {3: 5, 5: 10, 8: 15, 12: 25}

## Combo: entrega no prazo e com a carga acima de SEVERE_DAMAGE soma 1. Bônus (fração do
## valor da entrega) pelo combo atual. Atraso corta o combo pela metade; falha, cancelar
## com a carga ou carga muito danificada zeram; multa tira 1.
const COMBO_BONUS := [[15, 0.2], [10, 0.15], [6, 0.1], [4, 0.06], [2, 0.03]]


static func rank_for(reputation: int) -> int:
	var result := 0
	for i in RANKS.size():
		if reputation >= int(RANKS[i]["rep"]):
			result = i
	return result


static func rank_info(rank: int) -> Dictionary:
	return RANKS[clampi(rank, 0, RANKS.size() - 1)]


static func rank_name(rank: int) -> String:
	var info := rank_info(rank)
	return info["name_pt"] if Loc.language == "pt" else info["name_en"]


static func rank_unlocks(rank: int) -> String:
	var info := rank_info(rank)
	return info["unlocks_pt"] if Loc.language == "pt" else info["unlocks_en"]


## Reputação que falta para o próximo nível (-1 no último).
static func next_rank_rep(rank: int) -> int:
	if rank + 1 >= RANKS.size():
		return -1
	return int(RANKS[rank + 1]["rep"])


static func combo_bonus(combo: int) -> float:
	for pair: Array in COMBO_BONUS:
		if combo >= int(pair[0]):
			return float(pair[1])
	return 0.0


## Combo depois de uma entrega concluída.
static func combo_after(combo: int, late: bool, condition: float) -> int:
	if condition < SEVERE_DAMAGE:
		return 0
	if late:
		return combo / 2
	return combo + 1
