#!/usr/bin/env bash
# Verifica tipos (contra a API real do Roblox) e formatação do código.
# Requer rojo, luau-lsp e stylua no PATH (veja rokit.toml). Uso: ./tools/check.sh
set -euo pipefail
cd "$(dirname "$0")/.."

ROJO="${ROJO:-rojo}"
LUAU_LSP="${LUAU_LSP:-luau-lsp}"
STYLUA="${STYLUA:-stylua}"

mkdir -p build/.cache
DEFS=build/.cache/globalTypes.d.luau
if [ ! -f "$DEFS" ]; then
	curl -sSL -o "$DEFS" https://raw.githubusercontent.com/JohnnyMorganz/luau-lsp/main/scripts/globalTypes.d.luau
fi
"$ROJO" sourcemap default.project.json -o build/.cache/sourcemap.json
OUTPUT=$("$LUAU_LSP" analyze --definitions=@roblox="$DEFS" --sourcemap=build/.cache/sourcemap.json --platform=roblox src/ 2>&1 | grep -v '^\[' || true)
if [ -n "$OUTPUT" ]; then
	echo "$OUTPUT"
	exit 1
fi
"$STYLUA" --check src tools
echo "Tipos e formatação OK"
