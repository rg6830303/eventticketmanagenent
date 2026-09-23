export interface CartItem {
  code: string;
  quantity: number;
}

interface CartState {
  /** Which event these codes belong to. */
  eventSlug: string;
  items: CartItem[];
}

/*
 * v2 because the shape changed.
 *
 * A cart used to be a bare list of tier codes, which was unambiguous while
 * there was one event: NORMAL could only ever mean one thing. With a second
 * event on sale it is ambiguous and dangerous — tier codes are unique per
 * event, not globally, so a cart filled on one date and carried to another
 * would either silently drop its lines or, worse, price them against the wrong
 * event's tiers.
 *
 * So the cart now knows whose it is, and loading it for a different event
 * yields an empty one. Reading under a new key rather than migrating means a
 * customer mid-purchase when this ships gets an empty cart rather than a
 * mispriced one, which is the right way round to fail.
 */
const CART_KEY = 'hov-cart-v2';

function storageAvailable(): boolean {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

function readState(): CartState | null {
  if (!storageAvailable()) return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CART_KEY) ?? 'null') as unknown;
    if (!parsed || typeof parsed !== 'object') return null;

    const slug = (parsed as { eventSlug?: unknown }).eventSlug;
    const rawItems = (parsed as { items?: unknown }).items;
    if (typeof slug !== 'string' || !Array.isArray(rawItems)) return null;

    const items = rawItems
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const code =
          typeof (item as { code?: unknown }).code === 'string'
            ? (item as { code: string }).code.toUpperCase().trim()
            : '';
        const quantity = Number((item as { quantity?: unknown }).quantity);
        if (!code || !Number.isFinite(quantity) || quantity <= 0) return null;
        return { code, quantity: Math.floor(quantity) };
      })
      .filter((item): item is CartItem => Boolean(item));

    return { eventSlug: slug, items };
  } catch {
    return null;
  }
}

function writeState(state: CartState): void {
  if (!storageAvailable()) return;
  window.localStorage.setItem(
    CART_KEY,
    JSON.stringify({ ...state, items: state.items.filter((item) => item.quantity > 0) }),
  );
}

/** The cart for this event. A cart held for another event reads as empty. */
export function loadCart(eventSlug: string): CartItem[] {
  const state = readState();
  if (!state || state.eventSlug !== eventSlug) return [];
  return state.items;
}

/** Which event the stored cart belongs to, if any. */
export function cartEventSlug(): string | null {
  return readState()?.eventSlug ?? null;
}

function mutate(eventSlug: string, change: (items: CartItem[]) => CartItem[]): CartItem[] {
  const state = readState();
  // Switching events replaces the cart rather than merging into it: the codes
  // in it do not exist on the new event and would be dropped at checkout.
  const base = state && state.eventSlug === eventSlug ? state.items : [];
  const items = change([...base]);
  writeState({ eventSlug, items });
  return items;
}

export function saveCart(eventSlug: string, items: CartItem[]): void {
  writeState({ eventSlug, items });
}

export function addToCart(eventSlug: string, code: string, quantity = 1): CartItem[] {
  const normalized = code.toUpperCase().trim();
  if (!normalized || quantity <= 0) return loadCart(eventSlug);

  return mutate(eventSlug, (items) => {
    const index = items.findIndex((item) => item.code === normalized);
    if (index >= 0) {
      items[index] = { code: normalized, quantity: items[index].quantity + quantity };
    } else {
      items.push({ code: normalized, quantity });
    }
    return items;
  });
}

export function setCartQuantity(eventSlug: string, code: string, quantity: number): CartItem[] {
  const normalized = code.toUpperCase().trim();

  return mutate(eventSlug, (items) => {
    const index = items.findIndex((item) => item.code === normalized);
    if (index === -1) return items;

    if (quantity <= 0) {
      items.splice(index, 1);
    } else {
      items[index] = { code: normalized, quantity: Math.floor(quantity) };
    }
    return items;
  });
}

export function removeFromCart(eventSlug: string, code: string): CartItem[] {
  return setCartQuantity(eventSlug, code, 0);
}

export function clearCart(): void {
  if (!storageAvailable()) return;
  window.localStorage.removeItem(CART_KEY);
}
