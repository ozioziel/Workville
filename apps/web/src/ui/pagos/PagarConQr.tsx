import { RAMPA_SIMULADA, cotizarRampaSimulada, etiquetaEstadoRampa, formatoUsdc } from '@cryptoville/shared';
import { Suspense, lazy, useEffect, useState, type ComponentProps } from 'react';
import { useSesion } from '../../features/auth/sesion';
import { CanceladoPorUsuario } from '../../features/auth/wallet';
import { avisarCambioDeSaldo, crearRecarga, faltaParaPagar, saldoUsdc, simularPagoDelBanco, type Rampa } from '../../features/rampas/datos';
import { mensajeDeError } from '../../lib/api';
import { servicios } from '../../lib/config';
import { Aviso, Copiar, fechaCorta } from '../components/basicos';
import { Icono } from '../components/Iconos';

/**
 * «Pagar con el QR de tu banco»: para quien no tiene USDC. Pasa bolivianos a USDC con una rampa y,
 * cuando llega el USDC a su wallet, la persona confirma el pago de siempre (garantía, etapas o directo).
 * - Rampa simulada (testnet): el QR es de mentira y hay un botón para simular el pago del banco.
 * - Rampa de Pollar: el QR (o la transferencia) lo da el proveedor de cambio. SIN PROBAR con dinero real (docs/simulaciones.md).
 */
export function PagarConQr({ montoUsdc, pedidoId, onAcreditada }: { montoUsdc: string; pedidoId?: string; onAcreditada?: () => void }) {
  const rampa = servicios().rampa;
  const { usuario, firmante } = useSesion();
  const direccion = firmante?.direccion ?? usuario?.direccion ?? '';
  const [saldo, setSaldo] = useState<string | null | undefined>(undefined);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (!rampa || !direccion) return;
    saldoUsdc(direccion).then(setSaldo, () => setSaldo(null));
  }, [rampa, direccion]);

  if (!rampa || !direccion) return null;
  const alcanza = saldo !== undefined && saldo !== null && Number(saldo) >= Number(montoUsdc);

  return (
    <div className="caja pila-compacta">
      {saldo !== undefined && saldo !== null && (
        <span className="pequeno">
          Tienes <strong>{formatoUsdc(saldo)} USDC</strong> en tu wallet{alcanza ? ': te alcanza para pagar.' : '.'}
        </span>
      )}
      {!abierto ? (
        <button type="button" className={alcanza ? 'boton boton-chico' : 'boton'} onClick={() => setAbierto(true)}>
          <Icono nombre="qr" /> {alcanza ? 'Prefiero pagar con el QR de mi banco' : '¿No tienes USDC? Paga con el QR de tu banco'}
        </button>
      ) : rampa === 'simulada' ? (
        <RecargaSimulada montoUsdc={faltaParaPagar(montoUsdc, alcanza ? '0' : saldo ?? null)} direccion={direccion} pedidoId={pedidoId} onAcreditada={onAcreditada} />
      ) : (
        <RecargaConPollar
          montoUsdc={faltaParaPagar(montoUsdc, alcanza ? '0' : saldo ?? null)}
          direccion={direccion}
          esPollar={firmante?.metodo === 'pollar'}
          pedidoId={pedidoId}
          onAcreditada={onAcreditada}
        />
      )}
    </div>
  );
}

function QrDeTexto({ texto }: { texto: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    void import('qrcode').then((QR) => QR.toString(texto, { type: 'svg', errorCorrectionLevel: 'M', margin: 1 }).then(setSvg));
  }, [texto]);
  return svg ? <span className="qr-imagen" role="img" aria-label="Código QR para pagar desde el banco" dangerouslySetInnerHTML={{ __html: svg }} /> : null;
}

export function RecargaSimulada({ montoUsdc, direccion, pedidoId, onAcreditada }: { montoUsdc: string; direccion: string; pedidoId?: string; onAcreditada?: () => void }) {
  const [recarga, setRecarga] = useState<Rampa | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cotizacion = cotizarRampaSimulada('entrada', montoUsdc);

  const intentar = async (fn: () => Promise<void>) => {
    setError(null);
    setOcupado(true);
    try {
      await fn();
    } catch (e) {
      if (!(e instanceof CanceladoPorUsuario)) setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  };

  if (!recarga) {
    return (
      <div className="pila-compacta">
        <p>
          Pagas <strong>Bs {cotizacion.monto_local}</strong> desde la app de tu banco y te llegan <strong>{montoUsdc} USDC</strong> a tu wallet.
        </p>
        <span className="tenue pequeno">
          Tipo de cambio Bs {cotizacion.tipo_cambio} por dólar · comisión del cambio Bs {cotizacion.comision_local}. El QR vale {RAMPA_SIMULADA.minutosVigencia}{' '}
          minutos.
        </span>
        <Aviso tipo="aviso">Modo de prueba: este QR es simulado. Ningún banco lo cobra y no se mueve dinero real.</Aviso>
        <button type="button" className="boton boton-primario" disabled={ocupado} onClick={() => intentar(async () => setRecarga(await crearRecarga(montoUsdc, direccion, pedidoId)))}>
          {ocupado ? 'Armando el QR…' : `Ver el QR para pagar Bs ${cotizacion.monto_local}`}
        </button>
        {error && <Aviso tipo="peligro">{error}</Aviso>}
      </div>
    );
  }

  const montoLocal = Number(recarga.monto_local).toFixed(2);
  return (
    <div className="pila-compacta qr-pago">
      <strong>{recarga.estado === 'completada' ? '¡Listo! Ya tienes tus USDC' : `Escanea con la app de tu banco: Bs ${montoLocal}`}</strong>
      {recarga.estado === 'esperando_pago' && recarga.qr_payload && <QrDeTexto texto={recarga.qr_payload} />}
      <span className="pequeno">
        Referencia <code>{recarga.referencia}</code> <Copiar texto={recarga.referencia} />
      </span>
      <span className="tenue pequeno">{etiquetaEstadoRampa('entrada', recarga.estado)}{recarga.estado === 'esperando_pago' ? ` · vence ${fechaCorta(recarga.expira_en)}` : ''}</span>
      {recarga.estado === 'esperando_pago' && (
        <button
          type="button"
          className="boton boton-chico"
          disabled={ocupado}
          onClick={() =>
            intentar(async () => {
              const r = await simularPagoDelBanco(recarga.id);
              setRecarga(r);
              if (r.estado === 'completada') {
                avisarCambioDeSaldo();
                onAcreditada?.();
              }
            })
          }
        >
          {ocupado ? 'El banco está pagando…' : 'Simular el pago desde el banco (solo pruebas)'}
        </button>
      )}
      {recarga.estado === 'completada' && (
        <span className="pequeno">Llegaron {formatoUsdc(recarga.monto_usdc)} USDC a tu wallet. Ahora confirma el pago con el botón de arriba.</span>
      )}
      {(recarga.estado === 'vencida' || recarga.estado === 'fallida' || recarga.estado === 'reembolsada') && (
        <button type="button" className="boton boton-chico" onClick={() => setRecarga(null)}>
          Armar otro QR
        </button>
      )}
      {error && <Aviso tipo="peligro">{error}</Aviso>}
    </div>
  );
}

const PantallaPollar = lazy(() => import('./RecargaConPollar'));

/** Rampa con Pollar: se carga aparte porque trae el SDK de Pollar. */
export function RecargaConPollar(props: ComponentProps<typeof PantallaPollar>) {
  return (
    <Suspense fallback={<span className="tenue pequeno">Cargando…</span>}>
      <PantallaPollar {...props} />
    </Suspense>
  );
}
