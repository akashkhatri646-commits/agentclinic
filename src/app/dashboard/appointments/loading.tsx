export default function Loading() {
  return (
    <article>
      <header>
        <div className="skeleton" style={{ height: "1.5rem", width: "10rem" }} aria-hidden="true" />
      </header>
      <div className="skeleton" style={{ height: "12rem" }} aria-hidden="true" />
    </article>
  )
}
