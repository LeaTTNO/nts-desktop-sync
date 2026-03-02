import { readdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

const distDir = 'dist';

if (!existsSync(distDir)) {
  console.log('⚠️  dist/ mappe finnes ikke ennå – hopper over cleanup');
  process.exit(0);
}

const files = readdirSync(distDir);
let deleted = 0;

for (const file of files) {
  if (file.endsWith('.exe') || file.endsWith('.blockmap') || file.endsWith('.exe.blockmap')) {
    const fullPath = join(distDir, file);
    rmSync(fullPath, { force: true });
    console.log(`🗑️  Slettet: ${fullPath}`);
    deleted++;
  }
}

if (deleted === 0) {
  console.log('✅ Ingen gamle .exe / .blockmap filer å rydde opp');
} else {
  console.log(`✅ Ryddet opp ${deleted} gamle fil(er) fra dist/`);
}
