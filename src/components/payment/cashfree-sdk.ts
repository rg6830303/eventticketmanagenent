'use client';

/**
 * Browser-side Cashfree SDK loader.
 *
 * Shared by the cart checkout and the standalone pay page so there is exactly
 * one <script> tag and one cached promise per page, however many buttons are
 * mounted. A second tag for the same src re-registers the global and which
 * version wins is not deterministic.
 */

export type CashfreeMode = 'production' | 'sandbox';

export interface CashfreeInstance {
  checkout: (options: {
    paymentSessionId: string;
    redirectTarget?: '_self' | '_blank' | '_top';
  }) => Promise<{ error?: { message?: string } } | void>;
}

declare global {
  interface Window {
    Cashfree?: (options: { mode: CashfreeMode }) => CashfreeInstance;
  }
}

const SDK_SRC = 'https://sdk.cashfree.com/js/v3/cashfree.js';

let sdkPromise: Promise<void> | null = null;

export function loadCashfreeSdk(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.Cashfree) return Promise.resolve();
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_SRC}"]`);
    const script = existing ?? document.createElement('script');
    script.src = SDK_SRC;
    script.async = true;
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => {
      // Let a later attempt try again rather than caching the failure forever —
      // this fails on flaky mobile data far more often than for any real reason.
      sdkPromise = null;
      reject(new Error('Could not load the payment window'));
    });
    if (!existing) document.body.appendChild(script);
  });

  return sdkPromise;
}

/**
 * Hand the browser over to Cashfree's hosted checkout.
 *
 * A full-page redirect rather than an in-page modal: on Indian mobile that is
 * the difference between a UPI intent that opens the customer's payment app and
 * one that dies inside an iframe. A successful call never returns — anything it
 * does return is a refusal worth showing.
 */
export async function openCashfreeCheckout(
  paymentSessionId: string,
  mode: CashfreeMode = 'production',
): Promise<{ ok: true } | { ok: false; message: string }> {
  await loadCashfreeSdk();

  const Cashfree = window.Cashfree;
  if (!Cashfree) return { ok: false, message: 'The payment window is unavailable right now.' };

  const result = await Cashfree({ mode }).checkout({ paymentSessionId, redirectTarget: '_self' });

  if (result && typeof result === 'object' && 'error' in result && result.error) {
    return { ok: false, message: result.error.message ?? 'The payment window could not be opened.' };
  }

  return { ok: true };
}
