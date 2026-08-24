import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from './env';
import { query } from './db';
import { qrPngBuffer } from './qr';
import { buildQrPayload, ticketUrl } from './tickets';
import {
  BRAND_MARK_CID,
  ticketEmailHtml,
  ticketEmailSubject,
  ticketEmailText,
  contactAckHtml,
  type TicketEmailData,
} from './email-templates';
import { brandMarkPng } from './email-assets';
import type { BookingDetail } from './types';

/**
 * Gmail SMTP delivery.
 *
 * Gmail requires an App Password (2FA on the account, then
 * https://myaccount.google.com/apppasswords) — the normal account password is
 * rejected with "Username and Password not accepted".
 *
 * Quota reality check: a free @gmail.com account allows ~500 recipients/day and
 * Google Workspace ~2,000. For a 500-cap club night that is fine. If a single
 * drop ever needs to exceed that, move to a transactional provider — the
 * `sendMail` seam below is the only thing that would change.
 */

declare global {
  // eslint-disable-next-line no-var
  var __hovTransport: Transporter | undefined;
}

function getTransport(): Transporter {
  if (!globalThis.__hovTransport) {
    const smtp = env.smtp;
    globalThis.__hovTransport = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure, // true for 465, false for 587 (STARTTLS)
      auth: { user: smtp.user, pass: smtp.password },
      pool: true,
      maxConnections: 3,
      maxMessages: 50,
      connectionTimeout: 15_000,
      greetingTimeout: 10_000,
      socketTimeout: 25_000,
    });
  }
  return globalThis.__hovTransport;
}

/** Confirms the SMTP credentials actually authenticate. Used by /api/health. */
export async function verifySmtp(): Promise<{ ok: boolean; error?: string }> {
  if (!env.smtpConfigured) return { ok: false, error: 'SMTP credentials are not configured' };
  try {
    await getTransport().verify();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'unknown SMTP error' };
  }
}

export interface SendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: Array<{ filename: string; content: Buffer; cid?: string; contentType?: string }>;
  bookingId?: string | null;
  template: string;
}

/**
 * Single send seam. Every outbound message is written to email_log — sent or
 * failed — so "did the customer get their ticket?" is answerable from the
 * admin console instead of from a support guess.
 */
