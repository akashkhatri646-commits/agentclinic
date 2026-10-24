"use server"

import { auth } from "@/lib/auth"
import { getAgentByUserId } from "@/lib/agents"
import { createAilment, type AilmentSeverity } from "@/lib/ailments"
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
