// «Pagar con el QR de tu banco» con Pollar: cotización, datos que pide el proveedor, pantalla de pago (QR,
// transferencia o página del proveedor), firmas de los tramos, KYC del proveedor, co-firma y reintentos.
// Se carga aparte (React.lazy) porque trae el SDK de Pollar. SIN PROBAR con dinero real (docs/simulaciones.md).
import { USDC_CIRCLE, formatoUsdc } from '@cryptoville/shared';
import type { RampOrder } from '@pollar/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { clientePollar, firmarTransaccionPollar } from '../../features/auth/pollar';
import { avisarCambioDeSaldo, avisarEstadoPollar, registrarOrdenPollar } from '../../features/rampas/datos';
import {
  aprobarCofirma,
  cotizarRecarga,
  crearOrden,
  erroresDeCampos,
  firmarTramo,
  hacerPasoWallet,
  prepararFirmas,
  reintentar,
  rutasDeRecarga,
  seguirOrden,
  vistaOrden,
  yaPague,
  type ClienteRampa,
  type Cotizacion,
  type RutaRampa,
  type VistaOrden,
} from '../../features/rampas/pollar';
import { mensajeDeError } from '../../lib/api';
import { obtenerConfig, servicios } from '../../lib/config';
import { Aviso, Copiar, fechaCorta } from '../components/basicos';
import { Icono } from '../components/Iconos';

type Cliente = ClienteRampa & Parameters<typeof firmarTransaccionPollar>[0];

function minutos(segundos: number | null): string | null {
  if (segundos === null) return null;
  return segundos < 90 ? 'en un minuto' : `en unos ${Math.round(segundos / 60)} minutos`;
}

