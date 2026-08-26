import { formatEventDate, formatEventTime, formatInr } from './utils';

/**
 * Email markup.
 *
 * Table-based layout with fully inline styles — Outlook and most Android mail
 * clients strip <style> blocks and ignore flex/grid. The QR is referenced as
 * cid:ticket-qr-N so it renders without the "download images" prompt that would
 * otherwise leave the attendee at the door with a blank rectangle.
 */

export interface TicketEmailData {
  customerName: string;
  bookingReference: string;
  eventName: string;
  eventTagline: string | null;
  venueName: string;
  venueAddress: string | null;
  startsAt: string;
  doorsAt: string | null;
  /**
   * Kept on the payload though the ticket email no longer prints an age line —
   * the door still enforces it, and an event that reinstates the notice should
   * not need the mailer changed to get the number back.
   */
  ageLimit: number;
  tierName: string;
  quantity: number;
  amountPaise: number;
  tickets: Array<{
    code: string;
    holderName: string;
    cid: string;
    url: string;
    /** Heads this one QR lets through. A couple pass is 2, a VIP table is 5. */
    admits: number;
    tierName: string;
  }>;
  manageUrl: string;
  supportEmail: string;
  siteUrl: string;
}

/**
 * Email palette, matching the site.
 *
 * Light on purpose: a dark email is a coin flip in Outlook and in Gmail's own
 * dark-mode transform, both of which will happily re-tint a dark background and
 * leave the text on top of it unreadable. Dark text on a light card survives
 * every client's dark-mode meddling.
 */
const BG = '#f2f7fd';
const CARD = '#ffffff';
const LINE = '#cbdcef';
const BLUE = '#2586ef';
const TEXT = '#0a2138';
const MUTED = '#3c5c7d';

/** Content-ID for the brand mark attachment. Shared with the mailer. */
export const BRAND_MARK_CID = 'hov-brand-mark';

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function ticketEmailSubject(data: TicketEmailData): string {
  const noun = data.quantity === 1 ? 'ticket is' : `${data.quantity} tickets are`;
  return `Your ${noun} confirmed — ${data.eventName} (${data.bookingReference})`;
}

