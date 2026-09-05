const path = require('node:path');
require('esbuild').build({
  absWorkingDir: path.resolve(__dirname, '..'),
  entryPoints: ['server/src/cli.ts'],
  outfile: 'build/main.cjs',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs'
}).catch(error => { console.error(error.message); process.exitCode = 1; });
