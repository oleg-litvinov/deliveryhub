// Bundle each Lambda handler into dist/<name>/index.mjs (ESM, Node 22, arm64).
// The AWS SDK v3 is bundled too, so we pin the exact version we tested with.
import { build } from 'esbuild'
import { copyFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'

const handlers = ['webhook', 'worker', 'api', 'ringAuth']
rmSync('dist', { recursive: true, force: true })
await Promise.all(
  handlers.map((name) =>
    build({
      entryPoints: [`src/handlers/${name}.ts`],
      outfile: `dist/${name}/index.mjs`,
      bundle: true,
      platform: 'node',
      target: 'node22',
      format: 'esm',
      minify: true,
      sourcemap: false,
      // ESM bundles need a require() shim for CommonJS dependencies.
      banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
    }),
  ),
)
copyFileSync(createRequire(import.meta.url).resolve('zxing-wasm/reader/zxing_reader.wasm'), 'dist/worker/zxing_reader.wasm')
console.log('built', handlers.join(', '))
