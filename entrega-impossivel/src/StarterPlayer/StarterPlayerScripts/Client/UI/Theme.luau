--!strict
-- Cores e fontes da interface.

local Theme = {}

Theme.Colors = {
	Panel = Color3.fromRGB(22, 24, 36),
	PanelLight = Color3.fromRGB(36, 39, 58),
	Stroke = Color3.fromRGB(255, 255, 255),
	Text = Color3.fromRGB(255, 255, 255),
	TextDim = Color3.fromRGB(176, 182, 204),
	TextDark = Color3.fromRGB(28, 30, 42),
	Brand = Color3.fromRGB(255, 196, 0),
	Success = Color3.fromRGB(46, 213, 115),
	Danger = Color3.fromRGB(255, 71, 87),
	Warning = Color3.fromRGB(255, 165, 2),
	Info = Color3.fromRGB(84, 160, 255),
	Event = Color3.fromRGB(165, 94, 234),
	Pickup = Color3.fromRGB(255, 196, 0),
	Dropoff = Color3.fromRGB(46, 213, 115),
}

Theme.StyleColors = {
	info = Theme.Colors.Info,
	success = Theme.Colors.Success,
	warning = Theme.Colors.Warning,
	danger = Theme.Colors.Danger,
	event = Theme.Colors.Event,
} :: { [string]: Color3 }

Theme.Fonts = {
	Title = Font.fromEnum(Enum.Font.FredokaOne),
	Bold = Font.fromEnum(Enum.Font.GothamBold),
	Medium = Font.fromEnum(Enum.Font.GothamMedium),
}

Theme.PanelTransparency = 0.12

return Theme
