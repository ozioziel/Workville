// USDC de Circle en Stellar: el token de pago en testnet y en mainnet.
// Es un activo clásico (código + emisor) que los contratos usan por su Stellar Asset Contract (SAC).
// Fuente del emisor: https://developers.circle.com/stablecoins/usdc-contract-addresses
// El contrato es el SAC de ese activo (Asset.contractId(passphrase)); su name() devuelve «USDC:<emisor>».
import type { RedStellar } from './lab-links.js';

export interface ActivoClasico {
  codigo: string;
  emisor: string;
}

export const USDC_CIRCLE: Record<RedStellar, ActivoClasico & { contrato: string }> = {
  testnet: {
    codigo: 'USDC',
    emisor: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    contrato: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
  },
  mainnet: {
    codigo: 'USDC',
    emisor: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
    contrato: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75',
  },
};

/** Faucet de Circle para pedir USDC de testnet (elige la red Stellar). */
export const FAUCET_USDC_TESTNET = 'https://faucet.circle.com';

/**
 * Lee el activo clásico detrás de un SAC a partir de su name() («USDC:G…»).
 * Devuelve null para un token que no es un SAC (por ejemplo, el «USDC de prueba» propio), que no necesita trustline.
 */
export function activoDeNombreSac(nombre: unknown): ActivoClasico | null {
  if (typeof nombre !== 'string') return null;
  const m = /^([A-Za-z0-9]{1,12}):(G[A-Z2-7]{55})$/.exec(nombre);
  return m ? { codigo: m[1], emisor: m[2] } : null;
}
