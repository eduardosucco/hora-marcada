# Deploy rápido na Vercel

## 1. GitHub

Crie um repositório vazio e envie todo o conteúdo desta pasta para a raiz do repositório.

## 2. Supabase

Execute `supabase/schema.sql` no SQL Editor e copie:

- Project URL
- Publishable/anon key

## 3. Vercel

- Add New > Project
- Import Git Repository
- Selecione o repositório
- Framework Preset: Next.js
- Build Command: padrão
- Output Directory: padrão

Em Environment Variables:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Clique em Deploy.

## 4. Próximos deploys

Basta fazer `git push`. A Vercel cria automaticamente previews em branches e atualiza produção quando a branch principal é publicada.
