--!strict
-- Lista central de RemoteEvents. O servidor cria todos na inicialização (Remotes.Setup)
-- e o cliente apenas espera por eles (Remotes.Get). Assim nenhum script depende de
-- objetos criados manualmente no Studio.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local FOLDER_NAME = "Remotes"

local Remotes = {}

-- Nome -> descrição (apenas documentação; todos são RemoteEvent).
Remotes.Definitions = {
	-- Cliente -> Servidor
	AcceptOrder = "Aceitar uma das ofertas de entrega (offerId: string)",
	CancelOrder = "Cancelar a entrega atual",
	RerollOffers = "Pedir novas ofertas (com cooldown)",
	RequestSync = "Pedir o estado atual da entrega (usado ao carregar o cliente)",
	SpawnVehicle = "Chamar o veículo para perto do jogador",
	ResetVehicle = "Resgatar o veículo (desvirar/tirar de lugar preso)",
	DebugCommand = "Comandos de teste — só funcionam dentro do Roblox Studio",

	-- Servidor -> Cliente
	DeliveryState = "Estado completo da entrega do jogador",
	Notify = "Mostrar uma notificação na tela",
	VehicleReset = "Avisa o cliente que o veículo foi teleportado",
} :: { [string]: string }

function Remotes.Setup(): Folder
	assert(RunService:IsServer(), "Remotes.Setup só pode ser chamado no servidor")
	local folder = ReplicatedStorage:FindFirstChild(FOLDER_NAME)
	if not folder then
		local newFolder = Instance.new("Folder")
		newFolder.Name = FOLDER_NAME
		newFolder.Parent = ReplicatedStorage
		folder = newFolder
	end
	assert(folder and folder:IsA("Folder"), "ReplicatedStorage.Remotes precisa ser uma Folder")

	for name in Remotes.Definitions do
		if not folder:FindFirstChild(name) then
			local remote = Instance.new("RemoteEvent")
			remote.Name = name
			remote.Parent = folder
		end
	end
	return folder
end

function Remotes.Get(name: string): RemoteEvent
	assert(Remotes.Definitions[name], "Remote desconhecido: " .. name)
	local folder = ReplicatedStorage:WaitForChild(FOLDER_NAME, 30)
	assert(folder, "ReplicatedStorage.Remotes não encontrado (o servidor iniciou?)")
	local remote = folder:WaitForChild(name, 30)
	assert(remote and remote:IsA("RemoteEvent"), "RemoteEvent não encontrado: " .. name)
	return remote
end

return Remotes
