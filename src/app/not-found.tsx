import Link from "next/link"

export default function NotFound() {
  return (
    <main className="container">
      <article>
        <header>
          <h1>Page not found</h1>
        </header>
        <p>That address does not exist, or you may not have access to it.</p>
        <Link href="/dashboard" role="button">
          Back to the dashboard
        </Link>
      </article>
    </main>
  )
}
