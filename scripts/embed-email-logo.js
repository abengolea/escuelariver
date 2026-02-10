const fs = require('fs');
const path = require('path');
const base64Path = path.join(__dirname, '../src/lib/email-logo-base64.txt');
const outPath = path.join(__dirname, '../src/lib/email-logo-base64.ts');
const b = fs.readFileSync(base64Path, 'utf8').trim();
fs.writeFileSync(outPath, `/** Base64 del logo River para incrustar en emails (evita imagen rota). */\nexport const EMAIL_LOGO_BASE64 = "${b}";\n`, 'utf8');
console.log('OK: email-logo-base64.ts creado');
