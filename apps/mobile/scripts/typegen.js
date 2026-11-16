#!/usr/bin/env node
// Generates Expo Router typed-route declarations (.expo/types) without starting the
// dev server, so `tsc` works in CI and fresh checkouts. Uses Expo CLI's own generator.
const path = require('path');

const cliRoot = path.dirname(require.resolve('@expo/cli/package.json'));
const {
  startTypescriptTypeGenerationAsync,
} = require(path.join(cliRoot, 'build/src/start/server/type-generation/startTypescriptTypeGeneration'));

startTypescriptTypeGenerationAsync({ projectRoot: path.resolve(__dirname, '..') })
  .then(() => console.log('typed routes generated'))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
