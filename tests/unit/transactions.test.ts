import { TransactionService } from '../../src/modules/transactions/service.js';

const user = (id: string, balance: number) => ({
  id,
  email: `${id}@example.com`,
  display_name: id,
  password_hash: 'hash',
  balance_centavos: balance,
  created_at: new Date(),
  updated_at: new Date()
});

function makeService() {
  const sender = user('sender', 100_000);
  const recipient = user('recipient', 50_000);
  const created = {
    id: 'tx-1',
    sender_id: sender.id,
    recipient_id: recipient.id,
    amount_centavos: 25_000,
    currency: 'PHP',
    status: 'completed' as const,
    idempotency_key: 'key-1234',
    created_at: new Date()
  };
  const fakeDb = {
    transaction: (callback: (trx: object) => unknown) => Promise.resolve(callback({}))
  };
  const service = new TransactionService(fakeDb as never) as never as {
    transfer: TransactionService['transfer'];
    users: { findById: jest.Mock; lockUsers: jest.Mock; updateBalance: jest.Mock };
    transactions: { findByIdempotency: jest.Mock; create: jest.Mock };
    limits: { assertCanSpend: jest.Mock };
  };
  service.users = {
    findById: jest.fn((id: string) =>
      id === recipient.id ? recipient : id === sender.id ? sender : undefined
    ),
    lockUsers: jest.fn(() => [sender, recipient]),
    updateBalance: jest.fn()
  };
  service.transactions = {
    findByIdempotency: jest.fn(() => undefined),
    create: jest.fn(() => created)
  };
  service.limits = { assertCanSpend: jest.fn() };
  return { service, sender, recipient, created };
}

test('performs an atomic successful transfer through the service', async () => {
  const { service, created } = makeService();
  await expect(
    service.transfer({
      senderId: 'sender',
      recipientId: 'recipient',
      amount: '250.00',
      idempotencyKey: 'key-1234'
    })
  ).resolves.toEqual(created);
  expect(service.users.updateBalance).toHaveBeenCalledTimes(2);
  expect(service.transactions.create).toHaveBeenCalledTimes(1);
});

test('rejects self-transfer before balance mutation', async () => {
  const { service } = makeService();
  await expect(
    service.transfer({
      senderId: 'sender',
      recipientId: 'sender',
      amount: '1.00',
      idempotencyKey: 'key-1234'
    })
  ).rejects.toMatchObject({ code: 'SELF_TRANSFER' });
  expect(service.users.updateBalance).not.toHaveBeenCalled();
});

test('rejects a missing recipient', async () => {
  const { service } = makeService();
  await expect(
    service.transfer({
      senderId: 'sender',
      recipientId: 'missing',
      amount: '1.00',
      idempotencyKey: 'key-1234'
    })
  ).rejects.toMatchObject({ code: 'RECIPIENT_NOT_FOUND' });
});

test('rejects insufficient balance', async () => {
  const { service, sender } = makeService();
  sender.balance_centavos = 10;
  await expect(
    service.transfer({
      senderId: 'sender',
      recipientId: 'recipient',
      amount: '1.00',
      idempotencyKey: 'key-1234'
    })
  ).rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' });
});
