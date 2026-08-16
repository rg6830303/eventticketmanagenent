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
  ageLimit: number;
  tierName: string;
  quantity: number;
  amountPaise: number;
  tickets: Array<{ code: string; holderName: string; cid: string; url: string }>;
  manageUrl: string;
  supportEmail: string;
  siteUrl: string;
}

const BG = '#05070f';
const CARD = '#0b1226';
const LINE = '#1c2748';
const BLUE = '#1f6bff';
const TEXT = '#e9eefc';
const MUTED = '#93a1c6';

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
                <p style="margin:0 0 18px 0;font:700 18px/1.3 Arial,Helvetica,sans-serif;color:${TEXT};">
                  ${esc(ticket.holderName)}
                </p>
                <img src="cid:${ticket.cid}" width="220" height="220" alt="QR code for ticket ${esc(ticket.code)}"
                     style="display:block;margin:0 auto;border-radius:12px;background:#ffffff;padding:12px;" />
                <p style="margin:16px 0 0 0;font:700 15px/1.4 'Courier New',Courier,monospace;letter-spacing:2px;color:${TEXT};">
                  ${esc(ticket.code)}
                </p>
                <p style="margin:6px 0 0 0;font:400 12px/1.5 Arial,Helvetica,sans-serif;color:${MUTED};">
                  One scan only. Screenshot it — the venue has patchy signal.
                </p>
                <p style="margin:12px 0 0 0;">
                  <a href="${esc(ticket.url)}" style="font:600 12px/1 Arial,Helvetica,sans-serif;color:${BLUE};text-decoration:none;">
                    Open this pass in your browser &rarr;
                  </a>
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
          <p style="margin:0;font:800 26px/1 Arial,Helvetica,sans-serif;letter-spacing:-0.5px;color:${TEXT};">
            HOUZ <span style="color:${BLUE};">OF</span> VYBE
          </p>
          <p style="margin:6px 0 0 0;font:600 10px/1 Arial,Helvetica,sans-serif;letter-spacing:4px;text-transform:uppercase;color:${MUTED};">
            Hyderabad
          </p>
        </td></tr>

        <tr><td style="padding:0 0 20px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                 style="background:linear-gradient(135deg,#0d1a3d,#0a1226);border:1px solid ${LINE};border-radius:20px;">
            <tr><td style="padding:32px;">
              <p style="margin:0 0 8px 0;font:600 11px/1 Arial,Helvetica,sans-serif;letter-spacing:3px;text-transform:uppercase;color:${BLUE};">
                You're on the list
              </p>
              <h1 style="margin:0 0 6px 0;font:800 30px/1.15 Arial,Helvetica,sans-serif;color:${TEXT};">
                ${esc(data.eventName)}
              </h1>
              ${data.eventTagline ? `<p style="margin:0 0 18px 0;font:400 15px/1.5 Arial,Helvetica,sans-serif;color:${MUTED};">${esc(data.eventTagline)}</p>` : ''}
              <p style="margin:0;font:400 15px/1.7 Arial,Helvetica,sans-serif;color:${TEXT};">
                Hey ${esc(data.customerName.split(' ')[0])}, your booking is confirmed.
                ${data.quantity === 1 ? 'Your pass is' : `All ${data.quantity} passes are`} below.
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
              ${row('Age policy', `${data.ageLimit}+ · Government photo ID mandatory`)}
            </td></tr>
          </table>
        </td></tr>

        ${ticketBlocks}

        <tr><td style="padding:4px 0 20px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a1830;border:1px solid ${LINE};border-radius:16px;">
            <tr><td style="padding:22px 24px;">
              <p style="margin:0 0 10px 0;font:700 13px/1 Arial,Helvetica,sans-serif;letter-spacing:1px;text-transform:uppercase;color:${BLUE};">
                Before you come
              </p>
              <ul style="margin:0;padding:0 0 0 18px;font:400 14px/1.8 Arial,Helvetica,sans-serif;color:${MUTED};">
                <li>Carry a government photo ID matching the booking name. No ID, no entry.</li>
                <li>Each QR admits one person and works exactly once.</li>
                <li>Entry closes 90 minutes before the event ends.</li>
                <li>Management reserves the right of admission.</li>
              </ul>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:0 0 28px 0;text-align:center;">
          <a href="${esc(data.manageUrl)}"
             style="display:inline-block;background:${BLUE};color:#ffffff;text-decoration:none;padding:15px 34px;border-radius:999px;font:700 14px/1 Arial,Helvetica,sans-serif;">
            View all my tickets
          </a>
        </td></tr>

        <tr><td style="padding:22px 0 0 0;border-top:1px solid ${LINE};text-align:center;">
          <p style="margin:0 0 6px 0;font:400 12px/1.7 Arial,Helvetica,sans-serif;color:${MUTED};">
            Questions? Reply to this email or write to
            <a href="mailto:${esc(data.supportEmail)}" style="color:${BLUE};text-decoration:none;">${esc(data.supportEmail)}</a>
          </p>
          <p style="margin:0;font:400 11px/1.7 Arial,Helvetica,sans-serif;color:#5d6b93;">
            Houz of Vybe · Hyderabad, Telangana, India<br />
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
    `Age policy: ${data.ageLimit}+, government photo ID mandatory`,
    '',
    'YOUR PASSES',
    ...data.tickets.flatMap((t, i) => [
      `  ${i + 1}. ${t.holderName} — ${t.code}`,
      `     ${t.url}`,
    ]),
    '',
    'The QR codes are attached as images to this email. Show one at the door.',
    'Each QR admits one person and works exactly once.',
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
