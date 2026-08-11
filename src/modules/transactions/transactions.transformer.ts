import { formatCentavos } from '../../utils/money.js';

export function transformTransaction(transaction: {
  id: string;
  sender_id: string;
  recipient_id: string;
  amount_centavos: number | string;
  currency: string;
  status: string;
  created_at: Date;
}) {
  return {
    id: transaction.id,
    senderId: transaction.sender_id,
    recipientId: transaction.recipient_id,
    amount: formatCentavos(transaction.amount_centavos),
    currency: transaction.currency,
    status: transaction.status,
    createdAt: new Date(transaction.created_at).toISOString()
  };
}
export function transformHistoryRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    amount: formatCentavos(row.amount_centavos as string),
    currency: row.currency,
    sender: { id: row.sender_id, email: row.sender_email, displayName: row.sender_name },
    recipient: {
      id: row.recipient_id,
      email: row.recipient_email,
      displayName: row.recipient_name
    },
    createdAt: new Date(row.created_at as Date).toISOString()
  };
}
