// Labelled form inputs used by every form in the app.

const inputStyles =
  'mt-1.5 block h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-card outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-400 focus:ring-3 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500'

const labelStyles = 'text-[13px] font-medium text-slate-700'

interface TextFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  autoComplete?: string
  disabled?: boolean
}

export function TextField({ label, value, onChange, type = 'text', placeholder, autoComplete, disabled }: TextFieldProps) {
  return (
    <label className="block">
      <span className={labelStyles}>{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={inputStyles}
      />
    </label>
  )
}

interface TextAreaFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  rows?: number
  disabled?: boolean
}

export function TextAreaField({ label, value, onChange, rows = 4, disabled }: TextAreaFieldProps) {
  return (
    <label className="block">
      <span className={labelStyles}>{label}</span>
      <textarea
        rows={rows}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputStyles} h-auto resize-y py-2.5 leading-relaxed`}
      />
    </label>
  )
}

interface SelectFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  disabled?: boolean
}

export function SelectField({ label, value, onChange, options, disabled }: SelectFieldProps) {
  return (
    <label className="block">
      <span className={labelStyles}>{label}</span>
      <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className={inputStyles}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
