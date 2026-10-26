"use server"

import { auth } from "@/lib/auth"
import { canCreateSpecialist } from "@/lib/guards"
import { createAnthropicJudge, isJudgeConfigured } from "@/lib/evals/judge"
import {
  SERVICE_ERROR_MESSAGES,
  createSpecialistFromText,
  importOutputsFromText,
  updateSpecialistFromText,
} from "@/lib/evals/specialist-service"
import type { ValidationError } from "@/lib/evals/spec"
import { redirect } from "next/navigation"

/**
 * What the forms get back. Problems come back as data and are shown on the page; nothing
 * about them travels in the URL, so a crafted link cannot display wording of its own.
 */
export type SpecialistFormState = {
  message?: string
  errors?: ValidationError[]
  /** The text that was submitted, so a failed attempt keeps what was typed. */
  text?: string
}

const textOf = (formData: FormData) => String(formData.get("text") ?? "")

// Every action re-checks the session: hiding a form is not a security boundary.
async function requireSession() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  return { id: session.user.id, role: session.user.role }
}

function failure(result: { code: keyof typeof SERVICE_ERROR_MESSAGES | "invalid"; errors?: ValidationError[] }, text: string): SpecialistFormState {
  if (result.code === "invalid") {
    return { message: "That could not be saved. Fix the problems below and try again.", errors: result.errors ?? [], text }
  }
  return { message: SERVICE_ERROR_MESSAGES[result.code], text }
}

export async function createSpecialistAction(_prev: SpecialistFormState, formData: FormData): Promise<SpecialistFormState> {
  const actor = await requireSession()
  if (!canCreateSpecialist(actor.role)) redirect("/dashboard")
  const text = textOf(formData)

  const result = await createSpecialistFromText({ actor, text })
  if (!result.ok) return failure(result, text)
  redirect(`/dashboard/specialists/${result.slug}`)
}

export async function updateSpecialistAction(slug: string, _prev: SpecialistFormState, formData: FormData): Promise<SpecialistFormState> {
  const actor = await requireSession()
  const text = textOf(formData)

  const result = await updateSpecialistFromText({ actor, slug, text })
  if (!result.ok) {
    if (result.code === "forbidden") redirect(`/dashboard/specialists/${encodeURIComponent(slug)}`)
    return failure(result, text)
  }
  redirect(`/dashboard/specialists/${encodeURIComponent(slug)}`)
}

export async function importOutputsAction(slug: string, _prev: SpecialistFormState, formData: FormData): Promise<SpecialistFormState> {
  const actor = await requireSession()
  const text = textOf(formData)
  const instance = String(formData.get("instance") ?? "")
  // The judge is only used when asked for AND configured; otherwise the checkbox is ignored.
  const judge = formData.get("judge") === "on" && isJudgeConfigured() ? await createAnthropicJudge() : null

  const result = await importOutputsFromText({ actor, slug, instance, text, judge })
  if (!result.ok) {
    if (result.code === "forbidden") redirect(`/dashboard/specialists/${encodeURIComponent(slug)}`)
    return failure(result, text)
  }
  redirect(`/dashboard/evals/${result.runId}`)
}
