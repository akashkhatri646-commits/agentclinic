"use client"

import { useFormState } from "react-dom"
import { useEffect, useId, useRef, useState } from "react"
import Link from "next/link"
import type { SpecialistFormState } from "@/app/dashboard/specialists/actions"

type Action = (prev: SpecialistFormState, formData: FormData) => Promise<SpecialistFormState>

type Props = {
  action: Action
  initialText: string
  submitLabel: string
  cancelHref: string
  /** Label and help for the text box. */
  textLabel: string
  help: string
  /** Templates to start from (create only). */
  templates?: { id: string; label: string; summary: string; text: string }[]
  /** Instances to choose from (import only). */
  instances?: { slug: string; name: string; shape: string }[]
  /** Offer the LLM judge checkbox (import only). */
  offerJudge?: boolean
}

/**
 * One form for the three places a team pastes JSON: create, edit and import. The text can
 * be pasted, loaded from a file (read in the browser, so nothing is uploaded until the form
 * is submitted) or started from a template. Problems come back from the server as a list.
 */
export default function SpecialistForm({
  action,
  initialText,
  submitLabel,
  cancelHref,
  textLabel,
  help,
  templates,
  instances,
  offerJudge,
}: Props) {
  const [state, formAction] = useFormState<SpecialistFormState, FormData>(action, {})
  // The text box is uncontrolled: anything typed before the page finishes loading is kept, and
  // templates, files and a failed attempt replace it through the ref.
  const box = useRef<HTMLTextAreaElement>(null)
  const setText = (value: string) => {
    if (box.current) box.current.value = value
  }
  const errorId = useId()
  const helpId = useId()
  const fileError = useRef<string | null>(null)
  const [, force] = useState(0)


  async function onFile(file: File | undefined) {
    fileError.current = null
    if (!file) return
    if (file.size > 1024 * 1024) {
      fileError.current = "That file is over 1 MB. Check that it is the right file."
    } else {
      setText(await file.text())
    }
    force((n) => n + 1)
  }

  // After a failed submit the server returns what was typed; show it rather than the starting text.
  useEffect(() => {
    if (state.text !== undefined) setText(state.text)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  const hasProblems = Boolean(state.message || (state.errors && state.errors.length > 0))

  return (
    <form action={formAction}>
      {hasProblems && (
        <div role="alert" id={errorId}>
          {state.message && (
            <p>
              <strong style={{ color: "var(--pico-del-color)" }}>{state.message}</strong>
            </p>
          )}
          {state.errors && state.errors.length > 0 && (
            <ul className="error-list">
              {state.errors.map((e, i) => (
                <li key={i}>
                  {e.path ? <code>{e.path}</code> : null} {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {templates && (
        <label>
          Start from a template
          <select
            defaultValue=""
            onChange={(e) => {
              const t = templates.find((x) => x.id === e.target.value)
              if (t) setText(t.text)
            }}
          >
            <option value="">Keep what is below</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <small>Choosing a template replaces the text below. Change the slug and name before saving.</small>
        </label>
      )}

      {instances && (
        <label>
          Customer instance
          <select name="instance" defaultValue={instances[0]?.slug} required>
            {instances.map((i) => (
              <option key={i.slug} value={i.slug}>
                {i.name} ({i.shape})
              </option>
            ))}
          </select>
        </label>
      )}

      <label>
        Load from a file (optional)
        <input type="file" accept=".json,application/json,text/plain" onChange={(e) => onFile(e.target.files?.[0])} />
        {fileError.current && <small style={{ color: "var(--pico-del-color)" }}>{fileError.current}</small>}
      </label>

      <label>
        {textLabel}
        <textarea
          name="text"
          className="json-box"
          required
          spellCheck={false}
          ref={box}
          defaultValue={initialText}
          aria-invalid={hasProblems ? true : undefined}
          aria-describedby={`${helpId}${hasProblems ? ` ${errorId}` : ""}`}
        />
        <small id={helpId}>{help}</small>
      </label>

      {offerJudge && (
        <label>
          <input type="checkbox" name="judge" />
          Also score answers with the LLM judge
        </label>
      )}

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <button type="submit">{submitLabel}</button>
        <Link href={cancelHref} role="button" className="outline">
          Cancel
        </Link>
      </div>
    </form>
  )
}
