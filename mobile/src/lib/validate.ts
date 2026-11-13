/**
 * validate.ts — form checks for the account screens. Each returns an error message key, or null if OK.
 * Owner: Person 3/4 (Zuhayr). Messages are short, specific and say how to fix the problem.
 */

/** Simple email check (good enough for a form; the server does the real check). */
export function checkEmail(v: string): string | null {
  if (!v.trim()) return 'Enter your email.';
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? null : 'That email looks wrong, e.g. name@example.com';
}

/**
 * Turns what the user typed into +230XXXXXXXX, or null if it isn't a Mauritian mobile number.
 * Why: Mauritian mobile numbers are 8 digits starting with 5; people type them with or without +230 and spaces.
 */
export function normalisePhone(v: string): string | null {
  const digits = v.replace(/[^\d]/g, '').replace(/^230/, '');
  return /^5\d{7}$/.test(digits) ? `+230${digits}` : null;
}

/** Phone check with a helpful message. */
export function checkPhone(v: string): string | null {
  if (!v.trim()) return 'Enter your phone number.';
  return normalisePhone(v) ? null : 'Use a Mauritian mobile number: 8 digits starting with 5.';
}

/** Password rule: at least 8 characters with at least one number. */
export function checkPassword(v: string): string | null {
  if (v.length < 8) return 'Use at least 8 characters.';
  return /\d/.test(v) ? null : 'Add at least one number.';
}

/** 6-digit code check. */
export function checkCode(v: string): string | null {
  return /^\d{6}$/.test(v) ? null : 'Enter the 6 digits.';
}

/** Non-empty name. */
export function checkName(v: string): string | null {
  return v.trim().length >= 2 ? null : 'Enter a name.';
}
