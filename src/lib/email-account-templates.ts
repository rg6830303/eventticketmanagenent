import { BRAND_MARK_CID } from './email-templates';

/*
 * Account and marketing mail.
 *
 * One shell for everything that is not a ticket. None of it carries a QR, a
 * pass code or anything that could be mistaken for entry: the only email that
 * ever gets somebody through the door is the ticket email, and that is only
 * sent for a paid booking.
 *
 * Same palette as the ticket email — light card, dark text — because that is
 * the combination that survives every client's dark-mode rewriting.
 */

const BG = '#f2f7fd';
const CARD = '#ffffff';
const LINE = '#cbdcef';
const BLUE = '#2586ef';
const TEXT = '#0a2138';
const MUTED = '#3c5c7d';

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface ShellInput {
  preheader: string;
  eyebrow: string;
  heading: string;
  /** Trusted HTML — every interpolated value must already be escaped. */
  paragraphs: string[];
  cta?: { label: string; url: string };
  highlight?: string;
  footnote?: string;
  imageUrl?: string;
}

function shellHtml(input: ShellInput): string {
  const body = input.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 14px 0;font:400 15px/1.6 Arial,Helvetica,sans-serif;color:${MUTED};">${p}</p>`,
    )
    .join('');

  const image = input.imageUrl
    ? `<tr><td><img src="${esc(input.imageUrl)}" width="600" alt="" style="display:block;width:100%;height:auto;border:0;" /></td></tr>`
    : '';

  const highlight = input.highlight
    ? `<p style="margin:6px 0 18px 0;padding:14px 16px;background:${BG};border-radius:12px;font:700 15px/1.5 Arial,Helvetica,sans-serif;color:${TEXT};">${input.highlight}</p>`
    : '';

  const cta = input.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 6px 0;"><tr>
         <td style="background:${BLUE};border-radius:12px;">
           <a href="${esc(input.cta.url)}" style="display:inline-block;padding:15px 26px;font:700 15px/1 Arial,Helvetica,sans-serif;color:#ffffff;text-decoration:none;">${esc(input.cta.label)}</a>
         </td></tr></table>
       <p style="margin:12px 0 0 0;font:400 12px/1.5 Arial,Helvetica,sans-serif;color:${MUTED};">
         Button not working? Paste this into your browser:<br>
         <span style="word-break:break-all;color:${BLUE};">${esc(input.cta.url)}</span>
       </p>`
    : '';

  const footnote = input.footnote
    ? `<tr><td style="padding:20px 8px 0 8px;text-align:center;font:400 12px/1.6 Arial,Helvetica,sans-serif;color:${MUTED};">${input.footnote}</td></tr>`
    : '';

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><title>${esc(input.heading)}</title></head>
<body style="margin:0;padding:0;background:${BG};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(input.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;">
        <tr><td style="padding:0 0 24px 0;text-align:center;">
          <img src="cid:${BRAND_MARK_CID}" width="56" height="56" alt="Houz of Vybe"
               style="display:block;margin:0 auto 12px auto;border:0;border-radius:14px;" />
          <p style="margin:0;font:800 26px/1 Arial,Helvetica,sans-serif;letter-spacing:-0.5px;color:${TEXT};">
            HOUZ <span style="color:${BLUE};">OF</span> VYBE
          </p>
        </td></tr>
        <tr><td>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                 style="background:${CARD};border:1px solid ${LINE};border-radius:16px;overflow:hidden;">
            ${image}
            <tr><td style="padding:32px;">
              <p style="margin:0 0 8px 0;font:700 11px/1.4 Arial,Helvetica,sans-serif;letter-spacing:2px;text-transform:uppercase;color:${BLUE};">${esc(input.eyebrow)}</p>
              <h1 style="margin:0 0 18px 0;font:800 26px/1.2 Arial,Helvetica,sans-serif;color:${TEXT};">${esc(input.heading)}</h1>
              ${body}
              ${highlight}
              ${cta}
            </td></tr>
          </table>
        </td></tr>
        ${footnote}
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function shellText(input: ShellInput): string {
  const strip = (s: string) =>
    s.replace(/<[^>]+>/g, '').replace(/&middot;/g, '·').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
  const lines = ['HOUZ OF VYBE', '', strip(input.heading), '', ...input.paragraphs.map(strip)];
  if (input.highlight) lines.push('', strip(input.highlight));
  if (input.cta) lines.push('', `${input.cta.label}: ${input.cta.url}`);
  if (input.footnote) lines.push('', strip(input.footnote));
  return lines.join('\n');
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function resetEmail(data: { name: string; resetUrl: string; minutes: number }): RenderedEmail {
  const first = esc(data.name.split(' ')[0] || 'there');
  const input: ShellInput = {
    preheader: `Reset your Houz of Vybe password. The link works for ${data.minutes} minutes.`,
    eyebrow: 'Password reset',
    heading: 'Reset your password',
    paragraphs: [
      `Hey ${first}, someone asked to reset the password on your Houz of Vybe account.`,
      `If that was you, use the button below. The link works once, for the next ${data.minutes} minutes.`,
    ],
    cta: { label: 'Choose a new password', url: data.resetUrl },
    footnote:
      'Did not ask for this? Ignore this email — your password stays as it is, and the link is useless to anyone without access to your inbox.',
  };
  return { subject: 'Reset your Houz of Vybe password', html: shellHtml(input), text: shellText(input) };
}

export function welcomeEmail(data: { name: string; siteUrl: string }): RenderedEmail {
  const first = esc(data.name.split(' ')[0] || 'there');
  const input: ShellInput = {
    preheader: 'Your Houz of Vybe account is ready.',
    eyebrow: 'Welcome',
    heading: `You are in, ${first}`,
    paragraphs: [
      'Your Houz of Vybe account is set up. Sign in with this email to book passes, and every ticket you buy will sit in your account as well as your inbox.',
    ],
    cta: { label: 'See what is coming up', url: data.siteUrl },
  };
  return { subject: 'Welcome to Houz of Vybe', html: shellHtml(input), text: shellText(input) };
}

export interface NudgeEmailData {
  name: string;
  eventName: string;
  eventDate: string;
  payUrl: string;
  passSummary: string;
  amount: string;
  posterUrl?: string;
}

/**
 * The "you did not finish" email.
 *
 * Sent once, to a booking that was started and never paid. It deliberately
 * contains no QR and no pass code, and says in plain words that it is not a
 * ticket: an unpaid booking must never produce anything that looks like entry.
 * What it offers is the way back to the payment page they left.
 */
export function checkoutNudgeEmail(data: NudgeEmailData): RenderedEmail {
  const first = esc(data.name.split(' ')[0] || 'there');
  const input: ShellInput = {
    preheader: `Your ${data.eventName} passes are still waiting — the payment was not completed.`,
    eyebrow: 'Almost there',
    heading: `${first}, you left before the first beat`,
    paragraphs: [
      `You picked your passes for <strong style="color:${TEXT};">${esc(data.eventName)}</strong>, but the payment did not go through — so nothing has been charged and <strong style="color:${TEXT};">no ticket has been issued</strong>.`,
      'The dhol, the lights, the whole floor spinning in colour — it is one night, and it is filling up. Finishing takes under a minute, and your QR passes land in this inbox the moment the payment clears.',
    ],
    highlight: `${esc(data.passSummary)} &middot; ${esc(data.amount)} &middot; ${esc(data.eventDate)}`,
    cta: { label: 'Complete my booking', url: data.payUrl },
    imageUrl: data.posterUrl,
    footnote:
      'This email is not a ticket and will not get you in. QR passes are sent only after payment is complete. Already paid? Your tickets are on the way — check spam, or message @houzofvybe on Instagram.',
  };
  return {
    subject: `You did not finish booking ${data.eventName} — your passes are waiting`,
    html: shellHtml(input),
    text: shellText(input),
  };
}
