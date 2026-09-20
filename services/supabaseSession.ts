import { User } from '@/types';

export interface SupabaseUserLike {
  id: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

export const MAX_SESSION_AGE_MS = 8 * 60 * 60 * 1000;

export function sessionWithinMaximumAge(lastSignInAt: string | undefined, now = Date.now()): boolean {
  const signedInAt = Date.parse(lastSignInAt || '');
  return Number.isFinite(signedInAt) && signedInAt <= now && now - signedInAt < MAX_SESSION_AGE_MS;
}

export function mapSupabaseUser(user: SupabaseUserLike): User {
  const role = user.app_metadata?.role;
  if (role !== 'Admin' && role !== 'Assessor') {
    throw new Error('Authenticated user has no approved role');
  }

  return {
    id: user.id,
    name: typeof user.user_metadata?.name === 'string' ? user.user_metadata.name : user.email || user.id,
    username: user.email,
    role,
    stationId: typeof user.user_metadata?.stationId === 'string' ? user.user_metadata.stationId : 'Workstation',
  };
}
