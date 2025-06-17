export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Server-side Sentry initialization
    const { init } = await import('@sentry/nextjs');
    
    init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 1.0,
      debug: false,
      environment: process.env.NODE_ENV,
    });
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Edge runtime Sentry initialization
    const { init } = await import('@sentry/nextjs');
    
    init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 1.0,
      debug: false,
      environment: process.env.NODE_ENV,
    });
  }
} 