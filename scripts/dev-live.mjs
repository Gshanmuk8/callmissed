import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

// Refresh Wrangler's existing login without copying its credential into a file.
execFileSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'whoami'], {
  stdio: 'inherit',
});
const roots = [
  process.env.XDG_CONFIG_HOME,
  process.env.APPDATA && path.join(process.env.APPDATA, 'xdg.config'),
  path.join(os.homedir(), '.config'),
  os.homedir(),
].filter(Boolean);
const file = roots
  .map((root) => path.join(root, '.wrangler', 'config', 'default.toml'))
  .find((candidate) => fs.existsSync(candidate));
if (!file) throw new Error('Run npx wrangler login before starting live AI.');
const token = fs.readFileSync(file, 'utf8').match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];
if (!token) throw new Error('Wrangler OAuth login is missing. Run npx wrangler login.');
const response = await fetch('https://api.cloudflare.com/client/v4/accounts', {
  headers: { Authorization: `Bearer ${token}` },
});
const accounts = await response.json();
const accountId =
  process.env.CLOUDFLARE_ACCOUNT_ID ||
  (accounts.result?.length === 1 ? accounts.result[0].id : undefined);
if (!response.ok || !accountId) {
  throw new Error('Set CLOUDFLARE_ACCOUNT_ID to the account shown by wrangler whoami.');
}
// Only the local server receives this token. Production builds never load it.
// Direct Workers AI REST calls avoid uploading a remote development proxy.
process.env.CF_LOCAL_API_TOKEN = token;
process.env.CF_LOCAL_ACCOUNT_ID = accountId;
const { createServer } = await import('vite');
const server = await createServer({ server: { host: '127.0.0.1' } });
await server.listen();
server.printUrls();
server.bindCLIShortcuts({ print: true });
