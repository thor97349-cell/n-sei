--!strict
-- EVENTO: ATALHO — uma rota alternativa abre por um tempo (ponte da obra ou o
-- estacionamento do shopping). Antes de fechar, espera ninguém estar em cima dela.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local MapLayout = require(ReplicatedStorage.Shared.Map.MapLayout)
local MapBuilder = require(script.Parent.Parent.Map.MapBuilder)

type Context = any
type Handle = {
	Shortcut: Instance,
	Spec: MapLayout.ShortcutSpec,
	Active: boolean,
}

local MAX_CLOSE_WAIT = 20

local Shortcut = {}

local function getShortcutsFolder(): Instance?
	local map = Workspace:FindFirstChild("Map")
	return map and map:FindFirstChild("Shortcuts")
end

local function specFor(id: string): MapLayout.ShortcutSpec?
	for _, spec in MapLayout.Shortcuts do
		if spec.Id == id then
			return spec
		end
	end
	return nil
end

function Shortcut.CanStart(_context: Context): boolean
	return getShortcutsFolder() ~= nil
end

function Shortcut.Start(context: Context, duration: number): Handle?
	local folder = getShortcutsFolder()
	if not folder then
		return nil
	end
	local options = {}
	for _, child in folder:GetChildren() do
		local spec = specFor(child.Name)
		if spec and child:FindFirstChild("ClosedParts") then
			table.insert(options, { Instance = child, Spec = spec })
		end
	end
	if #options == 0 then
		return nil
	end
	local choice = options[context.Random:NextInteger(1, #options)]
	MapBuilder.SetShortcutOpen(choice.Instance, true)
	context.SetWorldState("OpenShortcut", choice.Spec.Id)
	context.Notify(string.format("🔓 ATALHO LIBERADO: %s por %ds!", choice.Spec.DisplayName, duration), "event", 7)

	local handle: Handle = { Shortcut = choice.Instance, Spec = choice.Spec, Active = true }
	task.delay(math.max(0, duration - 10), function()
		if handle.Active then
			context.Notify("⏳ O atalho fecha em 10 segundos!", "warning", 4)
		end
	end)
	return handle
end

function Shortcut.Stop(context: Context, handle: Handle)
	handle.Active = false
	-- Não fecha em cima de ninguém (quem estiver na ponte cairia no canal).
	local waited = 0
	while waited < MAX_CLOSE_WAIT do
		local occupied = false
		for _, zone in handle.Spec.ClearanceZones do
			if context.IsBoxOccupied(zone.Center, zone.Size) then
				occupied = true
				break
			end
		end
		if not occupied then
			break
		end
		task.wait(0.5)
		waited += 0.5
	end
	MapBuilder.SetShortcutOpen(handle.Shortcut, false)
	context.SetWorldState("OpenShortcut", "")
	context.Notify("🔒 O atalho fechou.", "info", 4)
end

return Shortcut
