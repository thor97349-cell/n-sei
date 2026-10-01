class_name VehicleSpecs
extends RefCounted
## Ficha técnica dos veículos (valores próximos de carros reais).
## Para criar um veículo novo, copie um bloco, mude o id e ajuste os números.
##
## torque: torque máximo do motor (N·m)   gears: relações de marcha   final_drive: diferencial
## cargo: maior tamanho de encomenda aceito ("S", "M" ou "L")
## grip: coeficiente de atrito do pneu (≈ aceleração lateral máxima em g × 1,1)

const ORDER := ["van", "hatch", "truck", "sport"]

const DATA := {
	"van": {
		"name": "Pé-de-Boi",
		"description_pt": "O furgão da firma. Confiável, espaçoso e nada rápido.",
		"description_en": "The company van. Reliable, roomy and not fast at all.",
		"price": 0,
		"style": "van", "limiter_kmh": 150.0,
		"length": 4.7, "width": 1.9, "height": 2.05,
		"wheelbase": 2.9, "track": 1.62, "wheel_radius": 0.34, "wheel_width": 0.23,
		"mass": 1650.0, "torque": 230.0, "torque_peak_rpm": 2800.0, "idle_rpm": 850.0, "max_rpm": 5600.0,
		"gears": [3.9, 2.25, 1.45, 1.05, 0.82], "reverse_gear": 3.6, "final_drive": 4.3,
		"drive": "front", "brake_decel": 8.0, "steer_angle": 0.62, "drag": 0.42,
		"grip": 1.05, "stiffness": 26.0, "rest_length": 0.26, "travel": 0.2,
		"damping_compression": 1.7, "damping_relaxation": 2.6, "center_of_mass_y": -0.05,
		"fuel_capacity": 60.0, "consumption": 1.0,
		"cargo": "M",
		"color": Color(0.96, 0.74, 0.06),
		"stats": {"speed": 2, "accel": 2, "handling": 3, "cargo": 4},
	},
	"hatch": {
		"name": "Faísca",
		"description_pt": "Hatch ligeiro e esperto. Ótimo para comida, péssimo para caixas.",
		"description_en": "Quick, nimble hatchback. Great for food, bad for boxes.",
		"price": 10500,
		"style": "hatch", "limiter_kmh": 185.0,
		"length": 4.05, "width": 1.76, "height": 1.47,
		"wheelbase": 2.55, "track": 1.52, "wheel_radius": 0.31, "wheel_width": 0.21,
		"mass": 1120.0, "torque": 172.0, "torque_peak_rpm": 3500.0, "idle_rpm": 850.0, "max_rpm": 6800.0,
		"gears": [3.6, 2.1, 1.45, 1.1, 0.88], "reverse_gear": 3.5, "final_drive": 4.1,
		"drive": "front", "brake_decel": 9.5, "steer_angle": 0.62, "drag": 0.30,
		"grip": 1.15, "stiffness": 32.0, "rest_length": 0.22, "travel": 0.17,
		"damping_compression": 1.9, "damping_relaxation": 2.9, "center_of_mass_y": -0.1,
		"fuel_capacity": 45.0, "consumption": 0.8,
		"cargo": "S",
		"color": Color(0.85, 0.12, 0.12),
		"stats": {"speed": 4, "accel": 4, "handling": 4, "cargo": 1},
	},
	"truck": {
		"name": "Brutão",
		"description_pt": "Caminhão baú. Lento e pesado, mas leva geladeira, sofá e mudança.",
		"description_en": "Box truck. Slow and heavy, but hauls fridges, sofas and house moves.",
		"price": 25000,
		"style": "truck", "limiter_kmh": 110.0,
		"length": 6.6, "width": 2.2, "height": 3.0,
		"wheelbase": 3.9, "track": 1.8, "wheel_radius": 0.42, "wheel_width": 0.28,
		"mass": 3900.0, "torque": 520.0, "torque_peak_rpm": 1800.0, "idle_rpm": 700.0, "max_rpm": 3800.0,
		"gears": [5.2, 3.0, 1.9, 1.35, 1.0, 0.8], "reverse_gear": 4.8, "final_drive": 4.6,
		"drive": "rear", "brake_decel": 7.0, "steer_angle": 0.58, "drag": 0.75,
		"grip": 0.95, "stiffness": 24.0, "rest_length": 0.3, "travel": 0.22,
		"damping_compression": 1.8, "damping_relaxation": 2.8, "center_of_mass_y": -0.2,
		"fuel_capacity": 120.0, "consumption": 2.2,
		"cargo": "L",
		"color": Color(0.92, 0.93, 0.95),
		"stats": {"speed": 1, "accel": 1, "handling": 2, "cargo": 5},
	},
	"sport": {
		"name": "Relâmpago",
		"description_pt": "Esportivo de verdade. Chega antes de todo mundo — se não bater.",
		"description_en": "A real sports car. Gets there first — if it doesn't crash.",
		"price": 58000,
		"style": "sport", "limiter_kmh": 250.0,
		"length": 4.45, "width": 1.92, "height": 1.24,
		"wheelbase": 2.62, "track": 1.64, "wheel_radius": 0.33, "wheel_width": 0.26,
		"mass": 1380.0, "torque": 470.0, "torque_peak_rpm": 4500.0, "idle_rpm": 950.0, "max_rpm": 7800.0,
		"gears": [3.3, 2.2, 1.65, 1.3, 1.05, 0.86], "reverse_gear": 3.2, "final_drive": 3.7,
		"drive": "rear", "brake_decel": 11.0, "steer_angle": 0.58, "drag": 0.26,
		"grip": 1.35, "stiffness": 42.0, "rest_length": 0.18, "travel": 0.14,
		"damping_compression": 2.3, "damping_relaxation": 3.4, "center_of_mass_y": -0.15,
		"fuel_capacity": 65.0, "consumption": 1.5,
		"cargo": "S",
		"color": Color(0.07, 0.3, 0.85),
		"stats": {"speed": 5, "accel": 5, "handling": 5, "cargo": 1},
	},
}

const CARGO_RANK := {"S": 1, "M": 2, "L": 3}


static func has(id: String) -> bool:
	return DATA.has(id)


static func get_spec(id: String) -> Dictionary:
	return DATA.get(id, DATA["van"])


static func can_carry(vehicle_id: String, cargo_size: String) -> bool:
	var spec := get_spec(vehicle_id)
	return int(CARGO_RANK.get(spec["cargo"], 1)) >= int(CARGO_RANK.get(cargo_size, 1))


## Velocidade máxima teórica (m/s) limitada pela rotação na última marcha.
static func top_speed(id: String) -> float:
	var spec := get_spec(id)
	var gears: Array = spec["gears"]
	var last: float = gears[gears.size() - 1]
	var wheel_rpm: float = spec["max_rpm"] / (last * spec["final_drive"])
	return wheel_rpm * TAU * spec["wheel_radius"] / 60.0


## Consumo típico (litros por km) dirigindo normalmente na cidade: o mesmo cálculo do
## Vehicle (consumo × escala × acelerador médio) mais o motor em marcha lenta.
static func liters_per_km(id: String) -> float:
	var spec := get_spec(id)
	var driving := float(spec["consumption"]) * (0.35 + 0.65 * 0.5)
	var idle := Vehicle.IDLE_FUEL_PER_SECOND * 1000.0 / GameConfig.REFERENCE_SPEED
	return (driving + idle) * GameConfig.FUEL_CONSUMPTION_SCALE
