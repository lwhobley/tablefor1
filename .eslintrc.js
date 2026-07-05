// https://docs.expo.dev/guides/using-eslint/
module.exports = {
  extends: 'expo',
  ignorePatterns: [
    // Deno edge functions: import remote https:// URLs and use the global
    // `Deno` namespace, neither of which the Node-focused `expo` config's
    // import resolver understands. They're type-checked by `deno check`
    // and unit-tested by `deno test` in CI instead of this ESLint config.
    'supabase/functions/**',
    'dist/**',
    '.expo/**',
  ],
  overrides: [
    {
      // metro.config.js runs under Node at build time (CommonJS, __dirname).
      files: ['metro.config.js', 'babel.config.js', 'tailwind.config.js'],
      env: { node: true },
    },
  ],
};
