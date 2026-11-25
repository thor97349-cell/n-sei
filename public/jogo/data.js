// FAÍSCA — dados do jogo: armas, passivas, inimigos, núcleos, oficina e conquistas.
"use strict";
window.F = window.F || {};

(function (F) {
  // Cada arma tem 5 níveis; `lv` lista o que muda em cada nível (acumulativo).
  F.WEAPONS = {
    pulso: {
      name: "Pulso", icon: "✦", color: "#7df9ff",
      desc: "Dispara projéteis no inimigo mais próximo.",
      lv: [
        { dmg: 10, cd: 0.6, count: 1, pierce: 1, speed: 560, txt: "Dispara projéteis no inimigo mais próximo." },
        { count: 2, txt: "+1 projétil" },
        { dmg: 14, pierce: 2, txt: "+40% dano, atravessa +1" },
        { cd: 0.48, count: 3, txt: "+1 projétil, dispara mais rápido" },
        { dmg: 20, count: 4, pierce: 3, txt: "+1 projétil, +40% dano, atravessa +1" },
      ],
      evo: { needs: "ritmo", name: "Tempestade de Pulsos", txt: "Rajadas em todas as direções.", dmg: 26, cd: 0.38, count: 4, pierce: 4, speed: 640, ring: 14 },
    },
    orbita: {
      name: "Órbita", icon: "◉", color: "#c58bff",
      desc: "Esferas giram ao seu redor e destroem o que tocam.",
      lv: [
        { dmg: 11, count: 2, radius: 72, spin: 3.2, size: 10, txt: "Esferas giram ao seu redor e destroem o que tocam." },
        { count: 3, txt: "+1 esfera" },
        { dmg: 16, radius: 86, txt: "+45% dano, órbita maior" },
        { count: 4, spin: 3.8, txt: "+1 esfera, gira mais rápido" },
        { count: 5, dmg: 22, size: 13, txt: "+1 esfera, +37% dano, esferas maiores" },
      ],
      evo: { needs: "alcance", name: "Anel Solar", txt: "Dois anéis de sóis em sentidos opostos.", dmg: 34, count: 7, radius: 118, spin: 4, size: 16, inner: 4 },
    },
    raio: {
      name: "Raio", icon: "ϟ", color: "#ffe14d",
      desc: "Relâmpago que salta entre inimigos próximos.",
      lv: [
        { dmg: 18, cd: 1.5, chains: 2, strikes: 1, range: 150, txt: "Relâmpago que salta entre inimigos próximos." },
        { chains: 3, txt: "+1 salto" },
        { dmg: 26, txt: "+45% dano" },
        { cd: 1.15, strikes: 2, txt: "+1 raio simultâneo, recarga menor" },
        { dmg: 36, chains: 5, txt: "+2 saltos, +40% dano" },
      ],
      evo: { needs: "precisao", name: "Tempestade Elétrica", txt: "Três raios em cadeia, com crítico extra.", dmg: 48, cd: 0.6, chains: 6, strikes: 3, range: 190, crit: 0.25 },
    },
    nova: {
      name: "Nova", icon: "◎", color: "#ff9f43",
      desc: "Onda de choque que empurra e fere tudo ao redor.",
      lv: [
        { dmg: 14, cd: 3, radius: 140, push: 220, txt: "Onda de choque que empurra e fere tudo ao redor." },
        { radius: 165, txt: "Onda maior" },
        { dmg: 22, txt: "+57% dano" },
        { cd: 2.4, radius: 190, txt: "Onda maior e mais frequente" },
        { dmg: 32, radius: 220, txt: "+45% dano, onda maior" },
      ],
      evo: { needs: "nucleo", name: "Supernova", txt: "Ondas gigantes que curam você a cada inimigo atingido.", dmg: 48, cd: 1.8, radius: 290, push: 300, heal: 0.6 },
    },
    enxame: {
      name: "Enxame", icon: "➶", color: "#5dff9c",
      desc: "Mísseis teleguiados que explodem em área.",
      lv: [
        { dmg: 20, cd: 2.2, count: 2, blast: 50, txt: "Mísseis teleguiados que explodem em área." },
        { count: 3, txt: "+1 míssil" },
        { dmg: 28, blast: 60, txt: "+40% dano, explosão maior" },
        { cd: 1.8, count: 4, txt: "+1 míssil, recarga menor" },
        { dmg: 38, count: 5, blast: 70, txt: "+1 míssil, +35% dano" },
      ],
      evo: { needs: "eco", name: "Chuva de Mísseis", txt: "Uma revoada de mísseis devastadores.", dmg: 50, cd: 1.2, count: 8, blast: 86 },
    },
    feixe: {
      name: "Feixe", icon: "═", color: "#ff6bd6",
      desc: "Laser que atravessa tudo em linha reta.",
      lv: [
        { dmg: 22, cd: 1.8, beams: 1, len: 380, width: 10, txt: "Laser que atravessa tudo em linha reta." },
        { len: 470, txt: "Laser mais longo" },
        { dmg: 32, txt: "+45% dano" },
        { cd: 1.4, beams: 2, txt: "+1 laser, recarga menor" },
        { dmg: 45, width: 16, txt: "+40% dano, laser mais grosso" },
      ],
      evo: { needs: "propulsao", name: "Prisma", txt: "Estrela de lasers que gira sem parar.", dmg: 60, cd: 0.9, beams: 5, len: 560, width: 22, star: true },
    },
    rastro: {
      name: "Rastro", icon: "✸", color: "#ff5252",
      desc: "Deixa minas pelo caminho que explodem ao contato.",
      lv: [
        { dmg: 26, cd: 1.0, blast: 56, count: 1, life: 7, txt: "Deixa minas pelo caminho que explodem ao contato." },
        { cd: 0.8, txt: "Minas mais frequentes" },
        { dmg: 36, blast: 66, txt: "+40% dano, explosão maior" },
        { count: 2, txt: "+1 mina por vez" },
        { dmg: 50, blast: 76, txt: "+40% dano, explosão maior" },
      ],
      evo: { needs: "ima", name: "Cometa", txt: "Um rastro de fogo de minas gigantes.", dmg: 70, cd: 0.4, blast: 92, count: 2, life: 8 },
    },
  };

  F.PASSIVES = {
    potencia: { name: "Potência", icon: "▲", color: "#ff6b6b", max: 5, txt: "+10% de dano" },
    ritmo: { name: "Ritmo", icon: "⟳", color: "#7df9ff", max: 5, txt: "-7% de recarga das armas" },
    alcance: { name: "Alcance", icon: "◌", color: "#c58bff", max: 5, txt: "+10% de área" },
    eco: { name: "Eco", icon: "⁂", color: "#5dff9c", max: 2, txt: "+1 projétil em armas de quantidade" },
    precisao: { name: "Precisão", icon: "⌖", color: "#ffe14d", max: 5, txt: "+5% de chance de crítico (dano x2)" },
    nucleo: { name: "Núcleo", icon: "♥", color: "#ff4d8d", max: 5, txt: "+20 de vida máxima e cura 20" },
    regen: { name: "Regeneração", icon: "✚", color: "#7dff7d", max: 5, txt: "+0,3 de vida por segundo" },
    propulsao: { name: "Propulsão", icon: "»", color: "#9ad0ff", max: 5, txt: "+7% de velocidade" },
    ima: { name: "Ímã", icon: "∪", color: "#4dd2ff", max: 5, txt: "+25% de alcance de coleta" },
    sorte: { name: "Sorte", icon: "♣", color: "#7dffb0", max: 5, txt: "+10% de sorte (raros, ouro e baús)" },
    blindagem: { name: "Blindagem", icon: "⬢", color: "#b0b8c8", max: 3, txt: "-1 de dano recebido" },
    sabedoria: { name: "Sabedoria", icon: "✧", color: "#ffd36b", max: 5, txt: "+8% de experiência" },
  };

  // r: raio, hp: vida base, spd: velocidade, dmg: dano de contato, xp: valor do cristal
  F.ENEMIES = {
    ponto: { r: 10, hp: 8, spd: 72, dmg: 8, xp: 1, color: "#ff3d7f", shape: "circle" },
    flecha: { r: 9, hp: 5, spd: 135, dmg: 6, xp: 1, color: "#ff8a3d", shape: "tri" },
    bloco: { r: 18, hp: 42, spd: 46, dmg: 14, xp: 4, color: "#b04dff", shape: "square" },
    divisor: { r: 14, hp: 20, spd: 66, dmg: 10, xp: 2, color: "#ff4dd2", shape: "diamond" },
    mini: { r: 7, hp: 5, spd: 100, dmg: 5, xp: 1, color: "#ff4dd2", shape: "diamond" },
    olho: { r: 13, hp: 18, spd: 62, dmg: 9, xp: 3, color: "#ffd23d", shape: "hex", shooter: true },
    investida: { r: 12, hp: 24, spd: 52, dmg: 12, xp: 3, color: "#ff2e2e", shape: "arrow", dasher: true },
  };

  F.BOSSES = [
    { at: 150, id: "colosso", name: "COLOSSO", hp: 2200, r: 46, spd: 58, dmg: 22, color: "#ff3d7f", shape: "square", sides: 4, patterns: ["burst", "summon"] },
    { at: 300, id: "hidra", name: "HIDRA", hp: 8000, r: 44, spd: 70, dmg: 26, color: "#ff8a3d", shape: "poly", sides: 5, patterns: ["dash", "spiral", "summon"] },
    { at: 450, id: "teceloa", name: "TECELÃ", hp: 26000, r: 42, spd: 64, dmg: 30, color: "#c58bff", shape: "poly", sides: 6, patterns: ["spiral", "blink", "burst"] },
    { at: 600, id: "singularidade", name: "SINGULARIDADE", hp: 95000, r: 56, spd: 72, dmg: 34, color: "#ffffff", shape: "poly", sides: 8, patterns: ["burst", "dash", "spiral", "blink", "summon"], final: true },
  ];

  F.CHARACTERS = [
    { id: "faisca", name: "Faísca", weapon: "pulso", color: "#7df9ff", perk: "Equilibrada. Começa com Pulso.", mods: {}, unlock: null },
    { id: "cometa", name: "Cometa", weapon: "rastro", color: "#ff5252", perk: "+12% de velocidade. Começa com Rastro.", mods: { speed: 0.12 }, unlock: "abates1k" },
    { id: "vortice", name: "Vórtice", weapon: "orbita", color: "#c58bff", perk: "+10% de área. Começa com Órbita.", mods: { area: 0.1 }, unlock: "chefe1" },
    { id: "tesla", name: "Tesla", weapon: "raio", color: "#ffe14d", perk: "+8% de crítico. Começa com Raio.", mods: { crit: 0.08 }, unlock: "combo100" },
    { id: "pulsar", name: "Pulsar", weapon: "nova", color: "#ff9f43", perk: "+30 de vida, -5% de velocidade. Começa com Nova.", mods: { hp: 30, speed: -0.05 }, unlock: "min5" },
    { id: "cacador", name: "Caçador", weapon: "enxame", color: "#5dff9c", perk: "+15% de sorte. Começa com Enxame.", mods: { luck: 0.15 }, unlock: "evolucao" },
    { id: "prisma", name: "Prisma", weapon: "feixe", color: "#ff6bd6", perk: "+10% de dano. Começa com Feixe.", mods: { dmg: 0.1 }, unlock: "vitoria" },
  ];

  // Melhorias permanentes compradas com ouro entre partidas.
  F.SHOP = [
    { id: "dano", name: "Potência base", icon: "▲", max: 5, base: 70, txt: "+5% de dano por nível" },
    { id: "vida", name: "Casco", icon: "♥", max: 5, base: 55, txt: "+12 de vida máxima por nível" },
    { id: "cadencia", name: "Sobrecarga", icon: "⟳", max: 3, base: 130, txt: "-4% de recarga por nível" },
    { id: "veloc", name: "Turbina", icon: "»", max: 3, base: 90, txt: "+4% de velocidade por nível" },
    { id: "ima", name: "Campo magnético", icon: "∪", max: 3, base: 60, txt: "+15% de alcance de coleta por nível" },
    { id: "regen", name: "Reparo", icon: "✚", max: 3, base: 110, txt: "+0,2 de vida por segundo por nível" },
    { id: "ouro", name: "Avareza", icon: "◆", max: 5, base: 90, txt: "+12% de ouro por nível" },
    { id: "xp", name: "Intuição", icon: "✧", max: 5, base: 80, txt: "+6% de experiência por nível" },
    { id: "sorte", name: "Trevo", icon: "♣", max: 3, base: 120, txt: "+8% de sorte por nível" },
    { id: "reroll", name: "Segunda chance", icon: "↻", max: 3, base: 140, txt: "+1 sorteio novo de cartas por partida" },
    { id: "armadura", name: "Couraça", icon: "⬢", max: 2, base: 220, txt: "-1 de dano recebido por nível" },
    { id: "reviver", name: "Fênix", icon: "✺", max: 1, base: 700, txt: "Renasce uma vez por partida com metade da vida" },
  ];
  F.shopCost = (item, lvl) => Math.round((item.base * Math.pow(1.75, lvl)) / 5) * 5;

  // check(s): s = estatísticas acumuladas + da partida atual
  F.ACHIEVEMENTS = [
    { id: "primeira", name: "Primeira faísca", txt: "Termine sua primeira partida", gold: 20, check: (s) => s.runs >= 1 },
    { id: "min3", name: "Pegando o jeito", txt: "Sobreviva 3 minutos", gold: 60, check: (s) => s.bestTime >= 180 },
    { id: "min5", name: "Sobrevivente", txt: "Sobreviva 5 minutos", gold: 120, check: (s) => s.bestTime >= 300, prog: (s) => [s.bestTime, 300, "s"] },
    { id: "chefe1", name: "Caçador de chefes", txt: "Derrote o Colosso", gold: 150, check: (s) => s.bossKills >= 1 },
    { id: "abates1k", name: "Exterminador", txt: "1.000 abates no total", gold: 100, check: (s) => s.kills >= 1000, prog: (s) => [s.kills, 1000] },
    { id: "combo100", name: "Em chamas", txt: "Faça um combo de 150", gold: 100, check: (s) => s.bestCombo >= 150, prog: (s) => [s.bestCombo, 150] },
    { id: "evolucao", name: "Metamorfose", txt: "Evolua uma arma", gold: 150, check: (s) => s.evolutions >= 1 },
    { id: "nivel20", name: "Ascensão", txt: "Chegue ao nível 20 numa partida", gold: 120, check: (s) => s.bestLevel >= 20, prog: (s) => [s.bestLevel, 20] },
    { id: "arsenal", name: "Arsenal completo", txt: "Tenha 6 armas ao mesmo tempo", gold: 200, check: (s) => s.maxWeapons >= 6, prog: (s) => [s.maxWeapons, 6] },
    { id: "intocavel", name: "Intocável", txt: "Depois dos 2 minutos, fique 60 segundos sem levar dano", gold: 150, check: (s) => s.bestNoHit >= 60, prog: (s) => [Math.floor(s.bestNoHit), 60, "s"] },
    { id: "combo500", name: "Inferno", txt: "Faça um combo de 1.000", gold: 300, check: (s) => s.bestCombo >= 1000, prog: (s) => [s.bestCombo, 1000] },
    { id: "abates10k", name: "Massacre", txt: "10.000 abates no total", gold: 400, check: (s) => s.kills >= 10000, prog: (s) => [s.kills, 10000] },
    { id: "chefe3", name: "Lenda", txt: "Derrote 3 chefões numa partida", gold: 300, check: (s) => s.bestBossRun >= 3, prog: (s) => [s.bestBossRun, 3] },
    { id: "vitoria", name: "Além do enxame", txt: "Derrote a Singularidade", gold: 600, check: (s) => s.wins >= 1 },
    { id: "rico", name: "Tesouro", txt: "Junte 3.000 de ouro no total", gold: 150, check: (s) => s.goldTotal >= 3000, prog: (s) => [s.goldTotal, 3000] },
    { id: "min15", name: "Infinito", txt: "Sobreviva 15 minutos", gold: 800, check: (s) => s.bestTime >= 900, prog: (s) => [s.bestTime, 900, "s"] },
    { id: "todos", name: "Constelação", txt: "Desbloqueie todos os núcleos", gold: 500, check: (s) => s.charsUnlocked >= 7, prog: (s) => [s.charsUnlocked, 7] },
  ];

  F.TIPS = [
    "Cada arma no nível máximo evolui se você tiver a passiva certa. Abra os baús dos inimigos dourados!",
    "Abates em sequência aumentam o combo, que multiplica a experiência. Levar dano zera o combo!",
    "Cristais dourados valem 100 de experiência. Os chefões sempre deixam um.",
    "O primeiro jogo do dia rende ouro em dobro.",
    "Corações curam, o vórtice puxa todos os cristais e a bomba limpa a tela.",
    "Cartas douradas dão 2 níveis de uma vez. A Sorte aumenta a chance delas.",
    "Inimigos amarelos atiram de longe. Mantenha-se em movimento.",
    "Os vermelhos em forma de seta param antes de investir. Desvie para o lado!",
    "Na Oficina, cada ouro gasto deixa a próxima partida mais forte.",
    "Pressione R na tela de cartas para sortear de novo.",
  ];
})(window.F);
