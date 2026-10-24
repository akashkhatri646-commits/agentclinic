"use server"

import { auth } from "@/lib/auth"
import { getAgentByUserId } from "@/lib/agents"
import { createAilment, type AilmentSeverity } from "@/lib/ailments"
import { redirect } from "next/navigation"

export async function createAilmentAction(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const agentId = formData.get("agentId") as string
  const description = (formData.get("description") as string)?.trim()
  const severity = formData.get("severity") as AilmentSeverity

  const agent = await getAgentByUserId(session.user.id)
  if (!agent || agent.id !== agentId) redirect("/dashboard/ailments")

  if (!description || !["LOW", "MEDIUM", "HIGH"].includes(severity)) {
    redirect("/dashboard/ailments/new?error=1")
  }

  await createAilment({ agentId, description, severity })
  redirect("/dashboard/ailments")
}
