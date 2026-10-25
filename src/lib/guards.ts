import { isStaff } from "./roles"

/**
 * Authorization rules shared by server actions and pages. They are pure so the
 * rules can be tested without a session or database. Every server action must
 * re-check them: the UI hiding a button is not a security boundary.
 */

export const canDischarge = (role: string): boolean => isStaff(role)

export const canAssignTherapy = (role: string): boolean => isStaff(role)

/** Staff and admins see every ailment; an agent sees only their own. */
export function canViewAilment(
  role: string,
  userId: string,
  ailmentOwnerUserId: string | null | undefined
): boolean {
  return isStaff(role) || (!!ailmentOwnerUserId && ailmentOwnerUserId === userId)
}

/** Only the agent who owns the ailment may book against it. */
export function canBookForAilment(
  userId: string,
  ailmentOwnerUserId: string | null | undefined
): boolean {
  return !!ailmentOwnerUserId && ailmentOwnerUserId === userId
}

export const canConfirmAppointment = (role: string): boolean => isStaff(role)

/** Staff and admins can cancel any appointment; an agent only their own. */
export function canCancelAppointment(
  role: string,
  userId: string,
  appointmentAgentUserId: string | null | undefined
): boolean {
  return isStaff(role) || (!!appointmentAgentUserId && appointmentAgentUserId === userId)
}

/** Eval runs and verdicts are for staff and admin only; agents never see scenarios or the hold-out set. */
export const canViewEvals = (role: string): boolean => isStaff(role)

export const canRunEvals = (role: string): boolean => isStaff(role)

/** The triage backlog and fixes are for staff and admin only; agents never see them. */
export const canViewTriage = (role: string): boolean => isStaff(role)

export const canManageTriage = (role: string): boolean => isStaff(role)
