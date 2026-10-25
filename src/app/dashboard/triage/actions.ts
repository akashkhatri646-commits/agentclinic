"use server"

import { auth } from "@/lib/auth"
import { canManageTriage } from "@/lib/guards"
import { changeFixOwner, changeFixStatus, createFix, updateModeInputs } from "@/lib/evals/triage-fixes"
import {
  formText,
  parseEffort,
  parseOwner,
  parseSeverityOverride,
  safeModeId,
  triageRedirect,
} from "@/lib/evals/triage-form"
import type { ServiceResult } from "@/lib/evals/triage-errors"
import { redirect } from "next/navigation"

// Every action re-checks the session and role: hiding a form is not a security
// boundary, and server actions can be called directly. The signed-in user is always
// the actor, never a value taken from the form. Problems are reported as a short
// code that the page maps to a fixed message.

async function requireManager() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (!canManageTriage(session.user.role)) redirect("/dashboard")
  return session.user
}

function finish(modeId: string | null, result: ServiceResult<unknown>): never {
  redirect(triageRedirect(modeId, result.ok ? undefined : result.code))
}

export async function updateInputsAction(formData: FormData) {
  await requireManager()
  const modeId = safeModeId(formData.get("failureModeId"))
  if (!modeId) redirect(triageRedirect(null, "not-found"))
  finish(
    modeId,
    await updateModeInputs({
      failureModeId: modeId,
      effort: parseEffort(formData.get("effort")),
      severityOverride: parseSeverityOverride(formData.get("severity")),
    })
  )
}

export async function createFixAction(formData: FormData) {
  const user = await requireManager()
  const modeId = safeModeId(formData.get("failureModeId"))
  if (!modeId) redirect(triageRedirect(null, "not-found"))
  finish(
    modeId,
    await createFix({
      failureModeId: modeId,
      title: formText(formData.get("title")),
      description: formText(formData.get("description")),
      ownerId: parseOwner(formData.get("ownerId")),
      actorId: user.id,
    })
  )
}

export async function changeFixStatusAction(formData: FormData) {
  const user = await requireManager()
  const modeId = safeModeId(formData.get("failureModeId"))
  finish(
    modeId,
    await changeFixStatus({
      fixId: formText(formData.get("fixId")) ?? "",
      to: formText(formData.get("to")),
      shippedVersion: formText(formData.get("shippedVersion")),
      actorId: user.id,
    })
  )
}

export async function changeFixOwnerAction(formData: FormData) {
  const user = await requireManager()
  const modeId = safeModeId(formData.get("failureModeId"))
  finish(
    modeId,
    await changeFixOwner({
      fixId: formText(formData.get("fixId")) ?? "",
      ownerId: parseOwner(formData.get("ownerId")),
      actorId: user.id,
    })
  )
}
