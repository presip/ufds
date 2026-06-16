import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = path.join(__dirname, '..', '..', '..', '..', 'ufds-spec', 'examples');
const LOCAL_FIXTURES_DIR = path.join(__dirname, '..', 'fixtures');

export function loadFixture(name) {
  const file = path.join(EXAMPLES_DIR, name);
  return JSON.parse(readFileSync(file, 'utf8'));
}

/** Loads a synthetic fixture from sdk/javascript/tests/fixtures (not spec-owned). */
export function loadLocalFixture(name) {
  const file = path.join(LOCAL_FIXTURES_DIR, name);
  return JSON.parse(readFileSync(file, 'utf8'));
}
