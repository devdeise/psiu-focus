
## Fase Backend Base — Auth + Perfil

Lovable Cloud já foi ativado neste turno. A próxima entrega cria autenticação e perfil, mantendo intactos: Agenda, Cadastro, Confirmar Pagamento, Finanças, layout dark/neon e localStorage atual.

### 1. Schema (migration)

Tabela `public.profiles`:
- `id uuid pk default gen_random_uuid()`
- `user_id uuid not null unique references auth.users(id) on delete cascade`
- `nome text`, `email text`, `telefone text`, `nome_profissional text`, `pin text`
- `created_at`, `updated_at timestamptz default now()`
- GRANTs para `authenticated` + `service_role`
- RLS habilitado, política única: `auth.uid() = user_id` para SELECT/INSERT/UPDATE/DELETE
- Trigger `handle_new_user` em `auth.users` → cria profile básico com `nome` = metadata.full_name ou email

### 2. Auth — configuração
- Configurar provider Google via `supabase--configure_social_auth`
- Email signup auto-confirm habilitado (sem verificação por email)

### 3. Tela `/auth`
Nova rota pública `src/routes/auth.tsx` com visual dark/neon do PSIU!:
- Tabs Entrar / Criar conta
- Email + senha (sem alert/prompt/confirm)
- Botão "Continuar com Google" via `lovable.auth.signInWithOAuth("google")`
- Estados de loading + mensagens de erro inline (toast `sonner`)
- Após login → redirect para `/`

### 4. Proteção de rotas
- Criar `src/routes/_authenticated/route.tsx` (layout gate, `ssr:false`, redirect → `/auth`)
- Mover rotas internas para o layout `_authenticated`: `index`, `agenda`, `cadastro`, `confirmar-pagamento`, `financas`, `analise-faltas`, `anotacoes`, `perfil`
  - Arquivos renomeados de `src/routes/<x>.tsx` → `src/routes/_authenticated/<x>.tsx`
  - Sem mudança de URL (`_authenticated` é pathless)

### 5. Perfil
Atualizar `src/routes/_authenticated/perfil.tsx`:
- Buscar/criar profile do usuário logado via `supabase.from("profiles")`
- Editar nome, email, telefone, nome profissional → salva no Cloud
- PIN continua local (já existente), mantém comportamento
- Botão "Sair" (signOut + redirect /auth)

### 6. Sidebar
`src/components/app-layout.tsx`:
- Mostrar nome do profile logado (fallback: email)
- Botão logout no rodapé do sidebar

### 7. Correções de build pré-existentes (bloqueiam deploy)
Erros já existentes no projeto que impedem build:
- `agenda.tsx` linha 235: tipar `AgendaItem` com `patient` requerido e `clinic` opcional; importar/recriar helper `dateKeyFromIso` (provavelmente `iso.slice(0,10)`)
- `cadastro.tsx` linha 1164: ajustar handler do botão `Salvar paciente` para `() => submitPatient()`
- `financas.tsx` linha 170: tipar retorno de `loadVisibleCards` como `CardId[]`

### Fora do escopo desta fase
- Migração de clínicas/pacientes/agenda/pagamentos para Cloud
- Limpeza do localStorage antigo
- Reset password / recuperação por email
- Qualquer alteração em regras financeiras, agenda, cadastro, faltas, repasse

### Critérios de aceite
Conforme PRD: criar conta, login, logout, sessão persistente, rotas internas protegidas, redirect → /auth, perfil lido/salvo no Cloud, visual preservado, regras não alteradas, localStorage preservado.
