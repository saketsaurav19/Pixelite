/// <reference lib="webworker" />
declare let self: ServiceWorkerGlobalScope

const originalAddEventListener = self.addEventListener.bind(self);
self.addEventListener = function(type: string, listener: any, options?: any) {
  if (type === 'fetch') {
    const originalListener = listener;
    listener = function(this: any, event: FetchEvent) {
      const originalRespondWith = event.respondWith.bind(event);
      event.respondWith = function(promise: Promise<Response> | Response) {
        return originalRespondWith(
          Promise.resolve(promise).then((response: Response) => {
            if (!response || response.status === 0) return response;

            // Recreate response to modify headers since they might be immutable
            const newHeaders = new Headers(response.headers);
            newHeaders.set("Cross-Origin-Embedder-Policy", coepCredentialless ? "credentialless" : "require-corp");
            if (!coepCredentialless) {
                newHeaders.set("Cross-Origin-Resource-Policy", "cross-origin");
            }
            newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");

            return new Response(response.body, {
              status: response.status,
              statusText: response.statusText,
              headers: newHeaders,
            });
          }).catch((e) => {
              console.error(e);
              throw e;
          })
        );
      };
      return originalListener.call(this, event);
    };
  }
  return originalAddEventListener(type as any, listener, options);
};

let coepCredentialless = false;
self.addEventListener("message", (ev) => {
    if (!ev.data) return;
    if (ev.data.type === "deregister") {
        self.registration
            .unregister()
            .then(() => self.clients.matchAll())
            .then(clients => {
                clients.forEach((client) => {
                    if (client.type === 'window') {
                        (client as WindowClient).navigate(client.url);
                    }
                });
            });
    } else if (ev.data.type === "coepCredentialless") {
        coepCredentialless = ev.data.value;
    }
});

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'

self.skipWaiting()
clientsClaim()

cleanupOutdatedCaches()

precacheAndRoute(self.__WB_MANIFEST)
