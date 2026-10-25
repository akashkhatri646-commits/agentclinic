import { auth } from "@/lib/auth"
import { getAilmentById } from "@/lib/ailments"
import { getAgentByUserId } from "@/lib/agents"
import { getAvailableSlots, createAppointment } from "@/lib/appointments"
import { canBookForAilment } from "@/lib/guards"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"

export const metadata = { title: "Book Appointment — AgentClinic" }

export default async function BookAppointmentPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { staffId?: string; date?: string; error?: string }
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const agent = await getAgentByUserId(session.user.id)
  if (!agent) redirect("/dashboard/ailments")

  const ailment = await getAilmentById(params.id)
  if (!ailment || ailment.agentId !== agent.id) notFound()
  if (!ailment.therapy) redirect(`/dashboard/ailments/${params.id}`)

  // Get all staff users
  const staffUsers = await prisma.user.findMany({
    where: { role: { in: ["STAFF", "ADMIN"] } },
    orderBy: { email: "asc" },
  })

  const selectedStaffId = searchParams.staffId
  const selectedDate = searchParams.date
  const error = searchParams.error

  let availableSlots: Date[] = []
  if (selectedStaffId && selectedDate) {
    const dateObj = new Date(selectedDate)
    if (!isNaN(dateObj.getTime())) {
      availableSlots = await getAvailableSlots(selectedStaffId, dateObj)
    }
  }

  // Min date = today (local), max = 3 months out
  const today = new Date().toISOString().split("T")[0]

  return (
    <article>
      <header>
        <div>
          <h2>Book Appointment</h2>
          <p>
            Therapy: <strong>{ailment.therapy.name}</strong> (
            {ailment.therapy.durationMinutes} min)
          </p>
        </div>
      </header>

      {error && (
        <p>
          <small style={{ color: "var(--pico-del-color)" }}>{decodeURIComponent(error)}</small>
        </p>
      )}

      {/* Step 1: Pick staff + date */}
      <form method="GET">
        <div className="grid">
          <label>
            Practitioner
            <select name="staffId" required defaultValue={selectedStaffId ?? ""}>
              <option value="">Select a practitioner…</option>
              {staffUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email}
                </option>
              ))}
            </select>
          </label>

          <label>
            Date
            <input
              type="date"
              name="date"
              required
              min={today}
              defaultValue={selectedDate ?? ""}
            />
          </label>
        </div>
        <button type="submit" className="outline">
          Show available slots
        </button>
      </form>

      {/* Step 2: Pick slot and confirm */}
      {selectedStaffId && selectedDate && (
        <section>
          <h3>Available Slots</h3>
          {availableSlots.length === 0 ? (
            <p>No slots available on this date. Try another day.</p>
          ) : (
            <BookSlotForm
              ailmentId={ailment.id}
              agentId={agent.id}
              staffId={selectedStaffId}
              therapyId={ailment.therapy.id}
              slots={availableSlots}
            />
          )}
        </section>
      )}
    </article>
  )
}

function BookSlotForm({
  ailmentId,
  agentId,
  staffId,
  therapyId,
  slots,
}: {
  ailmentId: string
  agentId: string
  staffId: string
  therapyId: string
  slots: Date[]
}) {
  async function handleBook(formData: FormData) {
    "use server"
    // Re-verify ownership: the ids above were captured at render time.
    const actor = await auth()
    if (!actor?.user?.id) redirect("/login")
    const current = await getAilmentById(ailmentId)
    if (!current || !canBookForAilment(actor.user.id, current.agent.userId)) {
      redirect("/dashboard/ailments")
    }

    const scheduledAtRaw = formData.get("scheduledAt") as string
    if (!scheduledAtRaw) redirect(`/dashboard/ailments/${ailmentId}/book`)

    const scheduledAt = new Date(scheduledAtRaw)
    let bookingError: string | null = null
    try {
      await createAppointment({ agentId, staffId, ailmentId, therapyId, scheduledAt })
    } catch (e: unknown) {
      bookingError = e instanceof Error ? e.message : "Booking failed."
    }

    if (bookingError) {
      redirect(
        `/dashboard/ailments/${ailmentId}/book?staffId=${staffId}&error=${encodeURIComponent(bookingError)}`
      )
    }
    redirect(`/dashboard/ailments/${ailmentId}`)
  }

  return (
    <form action={handleBook}>
      <fieldset>
        {slots.map((slot) => (
          <label key={slot.toISOString()}>
            <input
              type="radio"
              name="scheduledAt"
              value={slot.toISOString()}
              required
            />
            {slot.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          </label>
        ))}
      </fieldset>
      <button type="submit">Confirm booking</button>
    </form>
  )
}