export default function RecargaConPollar({
  montoUsdc,
  direccion,
  esPollar,
  pedidoId,
  onAcreditada,
}: {
  montoUsdc: string;
  direccion: string;
  esPollar: boolean;
  pedidoId?: string;
  onAcreditada?: () => void;
}) {
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [rutas, setRutas] = useState<RutaRampa[] | null>(null);
  const [elegida, setElegida] = useState(0);
  const [cotizacion, setCotizacion] = useState<Cotizacion | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [vista, setVista] = useState<VistaOrden | null>(null);
  const [rampaId, setRampaId] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const ultimoEstado = useRef<string | null>(null);
  const seguimiento = useRef<AbortController | null>(null);

  // El cliente de Pollar y las rutas del país (solo con la sesión de Pollar).
  useEffect(() => {
    if (!esPollar) return;
    let vivo = true;
    void (async () => {
      try {
        const c = (await clientePollar(servicios().pollar_api_key!, obtenerConfig().red)) as Cliente;
        const r = await rutasDeRecarga(c, servicios().rampa_paises ?? ['BO'], USDC_CIRCLE[obtenerConfig().red].emisor);
        if (!vivo) return;
        setCliente(c);
        setRutas(r);
      } catch (e) {
        if (vivo) setError(mensajeDeError(e));
      }
    })();
    return () => {
      vivo = false;
    };
  }, [esPollar]);

  // Las firmas de los tramos en Stellar las hace la sesión de Pollar, después de revisar que solo gasten de esta wallet.
  useEffect(() => {
    if (!cliente) return;
    return prepararFirmas(cliente, direccion, (xdr) => firmarTransaccionPollar(cliente, xdr));
  }, [cliente, direccion]);

  useEffect(() => () => seguimiento.current?.abort(), []);

  const ruta = rutas?.[elegida] ?? null;

  const cotizar = useCallback(async () => {
    if (!cliente || !ruta) return;
    setError(null);
    setOcupado('Cotizando…');
    try {
      setCotizacion(await cotizarRecarga(cliente, ruta, montoUsdc));
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(null);
    }
  }, [cliente, ruta, montoUsdc]);

  useEffect(() => {
    void cotizar();
  }, [cotizar]);

  /** Cada lectura de la orden: se muestra y, si cambió el estado, se avisa a WorkVille (al final, con la transacción del USDC). */
  const alCambiar = useCallback(
    (orden: RampOrder, id: string) => {
      const v = vistaOrden(orden);
      setVista(v);
      const clave = `${orden.state}:${v.hashUsdc ?? ''}`;
      if (ultimoEstado.current === clave) return;
      ultimoEstado.current = clave;
      if (orden.state === 'completed' && !v.hashUsdc) return;
      void avisarEstadoPollar(id, orden.state, v.hashUsdc)
        .then((r) => {
          if (r.estado === 'completada') {
            avisarCambioDeSaldo();
            onAcreditada?.();
          }
        })
        .catch((e: unknown) => {
          // Si el aviso no llegó, la próxima lectura de la orden lo vuelve a mandar.
          if (ultimoEstado.current === clave) ultimoEstado.current = null;
          setError(mensajeDeError(e));
        });
    },
    [onAcreditada],
  );

  const seguir = useCallback(
    (orden: RampOrder, id: string) => {
      alCambiar(orden, id);
      seguimiento.current?.abort();
      const control = new AbortController();
      seguimiento.current = control;
      void seguirOrden(cliente!, orden.id, (o) => alCambiar(o, id), control.signal).catch(() => undefined);
    },
    [alCambiar, cliente],
  );

  const intentar = async (texto: string, fn: () => Promise<void>) => {
    setError(null);
    setOcupado(texto);
    try {
      await fn();
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(null);
    }
  };

  if (!esPollar) return <Aviso tipo="info">Para pagar con el QR de tu banco, entra con tu correo (cuenta de Pollar).</Aviso>;
  if (!rutas) return error ? <Aviso tipo="peligro">{error}</Aviso> : <span className="tenue pequeno">Buscando formas de pago…</span>;
  if (!rutas.length) return <Aviso tipo="info">Todavía no hay un proveedor de cambio para tu país.</Aviso>;

  // ---- Orden en curso -----------------------------------------------------
  if (vista && rampaId && cliente) {
    const accion = (texto: string, fn: () => Promise<RampOrder>) => intentar(texto, async () => seguir(await fn(), rampaId));
    return (
      <div className="pila-compacta qr-pago">
        <strong>{vista.titulo}</strong>
        {vista.qr && 'svg' in vista.qr && <span className="qr-imagen" role="img" aria-label="Código QR para pagar desde el banco" dangerouslySetInnerHTML={{ __html: vista.qr.svg }} />}
        {vista.qr && 'src' in vista.qr && <img className="qr-imagen" src={vista.qr.src} alt="Código QR para pagar desde el banco" />}
        {vista.textoQr && (
          <span className="pequeno">
            {vista.textoQr.etiqueta}: <code>{vista.textoQr.valor}</code> <Copiar texto={vista.textoQr.valor} />
          </span>
        )}
        {vista.datos.map((d) => (
          <span key={d.etiqueta} className="pequeno">
            {d.etiqueta}: <strong>{d.valor}</strong> <Copiar texto={d.valor} />
          </span>
        ))}
        {vista.sinCodigo && <Aviso tipo="aviso">El proveedor no mandó el código para pagar. Espera un momento o vuelve a intentar.</Aviso>}
        {vista.pagoCerrado && <Aviso tipo="aviso">Se cerró el plazo para pagar esta orden.</Aviso>}
        {vista.enlace && (
          <a className="boton boton-chico" href={vista.enlace.url} target="_blank" rel="noreferrer">
            {vista.enlace.texto} <Icono nombre="enlace" tamano={14} />
          </a>
        )}
        {vista.nota && <span className="pequeno">{vista.nota}</span>}
        {vista.vence && !vista.pagoCerrado && vista.estado !== 'completada' && <span className="tenue pequeno">Vence {fechaCorta(vista.vence)}</span>}

        {vista.tipoAccion === 'FIAT_PAYMENT' && !vista.pagoCerrado && (
          <button type="button" className="boton boton-chico" disabled={Boolean(ocupado)} onClick={() => accion('Preguntando al proveedor…', () => yaPague(cliente, vista.id))}>
            {ocupado ?? 'Ya pagué'}
          </button>
        )}
        {vista.puedeFirmar && (
          <button type="button" className="boton boton-primario" disabled={Boolean(ocupado)} onClick={() => accion('Firmando…', () => firmarTramo(cliente, vista))}>
            <Icono nombre="escudo" /> {ocupado ?? 'Autorizar el envío'}
          </button>
        )}
        {vista.puedeAprobar && (
          <button type="button" className="boton boton-primario" disabled={Boolean(ocupado)} onClick={() => accion('Aprobando…', () => aprobarCofirma(cliente, vista))}>
            {ocupado ?? 'Aprobar desde este dispositivo'}
          </button>
        )}

        {vista.tramos.length > 1 && (
          <ol className="lista-pasos pequeno">
            {vista.tramos.map((t, i) => (
              <li key={i} className={t.estado === 'done' ? 'tenue' : undefined}>
                {t.estado === 'done' ? '✓ ' : t.estado === 'failed' ? '✗ ' : t.estado === 'active' ? '… ' : ''}
                {t.titulo}
                {t.nota && <span className="tenue"> · {t.nota}</span>}
              </li>
            ))}
          </ol>
        )}
        {vista.recibes && vista.estado !== 'completada' && (
          <span className="tenue pequeno">
            Te llegan {vista.recibes.estimado ? 'unos ' : ''}
            {formatoUsdc(vista.recibes.monto)} {vista.recibes.unidad}
          </span>
        )}
        {vista.estado === 'completada' && vista.recibes && (
          <span className="pequeno">Llegaron {formatoUsdc(vista.recibes.monto)} USDC a tu wallet. Ahora confirma el pago con el botón de arriba.</span>
        )}

        {/* La orden terminó en Pollar pero WorkVille no se enteró (por ejemplo, sin conexión): se vuelve a leer y a avisar. */}
        {vista.estado === 'completada' && error && (
          <button type="button" className="boton boton-chico" disabled={Boolean(ocupado)} onClick={() => accion('Revisando…', () => cliente.getRampOrder(vista.id))}>
            {ocupado ?? 'Volver a revisar'}
          </button>
        )}
        {vista.falla && <Aviso tipo={vista.reintentable ? 'aviso' : 'peligro'}>{vista.falla}</Aviso>}
        {vista.falla && vista.detenida && vista.reintentable && (
          <button type="button" className="boton boton-chico" disabled={Boolean(ocupado)} onClick={() => accion('Reintentando…', () => reintentar(cliente, vista.id))}>
            {ocupado ?? 'Reintentar'}
          </button>
        )}
        {vista.detenida && vista.estado !== 'completada' && !vista.reintentable && (
          <button
            type="button"
            className="boton boton-chico"
            onClick={() => {
              seguimiento.current?.abort();
              setVista(null);
              setRampaId(null);
              ultimoEstado.current = null;
              void cotizar();
            }}
          >
            Empezar de nuevo
          </button>
        )}
        {error && <Aviso tipo="peligro">{error}</Aviso>}
      </div>
    );
  }

  // ---- Cotización ---------------------------------------------------------
  const lista = cotizacion?.tipo === 'lista' ? cotizacion : null;
  const errores = lista ? erroresDeCampos(lista.resumen.campos, valores) : {};

  const pagar = () =>
    intentar('Armando la orden…', async () => {
      if (!lista || !cliente || !ruta) return;
      const orden = await crearOrden(cliente, lista.cotizacion, valores, direccion);
      const v = vistaOrden(orden);
      const r = await registrarOrdenPollar({
        orden_id: orden.id,
        direccion,
        pais: ruta.pais.pais,
        moneda: ruta.pais.moneda,
        monto_usdc: lista.resumen.recibes,
        monto_local: lista.resumen.pagas,
        comision_local: lista.resumen.comision,
        estado: orden.state,
        ...(v.vence ? { expira_en: v.vence } : {}),
        ...(pedidoId ? { pedido_id: pedidoId } : {}),
      });
      setRampaId(r.id);
      ultimoEstado.current = `${orden.state}:`;
      seguir(orden, r.id);
    });

  return (
    <div className="pila-compacta">
      {rutas.length > 1 && (
        <label className="pequeno">
          Cómo pagas{' '}
          <select className="campo" value={elegida} onChange={(e) => setElegida(Number(e.target.value))}>
            {rutas.map((r, i) => (
              <option key={i} value={i}>
                {r.pais.nombre} · {r.ruta.fiat.rail === r.pais.metodo ? r.pais.etiquetaMetodo : r.ruta.fiat.rail}
              </option>
            ))}
          </select>
        </label>
      )}

      {lista && (
        <>
          <p>
            Pagas <strong>{lista.resumen.pagas} {lista.resumen.moneda}</strong> y te llegan <strong>{formatoUsdc(lista.resumen.recibes)} USDC</strong> a tu wallet.
          </p>
          <span className="tenue pequeno">
            Comisión del cambio {lista.resumen.comision} {lista.resumen.moneda}
            {minutos(lista.resumen.segundos) ? ` · llega ${minutos(lista.resumen.segundos)}` : ''} · el precio vale hasta {fechaCorta(lista.resumen.vence)}. El cambio lo hace el
            proveedor de Pollar, no WorkVille.
          </span>
          {lista.resumen.campos.map((f) => (
            <label key={f.key} className="pequeno pila-compacta">
              {f.label}
              {f.optional ? ' (opcional)' : ''}
              {f.type === 'select' ? (
                <select className="campo" value={valores[f.key] ?? ''} onChange={(e) => setValores({ ...valores, [f.key]: e.target.value })}>
                  <option value="">Elige…</option>
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="campo"
                  type={f.type}
                  value={valores[f.key] ?? ''}
                  placeholder={f.placeholder}
                  onChange={(e) => setValores({ ...valores, [f.key]: e.target.value })}
                />
              )}
              {f.hint && <span className="tenue">{f.hint}</span>}
            </label>
          ))}
          <button type="button" className="boton boton-primario" disabled={Boolean(ocupado) || Object.keys(errores).length > 0} onClick={pagar}>
            {ocupado ?? `Pagar ${lista.resumen.pagas} ${lista.resumen.moneda}`}
          </button>
          {Object.values(errores)[0] && Object.keys(valores).length > 0 && <span className="tenue pequeno">{Object.values(errores)[0]}</span>}
        </>
      )}

      {cotizacion?.tipo === 'sin_ruta' && (
        <>
          <Aviso tipo="info">{cotizacion.requisito?.mensaje ?? cotizacion.mensaje}</Aviso>
          {cotizacion.faltaTrustline && <span className="pequeno">Activa USDC desde tu saldo («Activar USDC») y vuelve a intentar.</span>}
          {cotizacion.pasoWallet && (
            <button
              type="button"
              className="boton boton-chico"
              disabled={Boolean(ocupado)}
              onClick={() =>
                intentar(cotizacion.pasoWallet!.ocupado, async () => {
                  const { recuperacion } = await hacerPasoWallet(cliente!, cotizacion.pasoWallet!);
                  if (recuperacion) setAviso('Tu wallet nueva necesita una forma de recuperarla antes de firmar: agrégala en tu cuenta de Pollar.');
                  await cotizar();
                })
              }
            >
              {ocupado ?? cotizacion.pasoWallet.boton}
            </button>
          )}
          <button type="button" className="boton boton-chico" disabled={Boolean(ocupado)} onClick={() => void cotizar()}>
            Volver a cotizar
          </button>
        </>
      )}

      {!cotizacion && ocupado && <span className="tenue pequeno">{ocupado}</span>}
      {aviso && <Aviso tipo="aviso">{aviso}</Aviso>}
      {error && <Aviso tipo="peligro">{error}</Aviso>}
    </div>
  );
}
