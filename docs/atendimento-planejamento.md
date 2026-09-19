# Página de Atendimento/Atendente — Planejamento

## Conceito

Uma página **mobile-first**, prática e rápida para lançamento de pedidos no balcão. O atendente precisa criar pedidos em segundos, sem complicação.

## Fluxo Principal

```
[Página de Atendimento]
    │
    ├── 🎯 NOVO PEDIDO (ação principal)
    │       │
    │       └── Selecionar tipo de entrega
    │               ├── 🚗 Delivery
    │               ├── 🍽️ Mesa
    │               └── 📦 Retirada
    │
    ├── 📋 PEDIDOS HOJE (resumo rápido)
    │       ├── Novos
    │       ├── Em preparo
    │       └── Prontos
    │
    └── 🪑 MESAS ATIVAS (se habilitadas)
            ├── Mesa 1 (2 pedidos)
            ├── Mesa 3 (1 pedido)
            └── ...
```

## Layout Mobile (320px+)

```
┌─────────────────────────────┐
│  🍽️ ATENDIMENTO     [⚙️]   │  ← Header simples
├─────────────────────────────┤
│  ┌───────────────────────┐ │
│  │   ➕ NOVO PEDIDO      │ │  ← CTA grande, verde, centro
│  └───────────────────────┘ │
├─────────────────────────────┤
│  Como será o atendimento? │
│  ┌───────┐ ┌───────┐       │
│  │Delivery│ │ Mesa │       │  ← 3 botões de seleção rápida
│  │  🚗   │ │  🍽️  │       │
│  └───────┘ └───────┘       │
│  ┌───────┐                 │
│  │Retirada│                │
│  │  📦   │                 │
│  └───────┘                 │
├─────────────────────────────┤
│  📋 PEDIDOS HOJE           │
│  ┌───────────────────────┐ │
│  │ 🆕 Novo (3)  🕐 10:32 │ │
│  │ 🔴 Preparando (5)     │ │
│  │ 🟢 Pronto (2)          │ │
│  └───────────────────────┘ │
├─────────────────────────────┤
│  🪑 MESAS ATIVAS           │
│  ┌─────┐ ┌─────┐ ┌─────┐  │
│  │ 1 ✓ │ │ 2   │ │ 3 ✓ │  │  ← Bolinhas verdes = com pedido
│  │ 2ped │ │ --- │ │ 1ped │  │
│  └─────┘ └─────┘ └─────┘  │
├─────────────────────────────┤
│  [Pedidos] [Atendimento]   │  ← Bottom nav
└─────────────────────────────┘
```

## Tela: Seletor de Tipo de Entrega (Modal)

```
┌─────────────────────────────┐
│  ✕                         │
│                             │
│  Qual o tipo de atendimento?│
│                             │
│  ┌───────────────────────┐ │
│  │ 🚗                    │ │
│  │ DELIVERY              │ │
│  │ Cliente retira em casa │ │
│  └───────────────────────┘ │
│                             │
│  ┌───────────────────────┐ │
│  │ 🍽️                    │ │
│  │ MESA                  │ │
│  │ Pedido para salão     │ │
│  └───────────────────────┘ │
│                             │
│  ┌───────────────────────┐ │
│  │ 📦                    │ │
│  │ RETIRADA              │ │
│  │ Cliente busca na loja  │ │
│  └───────────────────────┘ │
│                             │
│  ┌───────────────────────┐ │
│  │     CANCELAR          │ │  ← Botão secundário
│  └───────────────────────┘ │
└─────────────────────────────┘
```

## Tela: Busca de Cliente (após selecionar Delivery/Mesa)

