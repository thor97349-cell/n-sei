# ENTREGA IMPOSSÍVEL — notas para desenvolvimento

Projeto Roblox (Luau) sincronizado com Rojo. Não tem relação com o app Next.js da raiz do
repositório — ignore o AGENTS.md da raiz ao trabalhar aqui.

- Código em `src/` (mapeado por `default.project.json`). Todo módulo usa `--!strict`.
- Servidor: `ServerScriptService/Server` (serviços com `Init`/`Start`, ligados por
  `Main.server.luau`). Cliente: `StarterPlayer/StarterPlayerScripts/Client` (controladores).
  Compartilhado: `ReplicatedStorage/Shared` (configs, MapLayout, DeliveryRules, utilitários).
- Regras de jogo e dinheiro são decididas SÓ no servidor; o cliente só envia pedidos pelos
  RemoteEvents listados em `Shared/Util/Remotes.luau` (sempre valide tipo e use RateLimiter).
- `MapBuilder` roda também no Lune (build): use só APIs básicas de Instance (sem PivotTo,
  sem ler `Part.Position`, use `FontFace` em vez de `Font`).
- Antes de commitar:
  - `./tools/check.sh` — tipos (luau-lsp + definições da API do Roblox) e StyLua;
  - `./tools/build.sh` — testes (`tools/tests`, 65+) e gera `build/EntregaImpossivel.rbxl`
    (versionado de propósito: é o arquivo que o dono do projeto abre no Studio).
- Ferramentas: `rokit.toml` (rojo, lune, stylua, luau-lsp).
