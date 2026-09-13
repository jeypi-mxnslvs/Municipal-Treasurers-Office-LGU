import { User } from '@/types';
import { ITreasuryRepository } from './ITreasuryRepository';
import { SupabaseRepository } from './SupabaseRepository';

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
  logout(): void;
}

export class AuthService implements IAuthService {
  private repository: ITreasuryRepository;

  constructor(repository?: ITreasuryRepository) {
    this.repository = repository || new SupabaseRepository();
  }

  setRepository(repository: ITreasuryRepository): void {
    this.repository = repository;
  }

  async login(username: string, password: string, stationId = 'Workstation'): Promise<LoginResult> {
    return this.repository.login(username, password, stationId);
  }

  async verifyPassword(username: string, password: string): Promise<boolean> {
    return this.repository.verifyPassword(username, password);
  }

  async lookupUser(username: string): Promise<User | null> {
    return this.repository.lookupUser(username);
  }

  getCurrentUser(): User | null {
    try {
      const saved = localStorage.getItem('lgu_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }

  logout(): void {
    localStorage.removeItem('lgu_token');
    localStorage.removeItem('lgu_user');
  }
}

export const authService: IAuthService = new AuthService();
