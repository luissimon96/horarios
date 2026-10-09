import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const requiredFiles = [
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'src/styles.css',
  'src/i18n.js',
  'src/variant-labels.js',
  'src/route-engine.js',
  'src/map-ui.js',
  'src/schedule-export.js',
  'src/address-search.js',
  'src/app.js',
  'src/bootstrap.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

const missing = requiredFiles.filter((relativePath) => !fs.existsSync(path.join(projectRoot, relativePath)));
if (missing.length > 0) {
  console.error('Arquivos obrigatórios ausentes:');
  for (const file of missing) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

const indexHtml = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
const checks = [
  ['link para styles.css', /<link[^>]+href=["']src\/styles\.css["'][^>]*>/i.test(indexHtml)],
  ['script do app.js', /<script[^>]+src=["']src\/app\.js["'][^>]*><\/script>/i.test(indexHtml)],
  ['ordem dos módulos do app', /<script src="src\/variant-labels\.js"><\/script>\s*<script src="src\/i18n\.js"><\/script>\s*<script src="src\/route-engine\.js"><\/script>\s*<script src="src\/map-ui\.js"><\/script>\s*<script src="src\/schedule-export\.js"><\/script>\s*<script src="src\/address-search\.js"><\/script>\s*<script src="src\/app\.js"><\/script>\s*<script src="src\/bootstrap\.js"><\/script>/i.test(indexHtml)],
  ['manifest da PWA', /<link[^>]+href=["']manifest\.webmanifest["'][^>]*>/i.test(indexHtml)],
  ['arquivo de serviço offline', fs.existsSync(path.join(projectRoot, 'sw.js'))],
  ['bootstrap com service worker', /serviceWorker/.test(fs.readFileSync(path.join(projectRoot, 'src/bootstrap.js'), 'utf8'))],
];

let failed = 0;
for (const [label, ok] of checks) {
  if (ok) {
    console.log(`OK: ${label}`);
  } else {
    console.error(`FALHA: ${label}`);
    failed += 1;
  }
}

if (failed > 0) {
  console.error(`Validação falhou com ${failed} problema(s).`);
  process.exit(1);
}

console.log('Validação concluída com sucesso.');
