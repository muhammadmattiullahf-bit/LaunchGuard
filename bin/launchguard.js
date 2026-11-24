#!/usr/bin/env node

import { runCli } from '../src/cli/cli.ts';

runCli(process.argv.slice(2))
  .then((exitCode) => {
    process.exit(exitCode);
  })
  .catch((err) => {
    console.error('Fatal CLI Error:', err);
    process.exit(4);
  });
