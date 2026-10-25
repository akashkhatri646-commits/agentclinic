export default function Loading() {
  return (
    <article>
      <header>
        <div className="skeleton" style={{ height: "1.5rem", width: "10rem" }} aria-hidden="true" />
      </header>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="skeleton"
          style={{ height: "2.5rem", marginBottom: "0.5rem" }}
          aria-hidden="true"
        />
      ))}
    </article>
  )
}
