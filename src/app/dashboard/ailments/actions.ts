"use server"

import { auth } from "@/lib/auth"
import { getAgentByUserId } from "@/lib/agents"
import {
  assignTherapy,
  createAilment,
  dischargeAilment,
  getAilmentById,
  reopenAilment,
  type AilmentSeverity,
} from "@/lib/ailments"
import {
  cancelAppointment,
  getAppointmentById,
  updateAppointmentStatus,
} from "@/lib/appointments"
import {
  canAssignTherapy,
  canCancelAppointment,
  canConfirmAppointment,
  canDischarge,
} from "@/lib/guards"
import { redirect } from "next/navigation"

export type AilmentFormState = {
  error?: string
  values?: { description: string; severity: string }
}

export async function createAilmentAction(
  _prev: AilmentFormState,
  formData: FormData
): Promise<AilmentFormState> {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const agentId = formData.get("agentId") as string
  const description = (formData.get("description") as string)?.trim() ?? ""
  const severity = formData.get("severity") as string

  const agent = await getAgentByUserId(session.user.id)
  if (!agent || agent.id !== agentId) redirect("/dashboard/ailments")

  if (!description) {
    return { error: "Please describe your ailment.", values: { description: "", severity } }
  }
  if (description.length > 2000) {
    return {
      error: "Description must be 2000 characters or fewer.",
      values: { description, severity },
    }
  }
  if (!["LOW", "MEDIUM", "HIGH"].includes(severity)) {
    return { error: "Please select a severity level.", values: { description, severity: "" } }
  }

  await createAilment({ agentId: agent.id, description, severity: severity as AilmentSeverity })
  redirect("/dashboard/ailments")
}

// ─── Staff / appointment actions ─────────────────────────────────────────────
// Each action re-checks the caller's session and role. Hiding a button in the
// UI is not enough: server actions can be invoked directly.

async function requireUser() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  return session.user
}

function backWithError(ailmentId: string, message: string): never {
  redirect(`/dashboard/ailments/${ailmentId}?error=${encodeURIComponent(message)}`)
}

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback
}

export async function assignTherapyAction(formData: FormData) {
  const user = await requireUser()
  const ailmentId = formData.get("ailmentId") as string
  const therapyId = formData.get("therapyId") as string
  if (!canAssignTherapy(user.role)) redirect("/dashboard/ailments")
  if (!ailmentId || !therapyId) return

  const ailment = await getAilmentById(ailmentId)
  if (!ailment) redirect("/dashboard/ailments")
  if (ailment.status === "RESOLVED") backWithError(ailmentId, "Reopen this ailment before changing its therapy.")

  await assignTherapy(ailmentId, therapyId)
  redirect(`/dashboard/ailments/${ailmentId}`)
}

export async function dischargeAilmentAction(formData: FormData) {
  const user = await requireUser()
  const ailmentId = formData.get("ailmentId") as string
  const note = (formData.get("note") as string) ?? ""
  if (!canDischarge(user.role)) redirect("/dashboard/ailments")
  if (!ailmentId) redirect("/dashboard/ailments")

  let error: string | null = null
  try {
    await dischargeAilment(ailmentId, note)
  } catch (e) {
    error = errorMessage(e, "Could not discharge this ailment.")
  }
  if (error) backWithError(ailmentId, error)
  redirect(`/dashboard/ailments/${ailmentId}`)
}

export async function reopenAilmentAction(formData: FormData) {
  const user = await requireUser()
  const ailmentId = formData.get("ailmentId") as string
  if (!canDischarge(user.role)) redirect("/dashboard/ailments")
  if (!ailmentId) redirect("/dashboard/ailments")

  let error: string | null = null
  try {
    await reopenAilment(ailmentId)
  } catch (e) {
    error = errorMessage(e, "Could not reopen this ailment.")
  }
  if (error) backWithError(ailmentId, error)
  redirect(`/dashboard/ailments/${ailmentId}`)
}

export async function confirmAppointmentAction(formData: FormData) {
  const user = await requireUser()
  const appointmentId = formData.get("appointmentId") as string
  const returnTo = safeReturnTo(formData.get("returnTo") as string)
  if (!canConfirmAppointment(user.role)) redirect("/dashboard")

  const appointment = appointmentId ? await getAppointmentById(appointmentId) : null
  if (!appointment) redirect(returnTo)
  if (appointment.status === "PENDING") {
    await updateAppointmentStatus(appointment.id, "CONFIRMED", user.id)
  }
  redirect(returnTo)
}

export async function cancelAppointmentAction(formData: FormData) {
  const user = await requireUser()
  const appointmentId = formData.get("appointmentId") as string
  const returnTo = safeReturnTo(formData.get("returnTo") as string)

  const appointment = appointmentId ? await getAppointmentById(appointmentId) : null
  if (!appointment) redirect(returnTo)
  if (!canCancelAppointment(user.role, user.id, appointment.agent.userId)) redirect("/dashboard")

  if (appointment.status !== "CANCELLED") {
    await cancelAppointment(appointment.id, user.id)
  }
  redirect(returnTo)
}

/** Only allow same-site dashboard paths, so a forged form field can't redirect elsewhere. */
function safeReturnTo(value: string | null): string {
  return value && /^\/dashboard(\/[A-Za-z0-9_-]+)*$/.test(value) ? value : "/dashboard"
}
