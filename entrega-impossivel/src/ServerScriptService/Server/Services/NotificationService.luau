--!strict
-- Envia notificações (toasts) para a tela dos jogadores.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Remotes = require(ReplicatedStorage.Shared.Util.Remotes)

-- Estilos aceitos pelo cliente: "info", "success", "warning", "danger", "event".
export type Style = string

local NotificationService = {}

local notifyRemote: RemoteEvent? = nil

local function remote(): RemoteEvent
	if not notifyRemote then
		notifyRemote = Remotes.Get("Notify")
	end
	return notifyRemote :: RemoteEvent
end

function NotificationService.Send(player: Player, text: string, style: Style?, duration: number?)
	if player.Parent ~= Players then
		return
	end
	remote():FireClient(player, { Text = text, Style = style or "info", Duration = duration or 4 })
end

function NotificationService.Broadcast(text: string, style: Style?, duration: number?)
	remote():FireAllClients({ Text = text, Style = style or "event", Duration = duration or 6 })
end

return NotificationService
