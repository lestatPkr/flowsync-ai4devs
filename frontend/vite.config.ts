import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Que ninguna página de otro sitio pueda incrustar la app (clickjacking sobre
// «Borrar tarea»). Solo `frame-ancestors`: no restringe scripts ni estilos.
// El servidor de producción no está en el repo: allí lo comprueba el despliegue.
const ANTI_FRAMING_HEADERS = {
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "frame-ancestors 'none'",
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { headers: ANTI_FRAMING_HEADERS },
  preview: { headers: ANTI_FRAMING_HEADERS },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
