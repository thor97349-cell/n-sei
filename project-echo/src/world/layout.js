// NODE-7 map layout as pure data (no three.js), so it can be validated in Node.
// Axes: +x = east, -z = north, +y = up. Units are meters.
//
//                   N
//   [W DOCK]---[NORTH SERVICE CORRIDOR]---[E GARAGE]
//      |  [SERVER HALL][DATA ROOM][MEETING|CORR]
//   [YARD]       |    [SEC LOBBY]  [EAST OFFICE]
//   [LOADING]*B2 |         |            |  D3
//   [ALLEY]--*B1--[SHOP]--[MAIN AVENUE]  [TECH TUNNEL]
//      \______________[SOUTH SPAWN]________/
//
// * = destructible wooden barricade. D# = interactive door.

const T = 0.4; // default wall thickness

export function buildLayout() {
  const boxes = []; // solid + visual boxes
  const L = { boxes, areas: [], doors: [], barricades: [], nodes: {}, edges: [], zones: {}, spawn: null, bots: [], barriers: [], decor: [] };

  const box = (x0, y0, z0, x1, y1, z1, mat, opt = {}) => {
    const b = {
      min: { x: Math.min(x0, x1), y: Math.min(y0, y1), z: Math.min(z0, z1) },
      max: { x: Math.max(x0, x1), y: Math.max(y0, y1), z: Math.max(z0, z1) },
      mat,
      surface: opt.surface || surfaceOf(mat),
      kind: opt.kind || 'static',
      collide: opt.collide !== false,
      visual: opt.visual !== false,
    };
    boxes.push(b);
    return b;
  };
  // centered box helper: center x,z; size w (x), h (y), d (z); y base
  const cbox = (cx, cz, w, h, d, mat, opt = {}) => box(cx - w / 2, opt.y || 0, cz - d / 2, cx + w / 2, (opt.y || 0) + h, cz + d / 2, mat, opt);

  // Wall along X at fixed z. openings: [[a, b, top]] (top < h creates a lintel)
  const wallX = (z, x0, x1, h, mat, openings = [], t = T) => {
    let cur = x0;
    const ops = [...openings].sort((p, q) => p[0] - q[0]);
    for (const [a, b, top] of ops) {
      if (a > cur) box(cur, 0, z - t / 2, a, h, z + t / 2, mat);
      if (top !== undefined && top < h) box(a, top, z - t / 2, b, h, z + t / 2, mat);
      cur = b;
    }
    if (cur < x1) box(cur, 0, z - t / 2, x1, h, z + t / 2, mat);
  };
  const wallZ = (x, z0, z1, h, mat, openings = [], t = T) => {
    let cur = z0;
    const ops = [...openings].sort((p, q) => p[0] - q[0]);
    for (const [a, b, top] of ops) {
      if (a > cur) box(x - t / 2, 0, cur, x + t / 2, h, a, mat);
      if (top !== undefined && top < h) box(x - t / 2, top, a, x + t / 2, h, b, mat);
      cur = b;
    }
    if (cur < z1) box(x - t / 2, 0, cur, x + t / 2, h, z1, mat);
  };

  // ---------------------------------------------------------------- areas
  // Non-overlapping rectangles: name, bounds, footstep surface, acoustic zone,
  // floor material, ceiling height (null = open sky).
  const area = (id, name, x0, z0, x1, z1, surface, zone, floor, ceiling = null, ceilMat = 'ceiling') =>
    L.areas.push({ id, name, min: { x: x0, z: z0 }, max: { x: x1, z: z1 }, surface, zone, floor, ceiling, ceilMat });

  area('spawn', 'SOUTH SPAWN', -14, 46, 14, 58, 'outdoor', 'outdoor', 'asphalt');
  area('weststreet', 'WEST STREET', -32, 48, -14, 55, 'outdoor', 'outdoor', 'asphalt');
  area('alley', 'SERVICE ALLEY', -32, 2, -24, 48, 'outdoor', 'outdoor', 'asphaltDark');
  area('shop', 'SHOP PASSAGE', -24, 22, -8, 25, 'wood', 'indoor', 'woodFloor', 3.2);
  area('avenue', 'MAIN AVENUE', -8, -2, 8, 46, 'outdoor', 'outdoor', 'asphalt');
  area('tunnel_in', 'TECH TUNNEL', 14, 50, 20.5, 53, 'metal', 'tunnel', 'grate', 3.0, 'metalDark');
  area('tunnel', 'TECH TUNNEL', 17, -2, 20.5, 50, 'metal', 'tunnel', 'grate', 3.0, 'metalDark');
  area('loading', 'LOADING AREA', -32, -14, -22, 2, 'concrete', 'outdoor', 'concreteFloor');
  area('yard', 'WEST YARD', -32, -30, -22, -14, 'concrete', 'outdoor', 'concreteFloor');
  area('dock', 'WEST LOADING DOCK', -46, -54, -22, -30, 'concrete', 'outdoor', 'concreteFloor');
  area('lobby', 'SECURITY LOBBY', -9, -18, 9, -2, 'tile', 'indoor', 'tile', 4.5);
  area('dataroom', 'DATA ROOM', -9, -34, 9, -18, 'metal', 'indoor', 'raisedFloor', 4.5);
  area('serverhall', 'SERVER HALL', -22, -34, -9, -2, 'concrete', 'indoor', 'concreteFloor', 4.5);
  area('office', 'EAST OFFICE', 9, -14, 24, -2, 'tile', 'indoor', 'carpet', 3.5);
  area('meeting', 'MEETING ROOM', 9, -30, 18, -14, 'tile', 'indoor', 'carpet', 3.5);
  area('officecorr', 'OFFICE CORRIDOR', 18, -34, 24, -14, 'tile', 'indoor', 'tile', 3.5);
  area('northcorr', 'SERVICE CORRIDOR', -22, -38, 24, -34, 'concrete', 'indoor', 'concreteFloor', 3.5);
  area('garage', 'EAST GARAGE', 24, -54, 46, -30, 'concrete', 'garage', 'concreteFloor', 3.4, 'concreteDark');

  // ------------------------------------------------------------- ground
  box(-60, -1, -70, 60, 0, 70, 'ground', { visual: false, surface: 'outdoor' });

  // ------------------------------------------------------------- spawn
  wallX(58, -14, 14, 8, 'facade');
  wallZ(-14, 46, 58, 8, 'facade', [[49, 54]]);
  wallZ(14, 46, 58, 8, 'facade', [[50, 53, 3.0]]);
  wallX(46, -14, -8, 8, 'facade');
  wallX(46, 8, 14, 8, 'facade');
  cbox(-10.5, 56, 1.2, 1.2, 1.2, 'crate');
  cbox(-9.2, 56.2, 1.2, 1.2, 1.2, 'crate');
  cbox(10, 56, 2.2, 2.4, 4.6, 'van');
  cbox(-11.5, 47.5, 2.2, 1.0, 0.6, 'barrierConcrete');

  // --------------------------------------------------------- west street
  wallX(55, -32, -14, 8, 'facade');
  wallX(48, -24, -14, 8, 'facade');
  wallZ(-32, -30, 55, 8, 'facade');
  cbox(-20, 53.8, 1.6, 1.4, 1.0, 'dumpster');

  // --------------------------------------------------------------- alley
  wallZ(-24, 2, 48, 8, 'brick', [[22, 25, 3.2]]);
  wallX(2, -24, -22, 8, 'brick');
  cbox(-30.2, 38, 1.2, 1.2, 1.2, 'crate');
  cbox(-30.2, 36.7, 1.2, 1.2, 1.2, 'crate');
  cbox(-30.2, 37.4, 1.1, 1.1, 1.1, 'crate', { y: 1.2 });
  cbox(-25.8, 30, 1.2, 1.2, 1.2, 'crate');
  cbox(-30.6, 27, 1.4, 1.4, 2.4, 'dumpster');
  cbox(-30.5, 17, 1.2, 1.2, 1.2, 'crate');
  cbox(-25.6, 8, 1.2, 1.2, 1.2, 'crate');
  cbox(-25.6, 9.3, 1.2, 1.2, 1.2, 'crate');
  cbox(-30.4, 11, 1.4, 0.15, 1.2, 'pallet');

  // ---------------------------------------------------------- shop passage
  wallX(22, -24, -8, 3.4, 'plaster');
  wallX(25, -24, -8, 3.4, 'plaster');
  cbox(-16, 24.5, 4, 2.0, 0.5, 'shelf');
  cbox(-12, 22.5, 2, 1.0, 0.6, 'counter');
  L.barricades.push({ id: 'B1', name: 'ALLEY SHOP BARRICADE', min: { x: -24.25, y: 0, z: 22.2 }, max: { x: -23.75, y: 3.2, z: 24.8 }, axis: 'z' });

  // --------------------------------------------------------------- avenue
  wallZ(-8, -2, 46, 8, 'facade', [[22, 25, 3.2]]);
  wallZ(8, -2, 46, 8, 'facade');
  cbox(-4.6, 33, 2.0, 1.5, 4.4, 'car');
  cbox(4.6, 8, 2.0, 1.5, 4.4, 'car2');
  cbox(3.5, 20, 2.4, 1.05, 0.6, 'barrierConcrete');
  cbox(-3.5, 9.5, 2.4, 1.05, 0.6, 'barrierConcrete');
  cbox(5.8, 39, 1.2, 2.2, 2.6, 'kiosk');
  cbox(-6.8, 14, 0.25, 4.5, 0.25, 'pole');
  cbox(6.8, 27, 0.25, 4.5, 0.25, 'pole');
  cbox(-5.5, 1.5, 1.3, 0.9, 1.3, 'planter');
  cbox(5.5, 1.5, 1.3, 0.9, 1.3, 'planter');

  // ----------------------------------------------------------- tunnel
  wallZ(17, -2, 50, 3.2, 'metalWall');
  wallZ(20.5, -2, 53, 3.2, 'metalWall');
  wallX(53, 14, 20.5, 3.2, 'metalWall');
  wallX(50, 14, 17, 3.2, 'metalWall');
  // Pipes (visual only) along the tunnel ceiling and walls.
  L.decor.push({ type: 'pipe', axis: 'z', x: 17.45, y: 2.55, z0: -2, z1: 50, r: 0.12, mat: 'pipe' });
  L.decor.push({ type: 'pipe', axis: 'z', x: 17.45, y: 2.2, z0: -2, z1: 50, r: 0.08, mat: 'pipeRed' });
  L.decor.push({ type: 'pipe', axis: 'z', x: 20.05, y: 2.6, z0: -2, z1: 53, r: 0.16, mat: 'pipe' });
  for (let z = 4; z < 50; z += 9) cbox(20.05, z, 0.5, 1.6, 0.9, 'electrical', { surface: 'metal' });

  // -------------------------------------------------------- loading / yard
  wallZ(-22, -54, 2, 7, 'concrete', [[-38, -34, 3.5], [-9, -6, 3.0]]);
  L.barricades.push({ id: 'B2', name: 'SERVER HALL BREACH', min: { x: -22.25, y: 0, z: -8.8 }, max: { x: -21.75, y: 3.0, z: -6.2 }, axis: 'z' });
  cbox(-30.3, -4, 1.3, 1.3, 1.3, 'crate');
  cbox(-30.3, -5.4, 1.3, 1.3, 1.3, 'crate');
  cbox(-24.8, -12, 1.4, 1.0, 1.4, 'palletStack');
  cbox(-30.2, -23.5, 2.4, 3.0, 7.0, 'trailer');

  // --------------------------------------------------------------- dock
  wallX(-30, -46, -32, 7, 'concrete');
  wallZ(-46, -54, -30, 7, 'concrete');
  wallX(-54, -46, -22, 7, 'concrete');
  cbox(-28, -46, 2.6, 2.8, 8.0, 'truck');
  cbox(-37.5, -35, 1.3, 1.3, 1.3, 'crate');
  cbox(-42.5, -40.5, 1.3, 1.3, 1.3, 'crate');
  cbox(-42.5, -41.8, 1.3, 1.3, 1.3, 'crate');
  cbox(-37, -48.5, 2.4, 1.1, 1.4, 'crate');
  cbox(-33, -52.5, 1.3, 1.3, 1.3, 'crate');
  cbox(-44.5, -52, 2.5, 1.6, 2.5, 'palletStack');

  // ----------------------------------------------------- facility shell
  // Lobby facade: glass panels either side of the main entrance.
  wallX(-2, -9, 9, 6, 'facadeFacility', [[-8.4, -3, 3.2], [-3, 3, 3.2], [3, 8.4, 3.2]]);
  box(-8.4, 0, -2.08, -3, 3.2, -1.92, 'glass', { kind: 'glass', surface: 'metal' });
  box(3, 0, -2.08, 8.4, 3.2, -1.92, 'glass', { kind: 'glass', surface: 'metal' });
  // Server hall south facade.
  wallX(-2, -22, -9, 6, 'facadeFacility');
  // Interior partitions.
  wallZ(-9, -34, -2, 4.5, 'plaster', [[-28, -25, 2.8], [-12, -9, 2.8]]);
  wallX(-18, -9, 9, 4.5, 'plaster', [[-1.5, 1.5, 2.8]]);
  wallZ(9, -34, -2, 4.5, 'plaster', [[-28, -25, 2.8], [-9, -6, 2.8]]);
  wallX(-34, -22, 24, 4.5, 'concrete', [[-20, -17, 2.8], [-1.5, 1.5, 2.8], [19, 23, 2.8]]);
  wallX(-38, -22, 24, 4.5, 'concrete');
  // Office wing.
  wallX(-2, 9, 24, 6, 'facadeFacility', [[17.4, 20.1, 2.7]]);
  wallZ(24, -54, -2, 6, 'concrete', [[-38, -34, 3.0]]);
  wallX(-14, 9, 24, 3.5, 'plaster', [[19, 22, 2.8]]);
  wallZ(18, -30, -14, 3.5, 'plaster', [[-26, -23, 2.8]]);
  wallX(-30, 9, 18, 3.5, 'plaster');
  box(9.2, 0, -33.8, 17.8, 3.5, -30.2, 'concrete'); // sealed storage block

  // --------------------------------------------------------------- lobby
  cbox(0, -9, 5, 1.1, 1.5, 'desk');
  cbox(-5, -14, 1, 4.5, 1, 'pillar');
  cbox(5, -14, 1, 4.5, 1, 'pillar');
  cbox(-7.6, -3.4, 1.0, 0.9, 1.0, 'planter');
  cbox(7.6, -3.4, 1.0, 0.9, 1.0, 'planter');
  cbox(-7.8, -16.6, 1.6, 0.8, 0.6, 'bench');
  cbox(7.8, -16.6, 1.6, 0.8, 0.6, 'bench');

  // ----------------------------------------------------------- data room
  L.terminal = { x: 0, z: -26, y: 1.15 };
  cbox(0, -26, 1.6, 1.05, 1.0, 'terminal', { surface: 'metal' });
  cbox(-6, -21.5, 1.0, 2.2, 2.0, 'rack', { surface: 'metal' });
  cbox(6, -21.5, 1.0, 2.2, 2.0, 'rack', { surface: 'metal' });
  cbox(-6, -31, 1.0, 2.2, 2.0, 'rack', { surface: 'metal' });
  cbox(6, -31, 1.0, 2.2, 2.0, 'rack', { surface: 'metal' });
  cbox(-3.2, -32.6, 2.0, 1.0, 0.8, 'console', { surface: 'metal' });
  cbox(3.2, -19.6, 2.0, 1.0, 0.8, 'console', { surface: 'metal' });

  // --------------------------------------------------------- server hall
  for (const z of [-13, -19, -25]) {
    cbox(-15.5, z, 7, 2.3, 1.2, 'rack', { surface: 'metal' });
  }
  cbox(-20.6, -3.5, 1.4, 1.2, 1.4, 'crate');
  cbox(-12.5, -32.5, 2.0, 1.6, 1.0, 'electrical', { surface: 'metal' });

  // -------------------------------------------------------------- office
  cbox(14, -11.5, 3.0, 0.8, 0.8, 'desk');
  cbox(22, -8, 3.0, 0.8, 0.8, 'desk');
  cbox(12.5, -3.2, 2.4, 1.6, 0.6, 'cabinet');
  cbox(23.4, -12.5, 0.8, 1.9, 1.6, 'cabinet');
  cbox(13.5, -21, 3.0, 0.8, 1.6, 'desk');
  cbox(23.3, -20, 0.9, 2.0, 0.8, 'vending');
  cbox(9.9, -16.5, 0.9, 1.9, 2.0, 'cabinet');

  // ------------------------------------------------------ north corridor
  cbox(6, -37.3, 0.8, 0.8, 0.8, 'crate');
  cbox(-6, -37.4, 1.6, 1.4, 0.6, 'electrical', { surface: 'metal' });
  L.decor.push({ type: 'pipe', axis: 'x', z: -37.5, y: 3.1, x0: -22, x1: 24, r: 0.14, mat: 'pipe' });

  // -------------------------------------------------------------- garage
  wallX(-30, 24, 46, 6, 'concrete');
  wallZ(46, -54, -30, 7, 'concrete');
  wallX(-54, 24, 46, 7, 'concrete');
  for (const x of [30, 36]) for (const z of [-41, -48]) cbox(x, z, 0.8, 3.4, 0.8, 'pillar');
  cbox(30, -33, 0.8, 3.4, 0.8, 'pillar');
  cbox(27, -50, 2.0, 1.5, 4.4, 'car');
  cbox(38, -33.5, 4.4, 1.5, 2.0, 'car2');
  cbox(33.5, -52.8, 2.4, 1.05, 0.6, 'barrierConcrete');
  // Exit ramp climbing north along the east wall (collision = shallow steps).
  const rampX0 = 41, rampX1 = 45.8, rampZ0 = -42, rampZ1 = -53.8, rampTop = 2.6, steps = 10;
  for (let i = 1; i <= steps; i++) {
    const z = rampZ0 + ((rampZ1 - rampZ0) * i) / (steps + 1);
    box(rampX0, 0, z, rampX1, (rampTop * i) / steps, rampZ1, 'ramp', { visual: false, surface: 'concrete' });
  }
  L.ramp = { x0: rampX0, x1: rampX1, z0: rampZ0, z1: rampZ1, top: rampTop };
  box(40.6, 0, -53.8, 41, 1.1, -42, 'barrierConcrete'); // ramp railing (low wall)
  box(41, 2.6, -54.2, 45.8, 6, -53.8, 'shutter', { surface: 'metal' }); // sealed exit shutter

  // ------------------------------------------------------------- doors
  // Sliding doors: closed box + slide axis/distance (moves into wall pocket).
  L.doors.push({ id: 'D1', name: 'DATA ROOM SECURITY DOOR', min: { x: -1.5, y: 0, z: -18.1 }, max: { x: 1.5, y: 2.8, z: -17.9 }, axis: 'x', dist: 2.9, open: false });
  L.doors.push({ id: 'D2', name: 'OFFICE DOOR', min: { x: 8.9, y: 0, z: -9 }, max: { x: 9.1, y: 2.8, z: -6 }, axis: 'z', dist: -2.9, open: true });
  L.doors.push({ id: 'D3', name: 'TUNNEL HATCH', min: { x: 17.4, y: 0, z: -2.1 }, max: { x: 20.1, y: 2.7, z: -1.9 }, axis: 'x', dist: -2.6, open: false });
  L.doors.push({ id: 'D4', name: 'GARAGE DOOR', min: { x: 23.9, y: 0, z: -38 }, max: { x: 24.1, y: 3.0, z: -34 }, axis: 'z', dist: 3.9, open: false });

  // ---------------------------------------------------- spawn barriers
  // Active only during the buy phase so the map stays safe.
  L.barriers.push({ min: { x: -8, y: 0, z: 45.6 }, max: { x: 8, y: 6, z: 46.0 } });
  L.barriers.push({ min: { x: -14.2, y: 0, z: 49 }, max: { x: -13.8, y: 6, z: 54 } });
  L.barriers.push({ min: { x: 13.8, y: 0, z: 50 }, max: { x: 14.2, y: 6, z: 53 } });

  // --------------------------------------------------------- objectives
  L.spawn = { x: 0, z: 53.5, yaw: 0 };
  L.zones.extraction = [
    { id: 'west', name: 'WEST LOADING DOCK', min: { x: -44, z: -52.5 }, max: { x: -34, z: -42 } },
    { id: 'east', name: 'EAST GARAGE', min: { x: 27.5, z: -52 }, max: { x: 39.5, z: -43 } },
  ];

  // ----------------------------------------------------------- waypoints
  const N = {
    S0: [0, 52], S1: [-10, 51.5], S2: [10, 51.5],
    W0: [-18, 51.5], W1: [-28, 51.5],
    A0: [-28, 44], A1: [-28, 34], A2: [-28, 23.5], A3: [-28, 13.5], A4: [-28, 4],
    SH0: [-21, 23.5], SH1: [-11, 23.5],
    AV0: [0, 42], AV1: [0, 30], AVS: [-4, 23.5], AV2: [0, 15], AV3: [0, 2],
    T0: [18.7, 51.5], T1: [18.7, 36], T2: [18.7, 18], T3: [18.7, 1.5],
    L0: [-27, -2], L1: [-27, -7.5], L2: [-26.5, -18], DK2: [-26.5, -28],
    DK1: [-34, -38], DK0: [-26, -36], DKX: [-39, -46.5],
    SV0: [-15.5, -7.5], SVE1: [-10.5, -10.5], SVW1: [-20.5, -8], SVW2: [-20.5, -22], SVE2: [-10.5, -22], SVE3: [-10.5, -26.5], SVW3: [-20.5, -29.5], SVN: [-18.5, -32],
    LB0: [0, -4.5], LB1: [-6, -10.5], LB2: [6, -7.5], LB3: [0, -15.5],
    DR_S: [0, -20.5], DR_W: [-6.5, -26.5], DR_E: [6.5, -26.5], DR_N: [0, -32],
    O0: [18.7, -4.5], O1: [11, -7.5], O2: [20.5, -11],
    MR0: [11, -26.5], MR1: [16, -24.5], C0: [21, -24.5], C1: [21, -16], C2: [21, -32],
    NC0: [-18.5, -36], NC1: [-9, -36], NC2: [0, -36], NC3: [10, -36], NC4: [21, -36],
    G0: [27, -36], G1: [33, -37], G2: [27, -44], GX: [33.2, -46.5],
  };
  for (const [id, [x, z]] of Object.entries(N)) L.nodes[id] = { id, x, z };
  const e = (a, b, opt = {}) => L.edges.push({ a, b, ...opt });
  e('S0', 'S1'); e('S0', 'S2'); e('S0', 'AV0'); e('S1', 'W0'); e('W0', 'W1'); e('W1', 'A0');
  e('S2', 'T0');
  e('A0', 'A1'); e('A1', 'A2'); e('A2', 'A3'); e('A3', 'A4'); e('A4', 'L0');
  e('A2', 'SH0', { barricade: 'B1' }); e('SH0', 'SH1'); e('SH1', 'AVS');
  e('AV0', 'AV1'); e('AV1', 'AVS'); e('AVS', 'AV2'); e('AV1', 'AV2'); e('AV2', 'AV3'); e('AV3', 'LB0');
  e('T0', 'T1'); e('T1', 'T2'); e('T2', 'T3'); e('T3', 'O0', { door: 'D3' });
  e('L0', 'L1'); e('L1', 'L2'); e('L2', 'DK2'); e('DK2', 'DK1'); e('DK2', 'DK0'); e('DK1', 'DK0'); e('DK1', 'DKX');
  e('L1', 'SV0', { barricade: 'B2' });
  e('DK0', 'NC0');
  e('SV0', 'SVE1'); e('SV0', 'SVW1'); e('SVW1', 'SVW2'); e('SVW2', 'SVW3'); e('SVW3', 'SVN'); e('SVN', 'NC0');
  e('SVE1', 'SVE2'); e('SVE2', 'SVE3'); e('SVW2', 'SVE2'); e('SVE3', 'SVW3');
  e('SVE1', 'LB1'); e('SVE3', 'DR_W');
  e('LB0', 'LB1'); e('LB0', 'LB2'); e('LB1', 'LB3'); e('LB2', 'LB3');
  e('LB3', 'DR_S', { door: 'D1' });
  e('DR_S', 'DR_W'); e('DR_S', 'DR_E'); e('DR_N', 'DR_W'); e('DR_N', 'DR_E'); e('DR_N', 'NC2');
  e('LB2', 'O1', { door: 'D2' }); e('O1', 'O0'); e('O1', 'O2'); e('O0', 'O2'); e('O2', 'C1');
  e('DR_E', 'MR0'); e('MR0', 'MR1'); e('MR1', 'C0'); e('C0', 'C1'); e('C0', 'C2'); e('C2', 'NC4');
  e('NC0', 'NC1'); e('NC1', 'NC2'); e('NC2', 'NC3'); e('NC3', 'NC4');
  e('NC4', 'G0', { door: 'D4' }); e('G0', 'G1'); e('G0', 'G2'); e('G1', 'GX'); e('G2', 'GX');

  // ------------------------------------------------------------- bots
  // Defensive roles. `posts` = candidate guard nodes (one picked per round),
  // `look` = facing yaw at post (0 = north / -z, +PI/2 = west).
  L.bots = [
    { name: 'WARDEN', role: 'guard', posts: [['DR_W', -Math.PI / 2], ['DR_E', Math.PI / 2], ['DR_N', Math.PI]], patrol: ['DR_W', 'DR_S', 'DR_E', 'DR_N'] },
    { name: 'SENTRY', role: 'patrol', posts: [['LB3', Math.PI], ['LB1', Math.PI * 0.85], ['O2', Math.PI]], patrol: ['LB3', 'LB2', 'O1', 'O2', 'C1', 'O2', 'O1', 'LB2'] },
    { name: 'HOUND', role: 'patrol', posts: [['SVW2', Math.PI], ['SVE2', Math.PI], ['NC0', Math.PI / 2]], patrol: ['SVE2', 'SVW2', 'SVW1', 'SV0', 'SVE1', 'SVE2', 'SVE3', 'SVW3', 'SVN', 'NC0', 'DK0', 'NC0', 'SVN', 'SVW3'] },
    { name: 'GHOST', role: 'patrol', posts: [['C2', Math.PI], ['NC3', Math.PI / 2]], patrol: ['C2', 'NC4', 'NC3', 'NC2', 'NC3', 'NC4', 'C2', 'C0', 'MR1', 'C0'] },
  ];

  return L;
}

function surfaceOf(mat) {
  if (/metal|rack|terminal|console|electrical|shutter|car|van|truck|trailer|vending|pole|dumpster|kiosk/.test(mat)) return 'metal';
  if (/crate|wood|pallet|shelf|counter|desk|cabinet|bench/.test(mat)) return 'wood';
  if (/glass/.test(mat)) return 'metal';
  if (/ground|asphalt/.test(mat)) return 'outdoor';
  return 'concrete';
}

export function areaAt(layout, x, z) {
  for (const a of layout.areas) if (x >= a.min.x && x <= a.max.x && z >= a.min.z && z <= a.max.z) return a;
  return null;
}
