import { formatCentavos } from '../../utils/money.js';
import type { UserRecord } from '../../types/domain.js';

export function transformUser(
  user: Pick<UserRecord, 'id' | 'email' | 'display_name' | 'balance_centavos'>
) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    balance: formatCentavos(user.balance_centavos),
    currency: 'PHP'
  };
}
