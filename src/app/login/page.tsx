import { loginAction } from "./actions"

type LoginPageProps = {
  searchParams: { error?: string }
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <main className="login-page">
      <article>
        <header>
          <h2>Sign in</h2>
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
