"use client"

import Link from "next/link"

/** Shown when a page fails unexpectedly. It never prints the error itself, which may hold internal detail. */
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="container">
      <article>
        <header>
          <h1>Something went wrong</h1>
        </header>
        <p role="alert">The page could not be shown. Try again, or go back to the dashboard.</p>
        <div className="grid">
          <button type="button" onClick={() => reset()}>
            Try again
          </button>
          <Link href="/dashboard" role="button" className="outline">
            Back to the dashboard
          </Link>
        </div>
      </article>
    </main>
  )
}
