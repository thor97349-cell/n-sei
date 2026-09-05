# HoraCerta

MVP de marketplace de expertise sênior por hora: conecta pequenos negócios
locais (salões, restaurantes, lojas, clínicas) a profissionais seniores
experientes (contadores, advogados, designers, engenheiros) para ajuda
pontual, cobrada por hora, sem contratação fixa.

Esta v1 é intencionalmente simples: dois formulários de cadastro (um para
profissionais, um para negócios) e um painel interno onde o match é feito
manualmente, via WhatsApp, antes de qualquer automação.

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript + Tailwind CSS
- SQLite local via `better-sqlite3` (sem dependência de serviço externo)

## Rodando localmente

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

O banco de dados SQLite é criado automaticamente em `data/n-sei.db` na
primeira execução (esse arquivo não é versionado).

## Estrutura

- `/` — landing page explicando a proposta para os dois lados
- `/profissionais` — cadastro de profissionais (área de expertise, anos de
  experiência, valor da hora, disponibilidade)
- `/negocios` — cadastro de negócios (tipo de ajuda, urgência, orçamento)
- `/admin` — painel interno para visualizar os cadastros e fazer o match
  manual, com controle de status de cada lead (novo, em contato, match
  feito, fechado, sem interesse)

## Painel interno (`/admin`)

Protegido por senha simples via variável de ambiente:

```bash
ADMIN_PASSWORD=sua-senha-aqui
```

Se `ADMIN_PASSWORD` não for definida, a senha padrão de desenvolvimento é
`changeme123` — defina uma senha real antes de publicar em produção.

## Modelo de negócio

Cadastro gratuito para os dois lados. Comissão de 15–20% sobre o valor da
hora é cobrada apenas quando um match é efetivamente fechado (processo
hoje acompanhado manualmente através do painel `/admin`).
