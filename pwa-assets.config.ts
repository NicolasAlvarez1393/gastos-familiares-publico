import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config'

// Genera los íconos de la PWA a partir de public/logo.svg.
// Se corre a mano con `npm run generate-pwa-assets` cuando cambia el logo,
// y los PNG resultantes se versionan (el build de Netlify no depende de esto).
const fondo = { background: '#0f766e' }

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...preset,
    maskable: { ...preset.maskable, resizeOptions: fondo },
    apple: { ...preset.apple, resizeOptions: fondo },
  },
  images: ['public/logo.svg'],
})
