class_name PedestrianLooks
extends RefCounted
## Sorteia a aparência de um pedestre: roupa (cor e tipo de cima, tipo e cor de baixo) e
## estilo (pele, cabelo, cor do cabelo, mochila/bolsa, guarda-chuva, celular). Devolve
## dois inteiros que o pedestrian.gdshader decodifica (mesma ordem do cabeçalho de lá).
## Os pesos deixam a rua com cara de rua: mais camiseta e calça jeans, alguns de jaqueta,
## bermuda, saia ou vestido, bonés, mochilas...

## [valor, peso]
const TOPS := [[0, 0.55], [2, 0.25], [3, 0.2]]
const BOTTOMS := [[0, 0.55], [2, 0.2], [3, 0.25]]
const BOTTOM_COLORS := [[0, 0.24], [1, 0.14], [2, 0.14], [3, 0.12], [4, 0.1], [5, 0.08], [6, 0.06], [7, 0.06], [8, 0.06]]
const HAIR_SKIRT := [[0, 0.1], [2, 0.45], [3, 0.25], [4, 0.12], [5, 0.08]]
const HAIR_OTHER := [[0, 0.58], [2, 0.06], [3, 0.03], [4, 0.13], [5, 0.2]]
const HAIR_COLORS := [[0, 0.36], [1, 0.3], [2, 0.16], [3, 0.1], [4, 0.08]]
const ACCESSORIES := [[0, 0.58], [1, 0.26], [2, 0.16]]


## Vector2i(roupa, estilo).
static func random(rng: RandomNumberGenerator) -> Vector2i:
	var shirt := rng.randi() % 14
	var top: int = _pick(TOPS, rng)
	var bottom: int = _pick(BOTTOMS, rng)
	var bottom_color: int = _pick(BOTTOM_COLORS, rng)
	var skin := rng.randi() % 5
	var hair: int = _pick(HAIR_SKIRT if bottom == 3 else HAIR_OTHER, rng)
	var hair_color: int = _pick(HAIR_COLORS, rng)
	var accessory: int = _pick(ACCESSORIES, rng)
	var umbrella := 1 if rng.randf() < 0.55 else 0
	var phone := 1 if rng.randf() < 0.5 else 0
	return Vector2i(encode_outfit(shirt, top, bottom, bottom_color), encode_style(skin, hair, hair_color, accessory, umbrella, phone))


static func encode_outfit(shirt: int, top: int, bottom: int, bottom_color: int) -> int:
	return shirt + 14 * top + 56 * bottom + 224 * bottom_color


static func encode_style(skin: int, hair: int, hair_color: int, accessory: int, umbrella: int, phone: int) -> int:
	return skin + 5 * hair + 30 * hair_color + 150 * accessory + 450 * umbrella + 900 * phone


static func _pick(table: Array, rng: RandomNumberGenerator) -> int:
	var total := 0.0
	for entry: Array in table:
		total += float(entry[1])
	var roll := rng.randf() * total
	for entry: Array in table:
		roll -= float(entry[1])
		if roll <= 0.0:
			return int(entry[0])
	return int(table[0][0])