```
┌─────────────────────────────┐
│  ← Novo Pedido              │
├─────────────────────────────┤
│  🔍 Buscar cliente          │
│  ┌───────────────────────┐ │
│  │ Nome ou telefone...   │ │
│  └───────────────────────┘ │
│                             │
│  OU                        │
│  ┌───────────────────────┐ │
│  │  👤 Novo Cliente     │ │  ← Botão para cadastrar
│  └───────────────────────┘ │
│                             │
│  ─────────────────────────  │
│  RECENTES                   │
│  ┌───────────────────────┐ │
│  │ Maria Silva           │ │
│  │ (48) 99999-1234      │ │
│  └───────────────────────┘ │
│  ┌───────────────────────┐ │
│  │ João Santos          │ │
│  │ (48) 88888-4567      │ │
│  └───────────────────────┘ │
│                             │
├─────────────────────────────┤
│  ┌───────────────────────┐ │
│  │    CONTINUAR →        │ │
│  └───────────────────────┘ │
└─────────────────────────────┘
```

## Tela: Seletor de Mesa (após selecionar Mesa)

```
┌─────────────────────────────┐
│  ← Selecionar Mesa          │
├─────────────────────────────┤
│  Escolha a mesa             │
│                             │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ │
│  │ 1 │ │ 2 │ │ 3 │ │ 4 │ │
│  │2🟢│ │---│ │1🟢│ │   │ │  ← Verde = tem pedido ativo
│  └───┘ └───┘ └───┘ └───┘ │
│                             │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ │
│  │ 5 │ │ 6 │ │ 7 │ │ 8 │ │
│  │   │ │1🟡│ │   │ │   │ │  ← Amarelo = pedido em preparo
│  └───┘ └───┘ └───┘ └───┘ │
│                             │
│  🟢 = Pedidos ativos        │
│  🟡 = Em preparo            │
├─────────────────────────────┤
│  ┌───────────────────────┐ │
│  │    CONTINUAR →        │ │
│  └───────────────────────┘ │
└─────────────────────────────┘
```

## Tela: Montar Pedido (Cardápio)

```
┌─────────────────────────────┐
│  ← Maria Silva / (48) ...  │
├─────────────────────────────┤
│  Mesa 3 · Delivery          │  ← Tag do tipo
├─────────────────────────────┤
│  🍕 Pizzas  🍔 Lanches     │  ← Categorias horizontais
│  ─────────────────────────  │
│                             │
│  PIZZAS                    │
│  ┌───────────────────────┐ │
│  │ 🍕 Calabresa         │ │
│  │ R$ 45,00             │ │
│  │                      │ │
│  │              [+ ADICIONAR] │
│  └───────────────────────┘ │
│                             │
│  ┌───────────────────────┐ │
│  │ 🍕 Margherita         │ │
│  │ R$ 42,00             │ │
│  │                      │ │
│  │              [+ ADICIONAR] │
│  └───────────────────────┘ │
│                             │
│  ... mais produtos ...      │
│                             │
├─────────────────────────────┤
│  ┌───────────────────────┐ │
│  │ 🛒 Ver pedido (3)    │ │  ← Badge com quantidade
│  │ Total: R$ 87,00      │ │
│  └───────────────────────┘ │
└─────────────────────────────┘
```

## Tela: Carrinho/Pedido Atual

```
┌─────────────────────────────┐
│  ← Continuar pedindo         │
├─────────────────────────────┤
│  PEDIDO ATUAL               │
│  Mesa 3 · João Santos       │
├─────────────────────────────┤
│  1x Calabresa         R$45 │
│     Tradicional 35cm        │
│     [+1] [-] [🗑️]          │
│                             │
│  2x Coca-Cola          R$14│
│     Lata 350ml              │
│     [+1] [-] [🗑️]          │
│                             │
│  1x	Borda		+R$8  │
│     Catupiry                │
│     [+1] [-] [🗑️]          │
├─────────────────────────────┤
│  Subtotal           R$ 67  │
│  Taxa entrega       R$ 5   │
│  ─────────────────────────  │
│  TOTAL              R$ 72   │
├─────────────────────────────┤
│  💳 Forma de pagamento      │
│  ┌───────────────────────┐ │
│  │ [ ] DINHEIRO          │ │
│  │ [ ] PIX               │ │
│  │ [✓] CARTÃO            │ │
│  └───────────────────────┘ │
│                             │
│  ┌───────────────────────┐ │
│  │   💬 ENVIAR PEDIDO    │ │  ← Verde, CTA final
│  └───────────────────────┘ │
│                             │
│  ┌───────────────────────┐ │
│  │   ✕ CANCELAR          │ │  ← Secundário
│  └───────────────────────┘ │
└─────────────────────────────┘
```

