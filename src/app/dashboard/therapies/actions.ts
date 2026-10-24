"use server"

import { auth } from "@/lib/auth"
import {
  createTherapy,
  updateTherapy,
  deleteTherapy,
} from "@/lib/therapies"
import { isStaff } from "@/lib/roles"
import { redirect } from "next/navigation"

export type TherapyFormState = {
  error?: string
  values?: { name: string; description: string; durationMinutes: string }
}

async function requireStaff() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (!isStaff(session.user.role)) redirect("/dashboard")
}

export async function createTherapyAction(
  _prev: TherapyFormState,
  formData: FormData
): Promise<TherapyFormState> {
  await requireStaff()

  const name = (formData.get("name") as string)?.trim() ?? ""
  const description = (formData.get("description") as string)?.trim() ?? ""
  const durationRaw = (formData.get("durationMinutes") as string)?.trim() ?? ""
  const durationMinutes = parseInt(durationRaw, 10)

  if (!name) return { error: "Name is required.", values: { name, description, durationMinutes: durationRaw } }
  if (!description) return { error: "Description is required.", values: { name, description, durationMinutes: durationRaw } }
  if (!durationRaw || isNaN(durationMinutes) || durationMinutes < 1) {
    return { error: "Duration must be a positive number.", values: { name, description, durationMinutes: durationRaw } }
  }

  await createTherapy({ name, description, durationMinutes })
  redirect("/dashboard/therapies")
}

export async function updateTherapyAction(
  id: string,
  _prev: TherapyFormState,
  formData: FormData
): Promise<TherapyFormState> {
  await requireStaff()

  const name = (formData.get("name") as string)?.trim() ?? ""
  const description = (formData.get("description") as string)?.trim() ?? ""
  const durationRaw = (formData.get("durationMinutes") as string)?.trim() ?? ""
  const durationMinutes = parseInt(durationRaw, 10)

  if (!name) return { error: "Name is required.", values: { name, description, durationMinutes: durationRaw } }
  if (!description) return { error: "Description is required.", values: { name, description, durationMinutes: durationRaw } }
  if (!durationRaw || isNaN(durationMinutes) || durationMinutes < 1) {
    return { error: "Duration must be a positive number.", values: { name, description, durationMinutes: durationRaw } }
  }

  await updateTherapy(id, { name, description, durationMinutes })
  redirect("/dashboard/therapies")
}

export async function deleteTherapyAction(id: string): Promise<{ error?: string }> {
  await requireStaff()
  try {
    await deleteTherapy(id)
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Could not delete therapy." }
  }
  redirect("/dashboard/therapies")
}
