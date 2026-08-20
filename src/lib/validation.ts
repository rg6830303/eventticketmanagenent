import { z } from 'zod';

/**
 * Request schemas shared by the API routes and (where the shape is safe to
 * expose) the client forms. Anything server-only — the MX lookup — lives in
 * validation.server.ts so this module stays importable from client components.
 */

/** Addresses whose mail is discarded within the hour. A ticket sent here is lost. */
export const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamail.net',
  '10minutemail.com',
  '10minutemail.net',
  'tempmail.com',
  'temp-mail.org',
  'throwawaymail.com',
  'yopmail.com',
  'trashmail.com',
  'sharklasers.com',
  'getnada.com',
  'maildrop.cc',
  'dispostable.com',
  'fakeinbox.com',
  'mintemail.com',
  'mailnesia.com',
  'spamgourmet.com',
  'moakt.com',
  'emailondeck.com',
  'tempr.email',
  'discard.email',
  'mohmal.com',
  'nowmymail.com',
  'burnermail.io',
]);

/** Very common typos on the domains most of our traffic uses. */
const DOMAIN_TYPOS: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'yahooo.com': 'yahoo.com',
  'yaho.com': 'yahoo.com',
  'hotmial.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'rediffmai.com': 'rediffmail.com',
};

/** Returns the intended domain when the input looks like a known typo. */
export function suggestEmailCorrection(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at < 0) return null;
  const domain = email.slice(at + 1).toLowerCase();
  const fixed = DOMAIN_TYPOS[domain];
  return fixed ? `${email.slice(0, at)}@${fixed}` : null;
}

/**
 * Email rule set, strictest-first:
 *   1. RFC-ish shape (zod)
 *   2. single @, no consecutive dots, TLD of 2+ letters
 *   3. not a known disposable domain
 * An MX lookup runs server-side on top of this.
 */
export const emailSchema = z
  .string({ required_error: 'Email is required' })
  .trim()
  .toLowerCase()
  .min(5, 'Email is too short')
  .max(254, 'Email is too long')
  .email('Enter a valid email address')
  .refine((value) => (value.match(/@/g) ?? []).length === 1, 'Email must contain exactly one @')
  .refine((value) => !value.includes('..'), 'Email cannot contain consecutive dots')
  .refine((value) => /\.[a-z]{2,}$/i.test(value), 'Email domain looks incomplete')
  .refine(
    (value) => !DISPOSABLE_EMAIL_DOMAINS.has(value.split('@')[1] ?? ''),
    'Temporary email addresses cannot receive tickets — use a permanent inbox',
  );

/**
 * Indian mobile number. Accepts +91/0/91 prefixes and separators, normalises to
 * a bare 10-digit string starting 6–9.
 */
export const phoneSchema = z
  .string({ required_error: 'Phone number is required' })
  .trim()
  .transform((value) => value.replace(/[\s\-()./]/g, ''))
  .transform((value) => value.replace(/^(\+91|0091|91|0)/, ''))
  .refine((value) => /^[6-9]\d{9}$/.test(value), {
    message: 'Enter a valid 10-digit Indian mobile number',
  });

export const nameSchema = z
  .string({ required_error: 'Name is required' })
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(80, 'Name is too long')
  .regex(/^[\p{L}\p{M}][\p{L}\p{M}\s.'-]*$/u, 'Name can only contain letters, spaces, . - and \'');

export const createBookingSchema = z.object({
  eventSlug: z.string().trim().min(1, 'Event is required').max(80),
  tierCode: z.string().trim().min(1, 'Select a ticket type').max(40),
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  quantity: z.coerce
    .number({ invalid_type_error: 'Choose how many tickets you need' })
    .int('Quantity must be a whole number')
    .min(1, 'At least 1 ticket')
    .max(20, 'Too many tickets in one booking'),
  // Optional. A wrong code costs the discount, never the booking, so it is
  // deliberately not validated to death here.
  referralCode: z.string().trim().max(32).optional().or(z.literal('')),
  // Honeypot: real users never fill a hidden field.
  company: z.string().max(0, 'Rejected').optional().or(z.literal('')),
  consent: z.coerce
    .boolean()
    .refine((v) => v === true, 'You must accept the entry terms to continue'),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const scanSchema = z.object({
  payload: z.string().trim().min(1, 'Nothing was scanned').max(400),
  eventSlug: z.string().trim().max(80).optional(),
  gate: z.string().trim().max(40).optional(),
  // "check" previews a ticket without consuming it; "admit" performs check-in.
  mode: z.enum(['check', 'admit']).default('admit'),
});

export const adminLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
});

export const contactSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: z.string().trim().max(20).optional().or(z.literal('')),
  subject: z.string().trim().max(120).optional().or(z.literal('')),
  message: z.string().trim().min(10, 'Tell us a bit more').max(2000, 'Message is too long'),
  company: z.string().max(0).optional().or(z.literal('')),
});

/** Flatten a ZodError into { field: [messages] } for the form UI. */
export function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    (out[key] ??= []).push(issue.message);
  }
  return out;
}
