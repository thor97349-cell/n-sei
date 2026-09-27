--!strict
-- Configurações gerais do jogo. Ajuste valores aqui em vez de mexer no código dos sistemas.

local GameConfig = {}

GameConfig.GameName = "ENTREGA IMPOSSÍVEL"

GameConfig.Units = {
	-- Escala usada só para exibição (distância e velocidade na tela).
	StudsToMeters = 0.5,
}

GameConfig.Delivery = {
	-- Quantas ofertas aparecem no painel de pedidos.
	OffersPerBoard = 3,
	-- Segundos entre pedidos de "novas ofertas".
	RerollCooldown = 8,
	-- Raio (em studs) em volta do ponto de coleta/entrega que conta como "chegou".
	PickupRadius = 20,
	DropoffRadius = 20,
	-- Velocidade média (studs/s) usada para calcular o prazo de cada pedido.
	ReferenceSpeed = 42,
	-- Distância mínima (pelo caminho seguro) entre coleta e destino.
	MinRouteDistance = 450,
	-- Segundos mostrando "ENTREGA CONCLUÍDA/ATRASADA" antes de liberar novo pedido.
	ResultDuration = 4,
	-- Depois que o tempo acaba, o jogador ainda pode entregar durante este período,
	-- recebendo só uma parte da recompensa. Depois disso o pedido é cancelado.
	LateGracePeriod = 30,
	LateRewardMultiplier = 0.4,
	-- Bônus por rapidez: fração do tempo que sobrou -> bônus sobre a recompensa.
	BonusTiers = {
		{ MinRemainingFraction = 0.45, Multiplier = 0.35, Label = "⚡ BÔNUS RELÂMPAGO" },
		{ MinRemainingFraction = 0.25, Multiplier = 0.15, Label = "🚀 BÔNUS RÁPIDO" },
	},
	-- Frequência (segundos) com que o servidor verifica a posição dos jogadores.
	MonitorInterval = 0.2,
	-- Anti-exploit: uma entrega nunca pode ser concluída mais rápido do que a linha reta
	-- percorrida na velocidade máxima do veículo mais rápido × este multiplicador.
	MaxPlausibleSpeedMultiplier = 1.3,
	-- Segundos de espera depois de cancelar uma entrega.
	CancelCooldown = 3,
}

GameConfig.Economy = {
	CurrencySymbol = "$",
	MaxMoney = 1e12,
	-- Nome da coluna no placar (leaderboard) do Roblox.
	LeaderstatName = "Dinheiro",
}

GameConfig.Data = {
	-- Mudar este nome cria um "save" novo (o antigo continua existindo no Roblox).
	StoreName = "EntregaImpossivel_PlayerData_v1",
	AutosaveInterval = 90,
	MaxLoadAttempts = 5,
	MaxSaveAttempts = 4,
	RetryBaseDelay = 2,
	-- Uma trava de sessão mais velha que isto é considerada abandonada (servidor caiu).
	SessionLockTimeout = 300,
	-- Quanto tempo esperamos outro servidor liberar os dados antes de assumir a trava.
	SessionLockWait = 20,
	SessionLockRetryDelay = 3,
	-- Tempo máximo que o servidor espera salvar tudo ao desligar.
	ShutdownTimeout = 25,
}

GameConfig.Vehicle = {
	DefaultVehicleId = "Starter",
	SpawnCooldown = 6,
	ResetCooldown = 4,
	-- Distância máxima para usar o botão "Dirigir" do veículo.
	EnterDistance = 14,
	-- Abaixo desta altura o veículo é considerado perdido (caiu do mapa).
	LostHeight = -150,
}

GameConfig.Debug = {
	-- No Roblox Studio, os eventos aleatórios acontecem mais cedo e com mais frequência
	-- para facilitar os testes. Não afeta servidores publicados.
	StudioFastEvents = true,
}

return GameConfig
