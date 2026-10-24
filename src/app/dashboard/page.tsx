import { auth } from "@/lib/auth"

export default async function DashboardPage() {
  const session = await auth()

  return (
    <article>
      <header>
        <h2>Dashboard</h2>
      </header>
      <p>
        Signed in as <strong>{session?.user?.email}</strong>
        {" · "}
        <span>{session?.user?.role}</span>
      </p>
    </article>
  )
}
