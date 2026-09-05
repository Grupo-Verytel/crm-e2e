const { copyFileSync, existsSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');

const source = join(__dirname, '..', '..', 'openapi', 'crm-mep.yaml');
const destDir = join(__dirname, '..', 'public', 'openapi');
const dest = join(destDir, 'crm-mep.yaml');

if (!existsSync(source)) {
  process.exit(0);
}

mkdirSync(destDir, { recursive: true });
copyFileSync(source, dest);
