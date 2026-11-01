import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Config separada de vite.config.ts para no cargar la PWA en los tests.
// Por defecto corre en Node (rápido, ideal para la lógica de dominio y sync);
// los tests de componentes piden jsdom con `// @vitest-environment jsdom`.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'servidor/**/*.test.ts'],
  },
})
