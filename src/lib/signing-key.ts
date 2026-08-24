/**
 * Signing keys, derived rather than demanded.
 *
 * This app needs two independent HMAC keys: one to sign the admin session
 * cookie, one to sign QR passes. Historically both had to be supplied as their
 * own environment variables, which meant a deployment could be fully wired to
 * Supabase — database connected, integration installed — and still refuse to
 * let anyone sign in because two more variables had not been pasted in.
 *
 * So when they are absent, both keys are derived from key material the Supabase
 * integration already provides. Deriving rather than reusing matters: feeding
 * SUPABASE_JWT_SECRET straight into our own JWTs would sign two different
 * token formats with one key, and cross-protocol confusion between them is
 * exactly the class of bug that is invisible until somebody goes looking. HKDF
 * with a distinct `info` string per purpose yields keys that are
 * cryptographically independent of each other and of Supabase's own use.
 *
 * An explicitly configured secret always wins and is used verbatim, so a
 * deployment that already set one keeps every pass it has ever issued valid.
 *
 * No `server-only` import and no `node:` imports: the middleware runs on the
 * Edge runtime and has to derive the identical session key. Web Crypto is the
 * one HKDF implementation available on both sides.
 */

/** Domain separation. Changing this invalidates every derived key. */
export const KDF_SALT = 'houz-of-vybe/kdf/v1';

export const ADMIN_SESSION_INFO = 'admin-session-jwt';
export const TICKET_SIGNING_INFO = 'ticket-qr-hmac';

/**
 * Fallback key material, most stable first.
 *
 * SUPABASE_JWT_SECRET leads because it is a high-entropy secret that the
 * Supabase integration sets on every project and that nothing else here reads.
 * POSTGRES_PASSWORD is last because it is the value most likely to be rotated
 * for unrelated reasons.
 */
export const KEY_MATERIAL_SOURCES = [
  'SUPABASE_JWT_SECRET',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SECRET_KEY',
  'POSTGRES_PASSWORD',
] as const;

export interface KeyMaterial {
  /** Which environment variable it came from. Reported by /api/health. */
  source: string;
  value: string;
  /** True when a purpose-built secret was configured rather than derived. */
  explicit: boolean;
}

/**
 * Find usable key material for a purpose.
 *
 * `explicitName` is the variable built for the job. When it is present it is
 * returned as-is and used verbatim — deriving from it instead would silently
 * invalidate every ticket already in a customer's inbox.
 */
export function resolveKeyMaterial(explicitName: string): KeyMaterial | null {
  const explicit = process.env[explicitName]?.trim();
  if (explicit) return { source: explicitName, value: explicit, explicit: true };

  for (const name of KEY_MATERIAL_SOURCES) {
    const value = process.env[name]?.trim();
    // Short material would make a weak key however it is stretched; HKDF
    // spreads entropy, it does not create it.
    if (value && value.length >= 24) return { source: name, value, explicit: false };
  }

  return null;
}

const encoder = new TextEncoder();

/**
 * HKDF-SHA256 to 32 bytes, using Web Crypto so this works unchanged on the
 * Edge runtime. Deterministic: the same material and `info` always yield the
 * same key, which is what lets the middleware and the API agree without
 * sharing anything but the environment.
 */
async function hkdf(material: string, info: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(material), 'HKDF', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: encoder.encode(KDF_SALT),
      info: encoder.encode(info),
    },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export class MissingKeyMaterialError extends Error {
  constructor(explicitName: string) {
    super(
      `No signing key available. Set ${explicitName}, or connect the Supabase integration ` +
        `which provides ${KEY_MATERIAL_SOURCES.join(' / ')}.`,
    );
    this.name = 'MissingKeyMaterialError';
  }
}

/**
 * The signing key for one purpose.
 *
 * An explicit secret is used verbatim, exactly as before this module existed.
 * Anything else is stretched through HKDF with the purpose as `info`, so the
 * admin cookie key and the ticket key are unrelated even though they come from
 * one piece of material.
 */
export async function signingKey(explicitName: string, info: string): Promise<Uint8Array> {
  const material = resolveKeyMaterial(explicitName);
  if (!material) throw new MissingKeyMaterialError(explicitName);
  if (material.explicit) return encoder.encode(material.value);
  return hkdf(material.value, info);
}

/** Where each key comes from, for /api/health. Never returns key bytes. */
export function signingKeyReport(): {
  adminSession: { source: string; derived: boolean } | null;
  ticket: { source: string; derived: boolean } | null;
} {
  const admin = resolveKeyMaterial('ADMIN_SESSION_SECRET');
  const ticket = resolveKeyMaterial('TICKET_SIGNING_SECRET');
  return {
    adminSession: admin ? { source: admin.source, derived: !admin.explicit } : null,
    ticket: ticket ? { source: ticket.source, derived: !ticket.explicit } : null,
  };
}
