import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

const chunkReloadFlag = 'sigaps-vite-preload-reload'
const swUpdateIntervalMs = 60_000

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    void updateSW(true)
  },
  onOfflineReady() {
    console.info('[SIGAPS] modo offline pronto')
  },
  onRegisteredSW(_swUrl: string, registration?: ServiceWorkerRegistration) {
    if (!registration) return

    window.setInterval(() => {
      void registration.update()
    }, swUpdateIntervalMs)
  },
  onRegisterError(error: unknown) {
    console.error('[SIGAPS] erro ao registrar PWA', error)
  },
})

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()

  if (sessionStorage.getItem(chunkReloadFlag) === '1') {
    sessionStorage.removeItem(chunkReloadFlag)
    return
  }

  sessionStorage.setItem(chunkReloadFlag, '1')
  const nextUrl = new URL(window.location.href)
  nextUrl.searchParams.set('v', Date.now().toString())
  window.location.replace(nextUrl.toString())
})

window.addEventListener(
  'pageshow',
  () => {
    sessionStorage.removeItem(chunkReloadFlag)
  },
  { once: true },
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
