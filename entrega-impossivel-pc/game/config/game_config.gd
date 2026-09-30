class_name GameConfig
extends RefCounted
## Números gerais do jogo. Ajuste aqui em vez de mexer nos sistemas.

## Velocidade média (m/s) usada para calcular prazos (≈ 40 km/h com semáforos e curvas).
const REFERENCE_SPEED := 11.0
const OFFERS_ON_PHONE := 3
const REFRESH_COOLDOWN := 10.0
const MIN_ROUTE_METERS := 420.0
## Segundos parado na vaga para carregar/entregar.
const LOAD_SECONDS := 2.0
## Velocidade máxima (m/s) considerada "parado" na vaga.
const STOP_SPEED := 1.6
const RESULT_SECONDS := 5.0
const LATE_GRACE_SECONDS := 40.0
const LATE_MULTIPLIER := 0.4
const BONUS_TIERS := [
	{"min_fraction": 0.45, "multiplier": 0.35},
	{"min_fraction": 0.25, "multiplier": 0.15},
]
## Gorjeta máxima (fração da recompensa) para 5 estrelas.
const MAX_TIP := 0.2
## Dano à carga: impacto (m/s de variação brusca) acima deste valor começa a estragar.
const CARGO_IMPACT_THRESHOLD := 3.5
const CARGO_DAMAGE_PER_IMPACT := 6.0

const FUEL_PRICE_PER_LITER := 1.4
const TOW_PRICE := 150
## Multa por avançar o sinal vermelho: 25% do saldo, entre R$ 15 e R$ 80 (no começo do
## jogo, com pouco dinheiro, a multa pesa menos; nunca deixa o saldo negativo).
const RED_LIGHT_FINE := 80
const RED_LIGHT_FINE_MIN := 15
const RED_LIGHT_FINE_SHARE := 0.25

## Relógio: minutos do jogo por segundo real (1 dia = 24 minutos reais).
const CLOCK_SPEED := 1.0
const AUTOSAVE_SECONDS := 60.0

## Eventos aleatórios: segundos entre eventos e duração (mín, máx).
const EVENT_FIRST_DELAY := Vector2(100.0, 160.0)
const EVENT_INTERVAL := Vector2(160.0, 260.0)
const EVENT_DURATION := {
	"accident": Vector2(80.0, 120.0),
	"storm": Vector2(90.0, 150.0),
	"shortcut": Vector2(60.0, 85.0),
}


## Valor da multa do sinal vermelho para quem tem `balance` de saldo.
static func red_light_fine(balance: int) -> int:
	var amount := clampi(roundi(float(balance) * RED_LIGHT_FINE_SHARE), RED_LIGHT_FINE_MIN, RED_LIGHT_FINE)
	return mini(amount, maxi(balance, 0))