export function ticketEmailHtml(data: TicketEmailData): string {
  const doors = data.doorsAt ? formatEventTime(data.doorsAt) : formatEventTime(data.startsAt);

  const ticketBlocks = data.tickets
    .map(
      (ticket, index) => `
      <tr>
        <td style="padding:0 0 16px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CARD};border:1px solid ${LINE};border-radius:16px;">
            <tr>
              <td style="padding:24px;text-align:center;">
                <p style="margin:0 0 4px 0;font:600 11px/1.4 Arial,Helvetica,sans-serif;letter-spacing:2px;text-transform:uppercase;color:${BLUE};">
                  Entry pass ${index + 1} of ${data.tickets.length}
                </p>
                <p style="margin:0 0 4px 0;font:700 18px/1.3 Arial,Helvetica,sans-serif;color:${TEXT};">
                  ${esc(ticket.holderName)}
                </p>
                <p style="margin:0 0 18px 0;font:600 13px/1.4 Arial,Helvetica,sans-serif;color:${BLUE};">
                  ${esc(ticket.tierName)}${ticket.admits > 1 ? ` &middot; admits ${ticket.admits}` : ''}
                </p>
                <img src="cid:${ticket.cid}" width="220" height="220" alt="QR code for ticket ${esc(ticket.code)}"
                     style="display:block;margin:0 auto;border-radius:12px;background:#ffffff;padding:12px;" />

                <!-- The code is spelled out because a mail app with images off
                     shows nothing above this line, and the door can type it. -->
                <p style="margin:16px 0 0 0;font:700 15px/1.4 'Courier New',Courier,monospace;letter-spacing:2px;color:${TEXT};">
                  ${esc(ticket.code)}
                </p>
                <p style="margin:6px 0 0 0;font:400 12px/1.5 Arial,Helvetica,sans-serif;color:${MUTED};">
                  ${
                    ticket.admits > 1
                      ? `One scan only, and it admits all ${ticket.admits} of you together.`
                      : 'One scan only.'
                  } Screenshot it — the venue has patchy signal.
                </p>

                <p style="margin:16px 0 0 0;">
                  <a href="${esc(ticket.url)}"
                     style="display:inline-block;border:1px solid ${BLUE};border-radius:8px;padding:11px 22px;font:700 13px/1 Arial,Helvetica,sans-serif;color:${BLUE};text-decoration:none;">
                    Open this pass
                  </a>
                </p>
                <p style="margin:10px 0 0 0;font:400 12px/1.6 Arial,Helvetica,sans-serif;color:${MUTED};">
                  No QR above? Some mail apps hide images. Tap <strong style="color:${TEXT};">Open this pass</strong>
                  for a full-screen version, or just read the code out at the door.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`,
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="dark light" />
<title>${esc(ticketEmailSubject(data))}</title>
</head>
<body style="margin:0;padding:0;background:${BG};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${esc(data.bookingReference)} · ${esc(data.eventName)} · ${esc(formatEventDate(data.startsAt))} · Show the QR at the door.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;">

        <tr><td style="padding:0 0 28px 0;text-align:center;">
          <!-- The mark is a cid: attachment, so it renders without the
               "display images" prompt. The wordmark below stays live text on
               purpose: if a client blocks the image anyway, the email still
               says who it is from, which is most of what a logo is for. -->
          <img src="cid:${BRAND_MARK_CID}" width="56" height="56" alt="Houz of Vybe"
               style="display:block;margin:0 auto 12px auto;border:0;outline:none;text-decoration:none;border-radius:14px;" />
          <p style="margin:0;font:800 26px/1 Arial,Helvetica,sans-serif;letter-spacing:-0.5px;color:${TEXT};">
            HOUZ <span style="color:${BLUE};">OF</span> VYBE
          </p>
          <p style="margin:6px 0 0 0;font:600 10px/1 Arial,Helvetica,sans-serif;letter-spacing:4px;text-transform:uppercase;color:${MUTED};">
            Hyderabad
          </p>
        </td></tr>

        <tr><td style="padding:0 0 20px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                 style="background:${CARD};border:1px solid ${LINE};border-radius:16px;">
            <tr><td style="padding:32px;">
              <p style="margin:0 0 8px 0;font:600 11px/1 Arial,Helvetica,sans-serif;letter-spacing:3px;text-transform:uppercase;color:${BLUE};">
                You're on the list
              </p>
              <h1 style="margin:0 0 6px 0;font:800 30px/1.15 Arial,Helvetica,sans-serif;color:${TEXT};">
                ${esc(data.eventName)}
              </h1>
              ${data.eventTagline ? `<p style="margin:0 0 18px 0;font:400 15px/1.5 Arial,Helvetica,sans-serif;color:${MUTED};">${esc(data.eventTagline)}</p>` : ''}
              <p style="margin:0 0 14px 0;font:400 15px/1.7 Arial,Helvetica,sans-serif;color:${TEXT};">
                Hi ${esc(data.customerName.split(' ')[0])}, thank you for booking with us — your
                payment has gone through and your ${data.quantity === 1 ? 'pass is' : `${data.quantity} passes are`}
                confirmed and attached below.
              </p>
              <p style="margin:0;font:400 15px/1.7 Arial,Helvetica,sans-serif;color:${MUTED};">
                Save this email. Screenshot the QR before you leave home — it scans perfectly
                offline, and signal at the venue is not something we can promise.
              </p>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:0 0 20px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CARD};border:1px solid ${LINE};border-radius:16px;">
            <tr><td style="padding:24px;">
              ${row('Booking reference', data.bookingReference, true)}
              ${row('Date', formatEventDate(data.startsAt))}
              ${row('Doors open', doors)}
              ${row('Venue', data.venueName)}
              ${data.venueAddress ? row('Address', data.venueAddress) : ''}
              ${row('Ticket type', data.tierName)}
              ${row('Quantity', String(data.quantity))}
              ${row('Amount paid', data.amountPaise === 0 ? 'Complimentary entry' : formatInr(data.amountPaise))}
            </td></tr>
          </table>
        </td></tr>

        ${ticketBlocks}

        <tr><td style="padding:4px 0 20px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e9f1fb;border:1px solid ${LINE};border-radius:16px;">
            <tr><td style="padding:22px 24px;">
              <p style="margin:0 0 10px 0;font:700 13px/1 Arial,Helvetica,sans-serif;letter-spacing:1px;text-transform:uppercase;color:${BLUE};">
                Before you come
              </p>
              <ul style="margin:0;padding:0 0 0 18px;font:400 14px/1.8 Arial,Helvetica,sans-serif;color:${MUTED};">
                <li>${
                  data.tickets.some((t) => t.admits > 1)
                    ? 'Each QR works exactly once and admits the number of people printed on it.'
                    : 'Each QR admits one person and works exactly once.'
                }</li>
                <li>Entry closes 90 minutes before the event ends.</li>
                <li>Management reserves the right of admission.</li>
              </ul>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:0 0 28px 0;text-align:center;">
          <!-- A bordered rectangle rather than a filled pill: the pill is the
               shape every promotional email uses, and this is a receipt. -->
          <a href="${esc(data.manageUrl)}"
             style="display:inline-block;border:1px solid ${BLUE};color:${BLUE};text-decoration:none;padding:13px 28px;border-radius:8px;font:700 13px/1 Arial,Helvetica,sans-serif;">
            View this booking online
          </a>
        </td></tr>

        <tr><td style="padding:0 0 26px 0;text-align:center;">
          <p style="margin:0;font:400 14px/1.7 Arial,Helvetica,sans-serif;color:${TEXT};">
            See you on the floor.<br />
            <span style="font-weight:700;">The Houz of Vybe crew</span>
          </p>
        </td></tr>

        <tr><td style="padding:22px 0 0 0;border-top:1px solid ${LINE};text-align:center;">
          <p style="margin:0 0 6px 0;font:400 12px/1.7 Arial,Helvetica,sans-serif;color:${MUTED};">
            Questions? Reply to this email or write to
            <a href="mailto:${esc(data.supportEmail)}" style="color:${BLUE};text-decoration:none;">${esc(data.supportEmail)}</a>
          </p>
          <p style="margin:0;font:400 11px/1.7 Arial,Helvetica,sans-serif;color:#5d6b93;">
            Houz of Vybe · Kingdome Klub &amp; Kitchen, 251/8, E/1, Kingdome Klub Rd,<br />
            Financial District, Hyderabad, Telangana 500075, India<br />
            You received this because you booked tickets at
            <a href="${esc(data.siteUrl)}" style="color:#5d6b93;">${esc(data.siteUrl.replace(/^https?:\/\//, ''))}</a>.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function row(label: string, value: string, highlight = false): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px 0;">
    <tr>
      <td width="42%" style="font:400 13px/1.5 Arial,Helvetica,sans-serif;color:${MUTED};vertical-align:top;">${esc(label)}</td>
      <td style="font:${highlight ? '700' : '600'} 14px/1.5 ${highlight ? "'Courier New',Courier,monospace" : 'Arial,Helvetica,sans-serif'};color:${highlight ? BLUE : TEXT};text-align:right;">${esc(value)}</td>
    </tr>
  </table>`;
}

export function ticketEmailText(data: TicketEmailData): string {
  const lines = [
    'HOUZ OF VYBE — HYDERABAD',
    '',
    `Hey ${data.customerName.split(' ')[0]}, your booking is confirmed.`,
    '',
    `Event:      ${data.eventName}`,
    `Date:       ${formatEventDate(data.startsAt)}`,
    `Doors:      ${formatEventTime(data.doorsAt ?? data.startsAt)}`,
    `Venue:      ${data.venueName}${data.venueAddress ? `, ${data.venueAddress}` : ''}`,
    `Ticket:     ${data.tierName} x${data.quantity}`,
    `Amount:     ${data.amountPaise === 0 ? 'Complimentary entry' : formatInr(data.amountPaise)}`,
    `Reference:  ${data.bookingReference}`,
    '',
    'YOUR PASSES',
    ...data.tickets.flatMap((t, i) => [
      `  ${i + 1}. ${t.holderName} — ${t.code}` +
        `${t.admits > 1 ? ` (${t.tierName}, admits ${t.admits})` : ` (${t.tierName})`}`,
      `     ${t.url}`,
    ]),
    '',
    'The QR codes are attached as images to this email. Show one at the door.',
    data.tickets.some((t) => t.admits > 1)
      ? 'Each QR works exactly once and admits the number of people shown beside it.'
      : 'Each QR admits one person and works exactly once.',
    '',
    `All tickets: ${data.manageUrl}`,
    `Support:     ${data.supportEmail}`,
    '',
    'Houz of Vybe · Hyderabad, Telangana, India',
  ];
  return lines.join('\n');
}

/** Plain notice used for the contact-form auto-reply. */
export function contactAckHtml(name: string, siteUrl: string): string {
  return `<!doctype html><html><body style="margin:0;background:${BG};padding:32px 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="width:100%;max-width:520px;background:${CARD};border:1px solid ${LINE};border-radius:18px;">
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px 0;font:800 20px/1 Arial,Helvetica,sans-serif;color:${TEXT};">HOUZ <span style="color:${BLUE};">OF</span> VYBE</p>
          <p style="margin:0 0 12px 0;font:400 15px/1.7 Arial,Helvetica,sans-serif;color:${TEXT};">Hey ${esc(name.split(' ')[0])},</p>
          <p style="margin:0 0 12px 0;font:400 15px/1.7 Arial,Helvetica,sans-serif;color:${MUTED};">
            We got your message. Someone from the crew will get back to you within one working day.
          </p>
          <p style="margin:0;font:400 13px/1.7 Arial,Helvetica,sans-serif;color:#5d6b93;">
            <a href="${esc(siteUrl)}" style="color:${BLUE};text-decoration:none;">${esc(siteUrl.replace(/^https?:\/\//, ''))}</a>
          </p>
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;
}
