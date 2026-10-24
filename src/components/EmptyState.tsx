import Link from "next/link"

type Props = {
  message: string
  actionHref?: string
  actionLabel?: string
}

export default function EmptyState({ message, actionHref, actionLabel }: Props) {
  return (
    <div className="empty-state">
      <p>{message}</p>
      {actionHref && actionLabel && (
        <Link href={actionHref} role="button" className="outline">
          {actionLabel}
        </Link>
      )}
    </div>
  )
}
