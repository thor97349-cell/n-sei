# Justo

O sistema de transparência para trabalhos em grupo escolares: registra o
peso de cada tarefa, guarda evidência de quem fez o quê, deixa o grupo
confirmar ou contestar cada conclusão e classifica a contribuição de cada
membro — para acabar com a injustiça de nota quando 1 ou 2 pessoas fazem a
maior parte do trabalho.

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript + Tailwind CSS
- Postgres (via [Neon](https://neon.tech), usando `@neondatabase/serverless`)
  — funciona em serverless/edge, incluindo o ambiente da Vercel
- [pdf-lib](https://pdf-lib.js.org) para gerar o relatório de contribuição
  em PDF direto no servidor
- [Auth.js](https://authjs.dev) (`next-auth` v5) com login via Google

> **Por que Postgres em vez de SQLite?** O pedido original sugeria SQLite
> via `better-sqlite3`, mas cada projeto no Justo é acessado por **vários
> membros ao mesmo tempo**, de dispositivos diferentes, e o deploy alvo é a
> Vercel (serverless). SQLite grava em disco local, que não é persistente
> nem compartilhado entre execuções serverless — o mesmo problema que já
> tinha aparecido no projeto anterior deste repositório. Neon Postgres
> resolve isso sem custo (tem plano gratuito) e sem precisar gerenciar
> servidor.

## Deploy na Vercel

1. Acesse [vercel.com](https://vercel.com), entre com sua conta GitHub e
   clique em **Add New → Project**.
2. Importe o repositório `n-sei` e selecione o branch com o código deste
   projeto. A Vercel detecta o framework (Next.js) automaticamente.
3. Antes ou depois do primeiro deploy, adicione um banco de dados: na aba
   **Storage** do projeto, clique em **Create Database** e escolha
   **Postgres (Neon)**. Ao conectar ao projeto, a variável `DATABASE_URL`
   é criada automaticamente.
4. Configure o login com Google — veja a seção abaixo — e adicione
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `AUTH_SECRET` em
   **Settings → Environment Variables**.
5. Clique em **Deploy**. Ao final você recebe uma URL pública
   (`algumacoisa.vercel.app`) para acessar no navegador.

Sem o passo 3, o site sobe normalmente, mas criar um projeto falha ao
salvar. Sem o passo 4, o botão "Entrar com Google" quebra — nenhuma tela
que depende de estar logado funciona sem isso.

## Configurando o login com Google

O Justo usa [Auth.js](https://authjs.dev) com o provedor Google. Isso exige
criar um app OAuth no Google — só quem administra o projeto precisa fazer
isso uma vez:

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   e crie um projeto (ou use um existente).
2. Configure a **tela de consentimento OAuth** (OAuth consent screen) —
   tipo "Externo" funciona para uso geral; preencha nome do app e e-mail
   de contato.
3. Em **Credentials → Create Credentials → OAuth client ID**, escolha
   **Web application** e adicione as **Authorized redirect URIs**:
   - `http://localhost:3000/api/auth/callback/google` (desenvolvimento local)
   - `https://SEU-DOMINIO.vercel.app/api/auth/callback/google` (produção —
     troque pelo domínio real do deploy)
4. Copie o **Client ID** e o **Client Secret** gerados.
5. Defina as variáveis de ambiente (local em `.env.local`, na Vercel em
   **Settings → Environment Variables**):
   ```bash
   GOOGLE_CLIENT_ID="seu-client-id"
   GOOGLE_CLIENT_SECRET="seu-client-secret"
   AUTH_SECRET="uma-string-aleatoria-longa"
   ```
   Gere o `AUTH_SECRET` com `npx auth secret` ou `openssl rand -base64 32`.

## Rodando localmente

Requer uma `DATABASE_URL` de Postgres e as variáveis do Google acima, em
um arquivo `.env.local` (não é commitado):

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). As tabelas são
criadas automaticamente na primeira consulta.

## Fluxo

1. **Landing page (`/`)** — explica o problema e a solução, com um botão
   para criar um projeto.
2. **Criar projeto (`/criar`)** — pede login com Google, depois nome do
   trabalho, descrição e prazo final. Quem cria já entra como o primeiro
   membro do projeto, com o nome e e-mail vindos da conta Google.
3. **Convidar membros** — dentro do projeto, um link de convite
   (`/entrar/[token]`) pode ser compartilhado por WhatsApp. Quem recebe o
   link entra com a própria conta Google e já é adicionado ao projeto
   automaticamente — sem formulário pra preencher.
4. **Dividir tarefas (aba "Tarefas")** — qualquer membro pode criar uma
   tarefa com título, descrição, responsável, prazo e **peso** (1 a 5 —
   "rápida" a "muito grande"). O peso é o que conta na contribuição de
   quem concluir, não a simples contagem de tarefas.
5. **Marcar progresso e evidência** — cada membro só pode iniciar/concluir
   as tarefas das quais é responsável. Ao concluir, escolhe um tipo de
   evidência: nota manual, link externo (Google Docs, Drive, GitHub,
   Canva...) ou arquivo anexado (até 2MB) — ou nenhuma. Criação, mudança de
   status e conclusão são registradas automaticamente com data/hora, sem
   o usuário precisar digitar nada disso.
6. **Confirmar ou contestar** — depois que alguém marca uma tarefa como
   concluída, qualquer outro membro (menos quem a concluiu) pode confirmar
   ou contestar com um clique. Sem campo de comentário — só um registro
   simples de "X confirmaram, Y contestaram", sem julgar quem está certo.
7. **Acompanhar contribuição (aba "Progresso")** — classifica cada membro
   em alta / moderada / baixa contribuição, calculado a partir do peso das
   tarefas concluídas e da proporção com evidência anexada. Também
   destaca tarefas atrasadas e mostra uma linha do tempo de conclusões. Ao
   clicar num membro, expande um resumo (tarefas concluídas, evidências
   anexadas, dias de participação ativa).
8. **Relatório PDF (`/p/[id]/relatorio`)** — gera na hora um PDF de uma
   página com o nome do projeto, o prazo e, para cada membro, o nível de
   contribuição, os pontos de peso concluídos e a lista de tarefas
   concluídas com prazo, data de conclusão, evidência e confirmações —
   pronto para anexar ao trabalho ou mostrar ao professor.

## Identificação com login Google

A identidade de cada membro vem da própria conta Google (nome + e-mail
verificados) — ninguém digita quem é, então ninguém consegue se passar por
outra pessoa do grupo (o problema do modelo anterior, baseado em nome +
e-mail digitados). A sessão é gerenciada pelo Auth.js; ao visitar um
projeto logado, a pessoa é automaticamente adicionada como membro (mesmo
comportamento de baixo atrito de antes, só que com identidade real). Usar
a mesma conta Google de novo, em outro aparelho, continua reconhecendo a
mesma pessoa.

## Estrutura

- `/` — landing page
- `/criar` — cria o projeto (exige login com Google)
- `/entrar/[token]` — página de convite (exige login com Google; entra e
  já é adicionado ao projeto automaticamente)
- `/p/[id]` — painel do projeto (abas Tarefas / Progresso), com o link de
  convite para compartilhar
- `/p/[id]/relatorio` — gera e baixa o relatório em PDF
- `/api/auth/[...nextauth]` — rotas do Auth.js (login/logout/callback do
  Google)
