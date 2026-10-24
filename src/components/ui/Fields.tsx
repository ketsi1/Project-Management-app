// Labelled form inputs used by every form in the app.

const inputStyles =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200'

interface TextFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  autoComplete?: string
}

export function TextField({ label, value, onChange, type = 'text', placeholder, autoComplete }: TextFieldProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
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
}

export function TextAreaField({ label, value, onChange, rows = 4 }: TextAreaFieldProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <textarea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} className={inputStyles} />
    </label>
  )
}

interface SelectFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}

export function SelectField({ label, value, onChange, options }: SelectFieldProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={inputStyles}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
