"use client"

import { useFormState } from "react-dom"
import { createTherapyAction, updateTherapyAction, type TherapyFormState } from "@/app/dashboard/therapies/actions"
import Link from "next/link"

type Therapy = {
  id: string
  name: string
  description: string
  durationMinutes: number
}

type Props =
  | { mode: "create"; therapy?: never }
  | { mode: "edit"; therapy: Therapy }

export default function TherapyForm({ mode, therapy }: Props) {
  const action =
    mode === "edit"
      ? updateTherapyAction.bind(null, therapy.id)
      : createTherapyAction

  const [state, formAction] = useFormState<TherapyFormState, FormData>(action, {})

  return (
    <form action={formAction}>
      {state.error && (
        <p>
          <small style={{ color: "var(--pico-del-color)" }}>{state.error}</small>
        </p>
      )}

      <label>
        Name
        <input
          name="name"
          type="text"
          required
          placeholder="e.g. Prompt Detox"
          defaultValue={state.values?.name ?? therapy?.name ?? ""}
          aria-invalid={state.error ? true : undefined}
        />
      </label>

      <label>
        Description
        <textarea
          name="description"
          required
          rows={3}
          placeholder="Describe this therapy…"
          defaultValue={state.values?.description ?? therapy?.description ?? ""}
          aria-invalid={state.error ? true : undefined}
        />
      </label>

      <label>
        Duration (minutes)
        <input
          name="durationMinutes"
          type="number"
          required
          min={1}
          placeholder="e.g. 60"
          defaultValue={
            state.values?.durationMinutes ?? therapy?.durationMinutes?.toString() ?? ""
          }
          aria-invalid={state.error ? true : undefined}
        />
      </label>

      <div style={{ display: "flex", gap: "1rem" }}>
        <button type="submit">{mode === "edit" ? "Save changes" : "Add therapy"}</button>
        <Link href="/dashboard/therapies" role="button" className="outline">
          Cancel
        </Link>
      </div>
    </form>
  )
}
