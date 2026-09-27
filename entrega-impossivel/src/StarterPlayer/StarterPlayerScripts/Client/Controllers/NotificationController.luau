--!strict
-- Avisos rápidos no topo da tela (eventos, erros, confirmações).

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Remotes = require(ReplicatedStorage.Shared.Util.Remotes)
local Theme = require(script.Parent.Parent.UI.Theme)
local UIUtil = require(script.Parent.Parent.UI.UIUtil)
local SoundController = require(script.Parent.SoundController)

local NotificationController = {}

local MAX_VISIBLE = 4

local container: Frame
local order = 0

function NotificationController.Show(text: string, style: string?, duration: number?)
	local color = Theme.StyleColors[style or "info"] or Theme.Colors.Info
	order += 1

	local toast = UIUtil.Panel(container, "Toast", UDim2.fromOffset(460, 44), UDim2.new(), nil)
	toast.LayoutOrder = order
	toast.BackgroundTransparency = 1
	local bar = Instance.new("Frame")
	bar.Name = "Bar"
	bar.Size = UDim2.new(0, 6, 1, -12)
	bar.Position = UDim2.fromOffset(8, 6)
	bar.BackgroundColor3 = color
	bar.BorderSizePixel = 0
	bar.Parent = toast
	UIUtil.Corner(bar, 3)

	local label = UIUtil.Label(toast, "Text", text, 17, Theme.Fonts.Bold)
	label.Position = UDim2.fromOffset(22, 0)
	label.Size = UDim2.new(1, -30, 1, 0)
	label.TextWrapped = true
	label.TextTruncate = Enum.TextTruncate.None
	label.TextTransparency = 1

	UIUtil.Tween(toast, 0.2, { BackgroundTransparency = Theme.PanelTransparency })
	UIUtil.Tween(label, 0.2, { TextTransparency = 0 })

	-- Remove os mais antigos se tiver muitos na tela.
	local toasts = {}
	for _, child in container:GetChildren() do
		if child:IsA("Frame") then
			table.insert(toasts, child)
		end
	end
	table.sort(toasts, function(a: Frame, b: Frame)
		return a.LayoutOrder < b.LayoutOrder
	end)
	for index = 1, #toasts - MAX_VISIBLE do
		toasts[index]:Destroy()
	end

	if style == "event" then
		SoundController.Play("Event")
	elseif style == "danger" then
		SoundController.Play("Fail")
	end

	task.delay(duration or 4, function()
		if toast.Parent then
			UIUtil.Tween(toast, 0.3, { BackgroundTransparency = 1 })
			UIUtil.Tween(label, 0.3, { TextTransparency = 1 })
			task.wait(0.35)
			toast:Destroy()
		end
	end)
end

function NotificationController.Init()
	local rootGui = UIUtil.GetRoot()
	local frame = Instance.new("Frame")
	frame.Name = "Notifications"
	frame.AnchorPoint = Vector2.new(0.5, 0)
	frame.Position = UDim2.new(0.5, 0, 0, 74)
	frame.Size = UDim2.fromOffset(460, 220)
	frame.BackgroundTransparency = 1
	frame.Parent = rootGui
	local layout = UIUtil.List(frame, Enum.FillDirection.Vertical, 6)
	layout.HorizontalAlignment = Enum.HorizontalAlignment.Center
	container = frame
end

function NotificationController.Start()
	Remotes.Get("Notify").OnClientEvent:Connect(function(payload: { Text: string, Style: string?, Duration: number? })
		if type(payload) == "table" and type(payload.Text) == "string" then
			NotificationController.Show(payload.Text, payload.Style, payload.Duration)
		end
	end)
end

return NotificationController
