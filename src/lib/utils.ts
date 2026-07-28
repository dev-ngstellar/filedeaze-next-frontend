import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import dayjs from 'dayjs';
import type { FocusEvent } from 'react';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Strips a stray leading zero from a numeric `<input type="number">` on blur (e.g. "01500" -> "1500").
 * Native number inputs don't do this themselves while typing — wire this to onBlur alongside
 * react-hook-form's own onBlur wherever a leading zero would look like a formatting bug. */
export function stripLeadingZeroOnBlur(e: FocusEvent<HTMLInputElement>): void {
  const value = e.target.value;
  if (/^0\d+/.test(value)) {
    e.target.value = String(Number(value));
  }
}

/** Formats a date for display, e.g. "10 Jul 2026". Returns '—' for null/undefined/invalid input. */
export function formatDate(date: string | Date | null | undefined, fmt = 'DD MMM YYYY'): string {
  if (!date) return '—';
  const d = dayjs(date);
  return d.isValid() ? d.format(fmt) : '—';
}

/** Formats a date + time for display, e.g. "10 Jul 2026, 14:30". Returns '—' for null/undefined/invalid input. */
export function formatDateTime(date: string | Date | null | undefined, fmt = 'DD MMM YYYY, HH:mm'): string {
  return formatDate(date, fmt);
}

/** Formats a number as Indian Rupees, e.g. "₹1,234". Returns '₹0' for null/undefined/NaN input. */
export function formatCurrency(amount: number | string | null | undefined): string {
  const n = Number(amount);
  return `₹${(Number.isFinite(n) ? n : 0).toLocaleString()}`;
}

/** Today's local date as 'YYYY-MM-DD' — the `min` value for a plain `<input type="date">` whose
 * backend field is guarded by `@IsNotPastDate()` (see is-not-past-date.validator.ts on the
 * backend: date-level only — rejects any date before today, accepts any time on today's date).
 * Call it fresh at render time rather than caching, so "today" stays correct if a form is left
 * open across midnight. */
export function getMinimumSelectableDate(): string {
  return dayjs().format('YYYY-MM-DD');
}

/** The current moment as 'YYYY-MM-DDTHH:mm' — the `min` value for an
 * `<input type="datetime-local">` whose backend field is guarded by `@IsNotPastDate()`. Note this
 * is deliberately *stricter* than the backend check itself, which only rejects dates before today
 * and would accept e.g. "8:00 AM today" even at 2:00 PM — letting a manager pick an already-passed
 * time today is still a real UX problem the backend alone won't catch, so the picker enforces the
 * tighter, moment-level rule here. */
export function getMinimumSelectableDateTime(): string {
  return dayjs().format('YYYY-MM-DDTHH:mm');
}

/** Mirrors the backend's `@IsNotPastDate()` validator exactly (date-level: true only if `value`
 * falls before the start of today) — for pre-submit react-hook-form `validate` rules, so an
 * invalid date is caught with a clear message before the API call, not after. Returns false (not
 * past) for empty/invalid input — required-ness and format are separate concerns for the caller. */
export function isPastSchedule(value: string | Date | null | undefined): boolean {
  if (!value) return false;
  const d = dayjs(value);
  return d.isValid() && d.isBefore(dayjs().startOf('day'));
}

/** True if `value` has more than 2 digits after the decimal point (e.g. 10.999 → true, 10.99 →
 * false). Mirrors the backend's IsMonetaryAmount decimal-places check exactly. */
export function hasMoreThanTwoDecimals(value: number): boolean {
  const decimals = value.toString().split('.')[1];
  return !!decimals && decimals.length > 2;
}

/** react-hook-form `validate` rule for a currency amount — mirrors the backend's
 * IsMonetaryAmount decorator's priority order exactly (type → negative → up to 2 decimal places
 * → max) so an invalid value is caught before submit with the same message the API would give,
 * instead of round-tripping for the same rejection (or, worse, showing a different-priority
 * message than the backend would for the same input). Pass `max` for fields with an established
 * ceiling (e.g. the ₹100,000 Business Settings cap) — omit it if none exists. */
export function validateMonetaryAmount(label: string, max?: number) {
  return (value: number | undefined | null): true | string => {
    if (value === undefined || value === null || Number.isNaN(value) || !Number.isFinite(value)) {
      return `${label} must be a valid number`;
    }
    if (value < 0) return `${label} cannot be negative`;
    if (hasMoreThanTwoDecimals(value)) return `${label} can contain up to 2 decimal places`;
    if (max !== undefined && value > max) return `${label} cannot exceed ₹${max.toLocaleString('en-US')}`;
    return true;
  };
}

/** Extracts a user-friendly message from an Axios/fetch error, with a status-aware fallback.
 * Pass `fallback` to override the final generic string with one specific to the action that
 * failed (e.g. "Failed to create ticket") — it's only used once every other check (backend
 * message, status code, timeout, network) has come up empty. */
export function getErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const err = error as { response?: { status?: number; data?: { message?: string } }; message?: string; code?: string } | undefined;
  const serverMessage = err?.response?.data?.message;
  if (serverMessage) return serverMessage;

  const status = err?.response?.status;
  if (status === 401) return 'Your session has expired. Please log in again.';
  if (status === 403) return "You don't have permission to view this.";
  if (status === 404) return 'The requested data could not be found.';
  if (status && status >= 500) return 'The server ran into a problem. Please try again in a moment.';
  if (err?.code === 'ECONNABORTED' || /timeout/i.test(err?.message ?? '')) return 'The request took too long. Please try again.';
  if (err?.message === 'Network Error') return 'Unable to connect to the server. Please check your internet connection.';
  return fallback;
}
