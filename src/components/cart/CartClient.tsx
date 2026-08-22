'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { formatInr } from '@/lib/utils';
import { addToCart, clearCart, loadCart, removeFromCart, setCartQuantity, type CartItem } from '@/lib/cart';
import { REFERRAL } from '@/content/site';
import type { TierOption } from '@/components/booking/BookingForm';
import { cn } from '@/lib/utils';

interface CartClientProps {
  eventName: string;
  eventSlug: string;
  tiers: TierOption[];
  eventDate: string;
  doorsAt: string;
}

type ReferralStatus = 'empty' | 'checking' | 'valid' | 'invalid';

const EASE = [0.16, 1, 0.3, 1] as const;
const REFERRAL_KEY = 'hov-cart-referral-v1';

export function CartClient({ eventName, eventSlug, tiers, eventDate, doorsAt }: CartClientProps) {
  const reduce = useReducedMotion();
  const tierMap = useMemo(() => new Map(tiers.map((tier) => [tier.code, tier])), [tiers]);
  const [hydrated, setHydrated] = useState(false);
  const [items, setItems] = useState<CartItem[]>([]);
  const [referralInput, setReferralInput] = useState('');
  const [referralStatus, setReferralStatus] = useState<ReferralStatus>('empty');
  const [referralDiscount, setReferralDiscount] = useState(0);
  const [referralMessage, setReferralMessage] = useState<string | null>(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    setHydrated(true);
    setItems(loadCart());
    setReferralInput(window.localStorage.getItem(REFERRAL_KEY) ?? '');
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(REFERRAL_KEY, referralInput);
  }, [referralInput, hydrated]);

  useEffect(() => {
    function sync() {
      setItems(loadCart());
    }

    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const cartRows = items
    .map((item) => {
      const tier = tierMap.get(item.code);
      if (!tier) return null;
      return {
        ...item,
        tier,
        lineTotal: tier.pricePaise * item.quantity,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  const subtotal = cartRows.reduce((sum, row) => sum + row.lineTotal, 0);
  const totalTickets = cartRows.reduce((sum, row) => sum + row.quantity, 0);
  const discount = referralStatus === 'valid' ? Math.min(referralDiscount, subtotal) : 0;
  const total = Math.max(0, subtotal - discount);

  useEffect(() => {
    const raw = referralInput.trim();
    if (!raw) {
      requestSeq.current += 1;
      setReferralStatus('empty');
      setReferralDiscount(0);
      setReferralMessage(null);
      return;
    }

    const id = window.setTimeout(async () => {
      const seq = ++requestSeq.current;
      setReferralStatus('checking');
      setReferralMessage(null);

      try {
        const response = await fetch('/api/referrals/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: raw.toUpperCase(), amountPaise: subtotal }),
        });
        const body = (await response.json()) as {
          data?: { valid: boolean; discountPaise: number; reason?: string };
          error?: string;
        };
        if (seq !== requestSeq.current) return;

        if (body.data?.valid) {
          setReferralStatus('valid');
          setReferralDiscount(body.data.discountPaise);
          setReferralMessage(`₹${Math.round(body.data.discountPaise / 100)} off applied`);
        } else {
          setReferralStatus('invalid');
          setReferralDiscount(0);
          setReferralMessage(body.data?.reason ?? body.error ?? 'That code did not work.');
        }
      } catch {
        if (seq !== requestSeq.current) return;
        setReferralStatus('invalid');
        setReferralDiscount(0);
        setReferralMessage('Could not check that code right now.');
      }
    }, 350);

    return () => window.clearTimeout(id);
  }, [referralInput, subtotal]);

  function updateQuantity(code: string, quantity: number) {
    const next = setCartQuantity(code, quantity);
    setItems(next);
  }

  function addOne(code: string) {
    const next = addToCart(code, 1);
    setItems(next);
  }

  function removeOne(code: string, quantity: number) {
    const nextQuantity = quantity - 1;
    const next = nextQuantity > 0 ? setCartQuantity(code, nextQuantity) : removeFromCart(code);
    setItems(next);
  }

  function clearAll() {
    clearCart();
    setItems([]);
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14">
      <section className="min-w-0">
        <div className="panel p-6 sm:p-8">
          <p className="kicker">Your cart</p>
          <h1 className="h-section mt-3">Tickets selected for {eventName}</h1>
          <p className="lede mt-4 max-w-2xl">
            Add the mix you want, then check the running bill and apply a referral code before you
            move on.
          </p>
        </div>

        <div className="mt-6 space-y-4">
          {!hydrated ? (
            <div className="panel p-6 text-slate">Loading cart…</div>
          ) : cartRows.length === 0 ? (
            <div className="panel p-8">
              <p className="h-card">Your cart is empty</p>
              <p className="mt-2 text-[0.9375rem] text-slate">
                Add VVIP, VIP or GA tickets from the ticket section to start building your order.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href={`/events/${eventSlug}`} className="btn-primary">
                  Browse tickets
                </Link>
                <Link href="/book" className="btn-outline">
                  Open booking page
                </Link>
              </div>
            </div>
          ) : (
            cartRows.map(({ code, quantity, tier }) => {
              const lineTotal = tier.pricePaise * quantity;
              const scarce = tier.remaining > 0 && quantity > tier.remaining;

              return (
                <article key={code} className="panel overflow-hidden p-0">
                  <div className="border-b border-ink/15 bg-vybe-100 px-5 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-display text-[1.05rem] font-semibold text-ink">{tier.name}</p>
                      <p className="tnum font-display text-[1rem] font-semibold text-ink">
                        {formatInr(lineTotal)}
                      </p>
                    </div>
                    <p className="mt-1 text-[0.8125rem] text-slate">{tier.description}</p>
                  </div>

                  <div className="space-y-4 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-4 text-[0.9375rem]">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => removeOne(code, quantity)}
                          className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-ink text-ink transition-colors hover:bg-vybe-100"
                          aria-label={`Remove one ${tier.name} ticket`}
                        >
                          −
                        </button>
                        <span className="tnum min-w-8 text-center font-display text-xl font-semibold text-ink">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => addOne(code)}
                          className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-ink text-ink transition-colors hover:bg-vybe-100"
                          aria-label={`Add one more ${tier.name} ticket`}
                        >
                          +
                        </button>
                      </div>

                      <div className="text-right text-[0.8125rem] text-slate">
                        <div>Unit price: {formatInr(tier.pricePaise)}</div>
                        <div>Total: {formatInr(lineTotal)}</div>
                      </div>
                    </div>

                    {scarce && (
                      <p className="text-[0.8125rem] font-medium text-flare-600">
                        You have more in the cart than live stock right now. Please reduce this
                        before booking.
                      </p>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/15 pt-4">
                      <p className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-muted">
                        {code}
                      </p>
                      <button
                        type="button"
                        onClick={() => updateQuantity(code, 0)}
                        className="text-[0.8125rem] font-medium text-vybe-600 underline underline-offset-2"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      <aside className="lg:sticky lg:top-28 lg:self-start">
        <div className="card-print overflow-hidden">
          <div className="border-b-[1.5px] border-ink bg-vybe-100 px-6 py-4">
            <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-ink">
              Bill summary
            </p>
            <p className="mt-2 font-display text-[1.2rem] font-semibold text-ink">
              {eventName}
            </p>
            <p className="mt-1 text-[0.8125rem] text-slate">
              {eventDate} · {doorsAt}
            </p>
          </div>

          <div className="space-y-3.5 px-6 py-5 text-[0.875rem]">
            <Row label="Items" value={`${cartRows.length}`} />
            <Row label="Tickets" value={`${totalTickets}`} />
            <Row label="Bill amount" value={formatInr(subtotal)} />

            <div className="rule-receipt my-4" />

            <div className="space-y-2">
              <label htmlFor="cart-referral" className="label">
                Referral code
              </label>
              <input
                id="cart-referral"
                value={referralInput}
                onChange={(event) => setReferralInput(event.target.value.toUpperCase())}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className={cn(
                  'field font-mono uppercase tracking-[0.12em]',
                  referralStatus === 'valid' &&
                    'border-leaf-500 focus:border-leaf-500 focus:shadow-[2px_2px_0_0_theme(colors.leaf.500)]',
                  referralStatus === 'invalid' && 'field-error',
                )}
                placeholder={REFERRAL.sampleCode}
              />
              <p className="help">{REFERRAL.copy}</p>
              <AnimatePresence initial={false}>
                {referralMessage && (
                  <motion.p
                    key={referralMessage}
                    initial={reduce ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
                    transition={{ duration: reduce ? 0 : 0.2, ease: EASE }}
                    className={cn(
                      'text-[0.8125rem] font-medium',
                      referralStatus === 'valid' ? 'text-leaf-600' : 'text-flare-600',
                    )}
                  >
                    {referralMessage}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <div className="rule-receipt my-4" />

            <Row label="Referral discount" value={discount > 0 ? `− ${formatInr(discount)}` : '₹0'} />

            <div className="flex items-baseline justify-between gap-4">
              <span className="font-semibold text-ink">Total cart value</span>
              <span className="text-right">
                {discount > 0 && (
                  <span className="tnum mr-2 text-[0.8125rem] text-muted line-through">
                    {formatInr(subtotal)}
                  </span>
                )}
                <span className="tnum font-display text-2xl font-bold text-ink">
                  {formatInr(total)}
                </span>
              </span>
            </div>

            <p className="text-[0.75rem] leading-relaxed text-muted">
              Referral codes are flat ₹100 discounts. The cart total updates on the live subtotal
              you have selected.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={`/events/${eventSlug}`} className="btn-outline">
            Back to tickets
          </Link>
          <a
            href="https://ig.me/m/houzofvybe"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
          >
            Confirm via Instagram DM
          </a>
          <button type="button" onClick={clearAll} className="btn-outline">
            Clear cart
          </button>
        </div>

        <p className="mt-4 text-center text-[0.8125rem] leading-relaxed text-slate">
          Once your cart is ready, tap Confirm via Instagram DM and send the order details to
          <span className="font-medium text-ink"> @houzofvybe</span>.
        </p>
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-slate">{label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  );
}