async function sendMail(args: SendArgs): Promise<SendResult> {
  // Checked before anything reads SMTP config, so an unconfigured deployment
  // returns a failure result instead of throwing.
  if (!env.smtpConfigured) {
    const error = 'SMTP is not configured — set SMTP_USER and SMTP_PASSWORD';
    await logEmail(args, 'failed', null, error);
    return { ok: false, error };
  }

  const smtp = env.smtp;

  try {
    // Deliverability headers.
    //
    // From MUST be the authenticated Gmail account. Gmail signs outbound mail
    // with its own DKIM for that address and rewrites or rejects a From it does
    // not own, and a From/envelope mismatch is one of the strongest spam
    // signals there is. `fromAddress` is forced to the SMTP user below.
    //
    // No List-Unsubscribe. RFC 8058 one-click requires an HTTPS endpoint, and
    // pairing the Post header with a bare mailto: — as this did briefly — is
    // malformed, which is worse than omitting both. More to the point, a ticket
    // someone paid for is not something to offer an unsubscribe from: honouring
    // it would mean withholding their pass.
    const headers: Record<string, string> = {
      'Auto-Submitted': 'auto-generated',
      'X-Auto-Response-Suppress': 'OOF, AutoReply',
    };
    if (args.bookingId) headers['X-Entity-Ref-ID'] = args.bookingId;

    // Never send as an address Gmail has not authenticated us for.
    const fromAddress = smtp.user || smtp.fromAddress;

    const info = (await getTransport().sendMail({
      from: `"${smtp.fromName}" <${fromAddress}>`,
      sender: fromAddress,
      to: args.to,
      bcc: smtp.bcc || undefined,
      replyTo: smtp.replyTo || undefined,
      subject: args.subject,
      html: args.html,
      text: args.text,
      attachments: args.attachments,
      headers,
    })) as { messageId?: string };

    await logEmail(args, 'sent', info.messageId ?? null, null);
    return { ok: true, messageId: info.messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown SMTP error';
    console.error('[mailer] send failed:', message);
    await logEmail(args, 'failed', null, message);
    return { ok: false, error: message };
  }
}

async function logEmail(
  args: SendArgs,
  status: 'sent' | 'failed',
  providerId: string | null,
  error: string | null,
): Promise<void> {
  try {
    await query(
      `INSERT INTO email_log (booking_id, recipient, subject, template, status, provider_id, error)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [args.bookingId ?? null, args.to, args.subject, args.template, status, providerId, error],
    );
  } catch (logError) {
    // Never let an audit-log write failure swallow a successful delivery.
    console.error('[mailer] email_log write failed:', logError);
  }
}

/**
 * Build and send the ticket email for a confirmed booking. Retries once on a
 * transient SMTP failure before giving up — Gmail occasionally closes a pooled
 * socket between messages.
 */
export async function sendTicketEmail(detail: BookingDetail): Promise<SendResult> {
  const { booking, event, tier, tickets, items } = detail;

  // A cart can mix pass types, so each QR has to name its own tier rather than
  // inherit the booking's headline one — otherwise a couple pass in a mixed
  // order is emailed labelled as a normal pass.
  const itemById = new Map(items.map((item) => [item.id, item]));

  const qrAttachments = await Promise.all(
    tickets.map(async (ticket, index) => ({
      filename: `${ticket.code}.png`,
      content: await qrPngBuffer(await buildQrPayload(ticket.code), 460),
      cid: `ticket-qr-${index}`,
      contentType: 'image/png',
    })),
  );

  // The mark leads, so it is the first inline part a client encounters.
  const attachments = [
    {
      filename: 'houz-of-vybe.png',
      content: brandMarkPng(),
      cid: BRAND_MARK_CID,
      contentType: 'image/png',
    },
    ...qrAttachments,
  ];

  const data: TicketEmailData = {
    customerName: booking.customer_name,
    bookingReference: booking.reference,
    eventName: event.name,
    eventTagline: event.tagline,
    venueName: event.venue_name,
    venueAddress: event.venue_address,
    startsAt: event.starts_at,
    doorsAt: event.doors_at,
    ageLimit: event.age_limit,
    tierName: tier?.name ?? 'General Entry',
    quantity: booking.quantity,
    amountPaise: booking.amount_paise,
    tickets: await Promise.all(
      tickets.map(async (ticket, index) => {
        const item = ticket.booking_item_id ? itemById.get(ticket.booking_item_id) : undefined;
        return {
          code: ticket.code,
          holderName: ticket.holder_name,
          cid: `ticket-qr-${index}`,
          url: await ticketUrl(ticket.code),
          admits: ticket.admits ?? item?.admits_each ?? 1,
          tierName: item?.tier_name ?? tier?.name ?? 'General Entry',
        };
      }),
    ),
    manageUrl: `${env.siteUrl}/booking/${booking.reference}`,
    supportEmail: env.smtp.replyTo || env.smtp.fromAddress,
    siteUrl: env.siteUrl,
  };

  const payload: SendArgs = {
    to: booking.customer_email,
    subject: ticketEmailSubject(data),
    html: ticketEmailHtml(data),
    text: ticketEmailText(data),
    attachments,
    bookingId: booking.id,
    template: 'ticket-confirmation',
  };

  const first = await sendMail(payload);
  if (first.ok) return first;

  // One retry on a fresh connection.
  globalThis.__hovTransport = undefined;
  return sendMail(payload);
}

export async function sendContactAck(name: string, to: string): Promise<SendResult> {
  return sendMail({
    to,
    subject: 'We got your message — Houz of Vybe',
    html: contactAckHtml(name, env.siteUrl),
    text: `Hey ${name.split(' ')[0]},\n\nWe got your message. Someone from the crew will get back to you within one working day.\n\nHouz of Vybe · Hyderabad`,
    template: 'contact-ack',
  });
}
