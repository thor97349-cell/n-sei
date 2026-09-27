--!strict
-- Painel de testes, visível SOMENTE no Roblox Studio: força eventos e dá dinheiro para
-- testar. O servidor também confere se está no Studio antes de obedecer.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Remotes = require(ReplicatedStorage.Shared.Util.Remotes)
local Theme = require(script.Parent.Parent.UI.Theme)
local UIUtil = require(script.Parent.Parent.UI.UIUtil)

local DebugController = {}

function DebugController.Init()
	if not RunService:IsStudio() then
		return
	end
	local remote = Remotes.Get("DebugCommand")
	local rootGui = UIUtil.GetRoot()

	local toggle = UIUtil.Button(
		rootGui,
		"DebugToggle",
		"🛠️",
		UDim2.fromOffset(40, 40),
		Theme.Colors.PanelLight,
		Theme.Colors.Text
	)
	toggle.AnchorPoint = Vector2.new(1, 0)
	toggle.Position = UDim2.new(1, -16, 0, if UIUtil.IsTouchLayout() then 206 else 70)

	local panel = UIUtil.Panel(
		rootGui,
		"DebugPanel",
		UDim2.fromOffset(190, 250),
		UDim2.new(1, -64, 0, if UIUtil.IsTouchLayout() then 206 else 70),
		Vector2.new(1, 0)
	)
	panel.Visible = false
	UIUtil.Padding(panel, 10)
	UIUtil.List(panel, Enum.FillDirection.Vertical, 6)
	local title = UIUtil.Label(panel, "Title", "Testes (só no Studio)", 14, Theme.Fonts.Title, Theme.Colors.Warning)
	title.LayoutOrder = 0

	local commands = {
		{ "🚧 Acidente", "event:Accident" },
		{ "🌧️ Tempestade", "event:Storm" },
		{ "🔓 Atalho", "event:Shortcut" },
		{ "⏹️ Encerrar evento", "stopevent" },
		{ "💰 +$1000", "money" },
	}
	for index, command in commands do
		local button = UIUtil.Button(
			panel,
			"Cmd" .. index,
			command[1],
			UDim2.new(1, 0, 0, 32),
			Theme.Colors.Info,
			Theme.Colors.Text
		)
		button.LayoutOrder = index
		button.TextSize = 15
		button.Activated:Connect(function()
			remote:FireServer(command[2])
		end)
	end

	toggle.Activated:Connect(function()
		panel.Visible = not panel.Visible
	end)
end

function DebugController.Start() end

return DebugController
