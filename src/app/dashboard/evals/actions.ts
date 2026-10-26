"use server"

import { auth } from "@/lib/auth"
import { canRunEvals } from "@/lib/guards"
import { startEvalRun } from "@/lib/evals/start"
import { withSpecialist } from "@/lib/evals/picker"
import { redirect } from "next/navigation"

// Re-checks the session and role on every call: hiding the form is not a
// security boundary, and server actions can be invoked directly.
export async function runEvalAction(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (!canRunEvals(session.user.role)) redirect("/dashboard")

  const specialist = String(formData.get("specialist") ?? "")
  const result = await startEvalRun({
    role: session.user.role,
    userId: session.user.id,
    specialist,
    version: String(formData.get("version") ?? ""),
    instance: String(formData.get("instance") ?? ""),
    useJudge: formData.get("judge") === "on",
  })

  if (!result.ok) redirect(withSpecialist(`/dashboard/evals?error=${result.code}`, specialist))
  // One run goes to its verdict; a run on every instance goes back to the list to compare them.
  if (result.runIds.length === 1) redirect(`/dashboard/evals/${result.runId}`)
  redirect(withSpecialist("/dashboard/evals", specialist))
}
