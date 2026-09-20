import { User } from '@/types';

export interface SupabaseUserLike {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}

export function mapSupabaseUser(user: SupabaseUserLike): User {
  const role = user.user_metadata?.role;
  if (role !== 'Admin' && role !== 'Assessor' && role !== 'SystemMaintenance') {
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
