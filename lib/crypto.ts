/**
 * Security and Session Cryptography Utility
 * Compliant with Phase 1: Security & Authentication Hardening
 */

// 15 minutes default inactivity threshold
export const DEFAULT_SESSION_TIMEOUT_MS = 15 * 60 * 1000;

export interface SessionPayload {
  userId: string;
  username: string;
  role: string;
  issuedAt: number;
  expiresAt: number;
}

/**
 * Base64Url encoder helper
 */
function base64UrlEncode(str: string): string {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Base64Url decoder helper
 */
function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return atob(base64);
}

/**
 * Generates a signed cryptographic session token with an expiration timestamp.
 */
export async function createSessionToken(
  user: { id: string | number; username?: string; role: string },
  expiresInMs: number = DEFAULT_SESSION_TIMEOUT_MS
): Promise<string> {
  const now = Date.now();
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload: SessionPayload = {
    userId: String(user.id),
    username: user.username || 'staff',
    role: user.role,
    issuedAt: now,
    expiresAt: now + expiresInMs,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  // Use WebCrypto HMAC-SHA256 for signing
  const encoder = new TextEncoder();
  const keySecret = `lgu-session-key-${user.username}-${user.role}`;
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(keySecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(dataToSign));
  const signatureBytes = Array.from(new Uint8Array(signatureBuffer))
    .map(b => String.fromCharCode(b))
    .join('');
  const encodedSignature = base64UrlEncode(signatureBytes);

  return `${dataToSign}.${encodedSignature}`;
}

/**
 * Validates a session token, returning the payload if valid and not expired.
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const payloadStr = base64UrlDecode(encodedPayload);
    const payload: SessionPayload = JSON.parse(payloadStr);

    // Check expiration
    if (!payload.expiresAt || Date.now() > payload.expiresAt) {
      return null; // Expired
    }

    // Verify signature
    const encoder = new TextEncoder();
    const dataToVerify = `${encodedHeader}.${encodedPayload}`;
    const keySecret = `lgu-session-key-${payload.username}-${payload.role}`;
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(keySecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signatureRaw = base64UrlDecode(encodedSignature);
    const signatureUint8 = new Uint8Array(
      signatureRaw.split('').map(c => c.charCodeAt(0))
    );

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureUint8,
      encoder.encode(dataToVerify)
    );

    return isValid ? payload : null;
  } catch {
    return null;
  }
}
