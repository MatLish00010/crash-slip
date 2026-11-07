import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/crash-slip/' : '/',
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
  },
}));
