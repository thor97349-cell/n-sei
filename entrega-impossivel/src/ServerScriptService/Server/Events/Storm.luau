--!strict
-- EVENTO: TEMPESTADE — chuva, céu escuro e pista escorregadia.
-- O servidor só muda o atributo "Weather"; cada cliente desenha a chuva e a neblina
-- (WeatherController) e o carro perde um pouco de aderência (VehicleController).

type Context = any

local Storm = {}

function Storm.Start(context: Context, _duration: number): {}
	context.SetWorldState("Weather", "Storm")
	context.Notify("🌧️ TEMPESTADE! Pista escorregadia e pouca visibilidade.", "event", 7)
	return {}
end

function Storm.Stop(context: Context, _handle: {})
	context.SetWorldState("Weather", "Clear")
	context.Notify("☀️ A tempestade passou.", "success", 4)
end

return Storm
