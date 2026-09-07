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
4. Clique em **Deploy**. Ao final você recebe uma URL pública
   (`algumacoisa.vercel.app`) para acessar no navegador.

Sem o passo 3, o site sobe normalmente, mas criar um projeto falha ao
salvar — o app não guarda nada em disco (não funcionaria em uma função
serverless), por isso depende do Postgres.

## Rodando localmente

Requer uma `DATABASE_URL` de Postgres (por exemplo, um banco Neon próprio
criado em neon.tech):

```bash
npm install
DATABASE_URL="postgres://..." npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). As tabelas são
criadas automaticamente na primeira consulta.

## Fluxo

1. **Landing page (`/`)** — explica o problema e a solução, com um botão
   para criar um projeto.
2. **Criar projeto (`/criar`)** — nome do trabalho, descrição, prazo final
   e os dados de quem está criando (nome + e-mail, sem senha). Quem cria
   já entra como o primeiro membro do projeto.
3. **Convidar membros** — dentro do projeto, um link de convite
   (`/entrar/[token]`) pode ser compartilhado por WhatsApp. Quem recebe o
   link só precisa informar nome e e-mail para entrar — sem senha. Usar o
   mesmo e-mail de novo (em outro aparelho, por exemplo) identifica a
   mesma pessoa em vez de criar um membro duplicado.
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

## Identificação sem login

Não há sistema de contas com senha. Ao entrar num projeto (pelo link de
convite ou direto pela URL do projeto), a pessoa informa nome + e-mail; um
cookie local guarda, por projeto, qual membro é você nesse navegador. Isso
é intencionalmente simples — como o público-alvo são estudantes acessando
por um link compartilhado no WhatsApp, criar conta com senha seria atrito
desnecessário para um MVP de baixo risco (não há dados sensíveis
envolvidos).

## Estrutura

- `/` — landing page
- `/criar` — formulário de criação de projeto
- `/entrar/[token]` — página de convite (nome + e-mail para entrar)
- `/p/[id]` — painel do projeto (abas Tarefas / Progresso), com o link de
  convite para compartilhar
- `/p/[id]/relatorio` — gera e baixa o relatório em PDF
