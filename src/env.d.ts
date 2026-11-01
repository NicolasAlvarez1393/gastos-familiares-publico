/// <reference types="vite/client" />

// Variables de entorno que ve la app. Explicación de cada una en .env.example.
interface ImportMetaEnv {
  readonly VITE_GOOGLE_API_KEY?: string
  readonly VITE_GOOGLE_APP_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
