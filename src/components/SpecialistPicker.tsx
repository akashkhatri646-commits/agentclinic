import type { PickerSpecialist } from "@/lib/evals/picker"

/**
 * Chooses which specialist a page shows. A plain GET form so it works without JavaScript:
 * pick one and press Show. Hidden when there is only one specialist to choose from.
 */
export default function SpecialistPicker({
  specialists,
  selected,
}: {
  specialists: PickerSpecialist[]
  selected: string | null
}) {
  if (specialists.length < 2) return null
  return (
    <form method="get" className="picker" aria-label="Choose a specialist">
      <label>
        Specialist
        <select name="specialist" defaultValue={selected ?? undefined}>
          {specialists.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="outline">
        Show
      </button>
    </form>
  )
}
