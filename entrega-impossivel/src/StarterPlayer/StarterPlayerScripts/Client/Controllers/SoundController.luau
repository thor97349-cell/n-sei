--!strict
-- Efeitos sonoros da interface. Os sons abaixo vêm da instalação do Roblox (rbxasset://).
-- Para trocar por sons da Creator Store, substitua pelo id "rbxassetid://123..." —
-- se algum som não carregar, o jogo continua funcionando normalmente (só fica mudo).

local SoundService = game:GetService("SoundService")

local SOUNDS: { [string]: { Id: string, Volume: number } } = {
	Click = { Id = "rbxasset://sounds/button.wav", Volume = 0.4 },
	Accept = { Id = "rbxasset://sounds/electronicpingshort.wav", Volume = 0.5 },
	Pickup = { Id = "rbxasset://sounds/electronicpingshort.wav", Volume = 0.7 },
	Success = { Id = "rbxasset://sounds/victory.wav", Volume = 0.5 },
	Fail = { Id = "rbxasset://sounds/uuhhh.mp3", Volume = 0.4 },
	Tick = { Id = "rbxasset://sounds/clickfast.wav", Volume = 0.25 },
	Event = { Id = "rbxasset://sounds/electronicpingshort.wav", Volume = 0.35 },
}

local SoundController = {}

local cache: { [string]: Sound } = {}

function SoundController.Play(name: string)
	local sound = cache[name]
	if not sound then
		local spec = SOUNDS[name]
		if not spec or spec.Id == "" then
			return
		end
		local newSound = Instance.new("Sound")
		newSound.Name = "UI_" .. name
		newSound.SoundId = spec.Id
		newSound.Volume = spec.Volume
		newSound.Parent = SoundService
		cache[name] = newSound
		sound = newSound
	end
	SoundService:PlayLocalSound(sound)
end

function SoundController.Init() end
function SoundController.Start() end

return SoundController
