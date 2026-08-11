export interface UserRecord {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  balance_centavos: number | string;
  created_at: Date;
  updated_at: Date;
}

export interface TransactionRecord {
  id: string;
  sender_id: string;
  recipient_id: string;
  amount_centavos: number | string;
  currency: string;
  status: 'completed';
  idempotency_key: string;
  created_at: Date;
}
