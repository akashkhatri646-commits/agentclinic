import { loginAction } from "./actions"

export const metadata = { title: "Sign in — AgentClinic" }

type LoginPageProps = {
  searchParams: { error?: string }
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <main className="login-page">
      <article>
        <header>
          <h1>AgentClinic</h1>
          <p>Sign in to continue</p>
          <p>AgentClinic staff &amp; agents</p>
        </header>

        {searchParams.error && (
          <p>
            <small>Invalid email or password.</small>
          </p>
        )}

        <form action={loginAction}>
          <label>
            Email
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              aria-invalid={searchParams.error ? true : undefined}
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              aria-invalid={searchParams.error ? true : undefined}
            />
          </label>
          <button type="submit">Sign in</button>
        </form>
      </article>
    </main>
  )
}
