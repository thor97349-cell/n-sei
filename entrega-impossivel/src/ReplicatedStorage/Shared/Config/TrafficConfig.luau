--!strict
-- Trânsito simples: carros que circulam em circuitos fixos pelas ruas.
-- Cada cliente simula os carros localmente a partir do relógio do servidor, então todos
-- os jogadores veem o trânsito praticamente no mesmo lugar sem custo de rede.
-- Os carros param quando há um jogador (ou outro carro) logo à frente.

export type Loop = {
	Name: string,
	-- Cruzamentos (x, z) visitados em ordem; o último volta para o primeiro.
	Points: { Vector2 },
	-- Distância do centro da rua até o centro da faixa (mão direita).
	LaneOffset: number,
	Cars: number,
	Speed: number,
}

local TrafficConfig = {}

TrafficConfig.Enabled = true

TrafficConfig.Loops = {
	{
		Name = "Centro",
		Points = { Vector2.new(-160, -160), Vector2.new(160, -160), Vector2.new(160, 160), Vector2.new(-160, 160) },
		LaneOffset = 6,
		Cars = 4,
		Speed = 26,
	},
	{
		Name = "Leste",
		Points = { Vector2.new(160, -160), Vector2.new(480, -160), Vector2.new(480, 160), Vector2.new(160, 160) },
		LaneOffset = 6,
		Cars = 3,
		Speed = 28,
	},
	{
		Name = "Oeste",
		Points = { Vector2.new(-480, -480), Vector2.new(-160, -480), Vector2.new(-160, -160), Vector2.new(-480, -160) },
		LaneOffset = 6,
		Cars = 3,
		Speed = 28,
	},
	{
		Name = "RodoviaHorario",
		Points = { Vector2.new(-760, -760), Vector2.new(760, -760), Vector2.new(760, 760), Vector2.new(-760, 760) },
		LaneOffset = 20,
		Cars = 4,
		Speed = 42,
	},
	{
		Name = "RodoviaAntiHorario",
		Points = { Vector2.new(-760, -760), Vector2.new(-760, 760), Vector2.new(760, 760), Vector2.new(760, -760) },
		LaneOffset = 20,
		Cars = 4,
		Speed = 42,
	},
} :: { Loop }

TrafficConfig.CarColors = {
	Color3.fromRGB(231, 76, 60),
	Color3.fromRGB(52, 152, 219),
	Color3.fromRGB(46, 204, 113),
	Color3.fromRGB(155, 89, 182),
	Color3.fromRGB(236, 240, 241),
	Color3.fromRGB(52, 73, 94),
	Color3.fromRGB(26, 188, 156),
	Color3.fromRGB(241, 196, 15),
}

-- Carros de trânsito só são desenhados perto do jogador (economiza desempenho).
TrafficConfig.RenderDistance = 700
-- Distância à frente em que o carro de trânsito freia por causa de um obstáculo.
TrafficConfig.BrakeDistance = 20
TrafficConfig.Acceleration = 18

return TrafficConfig
