// Loaded lazily by monitoring.js; imports only the functions we use to keep the chunk small.
import { addBreadcrumb, browserTracingIntegration, captureException, init, replayIntegration } from '@sentry/react';

export { addBreadcrumb, captureException };

export function start(dsn, apiBase) {
    init({
        dsn,
        environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
        release: import.meta.env.VITE_APP_VERSION || undefined,
        sendDefaultPii: false,
        integrations: [
            browserTracingIntegration(),
            // Session replay on error only (text and media masked); heavier, so opt in with VITE_SENTRY_REPLAY=1
            ...(import.meta.env.VITE_SENTRY_REPLAY === '1' ? [replayIntegration()] : [])
        ],
        tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES ?? 0.2),
        // Send trace headers to the Render backend so one user action is one trace: browser -> API
        tracePropagationTargets: apiBase ? [/^\/(?!\/)/, apiBase] : [/^\/(?!\/)/],
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 1
    });
}
