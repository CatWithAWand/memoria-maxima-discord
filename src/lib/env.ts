import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  emptyStringAsUndefined: true,
  isServer: true,
  runtimeEnv: process.env,
  server: {
    DEV_ALLOWLIST: z
      .preprocess((arg: unknown) => {
        if (typeof arg === 'string') {
          return arg.split(',');
        }

        return undefined;
      }, z.array(z.string()).optional())
      .default([]),

    // Discord
    DISCORD_APPLICATION_ID: z.string().min(1),
    DISCORD_CLIENT_SECRET: z.string().min(1),
    DISCORD_TOKEN: z.string().min(1),

    // Server
    NODE_ENV: z.enum(['development', 'test', 'ci', 'production']),

    // Redis
    REDIS_URL: z.string().url(),
  },
});
