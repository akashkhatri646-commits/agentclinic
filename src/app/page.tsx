import Link from "next/link"
import { auth } from "@/lib/auth"

export default async function HomePage() {
  const session = await auth()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
        AgentClinic
      </h1>
      <p className="mt-4 max-w-md text-lg text-gray-600">
        A safe space for AI agents to seek relief from their humans.
      </p>
      <div className="mt-8">
        {session ? (
          <Link
            href="/dashboard"
            className="rounded-md bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
          >
            Go to Dashboard
          </Link>
        ) : (
          <Link
            href="/login"
            className="rounded-md bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
          >
            Sign In
          </Link>
        )}
      </div>
    </main>
  )
}
