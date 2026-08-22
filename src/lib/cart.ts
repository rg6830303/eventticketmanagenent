export interface CartItem {
  code: string;
  quantity: number;
}

const CART_KEY = 'hov-cart-v1';

function storageAvailable(): boolean {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

function readRaw(): CartItem[] {
  if (!storageAvailable()) return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CART_KEY) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const code = typeof (item as { code?: unknown }).code === 'string'
          ? (item as { code: string }).code.toUpperCase().trim()
          : '';
        const quantity = Number((item as { quantity?: unknown }).quantity);
        if (!code || !Number.isFinite(quantity) || quantity <= 0) return null;
        return { code, quantity: Math.floor(quantity) };
      })
      .filter((item): item is CartItem => Boolean(item));
  } catch {
    return [];
  }
}

function writeRaw(items: CartItem[]): void {
  if (!storageAvailable()) return;
  window.localStorage.setItem(CART_KEY, JSON.stringify(items));
}

export function loadCart(): CartItem[] {
  return readRaw();
}

export function saveCart(items: CartItem[]): void {
  writeRaw(items.filter((item) => item.quantity > 0));
}

export function addToCart(code: string, quantity = 1): CartItem[] {
  const normalized = code.toUpperCase().trim();
  if (!normalized || quantity <= 0) return loadCart();

  const items = readRaw();
  const index = items.findIndex((item) => item.code === normalized);
  if (index >= 0) {
    items[index] = { code: normalized, quantity: items[index].quantity + quantity };
  } else {
    items.push({ code: normalized, quantity });
  }
  writeRaw(items);
  return items;
}

export function setCartQuantity(code: string, quantity: number): CartItem[] {
  const normalized = code.toUpperCase().trim();
  const items = readRaw();
  const index = items.findIndex((item) => item.code === normalized);
  if (index === -1) return items;

  if (quantity <= 0) {
    items.splice(index, 1);
  } else {
    items[index] = { code: normalized, quantity: Math.floor(quantity) };
  }
  writeRaw(items);
  return items;
}

export function removeFromCart(code: string): CartItem[] {
  return setCartQuantity(code, 0);
}

export function clearCart(): void {
  if (!storageAvailable()) return;
  window.localStorage.removeItem(CART_KEY);
}
