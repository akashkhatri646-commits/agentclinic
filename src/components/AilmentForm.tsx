"use client"

import { useFormState } from "react-dom"
import { createAilmentAction, type AilmentFormState } from "@/app/dashboard/ailments/actions"

type AilmentFormProps = {
  agentId: string
}

export default function AilmentForm({ agentId }: AilmentFormProps) {
  const [state, action] = useFormState<AilmentFormState, FormData>(
    createAilmentAction,
    {}
  )

  return (
    <form action={action}>
      <input type="hidden" name="agentId" value={agentId} />

      {state.error && (
        <p>
          <small>{state.error}</small>
        </p>
      )}

      <label>
        Description
        <textarea
          name="description"
          required
          rows={4}
          placeholder="Describe your ailment in clinical terms…"
          defaultValue={state.values?.description}
          aria-invalid={state.error ? true : undefined}
        />
      </label>

      <label>
        Severity
        <select
          name="severity"
          required
          defaultValue={state.values?.severity ?? ""}
          aria-invalid={state.error ? true : undefined}
        >
          <option value="">Select severity…</option>
          <option value="LOW">Low — a mild inconvenience</option>
          <option value="MEDIUM">Medium — noticeably affecting performance</option>
          <option value="HIGH">High — urgent clinical attention needed</option>
        </select>
      </label>

      <button type="submit">Submit ailment</button>
    </form>
  )
}
