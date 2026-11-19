import { execSync } from 'node:child_process';
import { defineConfig } from '@playwright/test';

const PORT = 8091; // not 8081: that is the owner's phone-testing Expo
const APP = `http://localhost:${PORT}`;

// Always read from the local stack (never trust a pre-set env), once in the main process; workers inherit it.
{
  const env: Record<string, string> = {};
  for (const line of execSync('npx supabase status -o env', { encoding: 'utf8', cwd: '..' }).split('\n')) {
    const m = /^(\w+)="(.*)"$/.exec(line.trim());
    if (m) env[m[1]] = m[2];
  }
  process.env.SUPABASE_URL = env.API_URL;
  process.env.SUPABASE_ANON_KEY = env.ANON_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = env.SERVICE_ROLE_KEY;
}
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(process.env.SUPABASE_URL!)) throw new Error('e2e runs only against local Supabase');

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.spec.ts', // not fake-plantid.test.mjs (node:test)
  globalSetup: './e2e/global-setup.ts',
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }], ['github']] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: APP,
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: `npx expo start --web --port ${PORT}`,
    url: APP,
    env: {
      CI: '1',
      EXPO_PUBLIC_SUPABASE_URL: process.env.SUPABASE_URL!,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY!,
      EXPO_PUBLIC_EMAIL_CONFIRMED_URL: `${APP}/email-confirmed`,
    },
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    { name: 'main', use: { browserName: 'chromium' }, testIgnore: ['**/*.branches.spec.ts', '**/speed.spec.ts'] },
    {
      name: 'plantid-branches',
      use: { browserName: 'chromium' },
      testMatch: '**/*.branches.spec.ts',
      dependencies: ['main'],
      fullyParallel: false,
    },
  ],
});
