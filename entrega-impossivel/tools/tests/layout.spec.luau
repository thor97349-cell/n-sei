-- Valida a planta da cidade: prédios dentro dos quarteirões, sem sobreposição,
-- pontos de entrega na beira da rua, etc.

local TestKit = require("../lib/TestKit")
local RobloxEnv = require("../lib/RobloxEnv")
local Vector3 = require("@lune/roblox").Vector3

return function(game: any, env: any)
	local MapLayout = env.require(RobloxEnv.find(game, "ReplicatedStorage.Shared.Map.MapLayout"))
	local OrderConfig = env.require(RobloxEnv.find(game, "ReplicatedStorage.Shared.Config.OrderConfig"))
	local test, expect = TestKit.test, TestKit.expect

	type Box = { Name: string, XMin: number, XMax: number, ZMin: number, ZMax: number }

	local function boxFrom(name: string, center: any, footprint: any): Box
		return {
			Name = name,
			XMin = center.X - footprint.X / 2,
			XMax = center.X + footprint.X / 2,
			ZMin = center.Z - footprint.Y / 2,
			ZMax = center.Z + footprint.Y / 2,
		}
	end

	local function overlaps(a: any, b: any, margin: number): boolean
		return a.XMin < b.XMax + margin
			and b.XMin < a.XMax + margin
			and a.ZMin < b.ZMax + margin
			and b.ZMin < a.ZMax + margin
	end

	local function inside(inner: any, outer: any, inset: number): boolean
		return inner.XMin >= outer.XMin + inset
			and inner.XMax <= outer.XMax - inset
			and inner.ZMin >= outer.ZMin + inset
			and inner.ZMax <= outer.ZMax - inset
	end

	local buildings: { Box } = {}
	for _, loc in MapLayout.Locations do
		local center = MapLayout.GetBuildingCenter(loc)
		local footprint = MapLayout.GetFootprint(loc.Facing, loc.Building.Width, loc.Building.Depth)
		table.insert(buildings, boxFrom("Local " .. loc.Id, center, footprint))
	end
	for index, filler in MapLayout.Fillers do
		local footprint = MapLayout.GetFootprint(filler.Facing, filler.Width, filler.Depth)
		table.insert(
			buildings,
			boxFrom(
				"Filler #" .. index .. " (" .. filler.Style .. ")",
				Vector3.new(filler.Center.X, 0, filler.Center.Y),
				footprint
			)
		)
	end
	local hq = MapLayout.HQ
	table.insert(
		buildings,
		boxFrom("Central de Entregas", hq.Center, MapLayout.GetFootprint(hq.Facing, hq.Width, hq.Depth))
	)

	local blocks = MapLayout.GetBlocks()

	local function blockContaining(box: Box): any
		for _, block in blocks do
			if inside(box, block, 0) then
				return block
			end
		end
		return nil
	end

	local ringOuter = MapLayout.RingCoordinate + MapLayout.RingWidth / 2

	TestKit.group("Planta da cidade", function()
		test("existem 30 quarteirões (linha do canal dividida em duas)", function()
			TestKit.equal(#blocks, 30)
		end)

		test("todo prédio está dentro de um quarteirão (ou fora do anel, no campo)", function()
			for _, box in buildings do
				local block = blockContaining(box)
				if block then
					expect(inside(box, block, 8), box.Name .. " invade a calçada do quarteirão " .. block.Key)
				else
					local outsideRing = box.XMax < -ringOuter
						or box.XMin > ringOuter
						or box.ZMax < -ringOuter
						or box.ZMin > ringOuter
					expect(outsideRing, box.Name .. " não está dentro de nenhum quarteirão")
					expect(
						box.XMin > -MapLayout.PlayableHalfSize and box.XMax < MapLayout.PlayableHalfSize,
						box.Name .. " fora do mapa"
					)
				end
			end
		end)

		test("nenhum prédio se sobrepõe a outro", function()
			for i = 1, #buildings do
				for j = i + 1, #buildings do
					expect(
						not overlaps(buildings[i], buildings[j], 2),
						buildings[i].Name .. " sobrepõe " .. buildings[j].Name
					)
				end
			end
		end)

		test("becos, estacionamento do shopping e obra ficam livres", function()
			local zones = {
				{ Name = "Beco 1", Box = MapLayout.Alleys[1].Area },
				{ Name = "Beco 2", Box = MapLayout.Alleys[2].Area },
				{ Name = "Estacionamento do shopping", Box = MapLayout.ShoppingLot.Area },
				{ Name = "Obra", Box = MapLayout.ConstructionZone },
				{ Name = "Estacionamento da central", Box = MapLayout.HQ.ParkingArea },
			}
			for _, zone in zones do
				for _, box in buildings do
					expect(not overlaps(box, zone.Box, 0), box.Name .. " invade " .. zone.Name)
				end
			end
		end)

		test("pontos de entrega ficam na calçada, virados para a rua", function()
			for _, loc in MapLayout.Locations do
				local pad = loc.Position
				local padBox = { XMin = pad.X, XMax = pad.X, ZMin = pad.Z, ZMax = pad.Z }
				local block = blockContaining(padBox)
				local facing = MapLayout.FacingVectors[loc.Facing]
				expect(facing, loc.Id .. " tem Facing inválido")
				if block then
					local distanceToEdge
					if loc.Facing == "N" then
						distanceToEdge = pad.Z - block.ZMin
					elseif loc.Facing == "S" then
						distanceToEdge = block.ZMax - pad.Z
					elseif loc.Facing == "E" then
						distanceToEdge = block.XMax - pad.X
					else
						distanceToEdge = pad.X - block.XMin
					end
					expect(
						distanceToEdge >= 2 and distanceToEdge <= 10,
						loc.Id .. " está a " .. distanceToEdge .. " studs da rua (esperado 2–10)"
					)
				else
					-- Fora do anel: precisa estar colado na rodovia.
					local nearRing = math.abs(math.abs(pad.X) - ringOuter) <= 10
						or math.abs(math.abs(pad.Z) - ringOuter) <= 10
					expect(nearRing, loc.Id .. " não está perto de nenhuma rua")
				end
				for _, box in buildings do
					expect(not overlaps(padBox, box, 4), loc.Id .. ": ponto de entrega dentro de " .. box.Name)
				end
			end
		end)

		test("pontos de entrega não ficam colados uns nos outros", function()
			local radius = 20
			for i, a in MapLayout.Locations do
				for j, b in MapLayout.Locations do
					if i < j then
						local distance = (a.Position - b.Position).Magnitude
						expect(distance > radius * 2 + 4, a.Id .. " e " .. b.Id .. " estão perto demais")
					end
				end
			end
		end)

		test("acidentes ficam no meio de ruas existentes", function()
			for _, spot in MapLayout.AccidentSpots do
				local p = spot.Position
				if spot.Axis == "X" then
					expect(table.find(MapLayout.Grid.Zs, p.Z), spot.Id .. " não está numa rua leste-oeste")
				else
					expect(table.find(MapLayout.Grid.Xs, p.X), spot.Id .. " não está numa rua norte-sul")
				end
				for _, loc in MapLayout.Locations do
					expect((loc.Position - p).Magnitude > 60, spot.Id .. " bloqueia a entrada de " .. loc.Id)
				end
			end
		end)

		test("tipos de pedido usam locais válidos", function()
			for _, typeId in OrderConfig.TypeOrder do
				local orderType = OrderConfig.Types[typeId]
				expect(orderType, "tipo ausente: " .. typeId)
				for _, pickupId in orderType.Pickups do
					local loc = MapLayout.GetLocation(pickupId)
					expect(loc and loc.Pickup, typeId .. ": coleta inválida " .. pickupId)
				end
				for _, dropoffId in orderType.Destinations or {} do
					local loc = MapLayout.GetLocation(dropoffId)
					expect(loc and loc.Dropoff, typeId .. ": destino inválido " .. dropoffId)
				end
			end
		end)

		test("vagas de estacionamento ficam dentro do estacionamento da central", function()
			local area = MapLayout.HQ.ParkingArea
			for index, slot in MapLayout.ParkingSlots do
				local p = slot.Position
				expect(p.X > area.XMin + 4 and p.X < area.XMax - 4, "vaga " .. index .. " fora (X)")
				expect(p.Z > area.ZMin + 6 and p.Z < area.ZMax - 6, "vaga " .. index .. " fora (Z)")
			end
		end)
	end)
end
