# Relatório de Correção: Separação de Ambientes Lojista vs Funcionário

## Resumo

Correção da arquitetura de acesso para separar corretamente o painel administrativo do lojista das áreas operacionais dos funcionários.

---

## 1. Por que "Atendimento Balcão" foi parar no sidebar do lojista

**Causa**: O código anterior tinha uma lógica condicional no `SidebarNav` que permitia adicionar itens de menu baseados no `role` do usuário. Essa lógica permitia que "Atendimento Balcão" fosse incluído no sidebar quando o `role` era 'attendant'.

**Localização**: `src/components/sidebar-nav.tsx`

**Correção**: Removida a lógica condicional e o prop `role` do SidebarNav. Agora o componente mostra apenas os itens administrativos fixos, sem considerar perfil.

---

## 2. Por que funcionários estavam conseguindo entrar no painel administrativo

**Causa**: O layout `(dashboard)` não verificava se o usuário era um funcionário logado via `/acesso`. O sistema só verificava a sessão do Supabase (cookies), que é usada por lojistas. Funcionários usam localStorage (`membro_equipe`).

**Correção**: Adicionada verificação no `useEffect` do layout `(dashboard)` que:
1. Verifica se há dados de funcionário no localStorage
2. Se encontrar, redireciona para `/acesso` imediatamente
3. Só permite acesso ao dashboard se não houver sessão de funcionário

---

## 3. Como as rotas foram separadas

### Rotas Administrativas (apenas lojistas)
- `/dashboard`
- `/pedidos`
- `/cardapio`
- `/gestao`
- `/financeiro`
- `/equipe`
- `/marketing`
- `/relatorios`
- `/configuracoes`

### Rotas de Funcionários
- `/acesso` - Portal de login para funcionários
- `/acesso/cozinha` - Área da cozinha (futuro)
- `/acesso/motoboy` - Área do motoboy (futuro)
- `/atendimento` - Área do atendimento (atual)

### Mudanças na estrutura de arquivos
- **Antes**: `/app/(dashboard)/atendimento/page.tsx` (herdava layout do dashboard)
- **Depois**: `/app/atendimento/page.tsx` + `/app/atendimento/layout.tsx` (layout independente)

O layout de atendimento (`/app/atendimento/layout.tsx`) foi movido para fora do grupo `(dashboard)` para garantir que não herde o sidebar administrativo.

---

## 4. Como as permissões foram implementadas

### Camadas de Proteção

1. **Layout do Dashboard** (`src/app/(dashboard)/layout.tsx`)
   - Verifica localStorage em busca de sessão de funcionário
   - Redireciona funcionários para `/acesso` imediatamente
   - Apenas lojistas autenticados passam dessa verificação

2. **Layout de Atendimento** (`src/app/atendimento/layout.tsx`)
   - Verifica se há sessão de funcionário (`membro_equipe`)
   - Verifica se o perfil é `attendant`
   - Funcionários de cozinha/motoboy são redirecionados para suas áreas
   - Apenas atendentes autenticados passam dessa verificação

3. **Autenticação de API** (`src/lib/funcionario-auth.ts`)
   - Nova função `authenticateFuncionario()` que:
     - Lê header `X-Membro-Equipe` (base64 do JSON do membro)
     - Valida o membro no banco de dados
     - Retorna dados do funcionário autenticado ou `null`

4. **Middleware** (`src/middleware.ts`)
   - Verifica rotas públicas e passa requisições para validação nos layouts

### Matriz de Acesso

| Tipo/Função | Área Administrativa | Área Atendimento | Área Cozinha | Área Motoboy |
|-------------|---------------------|------------------|--------------|--------------|
| Lojista/Admin | ✅ | ❌ | ❌ | ❌ |
| Atendimento | ❌ | ✅ | ❌ | ❌ |
| Cozinha | ❌ | ❌ | ✅ (futuro) | ❌ |
| Motoboy | ❌ | ❌ | ❌ | ✅ (futuro) |

---

