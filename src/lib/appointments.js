export const MIN_APPOINTMENT_LEAD_MS = 30 * 60 * 1000;

export function validateAppointmentSlot(dateStr, timeStr) {
  if (!dateStr || !timeStr) {
    return { ok: false, error: 'Please pick a date and time.' };
  }
  const appointmentAt = new Date(`${dateStr}T${timeStr}:00`);
  if (Number.isNaN(appointmentAt.getTime())) {
    return { ok: false, error: 'Invalid date or time.' };
  }
  const minAt = Date.now() + MIN_APPOINTMENT_LEAD_MS;
  if (appointmentAt.getTime() < minAt) {
    return { ok: false, error: 'Pick a time at least 30 minutes from now.' };
  }
  return { ok: true, iso: appointmentAt.toISOString(), date: appointmentAt };
}

export function minAppointmentDateStr() {
  return new Date().toISOString().slice(0, 10);
}

export const APPOINTMENT_STATUSES = {
  none: 'None',
  pending: 'Pending review',
  accepted: 'Confirmed',
  countered: 'Counter proposed',
  declined: 'Declined',
};

export const SUPPORT_AVAILABILITY = {
  available: { label: 'Available', hint: 'Team is online for support' },
  busy: { label: 'Busy', hint: 'We are helping other customers — messages welcome' },
  away: { label: 'Away', hint: 'Limited availability — we will reply when back' },
};
