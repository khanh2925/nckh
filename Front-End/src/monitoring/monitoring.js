// Error tracking with the Sentry SDK (works with Sentry cloud or GlitchTip: only the DSN changes).
// No VITE_SENTRY_DSN = disabled and the SDK is left out of the build.
// The SDK loads after the page (dynamic import); calls made before it is ready are queued (max 50).

const DSN = (import.meta.env.VITE_SENTRY_DSN || '').trim();
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

let sentry = null;
let pending = [];

export const monitoringEnabled = DSN !== '';

export function initMonitoring() {
    if (!monitoringEnabled) return;
    import('./sentryClient.js')
        .then(S => {
            S.start(DSN, API_BASE);
            sentry = S;
            const queued = pending;
            pending = [];
            queued.forEach(fn => fn(S));
        })
        .catch(() => {
            pending = [];
        });
}

function withSentry(fn) {
    if (sentry) fn(sentry);
    else if (monitoringEnabled && pending.length < 50) pending.push(fn);
}

export function reportError(error, context) {
    withSentry(S => S.captureException(error, context ? { contexts: { detail: context } } : undefined));
}

export function addMonitoringBreadcrumb(category, message, data) {
    withSentry(S => S.addBreadcrumb({ category, message, data, level: 'info' }));
}
