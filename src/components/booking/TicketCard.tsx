import { Globe } from '@/components/brand/Globe';
import { qrDataUrl } from '@/lib/qr';
import { buildQrPayload } from '@/lib/tickets';
import { cn, formatDateTime, formatEventDate, formatEventTime } from '@/lib/utils';
import type { EventRow, TicketRow, TicketStatus, TicketTierRow } from '@/lib/types';

interface TicketCardProps {
  ticket: TicketRow;
  event: EventRow;
  tier: TicketTierRow | null;
  /** 1-based position, shown as "Ticket 2 of 4" when `total` is also given. */
  index?: number;
  total?: number;
}

interface StatusStyle {
  label: string;
  stripe: string;
  pill: string;
  /** Printed under the QR once the pass can no longer be used. */
  stamp: string | null;
  live: boolean;
}

/**
 * Red is the logo colour and is used here strictly as a signal: a pass that is
 * spent or void gets the flare stripe, everything valid stays blue.
 */
const STATUS: Record<TicketStatus, StatusStyle> = {
  valid: {
    label: 'Valid',
    stripe: 'bg-gradient-to-b from-pulse-400 via-vybe-500 to-vybe-700',
    pill: 'border-vybe-400/45 bg-vybe-500/15 text-vybe-100',
    stamp: null,
    live: true,
  },
  used: {
    label: 'Checked in',
    stripe: 'bg-gradient-to-b from-flare-600/70 via-dim/50 to-hairline',
    pill: 'border-hairline bg-white/[0.04] text-dim',
    stamp: 'Checked in',
    live: false,
  },
  void: {
    label: 'Cancelled',
    stripe: 'bg-gradient-to-b from-flare-300 via-flare-500 to-flare-600',
    pill: 'border-flare-500/45 bg-flare-500/10 text-flare-300',
    stamp: 'Cancelled',
    live: false,
  },
  refunded: {
    label: 'Refunded',
    stripe: 'bg-gradient-to-b from-flare-300 via-flare-500 to-flare-600',
    pill: 'border-flare-500/45 bg-flare-500/10 text-flare-300',
    stamp: 'Refunded',
    live: false,
  },
};

