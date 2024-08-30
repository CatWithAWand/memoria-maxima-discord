import { Collection, type Message } from 'discord.js';
import { createClient, type RedisClientType } from 'redis';

import { env } from '@/lib/env';
import { messageOperations, webhookOperations } from '@/lib/store/operatations';
import type { SlashCommand } from '@/types';

export type RedisOperations<T> = {
  push: (client: RedisClientType, key: string, value: T) => Promise<void>;
  delete: (client: RedisClientType, key: string, value: T) => Promise<void>;
  deleteAll: (client: RedisClientType, key: string) => Promise<void>;
  getAll: (client: RedisClientType, key: string) => Promise<T[]>;
  pop: (client: RedisClientType, key: string) => Promise<T | null>;
  count: (client: RedisClientType, key: string) => Promise<number>;
};

let client: RedisClientType;
const commands = new Collection<string, SlashCommand>();

export const connect = async (): Promise<void> => {
  client = createClient({
    url: env.REDIS_URL,
  });
  await client.connect();
};

export const disconnect = async (): Promise<void> => {
  await client.quit();
};

const createStore = <T>(prefix: string, operations: RedisOperations<T>) => {
  const getKey = (...args: string[]): string => {
    if (args.length === 1) {
      return `${prefix}:${args[0]}`;
    } else {
      return `${prefix}:${args.join(':')}`;
    }
  };

  return {
    count: async (...args: string[]): Promise<number> => {
      const key = getKey(...args);
      return await operations.count(client, key);
    },
    delete: async (...args: (string | T)[]): Promise<void> => {
      const value = args.pop() as T;
      const key = getKey(...(args as string[]));
      await operations.delete(client, key, value);
    },
    deleteAll: async (...args: string[]): Promise<void> => {
      const key = getKey(...args);
      await operations.deleteAll(client, key);
    },
    getAll: async (...args: string[]): Promise<T[]> => {
      const key = getKey(...args);
      return await operations.getAll(client, key);
    },
    pop: async (...args: string[]): Promise<T | null> => {
      const key = getKey(...args);
      return await operations.pop(client, key);
    },
    push: async (...args: (string | T)[]): Promise<void> => {
      const value = args.pop() as T;
      const key = getKey(...(args as string[]));
      await operations.push(client, key, value);
    },
  };
};

const parseInfo = (str: string) => {
  const lines = str.split('\r\n');
  const result: Record<string, string> = {};
  lines.forEach((line) => {
    const [key, value] = line.split(':');

    if (key && value) result[key] = value;
  });
  return result;
};

export const getRedisVitals = async () => {
  const info = await client.info();
  const parsedInfo = parseInfo(info);

  const uptime = parseInt(parsedInfo['uptime_in_seconds'] || '0');
  const cpuSys = parseFloat(parsedInfo['used_cpu_sys'] || '0');
  const cpuUser = parseFloat(parsedInfo['used_cpu_user'] || '0');
  const cpuUsage = ((cpuSys + cpuUser) / uptime) * 100;

  const getInt = (key: string) => parseInt(parsedInfo[key] || '0');
  const getFloat = (key: string) => parseFloat(parsedInfo[key] || '0');
  const getString = (key: string) => parsedInfo[key] || '';
  const getTotalKeys = () => {
    const db0 = parsedInfo['db0'];

    if (!db0) return 0;
    const keysPart = db0.split(',')[0];

    if (!keysPart) return 0;
    const keyCount = keysPart.split('=')[1];

    return parseInt(keyCount || '0');
  };

  return {
    connectedClients: getInt('connected_clients'),
    cpuUsage: cpuUsage,
    datasetBytes: getInt('used_memory_dataset'),
    datasetHuman: `${(getInt('used_memory_dataset') / (1024 * 1024)).toFixed(2)} MB`,
    keyspaceHits: getInt('keyspace_hits'),
    keyspaceMisses: getInt('keyspace_misses'),
    maxMemory: getInt('maxmemory'),
    maxMemoryHuman: getString('maxmemory_human'),
    memFragmentationRatio: getFloat('mem_fragmentation_ratio'),
    opsPerSec: getInt('instantaneous_ops_per_sec'),
    role: getString('role'),
    totalCommands: getInt('total_commands_processed'),
    totalKeys: getTotalKeys(),
    uptime: uptime,
    usedMemory: getInt('used_memory'),
    usedMemoryHuman: getString('used_memory_human'),
    usedMemoryPeak: getInt('used_memory_peak'),
    usedMemoryPeakHuman: getString('used_memory_peak_human'),
    version: getString('redis_version'),
  };
};

export const getMessageStore = (prefix: string) =>
  createStore<Message>(prefix, messageOperations);
export const getWebhookStore = (prefix: string) =>
  createStore<string>(prefix, webhookOperations);

export const addCommand = (command: string, handler: SlashCommand) => {
  commands.set(command, handler);
};

export const getCommand = (command: string): SlashCommand | null => {
  const cmd = commands.get(command);

  if (!cmd) return null;

  return cmd;
};

export const getAllCommands = (): Collection<string, SlashCommand> => {
  return commands;
};
