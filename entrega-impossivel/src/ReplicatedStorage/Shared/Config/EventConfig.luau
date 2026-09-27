--!strict
-- Eventos aleatórios que afetam TODOS os jogadores do servidor.
-- Para criar um evento novo: adicione uma entrada aqui e um ModuleScript com o mesmo
-- Id em ServerScriptService.Server.Events (veja Accident/Storm/Shortcut como modelo).

export type EventDefinition = {
	Id: string,
	DisplayName: string,
	Icon: string,
	-- Chance relativa de ser sorteado.
	Weight: number,
	-- Duração em segundos: {mínimo, máximo}.
	Duration: { number },
}

local EventConfig = {}

EventConfig.Scheduler = {
	-- Segundos até o primeiro evento depois que o servidor abre: {mín, máx}.
	FirstDelay = { 90, 140 },
	-- Intervalo entre o fim de um evento e o início do próximo.
	Interval = { 150, 240 },
	-- Valores usados apenas dentro do Roblox Studio (testes).
	StudioFirstDelay = { 25, 35 },
	StudioInterval = { 45, 70 },
}

EventConfig.Events = {
	Accident = {
		Id = "Accident",
		DisplayName = "Acidente",
		Icon = "🚧",
		Weight = 3,
		Duration = { 70, 100 },
	},
	Storm = {
		Id = "Storm",
		DisplayName = "Tempestade",
		Icon = "🌧️",
		Weight = 2,
		Duration = { 60, 90 },
	},
	Shortcut = {
		Id = "Shortcut",
		DisplayName = "Atalho",
		Icon = "🔓",
		Weight = 2,
		Duration = { 55, 75 },
	},
} :: { [string]: EventDefinition }

EventConfig.EventOrder = { "Accident", "Storm", "Shortcut" }

return EventConfig
