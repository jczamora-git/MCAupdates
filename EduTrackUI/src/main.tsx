import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Initialize Firebase and register service worker
import { requestPermission } from "./lib/firebase";

const isSecureOrigin =
  window.isSecureContext ||
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname === '[::1]';

if ('serviceWorker' in navigator && isSecureOrigin) {
  const base = import.meta.env.BASE_URL || '/';
  navigator.serviceWorker.register(`${base}firebase-messaging-sw.js`)
    .then((registration) => {
      console.log('Service Worker registered successfully:', registration);
    })
    .catch((error) => {
      console.log('Service Worker registration failed:', error);
    });
} else if ('serviceWorker' in navigator) {
  console.warn('Service worker registration skipped: secure origin is required.');
}

// Request FCM permission on app load (you can move this to a specific component if needed)
requestPermission();

createRoot(document.getElementById("root")!).render(<App />);
