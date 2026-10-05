import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function buildPwa(directory = 'dist') {
  const root = resolve(directory);
  const files = ['/index.html', '/offline.html'];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isFile() && entry.name === 'manifest.webmanifest') files.push('/' + entry.name);
    if (entry.isDirectory() && ['assets', 'icons'].includes(entry.name)) {
      for (const name of await readdir(join(root, entry.name))) {
        if (/\.(?:js|css|png|svg|woff2?)$/.test(name)) files.push('/' + entry.name + '/' + name);
      }
    }
  }
  files.sort();
  const hash = createHash('sha256');
  const worker = await readFile(join(root, 'sw.js'), 'utf8');
  // Include SW implementation changes as well as the bytes of every cached artifact.
  hash.update(worker.replace(/\/\* PWA_CONFIG_START \*\/[\s\S]*?\/\* PWA_CONFIG_END \*\//, 'CONFIG'));
  for (const path of files) { hash.update(path); hash.update(await readFile(join(root, path.slice(1)))); }
  const config = { version: hash.digest('hex').slice(0, 20), files };
  if (!worker.includes('/* PWA_CONFIG_START */')) throw new Error('SW configuration marker missing');
  await writeFile(join(root, 'sw.js'), worker.replace(/\/\* PWA_CONFIG_START \*\/[\s\S]*?\/\* PWA_CONFIG_END \*\//, '/* PWA_CONFIG_START */ ' + JSON.stringify(config) + ' /* PWA_CONFIG_END */'));
  return config;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await buildPwa();
  console.log(`PWA: ${result.files.length} static files, shell ${result.version}`);
}
