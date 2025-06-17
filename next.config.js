const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
    webpack: (config, { isServer, dev }) => {
      if (!isServer) {
        // Prevent Firebase's node build (undici) from leaking into the browser bundle
        config.resolve.fallback = {
          ...config.resolve.fallback,
          undici: false,
          fs: false,
          path: false,
          crypto: false,
          stream: false,
          util: false,
          buffer: false,
          events: false,
        };
        
        // Exclude undici entirely from client bundles
        config.externals = config.externals || [];
        config.externals.push('undici');
      }
      
      // Handle Node.js modules that use newer syntax
      config.module.rules.push({
        test: /\.m?js$/,
        include: /node_modules/,
        type: 'javascript/auto',
        resolve: {
          fullySpecified: false,
        },
      });
      
          // Firebase v9 doesn't need special aliases
      
      return config;
    },
    experimental: {
      esmExternals: 'loose',
    },
    transpilePackages: ['firebase'],
  };
  
  // Sentry configuration
  const sentryWebpackPluginOptions = {
    silent: true,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
  };

  module.exports = withSentryConfig(nextConfig, sentryWebpackPluginOptions);
  