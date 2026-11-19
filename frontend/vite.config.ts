import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: 'localhost', port: 5173, strictPort: true, fs: { deny: ['.env', '.env.*', '**/.git/**', '**/.local/**', '**/scripts/**', '**/tests/**', '*.{crt,pem}'] } },
  test: { environment: 'jsdom', setupFiles: ['./src/i18n/test-setup.ts'], include: ['src/**/*.test.{ts,tsx}'], restoreMocks: true },
});
