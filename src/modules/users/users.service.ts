import { AppError } from '../../utils/app-error.js';
import type { UsersRepository } from './users.repository.js';

export class UsersService {
  constructor(private readonly users: UsersRepository) {}
  async getCurrentUser(id: string) {
    const user = await this.users.findById(id);
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User does not exist');
    return user;
  }
}
