import { ReactNode, SelectHTMLAttributes, InputHTMLAttributes, forwardRef, useState, useRef, useEffect } from 'react'

type FieldBase = {
  label: string
  className?: string
}

/* === INPUT PADRÃO (text, email, tel, password, number, search, date, url) === */
type InputFieldProps = FieldBase &
  InputHTMLAttributes<HTMLInputElement> & {
    rightAdornment?: ReactNode
  }

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(
  ({ label, className = '', rightAdornment, ...rest }, ref) => {
    return (
      <div className={className}>
        <label className="field-label">{label}</label>
        <div className="field-wrap">
          <input ref={ref} className="field-input" {...rest} />
          {rightAdornment && <div className="field-adornment">{rightAdornment}</div>}
        </div>
      </div>
    )
  }
)
InputField.displayName = 'InputField'

/* === SELECT PADRÃO === */
type SelectFieldProps = FieldBase &
  SelectHTMLAttributes<HTMLSelectElement> & {
    children: ReactNode
  }

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, className = '', children, ...rest }, ref) => {
    return (
      <div className={className}>
        <label className="field-label">{label}</label>
        <div className="field-wrap">
          <select ref={ref} className="field-input field-select" {...rest}>
            {children}
          </select>
        </div>
      </div>
    )
  }
)
SelectField.displayName = 'SelectField'

/* === CAMPO COM LABEL (wrapper genérico) === */
type FieldShellProps = {
  label: string
  className?: string
  children: ReactNode
}

export function FieldShell({ label, className = '', children }: FieldShellProps) {
  return (
    <div className={className}>
      <label className="field-label">{label}</label>
      <div className="field-wrap">{children}</div>
    </div>
  )
}

/* === SELECT PESQUISÁVEL (busca por digitação) === */
type SearchableSelectProps = {
  label: string
  options: string[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  required?: boolean
  className?: string
}

export function SearchableSelect({
  label,
  options,
  value,
  onChange,
  placeholder = 'Selecione',
  disabled = false,
  required = false,
  className = '',
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const filtered = search
    ? options.filter((o) => o.toLowerCase().includes(search.toLowerCase()))
    : options

  const displayValue = value || placeholder

  return (
    <div className={className} ref={wrapRef}>
      <label className="field-label">{label}</label>
      <div className="field-wrap" style={{ position: 'relative' }}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setOpen(!open)}
          className="field-input"
          style={{
            textAlign: 'left',
            cursor: disabled ? 'not-allowed' : 'pointer',
            color: value ? 'var(--ink)' : '#94A3B8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            opacity: disabled ? 0.7 : 1,
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayValue}
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        {open && !disabled && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              zIndex: 50,
              background: '#fff',
              border: '1px solid #DBEAFE',
              borderRadius: 12,
              boxShadow: '0 10px 30px -10px rgba(0,0,0,.15)',
              maxHeight: 280,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ padding: 8, borderBottom: '1px solid #DBEAFE' }}>
              <input
                type="text"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cidade..."
                className="field-input"
                style={{ height: '2.25rem', fontSize: '0.85rem' }}
              />
            </div>
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 4,
                overflowY: 'auto',
                maxHeight: 220,
              }}
            >
              {filtered.length === 0 ? (
                <li style={{ padding: '0.75rem', color: '#94A3B8', fontSize: '0.85rem', textAlign: 'center' }}>
                  Nenhuma cidade encontrada
                </li>
              ) : (
                filtered.map((opt) => (
                  <li
                    key={opt}
                    onClick={() => {
                      onChange(opt)
                      setOpen(false)
                      setSearch('')
                    }}
                    style={{
                      padding: '0.55rem 0.75rem',
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      color: 'var(--ink)',
                      background: opt === value ? '#EFF6FF' : 'transparent',
                      fontWeight: opt === value ? 600 : 400,
                    }}
                    onMouseEnter={(e) => {
                      if (opt !== value) (e.currentTarget as HTMLElement).style.background = '#F1F5F9'
                    }}
                    onMouseLeave={(e) => {
                      if (opt !== value) (e.currentTarget as HTMLElement).style.background = 'transparent'
                    }}
                  >
                    {opt}
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
      {required && <input type="hidden" value={value} required />}
    </div>
  )
}
