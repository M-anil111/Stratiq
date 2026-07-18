'use client'

// Chip-toggle multi-select for user ids, matching the interaction pattern of
// the string-option MultiSelect used on the New Project form (and elsewhere)
// but displaying each team member's name while storing their id.
export interface PersonOption { id: string; full_name: string }

export default function MultiSelectPeople({
  options,
  value,
  onChange,
}: {
  options: PersonOption[]
  value: string[]
  onChange: (v: string[]) => void
}) {
  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter(v => v !== id))
    else onChange([...value, id])
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button
          key={opt.id}
          type="button"
          onClick={() => toggle(opt.id)}
          className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
            value.includes(opt.id)
              ? 'bg-sky-500 border-sky-500 text-white'
              : 'bg-slate-900/[0.04] dark:bg-white/[0.05] border-slate-900/10 dark:border-white/[0.12] text-slate-700 dark:text-slate-300 hover:border-sky-400'
          }`}
        >
          {opt.full_name}
        </button>
      ))}
      {options.length === 0 && (
        <p className="text-xs text-slate-500 dark:text-slate-400">No team members available.</p>
      )}
    </div>
  )
}