## Tela: Pedido Enviado (Sucesso)

```
┌─────────────────────────────┐
│                             │
│         ✅                  │
│                             │
│     PEDIDO ENVIADO!        │
│                             │
│     #00423                 │  ← Código do pedido
│                             │
│     Mesa 3                 │
│     João Santos            │
│                             │
│  ┌───────────────────────┐ │
│  │  🟢 NOVO             │ │  ← Status atual
│  │  Aguardando preparo   │ │
│  └───────────────────────┘ │
│                             │
│  ┌───────────────────────┐ │
│  │  📋 NOVO PEDIDO       │ │  ← Próxima ação
│  └───────────────────────┘ │
│                             │
│  ┌───────────────────────┐ │
│  │  🏠 TELA INICIAL     │ │
│  └───────────────────────┘ │
│                             │
└─────────────────────────────┘
```

## Componentes Principais

### 1. Header Simples
- Título "ATENDIMENTO"
- Ícone de configuração (opcional)
- Fundo branco, sem shadow excessivo

### 2. Card CTA "Novo Pedido"
- Botão grande verde, centralizado
- Ícone + texto
- Sombra suave
- Touch target: 48px+ altura

### 3. Seletor de Tipo (3 cards)
- Grid responsivo (2 ou 3 colunas)
- Cada card: ícone + título + descrição curta
- Estados: default, hover/pressed, selected
- Cores diferenciadas:
  - Delivery: azul
  - Mesa: laranja
  - Retirada: roxo

### 4. Resumo do Dia
- 3 chips horizontais
- Novos (verde claro), Preparando (amarelo), Pronto (verde)
- Toque rápido para filtrar

### 5. Grade de Mesas
- Grid 4x2 (8 mesas visíveis)
- Cada mesa: número + indicador de status
- Estados: vazia, com pedido ativo, em preparo
- Cores: branco (vazia), verde (ativo), amarelo (preparo)

### 6. Bottom Nav (Mobile)
- 2 itens: Pedidos, Atendimento
- Ícone + label
- Ativo = verde, Inativo = cinza

## Conexões de Dados

### Necessário do Backend:

```typescript
//GET /api/atendimento/dashboard
{
  pedidosHoje: {
    novo: number,
    preparando: number,
    pronto: number
  },
  mesas: [
    { id: string, numero: number, nome?: string, status: 'vazia' | 'ativa' | 'preparo' }
  ],
  clienteRecentes: [
    { id, nome, telefone }
  ]
}

//GET /api/cardapio/produtos
// Para montar o pedido (já existe parcialmente)

//POST /api/pedidos/manual
// Para criar o pedido (já existe)
```

## Responsividade

- **320-480px:** Layout 1 coluna, cards empilhados
- **480-768px:** Grid 2 colunas para mesas
- **768px+:** Sidebar aparece, grid expandido

## Prioridades de Implementação

### Fase 1 (MVP)
1. Tela inicial com seletor de tipo
2. Fluxo Delivery (busca cliente → monta pedido → finaliza)
3. Fluxo Mesa (seleciona mesa → monta pedido → finaliza)
4. Fluxo Retirada (cliente busca → monta pedido → finaliza)
5. Resumo do dia

### Fase 2 (Melhorias)
1. Histórico rápido de pedidos do dia
2. Ações rápidas nos pedidos (marcar preparo, pronto)
3. Notas/observações do pedido
4. Desconto rápido

### Fase 3 (Avançado)
1. Comanda integrada
2. Multi-pedidos na mesma mesa
3. Transferência de pedido entre mesas
4. Conta分开

## UX/UI Guidelines

1. **Max 3 taps** para criar um pedido
2. **Autosave** do carrinho (não perde dados)
3. **Feedback visual** em todas as ações
4. **Teclado numérico** para telefone
5. **Scanner de código** (futuro)
6. **Confirmação** antes de enviar pedido

## Mockup HTML

Ver arquivo: `artifacts/atendimento-mockup.html`
