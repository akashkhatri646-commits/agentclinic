import { auth } from "@/lib/auth"
import { isStaff } from "@/lib/roles"
import { getTherapyById } from "@/lib/therapies"
import { redirect, notFound } from "next/navigation"
import TherapyForm from "@/components/TherapyForm"

export const metadata = { title: "Edit Therapy — AgentClinic" }

export default async function EditTherapyPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (!isStaff(session.user.role)) redirect("/dashboard")

  const therapy = await getTherapyById(params.id)
  if (!therapy) notFound()

  return (
    <article>
      <header>
        <h2>Edit Therapy</h2>
        <p>Update the details of <strong>{therapy.name}</strong>.</p>
      </header>
      <TherapyForm mode="edit" therapy={therapy} />
    </article>
  )
}
