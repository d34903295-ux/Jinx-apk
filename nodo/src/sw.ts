/// <reference lib="webworker" />
/**
 * Service worker de NODO.
 * - Precachea el app shell (HTML, JS, CSS, fuentes, iconos) para abrir sin conexión.
 * - Fallback de navegación a index.html (SPA).
 * Los pesos del modelo NO pasan por aquí: WebLLM los guarda en la Cache API por su cuenta.
 */
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare let self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

self.skipWaiting()
clientsClaim()
