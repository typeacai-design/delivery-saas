# Skill — Padronização Visual de Campos de Formulário

## 🎯 Objetivo

Garantir que **TODOS** os campos de formulário do projeto tenham o mesmo estilo visual (caixa azul-claro com bordas arredondadas), evitando que alguns campos apareçam como texto puro sobre o fundo da página.

## 🧩 Componente

**Arquivo:** `src/components/form-field.tsx`

Componentes exportados:

- `<InputField />` — input de texto, email, senha, telefone, número, data, url, search
- `<SelectField />` — dropdown / seletor
- `<FieldShell />` — wrapper genérico para casos customizados

Todos recebem a prop `label` (obrigatória) e quaisquer props nativas do elemento subjacente (`onChange`, `value`, `placeholder`, `required`, `disabled`, etc).

### Exemplo de uso

```tsx
import { InputField, SelectField } from '@/components/form-field'

<InputField
  label="E-mail"
  type="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  placeholder="seu@email.com"
  required
/>

<InputField
  label="Senha"
  type={show ? 'text' : 'password'}
  value={password}
  onChange={(e) => setPassword(e.target.value)}
  required
  rightAdornment={
    <button onClick={() => setShow(!show)} aria-label="Mostrar senha">
      {show ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  }
/>

<SelectField label="Estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
  <option value="">Selecione</option>
  <option value="SP">São Paulo</option>
</SelectField>
```

## 🎨 Especificação Visual (CSS)

Definida em `src/app/globals.css`:

```css
.field-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--ink);
  margin-bottom: 0.45rem;
}

.field-input {
  display: block;
  width: 100%;
  height: 2.75rem;
  padding: 0 1rem;
  font-size: 0.9rem;
  background: #EFF6FF;       /* blue-50 — azul-claro */
  border: 1px solid #DBEAFE; /* blue-100 */
  border-radius: 12px;
  outline: none;
  transition: ...;
}
```

### Estados

| Estado | Background | Borda | Extra |
|--------|-----------|-------|-------|
| Normal / preenchido | `#EFF6FF` | `#DBEAFE` | — |
| Foco | `#EFF6FF` | `#93C5FD` (blue-300) | ring `0 0 0 3px rgba(147,197,253,0.35)` |
| Desabilitado | `#F3F4F6` | `#E5E7EB` | opacity 0.7, cursor not-allowed |
| Erro (`.is-error`) | `#FEF2F2` | `#FCA5A5` | ring vermelho no foco |

### Padrão garantido

- ✅ Caixa retangular visível (sempre)
- ✅ Bordas arredondadas (12px)
- ✅ Mesma altura (2.75rem)
- ✅ Mesma largura (100% do container)
- ✅ Mesmo fundo azul-claro (#EFF6FF)
- ✅ Mesma borda (#DBEAFE)
- ✅ Mesmo padding interno (0 1rem)
- ✅ Mesmo tamanho de fonte (0.9rem)
- ✅ Mesmo alinhamento (block, line-height 1.4)
- ✅ Comportamento uniforme em todos os estados

## 🚨 Regra de Ouro

**Nunca** usar `<input>`, `<select>` ou `<textarea>` soltos sem as classes `field-input` / `field-select` ou sem o componente `<InputField>` / `<SelectField>`. O CSS global garante o estilo **apenas** quando esses wrappers são usados.

Se um campo novo for adicionado, **sempre** envolver no componente.

## 📁 Arquivos relacionados

- `src/components/form-field.tsx` — Componentes
- `src/app/globals.css` — Classes `.field-label`, `.field-input`, `.field-select`, `.field-wrap`
- `src/app/(auth)/registro/page.tsx` — Referência de uso (3 etapas: negócio / localização / responsável)

## Por que

Rick exigiu padronização visual após detectar inconsistência: campos email/senha tinham caixa azul-claro, mas Nome do Negócio, Telefone e seletores apareciam como texto puro. Esta skill garante que o problema não se repita em futuras telas.
