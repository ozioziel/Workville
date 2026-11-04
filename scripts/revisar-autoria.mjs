// Revisa que ningún commit ni PR atribuya autoría a una IA (regla del equipo, ver CLAUDE.md).
// Lo usan el hook local (.githooks/commit-msg) y el CI (.github/workflows/ci.yml).
//
//   node scripts/revisar-autoria.mjs --archivo .git/COMMIT_EDITMSG   un mensaje (hook commit-msg)
//   node scripts/revisar-autoria.mjs --rango origin/main..HEAD       todos los commits de un rango
//   node scripts/revisar-autoria.mjs --texto "título y descripción"  un texto suelto (PR)
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PROHIBIDO = [
  /^co-authored-by:.*\b(claude|anthropic|openai|chatgpt|copilot|codex|gemini)\b/im,
  /^co-authored-by:.*noreply@anthropic\.com/im,
  /generated with \[?claude code/i,
];

/** Devuelve la primera línea que rompe la regla, o null si el texto está limpio. */
function problemaEn(texto) {
  for (const regla of PROHIBIDO) {
    const m = texto.match(regla);
    if (m) return m[0].trim();
  }
  return null;
}

const [opcion, valor] = process.argv.slice(2);
if (!opcion || valor === undefined) {
  console.error('Uso: revisar-autoria.mjs --archivo <ruta> | --rango <a..b> | --texto <texto>');
  process.exit(2);
}

const fallas = [];
if (opcion === '--archivo') {
  const p = problemaEn(readFileSync(valor, 'utf8'));
  if (p) fallas.push(`el mensaje del commit: «${p}»`);
} else if (opcion === '--rango') {
  const salida = execFileSync('git', ['log', '--format=%H%x00%B%x01', valor], { encoding: 'utf8' });
  for (const bloque of salida.split('\x01')) {
    const [hash, mensaje = ''] = bloque.trim().split('\x00');
    if (!hash) continue;
    const p = problemaEn(mensaje);
    if (p) fallas.push(`el commit ${hash.slice(0, 7)}: «${p}»`);
  }
} else if (opcion === '--texto') {
  const p = problemaEn(valor);
  if (p) fallas.push(`el título o la descripción del PR: «${p}»`);
} else {
  console.error(`Opción desconocida: ${opcion}`);
  process.exit(2);
}

if (fallas.length > 0) {
  console.error('Los commits y PR son del equipo: no pueden atribuir autoría a una IA.');
  for (const f of fallas) console.error(`  ✗ ${f}`);
  console.error('Quita esas líneas (git commit --amend, o git rebase para commits anteriores) y vuelve a intentar.');
  process.exit(1);
}
