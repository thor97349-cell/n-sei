class_name Challenges
extends RefCounted
## Desafios rápidos (objetivos secundários). Sempre há alguns ativos (CareerRules.RANKS
## "challenges"); ao completar um, ele paga na hora e outro aparece no lugar.
##
## kind: como o progresso conta (ver Career._challenge_progress)
##   intact_streak: entregas seguidas com a carga intacta (dano zera)
##   under_time:    uma entrega concluída em menos de `value` segundos (da coleta à entrega)
##   no_fines:      entregas sem multa (uma multa zera)
##   fuel:          uma entrega de pelo menos 600 m gastando menos que fuel_limit() L/km
##   tier:          entregas de nível difícil ou arriscado
##   combo:         chegar ao combo `target` (relative: alvo = combo atual + o sorteado)
##   perfect:       entregas perfeitas
##   night:         uma entrega à noite (só aparece perto da noite)
## targets/values: um é sorteado; reward = pagamento base (vezes target quando per_target).

const DATA := {
	"intact_streak": {"targets": [3, 4], "reward": 40, "per_target": true, "min_rank": 0},
	"under_time": {"targets": [1], "values": [90.0, 105.0, 120.0], "reward": 100, "per_target": false, "min_rank": 0},
	"no_fines": {"targets": [3, 4], "reward": 30, "per_target": true, "min_rank": 0},
	"fuel": {"targets": [1], "reward": 90, "per_target": false, "min_rank": 0},
	"tier": {"targets": [2, 3], "reward": 40, "per_target": true, "min_rank": 0},
	"combo": {"targets": [3, 4], "reward": 30, "per_target": true, "min_rank": 0, "relative": true},
	"perfect": {"targets": [2, 3], "reward": 45, "per_target": true, "min_rank": 1},
	"night": {"targets": [1], "reward": 100, "per_target": false, "min_rank": 0},
}
## Entregas de espera até aparecer um desafio novo no lugar de um concluído.
const COOLDOWN_DELIVERIES := 3
## Consumo "econômico" do desafio de combustível: fração do consumo normal do veículo.
const FUEL_FRACTION := 0.8
const FUEL_MIN_ROUTE := 600.0


## Texto do desafio (com progresso quando faz sentido).
static func text(challenge: Dictionary) -> String:
	var kind: String = challenge.get("kind", "")
	var target := int(challenge.get("target", 1))
	match kind:
		"under_time":
			return Loc.t("challenge.under_time", [UiKit.clock(float(challenge.get("value", 120.0)))])
		"fuel":
			return Loc.t("challenge.fuel", ["%.1f" % fuel_limit(GameState.current_vehicle)])
	var key := "challenge." + kind
	if target == 1 and Loc.has(key + "_1"):
		key += "_1"
	return Loc.t(key, [target])


## Monta um desafio novo (evita repetir os tipos de `avoid`).
static func make(rng: RandomNumberGenerator, rank: int, avoid: Array, clock_minutes: float, combo: int = 0) -> Dictionary:
	var kinds: Array[String] = []
	for kind: String in DATA:
		if avoid.has(kind) or int(DATA[kind]["min_rank"]) > rank:
			continue
		# Desafio da noite só quando a noite está chegando (ou já é noite).
		if kind == "night" and not (clock_minutes >= 17.0 * 60.0 or clock_minutes < 4.0 * 60.0):
			continue
		kinds.append(kind)
	if kinds.is_empty():
		kinds.append("tier")
	var kind: String = kinds[rng.randi() % kinds.size()]
	var data: Dictionary = DATA[kind]
	var targets: Array = data["targets"]
	var target := int(targets[rng.randi() % targets.size()])
	var value := 0.0
	if data.has("values"):
		var values: Array = data["values"]
		value = float(values[rng.randi() % values.size()])
	var reward := int(data["reward"]) * (target if data["per_target"] else 1)
	var progress := 0
	if data.get("relative", false):
		target += combo
		progress = combo
	return {"kind": kind, "target": target, "value": value, "progress": progress, "reward": reward}


## Consumo máximo (L/km) do desafio de economia, para o veículo usado.
static func fuel_limit(vehicle_id: String) -> float:
	return snappedf(VehicleSpecs.liters_per_km(vehicle_id) * FUEL_FRACTION, 0.1)