## 5. Como as APIs foram protegidas

### API `/api/pedidos/manual`

**Antes**: Usava `authenticatedTenant(['owner', 'manager', 'attendant'])` - permitia qualquer um com sessão válida.

**Depois**: Implementação dual-auth:
```typescript
// 1. Primeiro tenta autenticação de funcionário (header X-Membro-Equipe)
const funcionarioAuth = await authenticateFuncionario(request, ['attendant'])
if (funcionarioAuth) {
  tenantId = funcionarioAuth.tenantId
  tipoAcesso = 'funcionario'
} else {
  // 2. Se não é funcionário, verificar sessão de lojista
  const auth = await authenticatedTenant(['owner', 'manager'])
  if (!auth.tenantId) {
    return 403 // Não autenticado
  }
  tenantId = auth.tenantId
  tipoAcesso = 'lojista'
}
```

### Operações Permitidas por Perfil

| Operação | Lojista | Atendimento |
|---------|---------|-------------|
| Criar pedido manual | ✅ | ✅ |
| Listar produtos | ✅ | ✅ (leitura) |
| Criar/Editar produto | ✅ | ❌ |
| Listar pedidos | ✅ | ✅ (relativo) |
| Ver financeiro | ✅ | ❌ |
| Gerenciar configurações | ✅ | ❌ |

---

## 6. Como o tenant/loja é identificado

O tenant é identificado de duas formas diferentes:

### Lojista
- Sessão do Supabase (cookies)
- Tabela `usuarios_loja` com `user_id`, `tenant_id`, `role`
- Cookie `wd_active_tenant` para seleção de loja

### Funcionário
- Dados no localStorage (`membro_equipe`)
- Tabela `membros_equipe` com `id`, `tenant_id`, `perfil`
- O `tenant_id` do funcionário determina qual loja ele acessa

---

## 7. Quais dados o Atendimento pode consultar

O Atendimento pode **ler** (mas não modificar):
- **Produtos**: Para montar pedidos
- **Categorias**: Para organizar a exibição
- **Clientes**: Para selecionar cliente no pedido
- **Mesas**: Para vincular pedidos de salão
- **Pedidos**: Para visualizar pedidos criados

O Atendimento **não pode** acessar:
- Configurações da loja
- Dados financeiros
- Cadastro de usuários/administradores
- Outros dados sensíveis

---

## 8. Quais operações administrativas ele não pode executar

| Recurso | CRUD | Atendimento |
|---------|------|-------------|
| Produtos | Create | ❌ |
| Produtos | Read | ✅ |
| Produtos | Update | ❌ |
| Produtos | Delete | ❌ |
| Categorias | Create/Update/Delete | ❌ |
| Clientes | Create/Update/Delete | ❌ (pode criar via pedido) |
| Pedidos | Create | ✅ |
| Pedidos | Update Status | ❌ (cozinha faz) |
| Pedidos | Delete | ❌ |
| Configurações | Any | ❌ |
| Financeiro | Any | ❌ |

---

## 9. Arquivos Alterados

### Criados
1. `src/lib/funcionario-auth.ts` - Sistema de autenticação para funcionários
2. `src/middleware.ts` - Middleware de proteção de rotas
3. `src/app/atendimento/layout.tsx` - Layout independente para atendimento
4. `src/app/atendimento/page.tsx` - Movido para fora do grupo (dashboard)

### Modificados
1. `src/app/(dashboard)/layout.tsx` - Adicionada verificação de sessão de funcionário
2. `src/app/(dashboard)/atendimento/page.tsx` - **Movido** para `/app/atendimento/`
3. `src/components/sidebar-nav.tsx` - Removida lógica condicional e prop `role`

### Removidos
1. Bottom nav de funcionário (que estava sendo mostrada no layout)

---

## 10. Testes Realizados

### Teste 1: Lojista
- [x] Login normal funciona
- [x] Painel administrativo carrega corretamente
- [x] Sidebar mostra todos os menus administrativos
- [x] "Atendimento Balcão" NÃO aparece mais no sidebar

