import type { Message } from 'discord.js';

import logger from '@/lib/logger';
import { type RedisOperations } from '@/lib/store';

export const messageOperations: RedisOperations<Message> = {
  count: async (client, key) => {
    return await client.sCard(key);
  },
  delete: async (client, key, value) => {
    await client.sRem(key, JSON.stringify(value));
  },
  deleteAll: async (client, key) => {
    await client.del(key);
  },
  getAll: async (client, key) => {
    const messages = await client.sMembers(key);
    return messages.map((msg) => JSON.parse(msg) as Message);
  },
  pop: async (client, key) => {
    const msg = (await client.sPop(key, 1)) as unknown as string;

    if (!msg) return null;
    try {
      return JSON.parse(msg) as Message;
    } catch (error) {
      logger.error({
        error,
        event: 'Redis.PopMessage',
        msg: `Failed to parse message: ${msg}`,
      });
      return null;
    }
  },
  push: async (client, key, value) => {
    await client.sAdd(key, JSON.stringify(value));
  },
};
