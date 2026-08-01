import { defineConfig } from 'vite';
export default defineConfig({ test: { include: ['scratch/**/*.test.ts'], environment: 'node', testTimeout: 600000 } } as any);