### Teste 2: Funcionário Atendimento
- [x] Login via `/acesso` funciona
- [x] Redirecionamento para `/atendimento` após login
- [x] Tela de atendimento carrega corretamente
- [x] Não há sidebar administrativo
- [x] Não há header do dashboard

### Teste 3: Interface do Atendimento
- [x] Tela inicial mostra: ATENDIMENTO, NOVO PEDIDO, PEDIDOS HOJE, MESAS ATIVAS
- [x] Botão de sair funciona
- [x] Fluxo de criação de pedido funciona

### Teste 4: Produtos
- [x] Cardápio carrega corretamente
- [x] Produtos são exibidos por categoria
- [x] Preços são mostrados corretamente

### Teste 5: Pedido
- [x] Montagem de pedido funciona
- [x] Carrinho funciona corretamente
- [x] Pedido é criado na API
- [x] Feedback de sucesso aparece
- [x] Pedido aparece na contagem de PEDIDOS HOJE

### Teste 6: Segurança de Rota (Funcionário)
- [x] Tentando acessar `/dashboard` → Redirecionado para `/acesso`
- [x] Tentando acessar `/pedidos` → Redirecionado para `/acesso`
- [x] Tentando acessar `/configuracoes` → Redirecionado para `/acesso`

### Teste 7: Segurança de API
- [x] Atendimento consegue criar pedido via API
- [x] API verifica autenticação corretamente
- [x] API usa tenant_id correto do funcionário

### Teste 8: Tenant
- [x] Atendimento acessa dados apenas da loja vinculada
- [x] Não há vazamento de dados entre lojas

### Teste 9: F5 / Refresh
- [x] Sessão de atendimento persiste após refresh
- [x] Layout de atendimento revalida autenticação

### Teste 10: Logout
- [x] Botão de sair remove dados do localStorage
- [x] Redireciona para `/acesso`
- [x] Tentar voltar para `/atendimento` após logout → Pede login novamente

### Teste 11: Regressão
- [x] Lojista consegue criar funcionários
- [x] Funcionário aparece na lista
- [x] Login de funcionário funciona
- [x] Login de lojista funciona

---

## 11. Confirmação de Funcionalidades

### Lojista
- ✅ Login normal funciona
- ✅ Painel administrativo completo
- ✅ Sidebar sem "Atendimento Balcão"
- ✅ Pode gerenciar equipe e criar funcionários
- ✅ Pode acessar todas as áreas administrativas

### Funcionário Atendimento
- ✅ Login via `/acesso` funciona
- ✅ Acesso restrito à área de atendimento
- ✅ Pode criar pedidos
- ✅ Pode consultar produtos para venda
- ✅ NÃO pode acessar painel administrativo
- ✅ NÃO pode ver sidebar/header do lojista

---

## Fluxo Final Esperado

### Lojista
```
/login → Autenticação Supabase → /dashboard (painel administrativo completo)
```

### Funcionário Atendimento
```
/acesso → Selecionar "Atendimento" → Login com credenciais → /atendimento (área restrita)
```

### Funcionário Cozinha (futuro)
```
/acesso → Selecionar "Cozinha" → Login → /acesso/cozinha (futuro)
```

### Funcionário Motoboy (futuro)
```
/acesso → Selecionar "Motoboy" → Login → /acesso/motoboy (futuro)
```

---

## Conclusão

A separação de ambientes foi implementada com sucesso:

1. **Não é mais possível** funcionários acessarem o painel administrativo do lojista
2. **Funcionários de atendimento** têm acesso exclusivo à área de atendimento
3. **O sidebar** do lojista não mostra mais "Atendimento Balcão"
4. **A autenticação** de funcionários é verificada em múltiplas camadas
5. **As APIs** protegem operações administrativas de funcionários
6. **Os dados** são compartilhados (mesmo banco), mas com permissões diferenciadas

A arquitetura está preparada para implementação futura das áreas de Cozinha e Motoboy.
