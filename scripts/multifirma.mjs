#!/usr/bin/env node
// Multifirmas del contrato en testnet: pone firmantes y umbrales a las cuentas admin y árbitro.
//
//   admin   → ozioziel, daniel69zz y una llave de respaldo offline, 2 de 3 (comisiones, plazos, árbitro, pausa, actualizaciones)
//   árbitro → ozioziel y daniel69zz, 1 de 2 (resolver disputas desde el panel del árbitro)
//
// Uso (desde la raíz del proyecto). Las llaves secretas van por variables de entorno, nunca como argumento:
//   MULTIFIRMA_ADMIN_SECRETA=S… MULTIFIRMA_ARBITRO_SECRETA=S… \
//   FIRMANTE_OZIOZIEL=G… FIRMANTE_DANIEL=G… FIRMANTE_RESPALDO=G… \
//   node scripts/multifirma.mjs             muestra cómo están las cuentas y qué cambiaría (no envía nada)
//   node scripts/multifirma.mjs --aplicar   envía los cambios
//
// - Solo testnet. Para mainnet se repite a mano desde Stellar Lab (docs/multifirma.md).
// - La llave propia de cada cuenta queda con peso 0: después de aplicar ya no firma sola. Antes de enviar se revisa
//   que los firmantes alcancen el umbral más alto, para que la cuenta no quede bloqueada.
// - Si una cuenta ya está como debe, no se toca. Si la del árbitro no existe, se crea con Friendbot.
// - Esto no cambia el contrato: si el árbitro es una cuenta nueva, después hay que llamar set_arbitro (lo firma el admin).
import { BASE_FEE, Horizon, Keypair, Networks, Operation, StrKey, TransactionBuilder } from '@stellar/stellar-sdk';

const HORIZON = 'https://horizon-testnet.stellar.org';
const FRIENDBOT = 'https://friendbot.stellar.org';
const aplicar = process.argv.includes('--aplicar');
const horizon = new Horizon.Server(HORIZON);

function secreta(nombre) {
  const valor = process.env[nombre]?.trim();
  if (!valor || !StrKey.isValidEd25519SecretSeed(valor)) throw new Error(`Falta ${nombre} (la llave secreta S… de la cuenta)`);
  return Keypair.fromSecret(valor);
}

function publica(nombre) {
  const valor = process.env[nombre]?.trim();
  if (!valor || !StrKey.isValidEd25519PublicKey(valor)) throw new Error(`Falta ${nombre} (una dirección G…)`);
  return valor;
}

/** Cómo tiene que quedar cada cuenta. */
function planes() {
  const ozioziel = publica('FIRMANTE_OZIOZIEL');
  const daniel = publica('FIRMANTE_DANIEL');
  const respaldo = publica('FIRMANTE_RESPALDO');
  if (new Set([ozioziel, daniel, respaldo]).size !== 3) throw new Error('Los tres firmantes tienen que ser llaves distintas');
  return [
    { nombre: 'admin', llave: secreta('MULTIFIRMA_ADMIN_SECRETA'), firmantes: [ozioziel, daniel, respaldo], umbral: 2 },
    { nombre: 'árbitro', llave: secreta('MULTIFIRMA_ARBITRO_SECRETA'), firmantes: [ozioziel, daniel], umbral: 1 },
  ];
}

async function cargar(direccion) {
  try {
    return await horizon.loadAccount(direccion);
  } catch (e) {
    if (e?.response?.status === 404) return null;
    throw e;
  }
}

/** ¿La cuenta ya tiene exactamente estos firmantes (peso 1), la llave propia en 0 y este umbral? */
function yaEsta(cuenta, plan) {
  const t = cuenta.thresholds;
  if (t.low_threshold !== plan.umbral || t.med_threshold !== plan.umbral || t.high_threshold !== plan.umbral) return false;
  const conPeso = cuenta.signers.filter((f) => f.weight > 0);
  return conPeso.length === plan.firmantes.length && plan.firmantes.every((g) => conPeso.some((f) => f.key === g && f.weight === 1));
}

function describir(cuenta) {
  const t = cuenta.thresholds;
  const firmantes = cuenta.signers.map((f) => `${f.key === cuenta.account_id ? 'propia' : f.key} (peso ${f.weight})`).join(', ');
  return `umbrales ${t.low_threshold}/${t.med_threshold}/${t.high_threshold} · firmantes: ${firmantes}`;
}

/** Operaciones para pasar la cuenta al plan: quita firmantes que sobran, suma los que faltan y apaga la llave propia. */
function operaciones(cuenta, plan) {
  const ops = [];
  for (const f of cuenta.signers) {
    if (f.key !== cuenta.account_id && f.type === 'ed25519_public_key' && !plan.firmantes.includes(f.key)) {
      ops.push(Operation.setOptions({ signer: { ed25519PublicKey: f.key, weight: 0 } }));
    }
  }
  for (const g of plan.firmantes) ops.push(Operation.setOptions({ signer: { ed25519PublicKey: g, weight: 1 } }));
  // Todo en la misma transacción: la firma de la llave propia se revisa antes de aplicar las operaciones.
  ops.push(Operation.setOptions({ masterWeight: 0, lowThreshold: plan.umbral, medThreshold: plan.umbral, highThreshold: plan.umbral }));
  return ops;
}

async function configurar(plan) {
  const direccion = plan.llave.publicKey();
  console.log(`\n${plan.nombre}: ${direccion}`);
  if (plan.firmantes.length < plan.umbral) throw new Error(`${plan.nombre}: con ${plan.firmantes.length} firmantes no se llega al umbral ${plan.umbral}`);
  let cuenta = await cargar(direccion);
  if (!cuenta) {
    console.log('  No existe en la red.');
    if (!aplicar) return console.log('  Con --aplicar se crea con Friendbot y se configura.');
    const r = await fetch(`${FRIENDBOT}?addr=${direccion}`);
    if (!r.ok) throw new Error(`Friendbot no creó la cuenta (${r.status})`);
    cuenta = await cargar(direccion);
    console.log('  ✓ Creada con Friendbot');
  }
  console.log(`  Ahora: ${describir(cuenta)}`);
  if (yaEsta(cuenta, plan)) return console.log(`  ✓ Ya es ${plan.umbral} de ${plan.firmantes.length}: no se cambia nada`);
  const propia = cuenta.signers.find((f) => f.key === direccion);
  if (!propia || propia.weight < cuenta.thresholds.high_threshold) {
    throw new Error(`${plan.nombre}: la llave propia ya no alcanza para cambiar los firmantes. Hazlo desde Stellar Lab con los firmantes actuales.`);
  }
  console.log(`  Queda: umbrales ${plan.umbral}/${plan.umbral}/${plan.umbral} · firmantes: ${plan.firmantes.join(', ')} (peso 1) · llave propia con peso 0`);
  if (!aplicar) return console.log('  Con --aplicar se envía.');
  const tx = new TransactionBuilder(cuenta, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET }).setTimeout(120);
  for (const op of operaciones(cuenta, plan)) tx.addOperation(op);
  const firmada = tx.build();
  firmada.sign(plan.llave);
  const r = await horizon.submitTransaction(firmada);
  console.log(`  ✓ Listo: ${r.hash}`);
}

try {
  for (const plan of planes()) await configurar(plan);
  if (!aplicar) console.log('\nNo se envió nada. Revisa los cambios y vuelve a correrlo con --aplicar.');
} catch (e) {
  const extra = e?.response?.data?.extras?.result_codes;
  console.error(`\n✗ ${e.message}${extra ? ` ${JSON.stringify(extra)}` : ''}`);
  process.exitCode = 1;
}
