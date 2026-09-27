--!strict
-- Funções pequenas para montar a interface por código (com tipos, para evitar erros).

local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")
local Workspace = game:GetService("Workspace")

local Theme = require(script.Parent.Theme)

local UIUtil = {}

local REFERENCE_SIZE = Vector2.new(1280, 760)

local root: ScreenGui? = nil

-- ScreenGui principal (não reseta quando o personagem morre).
function UIUtil.GetRoot(): ScreenGui
	if root then
		return root
	end
	local playerGui = Players.LocalPlayer:WaitForChild("PlayerGui")
	local gui = Instance.new("ScreenGui")
	gui.Name = "EntregaImpossivelHUD"
	gui.ResetOnSpawn = false
	gui.IgnoreGuiInset = false
	gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
	gui.Parent = playerGui

	-- Escala a interface conforme o tamanho da tela (celular, PC, TV).
	local scale = Instance.new("UIScale")
	scale.Parent = gui
	local function updateScale()
		local camera = Workspace.CurrentCamera
		if not camera then
			return
		end
		local viewport = camera.ViewportSize
		local factor = math.min(viewport.X / REFERENCE_SIZE.X, viewport.Y / REFERENCE_SIZE.Y)
		scale.Scale = math.clamp(factor, 0.55, 1.15)
	end
	updateScale()
	local camera = Workspace.CurrentCamera
	if camera then
		camera:GetPropertyChangedSignal("ViewportSize"):Connect(updateScale)
	end

	root = gui
	return gui
end

-- Celular/tablet (sem teclado): o analógico ocupa o canto inferior esquerdo e o botão de
-- pular o inferior direito, então a interface sobe para o topo nesses aparelhos.
function UIUtil.IsTouchLayout(): boolean
	return UserInputService.TouchEnabled and not UserInputService.KeyboardEnabled
end

function UIUtil.Corner(parent: GuiObject, radius: number): UICorner
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, radius)
	corner.Parent = parent
	return corner
end

function UIUtil.Stroke(parent: GuiObject, color: Color3?, thickness: number?, transparency: number?): UIStroke
	local stroke = Instance.new("UIStroke")
	stroke.Color = color or Theme.Colors.Stroke
	stroke.Thickness = thickness or 1.5
	stroke.Transparency = transparency or 0.85
	stroke.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
	stroke.Parent = parent
	return stroke
end

function UIUtil.Padding(parent: GuiObject, pixels: number)
	local padding = Instance.new("UIPadding")
	local value = UDim.new(0, pixels)
	padding.PaddingLeft = value
	padding.PaddingRight = value
	padding.PaddingTop = value
	padding.PaddingBottom = value
	padding.Parent = parent
end

function UIUtil.List(parent: GuiObject, direction: Enum.FillDirection, spacing: number): UIListLayout
	local layout = Instance.new("UIListLayout")
	layout.FillDirection = direction
	layout.Padding = UDim.new(0, spacing)
	layout.SortOrder = Enum.SortOrder.LayoutOrder
	layout.Parent = parent
	return layout
end

-- Painel escuro arredondado.
function UIUtil.Panel(parent: Instance, name: string, size: UDim2, position: UDim2, anchor: Vector2?): Frame
	local frame = Instance.new("Frame")
	frame.Name = name
	frame.Size = size
	frame.Position = position
	frame.AnchorPoint = anchor or Vector2.zero
	frame.BackgroundColor3 = Theme.Colors.Panel
	frame.BackgroundTransparency = Theme.PanelTransparency
	frame.BorderSizePixel = 0
	frame.Parent = parent
	UIUtil.Corner(frame, 14)
	UIUtil.Stroke(frame)
	return frame
end

function UIUtil.Label(
	parent: Instance,
	name: string,
	text: string,
	textSize: number,
	font: Font?,
	color: Color3?
): TextLabel
	local label = Instance.new("TextLabel")
	label.Name = name
	label.BackgroundTransparency = 1
	label.Text = text
	label.TextSize = textSize
	label.FontFace = font or Theme.Fonts.Bold
	label.TextColor3 = color or Theme.Colors.Text
	label.TextXAlignment = Enum.TextXAlignment.Left
	label.TextYAlignment = Enum.TextYAlignment.Center
	label.Size = UDim2.new(1, 0, 0, textSize + 6)
	label.TextTruncate = Enum.TextTruncate.AtEnd
	label.Parent = parent
	return label
end

function UIUtil.Button(
	parent: Instance,
	name: string,
	text: string,
	size: UDim2,
	color: Color3,
	textColor: Color3?
): TextButton
	local button = Instance.new("TextButton")
	button.Name = name
	button.Size = size
	button.BackgroundColor3 = color
	button.BorderSizePixel = 0
	button.AutoButtonColor = true
	button.Text = text
	button.TextSize = 18
	button.FontFace = Theme.Fonts.Title
	button.TextColor3 = textColor or Theme.Colors.TextDark
	button.Parent = parent
	UIUtil.Corner(button, 12)
	-- Pequeno "pulo" ao clicar.
	local scale = Instance.new("UIScale")
	scale.Parent = button
	button.MouseButton1Down:Connect(function()
		TweenService:Create(scale, TweenInfo.new(0.08), { Scale = 0.94 }):Play()
	end)
	button.MouseButton1Up:Connect(function()
		TweenService:Create(scale, TweenInfo.new(0.15, Enum.EasingStyle.Back, Enum.EasingDirection.Out), { Scale = 1 })
			:Play()
	end)
	button.MouseLeave:Connect(function()
		scale.Scale = 1
	end)
	return button
end

function UIUtil.Tween(
	instance: Instance,
	duration: number,
	goals: { [string]: any },
	style: Enum.EasingStyle?,
	direction: Enum.EasingDirection?
): Tween
	local tween = TweenService:Create(
		instance,
		TweenInfo.new(duration, style or Enum.EasingStyle.Quad, direction or Enum.EasingDirection.Out),
		goals
	)
	tween:Play()
	return tween
end

-- Faz um elemento "saltar" na tela (aparecer com efeito de mola).
function UIUtil.Pop(scale: UIScale, from: number?)
	scale.Scale = from or 0.7
	UIUtil.Tween(scale, 0.35, { Scale = 1 }, Enum.EasingStyle.Back)
end

return UIUtil
