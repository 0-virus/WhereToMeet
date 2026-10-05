import { readFile, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { androidIdentity } from './android-config.mjs';

export async function releaseProblems(env = process.env, root = process.cwd()) {
  const problems = [];
  const json = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
  try {
    const catalog = await json('data/hubs.json');
    if (!Array.isArray(catalog.hubs) || !catalog.hubs.length) problems.push('Verified catalog is empty; review source hubs and rebuild data/hubs.json');
    else if (catalog.hubs.some((hub) => hub.verified !== true || hub.regionCode === 'unreviewed')) problems.push('Release catalog contains unverified hubs');
    const quality = await json('data/quality-report.json');
    if (!quality.verifiedCount || quality.verifiedCount !== catalog.hubs.length) problems.push('Verified catalog count is missing or inconsistent');
  } catch { problems.push('Verified catalog and quality report are required'); }
  for (const key of ['APP_ORIGIN', 'ANDROID_PACKAGE_ID', 'PLAY_APP_SIGNING_SHA256']) if (!env[key]) problems.push(`${key} is required`);
  let identity;
  try { identity = androidIdentity(env); } catch (error) { problems.push(error.message); }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.VITE_OPERATOR_CONTACT || '') || /@example\./i.test(env.VITE_OPERATOR_CONTACT || '')) problems.push('VITE_OPERATOR_CONTACT must be the real public support email');
  if (!env.VITE_OPERATOR_NAME?.trim()) problems.push('VITE_OPERATOR_NAME must identify the real service operator');
  if (env.ROUTING_APPROVED !== 'true') problems.push('ROUTING_APPROVED must be true only after actual supplier validation and approval');
  try {
    const evidence = await readFile(resolve(root, env.ROUTING_APPROVAL_FILE || '__missing_approval__'), 'utf8');
    if (!evidence.trim()) throw new Error();
  } catch { problems.push('ROUTING_APPROVAL_FILE must identify the reviewed real-routing approval evidence'); }
  try {
    const links = await json('dist/.well-known/assetlinks.json');
    if (!identity || JSON.stringify(links) !== JSON.stringify(identity.assetlinks)) problems.push('Built assetlinks.json does not match the configured Play App Signing identity');
  } catch { problems.push('Built dist/.well-known/assetlinks.json is missing; generate identity then rebuild'); }
  for (const file of ['dist/index.html', 'dist/manifest.webmanifest', 'dist/sw.js', 'dist/icons/icon-192.png', 'dist/icons/icon-512.png', 'dist/icons/maskable-512.png']) {
    try { if ((await stat(join(root, file))).size === 0) throw new Error(); } catch { problems.push(`${file} is missing or empty`); }
  }
  for (const file of ['android/app/app-release-signed.apk', 'android/app/app-release-bundle.aab']) {
    try {
      const data = await readFile(join(root, file));
      if (data.length < 1024 || data[0] !== 0x50 || data[1] !== 0x4b) throw new Error();
    } catch { problems.push(`${file} is missing or not a built ZIP artifact`); }
  }
  try {
    const twa = await json('android/app/twa-manifest.json');
    if (!identity || twa.packageId !== identity.packageId || twa.host !== new URL(identity.origin).host) problems.push('Generated TWA identity does not match release identity');
  } catch { problems.push('Generated android/app/twa-manifest.json is missing'); }
  try {
    const evidence = await readFile(resolve(root, env.ANDROID_VALIDATION_FILE || '__missing_android_validation__'), 'utf8');
    if (!evidence.trim()) throw new Error();
  } catch { problems.push('ANDROID_VALIDATION_FILE must record signed Play build/domain association and physical-device scenarios'); }
  return problems;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const problems = await releaseProblems();
  if (problems.length) { console.error('RELEASE BLOCKED\n' + problems.map((value) => '- ' + value).join('\n')); process.exitCode = 1; }
  else console.log('Local release preflight passed. Human review of evidence, remote domain, account, provider terms and publication approval is still required.');
}
