# HoraCerta

🔗 **Deploy:** https://n-sei-red.vercel.app

MVP de marketplace de expertise sênior por hora: conecta pequenos negócios
locais (salões, restaurantes, lojas, clínicas) a profissionais seniores
experientes (contadores, advogados, designers, engenheiros) para ajuda
pontual, cobrada por hora, sem contratação fixa.

Esta v1 é intencionalmente simples: dois formulários de cadastro (um para
profissionais, um para negócios) e um painel interno onde o match é feito
manualmente, via WhatsApp, antes de qualquer automação.

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript + Tailwind CSS
- Postgres (via [Neon](https://neon.tech), usando `@neondatabase/serverless`)
  — funciona em serverless/edge, incluindo o ambiente da Vercel

## Deploy na Vercel

1. Acesse [vercel.com](https://vercel.com), entre com sua conta GitHub e
   clique em **Add New → Project**.
2. Importe o repositório `n-sei` e selecione o branch com o código deste
   projeto. A Vercel detecta o framework (Next.js) automaticamente — não
   precisa mudar nenhuma configuração de build.
3. Antes ou depois do primeiro deploy, adicione um banco de dados: na aba
   **Storage** do projeto, clique em **Create Database** e escolha
   **Postgres (Neon)**. Ao conectar ao projeto, a variável `DATABASE_URL`
   é criada automaticamente — não precisa copiar nada manualmente.
4. Em **Settings → Environment Variables**, adicione `ADMIN_PASSWORD` com
   a senha que você quer usar para acessar o painel `/admin`.
5. Clique em **Deploy**. Ao final você recebe uma URL pública
   (`algumacoisa.vercel.app`) para acessar no navegador.

Sem o passo 3, o site sobe normalmente, mas os formulários de cadastro
falham ao salvar — o app não guarda nada em disco (não funcionaria em uma
função serverless), por isso depende do Postgres.

## Rodando localmente

Requer uma `DATABASE_URL` de Postgres (por exemplo, o mesmo banco Neon
criado na Vercel, ou um banco Neon próprio criado em neon.tech):

```bash
npm install
DATABASE_URL="postgres://..." ADMIN_PASSWORD=sua-senha npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). As tabelas são
criadas automaticamente na primeira consulta.

## Estrutura

- `/` — landing page explicando a proposta para os dois lados
- `/profissionais` — cadastro de profissionais (área de expertise, anos de
  experiência, valor da hora, disponibilidade)
- `/negocios` — cadastro de negócios (tipo de ajuda, urgência, orçamento)
- `/admin` — painel interno para visualizar os cadastros e fazer o match
  manual, com controle de status de cada lead (novo, em contato, match
  feito, fechado, sem interesse), filtros (área/tipo, cidade, status) e
  exportação em CSV

## Painel interno (`/admin`)

Protegido por senha simples via variável de ambiente:

```bash
ADMIN_PASSWORD=sua-senha-aqui
```

Se `ADMIN_PASSWORD` não for definida, a senha padrão de desenvolvimento é
`changeme123` — defina uma senha real antes de publicar em produção.

## Alerta por e-mail de novo lead (opcional)

Quando um profissional ou negócio se cadastra, o app pode enviar um e-mail
de aviso automaticamente, usando [Resend](https://resend.com) (tem plano
gratuito, sem cartão de crédito):

1. Crie uma conta grátis em [resend.com](https://resend.com) e gere uma
   **API Key** em Settings → API Keys.
2. Na Vercel, em **Settings → Environment Variables**, adicione:
   - `RESEND_API_KEY` — a chave gerada no passo anterior
   - `ALERT_EMAIL_TO` — o e-mail que deve receber os avisos
3. Redeploy.

Sem verificar um domínio próprio no Resend (etapa mais avançada, não
necessária pra começar), a conta grátis só permite enviar para o
**mesmo e-mail usado no cadastro da conta Resend** — então use esse e-mail
em `ALERT_EMAIL_TO`. Se essas variáveis não forem definidas, o app
funciona normalmente e simplesmente não envia alerta (os cadastros
continuam salvos e visíveis no painel `/admin` de qualquer forma).

## Modelo de negócio

Cadastro gratuito para os dois lados. Comissão de 15–20% sobre o valor da
hora é cobrada apenas quando um match é efetivamente fechado (processo
hoje acompanhado manualmente através do painel `/admin`).

O formulário de negócios também pergunta quanto a pessoa pagaria por hora
por esse tipo de ajuda (opcional, dado de pesquisa de precificação) — e
cada lead no painel `/admin` tem um campo de **status de pagamento**
(pendente / cobrado / pago), hoje atualizado manualmente. Nenhum pagamento
é processado pelo app ainda; é só a estrutura de dados já pronta para
quando a cobrança da comissão for automatizada.

## FoodCreator Editor (editor de vídeos no site)

Página **`/editor`** (por exemplo, https://n-sei-red.vercel.app/editor depois do deploy):
edição automática de vídeos de culinária para YouTube (16:9) e Shorts (9:16), feita
**inteiramente no navegador** com [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm).
O vídeo não é enviado a nenhum servidor e não há custo de processamento.

O que ela faz:

- corta silêncios, mantendo uma margem perto da fala e encurtando (sem eliminar)
  pausas longas de degustação;
- três estilos de edição (avaliação, receita e desafio), que mudam os cortes e os zooms;
- zooms discretos nos cortes para disfarçar as emendas;
- Shorts a partir de vídeo deitado: recorte com posição ajustável ou encaixe com fundo
  desfocado;
- música de fundo opcional (exige confirmar a licença), que abaixa quando há fala;
- exporta MP4 H.264 + AAC, confere o arquivo final e mostra a prévia e o botão de download;
- cancelamento a qualquer momento.

### Como funciona

São arquivos estáticos em `public/editor/`, servidos pelo próprio Next.js (o
`next.config.ts` faz `/editor` abrir `/editor/index.html`):

| Arquivo | Papel |
|---|---|
| `pipeline.js` | regras de edição (cortes, enquadramento, zoom, áudio), funções puras |
| `editor.js` | orquestra uma edição: analisar → detectar pausas → renderizar → conferir |
| `ffmpeg-worker.js` | Web Worker que roda o ffmpeg.wasm sem travar a página |
| `ffmpeg-client.js` | conversa com o worker; cancelar = encerrar o worker |
| `app.js` / `index.html` | a tela |

O ffmpeg.wasm (pacote `@ffmpeg/core`, versão travada no `package.json`) é copiado
para `public/editor/vendor/` por `scripts/copy-ffmpeg-core.mjs` no `npm install` e no
`npm run build`. Assim o site não depende de CDN. A pasta não vai para o git.

### Rodar localmente

```bash
npm install          # também copia o ffmpeg.wasm
npm run dev          # abra http://localhost:3000/editor
```

### Testes

```bash
npm run test:editor  # regras de edição + edição real com ffmpeg.wasm no Node
```

O teste com ffmpeg.wasm precisa do `ffmpeg` do sistema só para gerar o vídeo de teste;
sem ele, o teste é pulado e o motivo aparece na saída. O teste no navegador (Chromium
via Playwright) está em `tests/editor/e2e-browser.mjs`, com instruções no topo do arquivo.

### Limitações conhecidas

- **Velocidade:** é bem mais lento que um programa instalado. Medido em Chromium: um
  vídeo de 12 s em 720p levou cerca de 26–30 s (Shorts e YouTube). Em 1080p, cada segundo
  de vídeo levou ~7 s nos testes. Vídeos longos podem levar muito tempo, e a aba precisa
  ficar aberta.
- **Memória:** o navegador tem limite de memória para o ffmpeg.wasm. O vídeo de entrada é
  lido aos pedaços, mas o arquivo final fica na memória até o download.
- **Sem legendas automáticas** no site (por enquanto).
- **Sem detecção de rosto ou de comida:** o recorte vertical é central (ou na posição
  escolhida), e a página avisa para conferir.
- Testado em Chromium no Linux. Ainda não foi testado em Chrome/Edge no Windows,
  no Safari ou no celular.

## Outros projetos neste repositório


- [`foodcreator-editor/`](foodcreator-editor/README.md): primeira versão do editor, como
  aplicativo desktop (Python + PySide6 + FFmpeg). Foi substituída pelo editor no site
  (`/editor`), que usa as mesmas regras de edição; fica no repositório como referência.
