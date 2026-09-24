# Hora Marcada — Demo Vercel + Supabase

Versão enxuta do projeto para publicar como demonstração usando GitHub, Vercel e Supabase.

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase (PostgreSQL + Auth/API)
- Vercel para hospedagem

## Rodar localmente

```bash
corepack enable
pnpm install
cp .env.example .env.local
pnpm dev
```

Sem as variáveis do Supabase, o projeto mantém o comportamento de demonstração/local definido pela aplicação.

## Configurar Supabase

1. Crie um projeto no Supabase.
2. Abra o SQL Editor.
3. Execute `supabase/schema.sql`.
4. Em Project Settings > API, copie a URL do projeto e a publishable/anon key.
5. Crie `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=SUA_CHAVE_PUBLICA
```

Nunca use a `service_role` no frontend.

## Subir no GitHub

```bash
git init
git add .
git commit -m "Initial demo"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git
git push -u origin main
```

## Publicar na Vercel

1. Vercel > Add New > Project.
2. Importe o repositório GitHub.
3. Framework: Next.js (detecção automática).
4. Não altere Build Command nem Output Directory.
5. Adicione as variáveis:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
6. Clique em Deploy.

A URL gratuita será semelhante a `seu-projeto.vercel.app`.

## Atualizações

Após a integração GitHub/Vercel, um push para `main` gera novo deploy automaticamente:

```bash
git add .
git commit -m "Minha alteração"
git push
```

## Observação

Esta versão é direcionada a demonstração. Antes de uso comercial/multiempresa, revise as políticas RLS e substitua consultas globais por consultas filtradas por `provider_id`/tenant.
