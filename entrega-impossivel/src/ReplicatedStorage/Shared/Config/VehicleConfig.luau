--!strict
-- Veículos do jogo. Para adicionar um veículo novo no futuro:
--   1. Copie o bloco "Starter" com outro Id e ajuste Handling/Body/Price.
--   2. (Opcional) Coloque um Model pronto em ServerStorage.VehicleTemplates com o
--      mesmo nome do Id — ele será usado no lugar do modelo gerado por código
--      (precisa ter as partes "Chassis" e "DriverSeat"; veja VehicleBuilder).
-- A compra/garagem ainda não existe: todo jogador usa DefaultVehicleId.

export type Handling = {
	-- Velocidades em studs/s.
	MaxSpeed: number,
	ReverseSpeed: number,
	-- Acelerações em studs/s².
	Acceleration: number,
	ReverseAcceleration: number,
	BrakeDeceleration: number,
	CoastDeceleration: number,
	-- Rotação máxima em radianos/s e a velocidade a partir da qual ela é atingida.
	TurnRate: number,
	TurnSpeedReference: number,
	-- Aderência lateral: quanto maior, menos o carro "escorrega" nas curvas.
	Grip: number,
	HandbrakeGrip: number,
	WetGripMultiplier: number,
}

export type Body = {
	Style: string,
	PrimaryColor: Color3,
	SecondaryColor: Color3,
	-- Distância do centro do chassi até o chão (depende das rodas).
	GroundOffset: number,
}

export type VehicleDefinition = {
	Id: string,
	DisplayName: string,
	Description: string,
	Price: number,
	Handling: Handling,
	Body: Body,
}

local VehicleConfig = {}

VehicleConfig.Vehicles = {
	Starter = {
		Id = "Starter",
		DisplayName = "Pé-de-Boi",
		Description = "O furgãozinho da firma. Lento, confiável e com cheiro de pizza.",
		Price = 0,
		Handling = {
			MaxSpeed = 60,
			ReverseSpeed = 22,
			Acceleration = 28,
			ReverseAcceleration = 22,
			BrakeDeceleration = 85,
			CoastDeceleration = 14,
			TurnRate = 2.3,
			TurnSpeedReference = 16,
			Grip = 9,
			HandbrakeGrip = 1.6,
			WetGripMultiplier = 0.55,
		},
		Body = {
			Style = "Van",
			PrimaryColor = Color3.fromRGB(255, 196, 0),
			SecondaryColor = Color3.fromRGB(245, 245, 245),
			GroundOffset = 1.7,
		},
	},
} :: { [string]: VehicleDefinition }

function VehicleConfig.Get(vehicleId: string): VehicleDefinition?
	return VehicleConfig.Vehicles[vehicleId]
end

-- Usado pelo anti-exploit das entregas.
function VehicleConfig.GetFastestSpeed(): number
	local fastest = 0
	for _, definition in VehicleConfig.Vehicles do
		fastest = math.max(fastest, definition.Handling.MaxSpeed)
	end
	return fastest
end

return VehicleConfig
