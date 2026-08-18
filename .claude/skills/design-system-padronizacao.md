---
name: design-system-padronizacao
description: Padrões do design system do SaaS Fornalha (glassmorphism verde/preto/branco, inputs padronizados)
---

# Skill: Design System Padronização

## Paleta

- **Verde principal:** `#16A34A`
- **Preto/Ink:** `#0A0A0A`
- **Branco:** `#FFFFFF`
- **Variações verde:** `--green-2: #22C55E`, `--green-3: #4ADE80`

## Glassmorphism

```css
.glass {
  background: linear-gradient(180deg, rgba(255,255,255,.85), rgba(255,255,255,.55));
  border: 1px solid var(--line);
  border-radius: 18px;
  backdrop-filter: blur(24px) saturate(180%);
  box-shadow: var(--shadow-glass);
}
```

## Inputs Padronizados

```css
input, select, textarea {
  border-radius: var(--radius-sm);  /* 12px - RETANGULAR arredondado */
  border: 1px solid var(--line);
  background: rgba(255,255,255,.85);
  padding: 0.85rem 1.1rem;          /* Generoso */
  font-size: 0.9rem;
  color: var(--ink);
  line-height: 1.4;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.7), 0 1px 2px rgba(0,0,0,.04);
}
```

**NÃO usar `border-radius: pill`** — campos devem ser retangulares arredondados.

## Botão Ver Senha

Adicionar dentro de `div.relative` com o input:

```tsx
<div className="relative">
  <input type={showPassword ? 'text' : 'password'} ... />
  <button
    type="button"
    onClick={() => setShowPassword(!showPassword)}
    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)] hover:text-[var(--ink)]"
  >
    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
  </button>
</div>
```

## Selects

- Sempre com `appearance: none`
- Ícone de seta customizado via background-image
- Padding-right generoso (2.2rem)

**Por que:** Manter consistência visual entre todas as telas (login, registro, dashboard, etc).
