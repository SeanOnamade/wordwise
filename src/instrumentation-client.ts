import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  debug: false,
  environment: process.env.NODE_ENV,
  beforeSend(event) {
    // Filter out development noise
    if (process.env.NODE_ENV === 'development' && event.exception) {
      const error = event.exception.values?.[0];
      if (error?.value?.includes('Non-Error promise rejection captured')) {
        return null;
      }
    }
    return event;
  },
});

// Export router transition hook for navigation instrumentation
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart; 