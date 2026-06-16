## Fases Backend 4, 5 e 6 — PSIU!

Esta é uma fase grande (migrar pagamentos, finanças e finalizar a saída do localStorage). Apresento o plano antes de implementar para você validar a abordagem.

### Estratégia geral

Vou seguir o mesmo padrão híbrido já usado nas Fases 2/3:
- Mantém as estruturas atuais do `localStorage` como cache local síncrono (compatível com a UI atual sem reescrita).
- Adiciona persistência no Lovable Cloud via camada `cloud.ts` (push debounce + pull on login).
- Cada novo registro recebe `user_id` do usuário logado; RLS garante isolamento.

Assim, **Confirmar Pagamento** e **Finanças** continuam funcionando visualmente como hoje, apenas passam a sincronizar com a nuvem.

---

### FASE BACKEND 4 — Pagamentos

**1. Migrations (2 tabelas novas):**

- `clinic_payments` — campos: `clinic_id`, `competencia`, `mes_previsto`, `valor_previsto`, `quantidade_atendimentos`, `status` (aguardando/atrasado/confirmado), `houve_atraso`, `mes_computado_caixa`, `houve_desconto`, `desconto_informado`, `valor_real_recebido`, `observacao`, `confirmado_em`.
- `patient_payments` — campos: `patient_id`, `atendimento_id` (nullable), `modelo` (por_sessao/mensal), `competencia`, `valor_total`, `valor_recebido`, `saldo_pendente`, `status` (pendente/parcial/pago), `houve_atraso`, `mes_computado_caixa`, `observacao`, `confirmado_em`.

Ambas com RLS `auth.uid() = user_id`, GRANT para `authenticated` + `service_role`, trigger `updated_at`.

**2. Camada de sync (`src/lib/store/cloud.ts`):**
- Adicionar `pullClinicPayments`, `pullPatientPayments` no pull inicial.
- Adicionar `pushClinicPayments`, `pushPatientPayments` (upsert por id).
- Hookar nos saves do store.

**3. Store (`src/lib/store/index.ts`):**
- Já existem `loadClinicPayments`, `loadPatientPayments` (ou similares) — confirmar e plugar `scheduleSync`.
- Onde não existirem, adicionar.

**4. UI `confirmar-pagamento.tsx`:**
- Já implementa modais de clínica (atraso + desconto), particular sessão e particular mensal (parcial/quitação). Vou auditar e ajustar conforme regras detalhadas (status atrasado computado por mês previsto vs hoje, validações de desconto, etc.).
- Histórico: garantir filtro por `mes_computado_caixa`, exibir colunas pedidas, botão Editar + modal de PIN (validar contra `profiles.pin`).
- Garantir zero `alert/prompt/confirm` nativos.

---

### FASE BACKEND 5 — Finanças

`financas.tsx` já existe e calcula sobre dados locais. Vou:

1. Garantir que lê de `loadClinicPayments` / `loadPatientPayments` / `loadAppointments` (que agora vêm do Cloud sincronizado).
2. Ajustar os cards conforme regras:
   - **Atingido** = realizados / previstos.
   - **Previsão de Pagamento** = produção prevista (clínica usa `data + prazo`); não subtrai desconto.
   - **Recebido no Caixa** = soma `valor_real_recebido` / `valor_recebido` por `mes_computado_caixa`, separando No prazo / Atrasados recebidos + linha Desconto informado (não soma no principal).
   - **Aguardando Pagamento Clínicas** = `clinic_payments` com status aguardando/atrasado no período.
   - **Particulares Pendentes** = `patient_payments` pendente/parcial.
   - **Perdas Operacionais** = faltas/cancelamentos × valor; NÃO inclui desconto.
   - **Ranking / Clínica mais rentável** = valor cheio produzido por clínica/competência.
3. Todos respeitam o filtro de período já existente.

---

### FASE BACKEND 6 — Migração final e limpeza

1. **Botão de migração** em Perfil: "Importar dados antigos do dispositivo" → modal de confirmação → faz upsert de tudo do localStorage para o Cloud associado ao `user_id`; mostra toast de sucesso/erro; evita duplicidades via id.
2. **Localstorage** continua como cache de leitura (espelho do Cloud), mas o Cloud passa a ser fonte de verdade — no logout o cache é limpo (já implementado).
3. **Testes ponta a ponta**: vou rodar build, abrir o preview, validar fluxos críticos (criar conta, criar clínica/paciente, agenda, confirmar pagamento c/ e s/ atraso e desconto, parcial, quitação, histórico c/ PIN, recarregar página, isolamento por usuário).
4. **Polimento**: revisar estados vazios, toasts (sonner), loading, ausência de `alert/prompt/confirm`.

---

### Restrições respeitadas

- Sem Supabase externo, sem API/login paralelos.
- Visual dark/neon preservado, modais próprios.
- Regras Agenda/Cadastro/Perfil intocadas.
- RLS isola dados por usuário em todas as novas tabelas.

---

### Riscos / pontos de atenção

- `confirmar-pagamento.tsx` tem 2008 linhas — a auditoria das regras de modal e histórico pode revelar divergências com o spec; vou ajustar pontualmente sem reescrever do zero.
- `financas.tsx` (878 linhas) já tem muita lógica; vou plugar nas novas fontes mantendo a estrutura.
- Por ser uma única entrega muito grande, sugiro **executar em 3 turnos** (uma fase por turno) para você validar incrementalmente. Posso também fazer tudo em sequência se preferir.

**Como prefere prosseguir?**
- (A) Executar Fase 4 agora, validar, depois 5, depois 6.
- (B) Executar as três em sequência sem pausa.