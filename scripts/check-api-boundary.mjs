import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, relative } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const appRoot = resolve(root, 'src/app');
const allowed = new Set([
  'src/app/core/auth/auth.service.ts',
  'src/app/core/supabase/supabase.service.ts',
  'src/app/core/api/api-auth.interceptor.ts',
]);
const forbidden = [
  /injectSupabase\s*\(/,
  /\bsupabase\s*\.\s*from\s*\(/,
  /\bsupabase\s*\.\s*rpc\s*\(/,
  /\bsupabase\s*\.\s*storage\b/,
  /\bsupabase\s*\.\s*functions\b/,
  /createClient\s*\(/,
];

function files(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = resolve(directory, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

const violations = [];
for (const path of files(appRoot).filter((value) => value.endsWith('.ts'))) {
  const name = relative(root, path);
  if (allowed.has(name)) continue;
  const source = readFileSync(path, 'utf8');
  if (forbidden.some((pattern) => pattern.test(source))) violations.push(name);
}

const generatedTypes = readFileSync(
  resolve(appRoot, 'core/api/generated/kolss-api.types.ts'),
  'utf8',
);
if (!generatedTypes.includes("API_CONTRACT_VERSION = '1.0.0'")) {
  violations.push('Generated API contract is not pinned to 1.0.0');
}

const manifest = JSON.parse(
  readFileSync(resolve(appRoot, 'core/api/generated/kolss-api.contract.json'), 'utf8'),
);
if (manifest.version !== '1.0.0') violations.push('Generated API manifest is not v1.0.0');
const backendContract = resolve(root, '../kolss-platform-api/api/openapi.yaml');
if (existsSync(backendContract)) {
  const hash = createHash('sha256').update(readFileSync(backendContract)).digest('hex');
  if (hash !== manifest.sha256) {
    violations.push('Generated API client is stale relative to kolss-platform-api/api/openapi.yaml');
  }
}

if (violations.length) {
  console.error('Direct Supabase business API access or contract drift detected:\n' + violations.join('\n'));
  process.exit(1);
}
console.log('API boundary verified: Supabase browser access is auth-only; contract v1.0.0.');
