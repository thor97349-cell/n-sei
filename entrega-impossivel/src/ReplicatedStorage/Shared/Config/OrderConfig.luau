--!strict
-- Tipos de encomenda. Cada tipo define de onde sai, quanto paga e quanto tempo dá.
--
--   Recompensa = BaseReward + distância da rota × RewardPerStud
--   Prazo      = (distância da rota ÷ ReferenceSpeed) × TimeFactor + TimeBuffer
--
-- TimeFactor perto de 1.0 = prazo apertadíssimo (precisa de atalhos);
-- TimeFactor alto = prazo folgado. Weight = chance relativa de aparecer.

export type OrderType = {
	Id: string,
	DisplayName: string,
	Icon: string,
	-- Etiqueta exibida no cartão do pedido (ex.: "URGENTE").
	Tag: string,
	TagColor: Color3,
	-- Ids de locais (MapLayout.Locations) onde a encomenda pode ser coletada.
	Pickups: { string },
	-- Se definido, restringe os destinos possíveis.
	Destinations: { string }?,
	BaseReward: number,
	RewardPerStud: number,
	TimeFactor: number,
	TimeBuffer: number,
	MinTime: number,
	Weight: number,
}

local OrderConfig = {}

OrderConfig.Types = {
	Pizza = {
		Id = "Pizza",
		DisplayName = "Pizza",
		Icon = "🍕",
		Tag = "RÁPIDA",
		TagColor = Color3.fromRGB(255, 159, 67),
		Pickups = { "Pizzaria" },
		BaseReward = 70,
		RewardPerStud = 0.11,
		TimeFactor = 1.3,
		TimeBuffer = 10,
		MinTime = 25,
		Weight = 3,
	},
	Burger = {
		Id = "Burger",
		DisplayName = "Hambúrguer",
		Icon = "🍔",
		Tag = "RÁPIDA",
		TagColor = Color3.fromRGB(255, 159, 67),
		Pickups = { "BurgerBoom" },
		BaseReward = 75,
		RewardPerStud = 0.12,
		TimeFactor = 1.35,
		TimeBuffer = 12,
		MinTime = 25,
		Weight = 3,
	},
	Documento = {
		Id = "Documento",
		DisplayName = "Documento",
		Icon = "📄",
		Tag = "NORMAL",
		TagColor = Color3.fromRGB(84, 160, 255),
		Pickups = { "Cartorio", "Prefeitura" },
		BaseReward = 130,
		RewardPerStud = 0.15,
		TimeFactor = 1.7,
		TimeBuffer = 20,
		MinTime = 35,
		Weight = 2,
	},
	Remedio = {
		Id = "Remedio",
		DisplayName = "Remédio",
		Icon = "💊",
		Tag = "PRIORIDADE",
		TagColor = Color3.fromRGB(255, 107, 129),
		Pickups = { "Farmacia" },
		Destinations = {
			"Hospital",
			"CasaAmarela",
			"CasaAzul",
			"CasaVerde",
			"CasaRosa",
			"ResidencialSolar",
			"BeiraRio",
			"Chacara",
			"Bombeiros",
			"Escola",
		},
		BaseReward = 150,
		RewardPerStud = 0.17,
		TimeFactor = 1.4,
		TimeBuffer = 12,
		MinTime = 28,
		Weight = 2,
	},
	Pacote = {
		Id = "Pacote",
		DisplayName = "Pacote",
		Icon = "📦",
		Tag = "TRANQUILA",
		TagColor = Color3.fromRGB(46, 213, 115),
		Pickups = { "Distribuicao", "Shopping" },
		BaseReward = 100,
		RewardPerStud = 0.13,
		TimeFactor = 1.95,
		TimeBuffer = 22,
		MinTime = 40,
		Weight = 3,
	},
	PacoteUrgente = {
		Id = "PacoteUrgente",
		DisplayName = "Pacote Urgente",
		Icon = "📦",
		Tag = "⚡ URGENTE",
		TagColor = Color3.fromRGB(255, 71, 87),
		Pickups = { "Distribuicao" },
		BaseReward = 240,
		RewardPerStud = 0.26,
		TimeFactor = 1.12,
		TimeBuffer = 8,
		MinTime = 22,
		Weight = 1,
	},
} :: { [string]: OrderType }

-- Ordem fixa para iterar de forma determinística.
OrderConfig.TypeOrder = { "Pizza", "Burger", "Documento", "Remedio", "Pacote", "PacoteUrgente" }

function OrderConfig.Get(typeId: string): OrderType?
	return OrderConfig.Types[typeId]
end

return OrderConfig
