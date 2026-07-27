import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/plus-jakarta-sans/800.css';
import '@fontsource/vazirmatn/400.css';
import '@fontsource/vazirmatn/500.css';
import '@fontsource/vazirmatn/700.css';
import '@/i18n/i18n';
import { App } from '@/App';

// The service worker owns the application shell and its bundles, which is
// what makes a cold start with no connection possible at all. Registered
// after load so it never competes with the first paint.
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(
            (registration) => {
                // A deploy that lands while the app is open should be picked
                // up without the user knowing to reload twice.
                window.setInterval(() => void registration.update(), 60 * 60 * 1000);
            },
            () => undefined,
        );
    });
}

const container = document.getElementById('root');

if (!container) {
    throw new Error('Root element #root not found');
}

createRoot(container).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
