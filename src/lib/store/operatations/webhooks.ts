import { type RedisOperations } from '@/lib/store';

export const webhookOperations: RedisOperations<string> = {
  count: async (client, key) => {
    return await client.hLen(key);
  },
  delete: async (client, key, value) => {
    const [userId] = JSON.parse(value);
    await client.hDel(key, userId);
  },
  deleteAll: async (client, key) => {
    await client.del(key);
  },
  getAll: async (client, key) => {
    const webhooks = await client.hGetAll(key);
    return Object.entries(webhooks).map(([userId, webhookData]) =>
      JSON.stringify([userId, webhookData]),
    );
  },
  pop: async (client, key) => {
    const webhooks = await client.hGetAll(key);
    const entries = Object.entries(webhooks);

    if (entries.length === 0) return null;
    const [userId, webhookData] = entries[0] as [string, string];
    await client.hDel(key, userId);
    return JSON.stringify([userId, webhookData]);
  },
  push: async (client, key, value) => {
    const [userId, webhookData] = JSON.parse(value);
    await client.hSet(key, userId, webhookData);
  },
};
