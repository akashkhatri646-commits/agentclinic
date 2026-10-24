import { auth } from "@/lib/auth"
import { isStaff } from "@/lib/roles"
import { redirect } from "next/navigation"
import TherapyForm from "@/components/TherapyForm"

export const metadata = { title: "Add Therapy — AgentClinic" }

export default async function NewTherapyPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (!isStaff(session.user.role)) redirect("/dashboard")

  return (
    <article>
      <header>
        <h2>Add Therapy</h2>
        <p>Define a new treatment for the AgentClinic catalogue.</p>
      </header>
      <TherapyForm mode="create" />
    </article>
  )
}
