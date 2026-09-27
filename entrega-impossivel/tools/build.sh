#!/usr/bin/env bash
# Gera o arquivo final do jogo (build/EntregaImpossivel.rbxl) e roda os testes.
# Requer rojo e lune no PATH (veja rokit.toml). Uso: ./tools/build.sh
set -euo pipefail
cd "$(dirname "$0")/.."

ROJO="${ROJO:-rojo}"
LUNE="${LUNE:-lune}"

mkdir -p build
"$ROJO" build default.project.json -o build/_base.rbxl
"$LUNE" run tools/run_tests.luau build/_base.rbxl
"$LUNE" run tools/bake_map.luau build/_base.rbxl build/EntregaImpossivel.rbxl
rm -f build/_base.rbxl
echo "Pronto: build/EntregaImpossivel.rbxl"
