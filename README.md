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
