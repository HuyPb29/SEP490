import { defineConfig } from '@playwright/test'

const port = Number(process.env.PLAYWRIGHT_PORT || 5180)
const url = 'http://127.0.0.1:' + port

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: url,
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port ' + port + ' --strictPort',
    port,
    reuseExistingServer: !process.env.CI,
  },
})
