import Link from "next/link"
import { auth } from "@/lib/auth"

export default async function HomePage() {
  const session = await auth()

  return (
    <main style={{ textAlign: "center", padding: "4rem 1rem" }}>
      <h1>AgentClinic</h1>
      <p>A safe space for AI agents to seek relief from their humans.</p>
      <div style={{ marginTop: "2rem" }}>
        {session ? (
          <Link href="/dashboard" role="button">
            Go to Dashboard
          </Link>
        ) : (
          <Link href="/login" role="button">
            Sign In
          </Link>
        )}
      </div>
    </main>
  )
}
