import { useEffect, useLayoutEffect, useMemo, useRef, type ComponentType } from 'react';
import type { DocumentoLegal } from '@cryptoville/shared';
import { obtenerConfig, plazosV2, reglas, servicios } from '../../lib/config';
import { useIdioma } from '../../lib/idioma';
import type { PaginaSitio } from '../../lib/rutas';
import type { AccionPortada } from '../portada/fases';
import { Franja, Pie, ProveedorSitio, type ContextoSitio } from './comunes';
import { PaginaComisiones, PaginaComo, PaginaQueEs, PaginaVillas } from './Paginas';
import { traducir, type ClaveTexto } from './textos';
import './sitio.css';

const PAGINAS: Record<PaginaSitio, { Componente: ComponentType; titulo: ClaveTexto }> = {
  quees: { Componente: PaginaQueEs, titulo: 'nav.quees' },
  como: { Componente: PaginaComo, titulo: 'nav.como' },
  villas: { Componente: PaginaVillas, titulo: 'nav.villas' },
  comisiones: { Componente: PaginaComisiones, titulo: 'nav.comisiones' },
};

/** Ancho de los marcos de escritorio y de celular en Figma. */
const ANCHO_ESCRITORIO = 1440;
const ANCHO_CELULAR = 390;
const ZOOM_MAXIMO_CELULAR = 1.6;
const SEGUNDOS_POR_DIA = 86400;

interface Props {
  pagina: PaginaSitio;
  irA: (ruta: string) => void;
  onElegir: (accion: AccionPortada) => void;
  onLegal: (documento: DocumentoLegal) => void;
}

/** Una página informativa. Se desplaza sola: el resto de la web ocupa la pantalla sin desplazarse. */
export function Sitio({ pagina, irA, onElegir, onLegal }: Props) {
  const idioma = useIdioma();
  const raiz = useRef<HTMLDivElement>(null);
  const { Componente, titulo } = PAGINAS[pagina];

  const contexto = useMemo<ContextoSitio>(() => {
    const r = reglas();
    const plazos = plazosV2();
    const s = servicios();
    return {
      pagina,
      t: (clave, valores) => traducir(idioma, clave, valores),
      irA,
      onElegir,
      onLegal,
      enPruebas: obtenerConfig().red === 'testnet',
      rampaSimulada: s.rampa === 'simulada',
      conCorreo: Boolean(s.pollar_api_key),
      valores: {
        revision: Math.round(plazos.revisionSeg / SEGUNDOS_POR_DIA),
        arbitro: Math.round(plazos.disputaMaxSeg / SEGUNDOS_POR_DIA),
        cambios: r.fases.cambiosPorFase,
        min: r.fases.min,
        max: r.fases.max,
        casas: r.villa.casasPorSector,
        gratis: r.locales.gratis,
        extra: r.locales.precioExtraUsdc,
        maximo: r.locales.maximo,
      },
      comisiones: { directo: r.comisiones.directoBps, garantia: r.comisiones.garantiaBps, etapas: r.comisiones.etapasBps },
    };
  }, [pagina, idioma, irA, onElegir, onLegal]);

  // El diseño de escritorio se escala entero; en el celular solo se escalan las bandas de arte.
  useLayoutEffect(() => {
    const div = raiz.current;
    if (!div) return;
    const medir = () => {
      const ancho = div.clientWidth;
      div.style.setProperty('--zoom-escritorio', String(ancho / ANCHO_ESCRITORIO));
      div.style.setProperty('--zoom-celular', String(Math.min(ZOOM_MAXIMO_CELULAR, ancho / ANCHO_CELULAR)));
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(div);
    return () => observador.disconnect();
  }, []);

  // Cada página empieza arriba y con el foco dentro, para poder desplazarse con el teclado.
  useEffect(() => {
    raiz.current?.scrollTo(0, 0);
    raiz.current?.focus({ preventScroll: true });
  }, [pagina]);

  useEffect(() => {
    document.title = `${traducir(idioma, titulo)} · WorkVille`;
    return () => {
      document.title = 'WorkVille';
    };
  }, [idioma, titulo]);

  return (
    <ProveedorSitio value={contexto}>
      <div ref={raiz} className="sitio" tabIndex={-1}>
        <div className="si-lienzo">
          <Franja />
          <main>
            <Componente />
          </main>
          <Pie />
        </div>
      </div>
    </ProveedorSitio>
  );
}
