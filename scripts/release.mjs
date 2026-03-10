/**
 * Release script: bumps patch version, builds, commits, pushes, and creates GitHub release.
 * Usage: npm run release
 * Optionally pass release notes: npm run release -- "my notes"
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { cwd: root, stdio: 'inherit' });
}

// 1. Get version from package.json BEFORE bump (for display only)
const pkgBefore = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
console.log(`\n📦 Current version: ${pkgBefore.version}`);

// 2. Bump patch version
run('npm version patch --no-git-tag-version');

// 3. Read new version
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const version = pkg.version;
console.log(`\n🚀 Releasing v${version}\n`);

// 4. Build
run('npm run build');

// 5. Commit and push
run(`git add -A`);
run(`git commit -m "v${version}"`);
run(`git push`);

// 6. Create GitHub release with exe + blockmap + latest.yml
const exe = `dist/NTS-Desktop-Sync-Setup-${version}.exe`;
const blockmap = `dist/NTS-Desktop-Sync-Setup-${version}.exe.blockmap`;
const latestYml = `dist/latest.yml`;
const notes = process.argv[2] || `v${version}`;

run(`gh release create v${version} "${exe}" "${blockmap}" "${latestYml}" --title "v${version}" --notes "${notes}"`);

console.log(`\n✅ Released v${version} successfully!`);
