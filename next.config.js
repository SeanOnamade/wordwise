const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
    webpack: (config, { isServer, dev }) => {
      if (!isServer) {
        // Ensure server-only modules are not included in client bundles
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
      }
      
      // Handle Node.js modules that use newer syntax
      config.module.rules.push({
        test: /\.m?js$/,
        include: [
          /node_modules\/undici/,
          /node_modules\/cheerio/,
          /node_modules\/parse5/,
          /node_modules\/domhandler/,
          /node_modules\/htmlparser2/,
          /node_modules\/dom-serializer/,
        ],
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', {
                targets: {
                  node: 'current',
                },
              }],
            ],
            plugins: [
              '@babel/plugin-proposal-class-properties',
              '@babel/plugin-proposal-private-methods',
              '@babel/plugin-proposal-private-property-in-object',
            ],
          },
        },
      });
      
      return config;
    },
    experimental: {
      esmExternals: true,
    },
};

// Sentry configuration
const sentryWebpackPluginOptions = {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
};

module.exports = withSentryConfig(nextConfig, sentryWebpackPluginOptions);
  