export async function TicketCard({ ticket, event, tier, index, total }: TicketCardProps) {
  const qr = await qrDataUrl(buildQrPayload(ticket.code), 512);
  const style = STATUS[ticket.status];
  const spent = ticket.status !== 'valid';

  return (
    <article className="group print:break-inside-avoid">
      {/* Notch host: deliberately not clipped, so the punched holes can sit
          half outside the card edge. No tilt, no parent opacity — an ancestor
          transform or fade would land on the QR, and the QR has to stay a flat,
          full-contrast, unrotated target for the door scanner. */}
      <div className="relative">
        <div
          className={cn(
            'relative rounded-[24px] border bg-elevated/70 backdrop-blur-md',
            'shadow-[0_20px_60px_-30px_rgba(3,6,15,0.95)] transition-shadow duration-300',
            'print:border-black/25 print:bg-white print:shadow-none print:backdrop-blur-none',
            style.live
              ? 'border-hairline group-hover:shadow-glow-lg'
              : 'border-flare-600/25 print:border-black/25',
          )}
        >
          {/* Brand motif, low enough to read as watermark rather than art. */}
          <span
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-8 block h-40 w-40 overflow-hidden print:hidden"
          >
            <Globe
              className={cn(
                'h-full w-full',
                style.live ? 'text-vybe-400/[0.07]' : 'text-flare/[0.09]',
              )}
              strokeWidth={1.3}
            />
          </span>

          <span
            aria-hidden
            className={cn(
              'absolute inset-y-5 left-0 w-[5px] rounded-full print:hidden',
              style.stripe,
            )}
          />

          <header className="relative flex items-start justify-between gap-3 px-6 pt-5 sm:px-7">
            <div className="min-w-0">
              {typeof index === 'number' && typeof total === 'number' && (
                <p className="eyebrow print:text-black">
                  Ticket {index} of {total}
                </p>
              )}
              <h3 className="mt-1.5 truncate font-display text-lg font-bold text-chalk print:text-black">
                {event.name}
              </h3>
            </div>
            <span
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1',
                'text-[10px] font-semibold uppercase tracking-[0.16em] print:border-black/30 print:text-black',
                style.pill,
              )}
            >
              {style.live && (
                <span aria-hidden className="relative flex h-1.5 w-1.5">
                  <span className="absolute inset-0 rounded-full bg-pulse-400 animate-pulse-ring" />
                  <span className="relative h-1.5 w-1.5 rounded-full bg-pulse-400" />
                </span>
              )}
              {style.label}
            </span>
          </header>

          <div className="relative grid gap-x-6 gap-y-3 px-6 pb-5 pt-4 sm:grid-cols-2 sm:px-7">
            <Field label="Holder">
              <span className="text-[15px] font-semibold text-chalk print:text-black">
                {ticket.holder_name}
              </span>
            </Field>
            <Field label="Tier">
              <span className="text-[15px] font-semibold text-chalk print:text-black">
                {tier?.name ?? 'General entry'}
              </span>
            </Field>
            <Field label="Doors">
              <span className="text-[13px] text-haze print:text-black">
                {formatEventDate(event.starts_at)} ·{' '}
                {formatEventTime(event.doors_at ?? event.starts_at)}
              </span>
            </Field>
            <Field label={ticket.seat_label ? 'Seat / zone' : 'Venue'}>
              <span className="text-[13px] text-haze print:text-black">
                {ticket.seat_label ?? event.venue_name}
              </span>
            </Field>
          </div>

          {/* Tear line + perforation. The circles are painted in the page
              colour so they read as holes punched through the ticket. */}
          <div className="relative">
            <div className="mx-6 border-t border-dashed border-hairline/90 print:border-black/30 sm:mx-7" />
            <span
              aria-hidden
              className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border border-hairline bg-void print:hidden"
            />
            <span
              aria-hidden
              className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border border-hairline bg-void print:hidden"
            />
          </div>

          <div className="relative px-6 pb-6 pt-5 sm:px-7">
            <div className="mx-auto w-full max-w-[248px]">
              <div className="rounded-2xl bg-white p-3 shadow-[0_12px_34px_-18px_rgba(0,0,0,0.9)]">
                {/* Data URL rendered at request time — next/image would only add
                    an optimiser hop for bytes we already hold.
                    Nothing is layered over, rotated into or faded across this
                    image: a scanner needs the full quiet zone and full contrast,
                    including on a spent pass. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qr}
                  alt={`Entry QR code for ticket ${ticket.code}`}
                  width={512}
                  height={512}
                  className="block h-auto w-full"
                />
              </div>

              {style.stamp && (
                <p
                  className={cn(
                    'mt-3 flex items-center justify-center gap-2 rounded-lg border px-3 py-1.5',
                    'text-center font-display text-[11px] font-extrabold uppercase tracking-[0.18em]',
                    'border-flare-500/50 bg-flare-500/10 text-flare-300',
                    'print:border-black/40 print:bg-transparent print:text-black',
                  )}
                >
                  {style.stamp}
                </p>
              )}

              <p className="mt-3 text-center font-mono text-[13px] font-medium tracking-[0.14em] text-chalk print:text-black">
                {ticket.code}
              </p>

              {ticket.status === 'used' && ticket.checked_in_at ? (
                <p className="mt-1.5 text-center text-[12px] leading-relaxed text-dim print:text-black">
                  Checked in {formatDateTime(ticket.checked_in_at)}
                  {ticket.checked_in_gate ? ` · ${ticket.checked_in_gate}` : ''}
                </p>
              ) : (
                <p className="mt-1.5 text-center text-[12px] leading-relaxed text-dim print:text-black">
                  {spent
                    ? 'This pass is no longer valid for entry.'
                    : 'Hold this up at the door — one scan, one entry.'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-dim print:text-black/60">
        {label}
      </p>
      <p className="mt-0.5 truncate">{children}</p>
    </div>
  );
}

export default TicketCard;
