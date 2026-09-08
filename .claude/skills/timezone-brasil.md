# Timezone em Filtros de Data no Brasil (UTC-3)

## ⚠️ O Bug Clássico

Quando você precisa filtrar registros do banco Supabase por "hoje" no fuso do Brasil, **NUNCA** faça assim:

```javascript
// ❌ ERRADO — pega pedidos de 00:00 UTC até 23:59 UTC
// Não corresponde ao dia em Brasília!
const hoje = new Date()
const hojeLocal = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
const inicio = new Date(hojeLocal.getTime() - 3 * 60 * 60 * 1000) // -3h
const fim = new Date(inicio.getTime() + 24 * 60 * 60 * 1000 - 1)
```

**Por que dá errado?** Pedido criado às **22:31 de 07/09 em Brasília** vira **01:31 UTC do dia 08/09**. O filtro `>= 08/09 00:00 UTC` inclui ele como "hoje", mas em Brasília foi **ontem**.

## ✅ A Forma Correta

Use `Date.UTC(ano, mes, dia, offset_horas, ...)` com **offset de +3 horas** (porque Brasília = UTC-3, então adicionar 3h ao UTC te dá a hora local):

```javascript
// ✅ CORRETO — pega exatamente o dia em Brasília (00:00 até 23:59 BRT)
const agora = new Date()
const brasilia = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
const ano = brasilia.getFullYear()
const mes = brasilia.getMonth()
const dia = brasilia.getDate()

// 08/09 00:00:00 BRT → 08/09 03:00:00 UTC
const inicioHojeUTC = new Date(Date.UTC(ano, mes, dia, 3, 0, 0, 0))
// 08/09 23:59:59 BRT → 09/09 02:59:59 UTC
const fimHojeUTC = new Date(Date.UTC(ano, mes, dia + 1, 2, 59, 59, 999))
```

Para filtro de mês (primeiro dia do mês atual):
```javascript
// 01/09 00:00:00 BRT → 01/09 03:00:00 UTC
const primeiroDiaMesUTC = new Date(Date.UTC(ano, mes, 1, 3, 0, 0, 0))
```

## 🧪 Como Validar

Antes de fazer deploy, sempre teste:

```bash
node -e "
const agora = new Date();
const brasilia = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
const ano = brasilia.getFullYear();
const mes = brasilia.getMonth();
const dia = brasilia.getDate();

const inicioHojeUTC = new Date(Date.UTC(ano, mes, dia, 3, 0, 0, 0));
const fimHojeUTC = new Date(Date.UTC(ano, mes, dia + 1, 2, 59, 59, 999));

console.log('inicioHojeUTC ISO:', inicioHojeUTC.toISOString());
console.log('fimHojeUTC ISO:', fimHojeUTC.toISOString());

// Testar com pedido de ONTEM em Brasília (07/09 22:31 = 08/09 01:31 UTC)
const ontemBrasilia = new Date('2026-09-08T01:31:44Z');
console.log('Pedido de ontem em Brasília está dentro?', 
  ontemBrasilia >= inicioHojeUTC && ontemBrasilia <= fimHojeUTC);
console.log('Esperado: false');
"
```

## 📋 Checklist de Uso

Sempre que filtrar por "hoje", "ontem", "este mês", "esta semana":

- [ ] Use `agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })` para pegar a data local
- [ ] Use `Date.UTC(ano, mes, dia, 3, ...)` para **início** (00:00 BRT = 03:00 UTC)
- [ ] Use `Date.UTC(ano, mes, dia+1, 2, 59, 59, 999)` para **fim** (23:59 BRT = 02:59 UTC+1)
- [ ] **NUNCA** subtraia 3h de uma data local — esse é o bug clássico
- [ ] Teste com pedidos limítrofes (00:00 e 23:59 no horário de Brasília)

## 🎯 TL;DR

| Situação | Errado | Correto |
|----------|--------|---------|
| Início do dia | `setHours(0,0,0,0)` depois `-3h` | `Date.UTC(d, 3, 0, 0, 0)` |
| Fim do dia | `setHours(23,59,59,999)` depois `-3h` | `Date.UTC(d+1, 2, 59, 59, 999)` |
| Início do mês | dia 1 00:00 BRT - 3h | `Date.UTC(ano, mes, 1, 3, 0, 0, 0)` |

**Lembre-se**: O offset de +3h no `Date.UTC()` é para "puxar" o início do dia brasileiro para o UTC correspondente. Adicionar 3h ao UTC te dá Brasília.
