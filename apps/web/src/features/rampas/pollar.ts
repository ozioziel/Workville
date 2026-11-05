// Rampa REAL con Pollar (mainnet): bolivianos → USDC con el QR del banco, desde el navegador y con la sesión
// de Pollar de la persona (Google o correo). WorkVille no toca el dinero: lo cambia el proveedor de Pollar.
// Desde @pollar/core 0.12 una rampa es una orden (ruta → cotización → orden → seguir la orden).
//
// ⚠ SIN PROBAR: este camino se usa solo si `getRampRoutes('ONRAMP')` trae una ruta de Bolivia con QR que
// entregue USDC en Stellar. La interfaz propia (datos del pagador, firmas de tramos, KYC) llega con la rampa con Pollar.
// Qué falta revisar: docs/simulaciones.md, sección «Rampa real con Pollar».
import type { PollarClient, RampOrder, RampRoutesResponse } from '@pollar/core';

export const PAIS_RAMPA = 'BO';

type Ruta = RampRoutesResponse['routes'][number];

export interface RecargaPollar {
  txId: string;
  estado: 'pending' | 'processing' | 'completed' | 'failed';
  /** Si la rampa pide verificar la identidad antes (su propio KYC). */
  kycUrl: string | null;
  /** Imagen del QR lista para mostrar (SVG en texto o PNG en base64). */
  qr: { svg: string } | { src: string } | null;
  /** Datos para pagar sin escanear (monto, referencia, cuenta…), ya con su etiqueta. */
  campos: { etiqueta: string; valor: string; copiable: boolean }[];
}

/** Ruta de Bolivia con QR que entrega USDC en Stellar, si la app de Pollar la tiene. */
async function rutaBolivia(c: PollarClient): Promise<Ruta | null> {
  const { routes } = await c.getRampRoutes('ONRAMP');
  return (
    routes.find(
      (r) => r.fiat.country.toUpperCase() === PAIS_RAMPA && r.fiat.rail === 'QR' && r.asset.chain === 'STELLAR' && r.asset.code === 'USDC',
    ) ?? null
  );
}

/** ¿La app de Pollar tiene rampa para Bolivia? (necesita la sesión de Pollar). */
export async function hayRampaBolivia(c: PollarClient): Promise<{ moneda: string } | null> {
  const ruta = await rutaBolivia(c);
  return ruta ? { moneda: ruta.fiat.currency } : null;
}

/** Cotiza y crea la orden; devuelve el QR para pagar desde el banco. */
export async function crearRecargaPollar(c: PollarClient, montoLocal: number, moneda: string, direccion: string): Promise<RecargaPollar> {
  const ruta = await rutaBolivia(c);
  if (!ruta || ruta.fiat.currency !== moneda) throw new Error('El proveedor de cambio ya no tiene esta forma de pago');
  const { quotes } = await c.quoteRamp({
    direction: 'ONRAMP',
    fiat: { currency: ruta.fiat.currency, rail: ruta.fiat.rail, country: ruta.fiat.country },
    asset: { code: ruta.asset.code, identifier: ruta.asset.identifier, chain: ruta.asset.chain },
    amount: { value: montoLocal.toFixed(2), denomination: 'in' },
  });
  const cotizacion = quotes[0];
  if (!cotizacion) throw new Error('El proveedor de cambio no tiene una forma de pago para este monto');
  // Pollar entrega en la wallet de la sesión: si el último tramo dice otra, no se sigue.
  const destino = cotizacion.legs.at(-1)?.wallet?.address;
  if (destino && destino !== direccion) throw new Error('El cambio llegaría a otra wallet: vuelve a entrar con tu cuenta');
  return aRecarga(await c.createRampOrder({ quoteId: cotizacion.quoteId }));
}

export async function estadoRecargaPollar(c: PollarClient, txId: string): Promise<RecargaPollar> {
  return aRecarga(await c.getRampOrder(txId));
}

function aRecarga(orden: RampOrder): RecargaPollar {
  const accion = orden.pendingAction;
  let qr: RecargaPollar['qr'] = null;
  let campos: RecargaPollar['campos'] = [];
  if (accion?.kind === 'FIAT_PAYMENT') {
    const i = accion.instructions;
    if (i.kind === 'qr') {
      const imagen = i.scannable?.image;
      if (imagen) {
        // Los SVG de Pollar se pueden insertar tal cual (inlineSafe); los PNG del proveedor van como imagen.
        if (imagen.mediaType === 'image/svg+xml' && imagen.encoding === 'utf8' && imagen.inlineSafe) qr = { svg: imagen.data };
        else qr = { src: `data:${imagen.mediaType};${imagen.encoding === 'base64' ? 'base64' : 'utf8'},${imagen.data}` };
      }
      campos = [{ etiqueta: 'Monto', valor: `${i.amount} ${i.currency}`, copiable: true }];
    } else if (i.kind === 'bank_transfer') {
      campos = [
        { etiqueta: 'Monto', valor: `${i.amount} ${i.currency}`, copiable: true },
        ...i.details.map((d) => ({ etiqueta: d.label, valor: d.value, copiable: true })),
        ...(i.reference ? [{ etiqueta: 'Referencia', valor: i.reference, copiable: true }] : []),
      ];
    }
  }
  return {
    txId: orden.id,
    estado: estadoDe(orden.state),
    kycUrl: accion?.kind === 'KYC' ? accion.url : null,
    qr,
    campos,
  };
}

function estadoDe(estado: string): RecargaPollar['estado'] {
  if (estado === 'completed') return 'completed';
  if (estado === 'failed' || estado === 'refunded') return 'failed';
  if (estado === 'processing' || estado === 'settling_onchain') return 'processing';
  return 'pending';
}
