import { describe, it, expect } from 'vitest';
import { createSessionToken, verifySessionToken, DEFAULT_SESSION_TIMEOUT_MS } from './crypto';

describe('lib/crypto - Cryptographic Session Management', () => {
  const mockUser = {
    id: '42',
    username: 'juan.assessor',
    role: 'Assessor',
  };

  it('generates a 3-part cryptographic session token', async () => {
    const token = await createSessionToken(mockUser);
    expect(token).toBeTypeOf('string');
    const parts = token.split('.');
    expect(parts.length).toBe(3);
  });

  it('verifies a valid token and returns payload data', async () => {
    const token = await createSessionToken(mockUser, 60000);
    const payload = await verifySessionToken(token);

    expect(payload).not.toBeNull();
    expect(payload?.userId).toBe('42');
    expect(payload?.username).toBe('juan.assessor');
    expect(payload?.role).toBe('Assessor');
    expect(payload?.expiresAt).toBeGreaterThan(Date.now());
  });

  it('rejects an expired token', async () => {
    // Negative duration = expired immediately
    const expiredToken = await createSessionToken(mockUser, -1000);
    const result = await verifySessionToken(expiredToken);
    expect(result).toBeNull();
  });

  it('rejects a tampered token payload with signature mismatch', async () => {
    const token = await createSessionToken(mockUser);
    const parts = token.split('.');

    // Tamper with payload (elevate role to Admin)
    const tamperedPayload = btoa(JSON.stringify({
      userId: '42',
      username: 'juan.assessor',
      role: 'Admin',
      issuedAt: Date.now(),
      expiresAt: Date.now() + 60000,
    })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const forgedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
    const result = await verifySessionToken(forgedToken);
    expect(result).toBeNull();
  });

  it('rejects malformed token strings', async () => {
    expect(await verifySessionToken('invalid-token')).toBeNull();
    expect(await verifySessionToken('')).toBeNull();
    expect(await verifySessionToken('a.b')).toBeNull();
    expect(await verifySessionToken('a.b.c.d')).toBeNull();
  });

  it('respects the default 15-minute inactivity timeout configuration', () => {
    expect(DEFAULT_SESSION_TIMEOUT_MS).toBe(15 * 60 * 1000);
  });
});
