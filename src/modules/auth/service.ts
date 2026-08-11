import bcrypt from 'bcrypt';
import { AppError } from '../../utils/app-error.js';
import type { AuthRepository } from './auth.repository.js';

export class AuthService {
  constructor(private readonly users: AuthRepository) {}

  async register(input: { email: string; displayName: string; password: string }) {
    const existing = await this.users.findByEmail(input.email);
    if (existing) throw new AppError(409, 'EMAIL_ALREADY_EXISTS', 'Email is already registered');
    const passwordHash = await bcrypt.hash(input.password, 12);
    try {
      return await this.users.create({
        email: input.email,
        display_name: input.displayName,
        password_hash: passwordHash
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505')
        throw new AppError(409, 'EMAIL_ALREADY_EXISTS', 'Email is already registered');
      throw error;
    }
  }

  async authenticate(email: string, password: string) {
    const user = await this.users.findByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    return user;
  }
}
