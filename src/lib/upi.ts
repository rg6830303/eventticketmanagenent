/**
 * UPI deep links and UTR handling.
 *
 * Deliberately isomorphic — no `server-only` import — because the browser needs
 * the same UTR rules the API enforces. Anything secret (the payee VPA comes
 * from env) is read on the server and passed in, so this module never has to
 * know where it runs.
 */

/** Characters a UPI note may contain. PSPs reject most punctuation outright. */
const NOTE_SAFE = /[^A-Za-z0-9 .-]/g;

export interface UpiLinkArgs {
  /** Payee VPA, e.g. `name@bank`. */
  payeeAddress: string;
  /** Payee display name, shown in the customer's UPI app. */
  payeeName: string;
  /** Amount in paise — the same integer the booking stores. */
  amountPaise: number;
  /** Booking reference, used as the merchant transaction reference. */
  reference: string;
  /** Human-readable note. Trimmed and stripped to PSP-safe characters. */
  note?: string;
}

/**
 * Build an NPCI-compliant `upi://pay` URI.
 *
 * Three things here are load-bearing and easy to get wrong:
 *
 *  1. **The amount is formatted from paise, to exactly two decimals.** UPI apps
 *     parse `am` as a decimal string; `500` and `500.00` are both accepted but
 *     `500.5` has been seen to render as ₹500.50 in some PSPs and ₹500.05 in
 *     others. Fixing the scale removes the ambiguity.
 *  2. **Every value is percent-encoded.** A payee name with a space produces a
 *     link that silently truncates at the space in several Android intent
 *     handlers.
 *  3. **`tr` carries the booking reference, not `tn`.** `tr` is the merchant
 *     transaction reference and is what lands in the payee's statement, which
 *     is the whole basis for reconciling a payment later. `tn` is a free-text
 *     note the customer sees and is not guaranteed to survive.
 */
export function buildUpiUri(args: UpiLinkArgs): string {
  const amount = (Math.max(0, Math.round(args.amountPaise)) / 100).toFixed(2);
  const note = (args.note ?? `Ticket ${args.reference}`)
    .replace(NOTE_SAFE, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50);

  const params = new URLSearchParams({
    pa: args.payeeAddress,
    pn: args.payeeName,
    am: amount,
    cu: 'INR',
    tr: args.reference,
    tn: note,
  });

  // URLSearchParams encodes a space as "+", which is correct for form bodies
  // and wrong inside a URI query that UPI apps parse literally — several show
  // the plus sign in the note. %20 is safe everywhere.
  return `upi://pay?${params.toString().replace(/\+/g, '%20')}`;
}

/** Digits only. People paste UTRs with spaces, and some apps prefix "UTR:". */
export function normaliseUtr(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 12);
}

/**
 * A UPI UTR (strictly an RRN) is 12 digits.
 *
 * Not all-zeros, because "000000000000" is what a blank field and a few broken
 * bank screenshots produce, and it would otherwise sail through as valid.
 */
export function isValidUtr(raw: string): boolean {
  const utr = normaliseUtr(raw);
  return /^\d{12}$/.test(utr) && !/^0+$/.test(utr);
}

/** `1234 5678 9012` — easier to check against a bank app than a 12-digit run. */
export function formatUtr(raw: string): string {
  const utr = normaliseUtr(raw);
  return utr.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}
