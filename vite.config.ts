import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';
export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    cloudflare({
      remoteBindings: process.env.CF_REMOTE_AI === '1',
      config:
        command === 'serve'
          ? {
              vars: {
                AI_PROVIDER:
                  process.env.CF_LOCAL_API_TOKEN || process.env.CF_REMOTE_AI === '1'
                    ? 'cloudflare'
                    : 'none',
                ...(process.env.CF_LOCAL_API_TOKEN
                  ? {
                      CF_LOCAL_API_TOKEN: process.env.CF_LOCAL_API_TOKEN,
                      CF_LOCAL_ACCOUNT_ID: process.env.CF_LOCAL_ACCOUNT_ID!,
                    }
                  : {}),
              },
            }
          : undefined,
    }),
  ],
  server: { port: 5173, strictPort: true },
}));
