import { transformUser } from '../users/users.transformer.js';
import type { UserRecord } from '../../types/domain.js';

export function transformAuthUser(user: UserRecord, token: string) {
  return { token, user: transformUser(user) };
}
export { transformUser };
