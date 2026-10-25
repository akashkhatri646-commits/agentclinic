"use server"

import { auth } from "@/lib/auth"
import { canRunEvals } from "@/lib/guards"
import { startEvalRun } from "@/lib/evals/start"
import { redirect } from "next/navigation"

// Re-checks the session and role on every call: hiding the form is not a
// security boundary, and server actions can be invoked directly.
export async function runEvalAction(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (!canRunEvals(session.user.role)) redirect("/dashboard")

  const result = await startEvalRun({
    role: session.user.role,
    userId: session.user.id,
    version: String(formData.get("version") ?? ""),
    useJudge: formData.get("judge") === "on",
  })

  if (!result.ok) redirect(`/dashboard/evals?error=${result.code}`)
  redirect(`/dashboard/evals/${result.runId}`)
}
