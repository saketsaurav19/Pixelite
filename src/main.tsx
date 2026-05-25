import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

// Setup cross-origin isolation fallback logic
const reloadedBySelf = window.sessionStorage.getItem("coiReloadedBySelf");
window.sessionStorage.removeItem("coiReloadedBySelf");
const coepDegrading = (reloadedBySelf === "coepdegrade");

const n = navigator;
const controlling = n.serviceWorker && n.serviceWorker.controller;

if (controlling && !window.crossOriginIsolated) {
    window.sessionStorage.setItem("coiCoepHasFailed", "true");
}
const coepHasFailed = window.sessionStorage.getItem("coiCoepHasFailed");

if (controlling) {
    const reloadToDegrade = !(coepDegrading || window.crossOriginIsolated);
    n.serviceWorker.controller.postMessage({
        type: "coepCredentialless",
        value: (reloadToDegrade || coepHasFailed) ? false : true,
    });

    if (reloadToDegrade) {
        window.sessionStorage.setItem("coiReloadedBySelf", "coepdegrade");
        window.location.reload();
    }
}

// Register service worker for offline support
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateSW();
  },
  onOfflineReady() {
    console.log('App ready to work offline');
  },
  onRegisteredSW(_swUrl, registration) {
    if (registration) {
      registration.addEventListener("updatefound", () => {
          window.sessionStorage.setItem("coiReloadedBySelf", "updatefound");
      });
      // If the registration is active, but it's not controlling the page
      if (registration.active && !n.serviceWorker?.controller) {
          window.sessionStorage.setItem("coiReloadedBySelf", "notcontrolling");
          window.location.reload();
      }
    }
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
