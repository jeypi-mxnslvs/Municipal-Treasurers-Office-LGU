import { User } from '@/types';
import { ITreasuryRepository } from './ITreasuryRepository';
import { SupabaseRepository } from './SupabaseRepository';
import { supabase } from './supabase';
import { mapSupabaseUser } from './supabaseSession';

export interface LoginResult {
  token: string;
  user: User;
}

/**
 * IAuthService
 *
 * Application-level authentication contract.
 * Isolates UI components from authentication backend implementations (Supabase, On-Premise REST, LDAP, etc.).
 */
export interface IAuthService {
  login(username: string, password: string, stationId?: string): Promise<LoginResult>;
  verifyPassword(username: string, password: string): Promise<boolean>;
  lookupUser(username: string): Promise<User | null>;
  getCurrentUser(): User | null;
  logout(): Promise<void>;
}

export class AuthService implements IAuthService {
  private repository: ITreasuryRepository;

  constructor(repository?: ITreasuryRepository) {
    this.repository = repository || new SupabaseRepository();
  }

  setRepository(repository: ITreasuryRepository): void {
    this.repository = repository;
  }

  async login(username: string, password: string, _stationId = 'Workstation'): Promise<LoginResult> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: username.trim().toLowerCase(),
      password,
    });

    if (error || !data.session || !data.user) {
      throw error || new Error('Invalid credentials');
    }

    return {
      token: data.session.access_token,
      user: mapSupabaseUser(data.user),
    };
  }

  async verifyPassword(username: string, password: string): Promise<boolean> {
    try {
      await this.login(username, password);
      return true;
    } catch {
      return false;
    }
  }

  async lookupUser(username: string): Promise<User | null> {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user || user.email?.toLowerCase() !== username.trim().toLowerCase()) return null;
    return mapSupabaseUser(user);
  }

  getCurrentUser(): User | null {
    return null;
  }

  async logout(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }
}

export const authService: IAuthService = new AuthService();
