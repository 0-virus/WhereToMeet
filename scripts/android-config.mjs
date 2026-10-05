import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function androidIdentity(env) {
  let url;
  try { url = new URL(env.APP_ORIGIN); } catch { throw new Error('APP_ORIGIN must be an explicit public HTTPS origin'); }
  const host = url.hostname;
  if (url.protocol !== 'https:' || ![url.origin, url.origin + '/'].includes(env.APP_ORIGIN) || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash || !host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':') || /(?:^|\.)(?:localhost|local|test|invalid|example|example\.com|example\.org|example\.net)$/.test(host)) throw new Error('APP_ORIGIN must be a public HTTPS origin with no path, credentials, port or placeholder');
  const packageId = env.ANDROID_PACKAGE_ID || '';
  if (!/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/.test(packageId) || /(?:^|\.)(?:example|placeholder|test)(?:\.|$)/.test(packageId)) throw new Error('ANDROID_PACKAGE_ID must be the permanent reverse-domain Android identifier');
  const fingerprint = (env.PLAY_APP_SIGNING_SHA256 || '').trim().toUpperCase();
  if (!/^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(fingerprint) || new Set(fingerprint.split(':')).size < 2) throw new Error('PLAY_APP_SIGNING_SHA256 must be the real 32-byte colon-separated Play App Signing certificate fingerprint');
  return {
    origin: url.origin, packageId,
    assetlinks: [{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: packageId, sha256_cert_fingerprints: [fingerprint] } }],
  };
}

export async function writeAndroidConfig(env = process.env) {
  const identity = androidIdentity(env);
  await mkdir('public/.well-known', { recursive: true });
  await mkdir('android', { recursive: true });
  await writeFile('public/.well-known/assetlinks.json', JSON.stringify(identity.assetlinks, null, 2) + '\n');
  await writeFile('android/identity.json', JSON.stringify({ origin: identity.origin, packageId: identity.packageId, manifestUrl: identity.origin + '/manifest.webmanifest' }, null, 2) + '\n');
  console.log('Validated Android identity and public Digital Asset Links written. Rebuild web assets before deployment.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { await writeAndroidConfig(); } catch (error) { console.error('BLOCKED: ' + error.message); process.exitCode = 1; }
}
