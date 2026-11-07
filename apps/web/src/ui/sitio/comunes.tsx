import { APARIENCIA_POR_AVATAR, type Barrio, type DocumentoLegal, type Lugar } from '@cryptoville/shared';
import { createContext, useContext, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { crearCasa } from '../../arte/casa';
import { crearPersona } from '../../arte/persona';
import { COLOR_CASA, aImagen, crearBanderines, crearCarrito, crearCerroFrente, crearFlores, crearGato } from '../../arte/portada';
import { crearArbol, edificioCentral } from '../../arte/villa';
import type { AccionPortada } from '../portada/fases';
import { rutaDePagina, type PaginaSitio } from '../../lib/rutas';
import { LogoIcono } from '../components/Iconos';
import { SelectorIdioma } from './SelectorIdioma';
import type { ClaveTexto, Valores } from './textos';

export interface ContextoSitio {
  pagina: PaginaSitio;
  t: (clave: ClaveTexto, valores?: Valores) => string;
  /** Va a una ruta del sitio sin recargar. */
  irA: (ruta: string) => void;
  onElegir: (accion: AccionPortada) => void;
  onLegal: (documento: DocumentoLegal) => void;
  enPruebas: boolean;
  rampaSimulada: boolean;
  conCorreo: boolean;
  /** Los números de las reglas, ya listos para los textos. */
  valores: Record<'revision' | 'cambios' | 'arbitro' | 'min' | 'max' | 'casas' | 'gratis' | 'extra' | 'maximo', number | string>;
  comisiones: { directo: number; garantia: number; etapas: number };
}

const Contexto = createContext<ContextoSitio | null>(null);
export const ProveedorSitio = Contexto.Provider;

export function useSitio(): ContextoSitio {
  const c = useContext(Contexto);
  if (!c) throw new Error('useSitio va dentro de ProveedorSitio');
  return c;
}

// ---------- Arte ----------

export const arteCasa = (barrio: Barrio) => aImagen(crearCasa({ barrio, apariencia: null, color: COLOR_CASA[barrio] }));
export const artePersona = (avatar: number) => aImagen(crearPersona(APARIENCIA_POR_AVATAR[avatar]));
export const arteArbol = (lugar: Lugar) => aImagen(crearArbol(lugar));

/** Lugar en el celular: [x, y, ancho]. Lo que no lo tiene solo aparece en el escritorio. */
export type EnCelular = [number, number, number];

interface Colocacion {
  x: number;
  y: number;
  w: number;
  h: number;
  m?: EnCelular;
}

const estiloColocacion = ({ x, y, w, h, m }: Colocacion): CSSProperties =>
  ({
    '--x': `${x}px`,
    '--y': `${y}px`,
    '--w': `${w}px`,
    '--h': `${h}px`,
    ...(m ? { '--mx': `${m[0]}px`, '--my': `${m[1]}px`, '--mw': `${m[2]}px`, '--mh': `${(m[2] * h) / w}px` } : {}),
  }) as CSSProperties;

type Movimiento = { anim: 'va'; dx?: number; dy?: number } | { anim: 'late' | 'salta' };

/** Una pieza de arte en su lugar. Es decoración: los lectores de pantalla la saltan. */
export function Pieza({ src, mov, ...c }: Colocacion & { src: string; mov?: Movimiento }) {
  const estilo = estiloColocacion(c);
  let clase = `si-pieza ${c.m ? '' : 'si-solo-escritorio'}`;
  if (mov?.anim === 'va') {
    clase += ' si-va';
    (estilo as Record<string, string>)['--dx'] = `${mov.dx ?? 0}px`;
    (estilo as Record<string, string>)['--dy'] = `${mov.dy ?? 0}px`;
  } else if (mov) clase += ` si-${mov.anim}`;
  return (
    <div className={clase} style={estilo}>
      <img src={src} alt="" draggable={false} />
    </div>
  );
}

/** Un rectángulo o un círculo con contenido, colocado como una pieza. */
export function Caja({ clase = '', children, ...c }: Colocacion & { clase?: string; children?: ReactNode }) {
  return (
    <div className={`si-pieza ${c.m ? '' : 'si-solo-escritorio'} ${clase}`} style={estiloColocacion(c)}>
      {children}
    </div>
  );
}

/** Franja de punta a punta: la calle (con líneas) o el suelo. */
export function Calle({ y, h = 78, my, mh = 44, lineas = true }: { y: number; h?: number; my?: number; mh?: number; lineas?: boolean }) {
  const estilo = { '--y': `${y}px`, '--h': `${h}px`, '--my': `${my ?? 0}px`, '--mh': `${mh}px` } as CSSProperties;
  return <div className={`si-calle ${lineas ? 'si-con-lineas' : ''} ${my === undefined ? 'si-solo-escritorio' : ''}`} style={estilo} />;
}

const LETREROS: Record<Barrio, { clave: ClaveTexto; frente: [number, number]; x: number; y: number; color: string; base: number }> = {
  creativo: { clave: 'letrero.galeria', frente: [76, 274], x: 132, y: 121, color: '#b85a42', base: 16 },
  tech: { clave: 'letrero.torre', frente: [58, 330], x: 114, y: 177, color: '#c2e0c6', base: 17 },
  audiovisual: { clave: 'letrero.cine', frente: [76, 274], x: 132, y: 121, color: '#7e3f43', base: 17 },
  academy: { clave: 'letrero.biblioteca', frente: [78, 338], x: 134, y: 185, color: '#e9b44c', base: 17 },
};

/** El edificio central de una villa, con su letrero en el idioma del sitio. `w` y `m` miden el ancho del cuerpo. */
export function Edificio({ barrio, x, y, w, m }: { barrio: Barrio; x: number; y: number; w: number; m?: EnCelular }) {
  const { t } = useSitio();
  const e = edificioCentral(barrio);
  const l = LETREROS[barrio];
  const ancho = e.cuerpo.ancho;
  const alto = l.frente[1] + e.frente.alto;
  const estilo = {
    ...estiloColocacion({ x, y, w, h: (w * alto) / ancho, m }),
    '--escala': w / ancho,
    ...(m ? { '--escala-m': m[2] / ancho } : {}),
  } as CSSProperties;
  return (
    <div className={`si-pieza si-edificio ${m ? '' : 'si-solo-escritorio'}`} style={estilo}>
      <div className="si-edificio-dentro">
        <img src={aImagen(e.frente.svg())} alt="" width={e.frente.ancho} height={e.frente.alto} style={{ left: l.frente[0], top: l.frente[1] }} draggable={false} />
        <img src={aImagen(e.cuerpo.svg())} alt="" width={e.cuerpo.ancho} height={e.cuerpo.alto} style={{ left: 0, top: 0 }} draggable={false} />
        <span style={{ left: l.x, top: l.y, color: l.color, fontSize: l.base }}>{t(l.clave)}</span>
      </div>
    </div>
  );
}

// ---------- Estructura ----------

export function Seccion({ nombre, alto, fondo, clase = '', children }: { nombre: string; alto: number; fondo: string; clase?: string; children: ReactNode }) {
  return (
    <section className={`si-seccion ${clase}`} data-nombre={nombre} style={{ '--alto': `${alto}px`, background: fondo } as CSSProperties}>
      {children}
    </section>
  );
}

/** El lienzo del arte: en el escritorio cubre la sección; en el celular es una banda propia de `alto` px. */
export function Arte({ alto, children }: { alto?: number; children: ReactNode }) {
  return (
    <div className={`si-arte ${alto === undefined ? 'si-solo-escritorio' : ''}`} style={{ '--am': `${alto ?? 0}px` } as CSSProperties} aria-hidden="true">
      {children}
    </div>
  );
}

/** Un bloque de texto en su lugar de Figma; en el celular sigue el orden del documento. */
export function Bloque({ x, y, w, gap = 0, children }: { x: number; y: number; w: number; gap?: number; children: ReactNode }) {
  return (
    <div className="si-bloque" style={{ '--x': `${x}px`, '--y': `${y}px`, '--w': `${w}px`, '--gap': `${gap}px` } as CSSProperties}>
      {children}
    </div>
  );
}

export function Enlace({ ruta, clase, children, actual }: { ruta: string; clase?: string; children: ReactNode; actual?: boolean }) {
  const { irA } = useSitio();
  const alPulsar = (e: MouseEvent<HTMLAnchorElement>) => {
    // Con Ctrl, Cmd o el botón del medio, el navegador abre otra pestaña.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    irA(ruta);
  };
  return (
    <a href={ruta} className={clase} aria-current={actual ? 'page' : undefined} onClick={alPulsar}>
      {children}
    </a>
  );
}

const ENLACES: { pagina: PaginaSitio; clave: ClaveTexto }[] = [
  { pagina: 'quees', clave: 'nav.quees' },
  { pagina: 'como', clave: 'nav.como' },
  { pagina: 'villas', clave: 'nav.villas' },
  { pagina: 'comisiones', clave: 'nav.comisiones' },
];

export function Encabezado() {
  const { t, pagina, onElegir } = useSitio();
  const [menu, setMenu] = useState(false);
  return (
    <header className="si-encabezado">
      <Enlace ruta="/" clase="si-marca">
        <LogoIcono tamano={44} />
        <span>WorkVille</span>
      </Enlace>
      <nav className="si-nav" aria-label={t('nav.aria')}>
        {ENLACES.map((e) => (
          <Enlace key={e.pagina} ruta={rutaDePagina(e.pagina)} clase="si-enlace" actual={e.pagina === pagina}>
            {t(e.clave)}
          </Enlace>
        ))}
        <SelectorIdioma />
        <button type="button" className="si-boton si-entrar" onClick={() => onElegir('entrar')}>
          {t('nav.entrar')}
        </button>
        <button type="button" className="si-hamburguesa" aria-label={t('nav.menu')} aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </button>
      </nav>
      {menu && (
        <div className="si-menu-movil">
          {ENLACES.map((e) => (
            <Enlace key={e.pagina} ruta={rutaDePagina(e.pagina)} clase="si-menu-enlace" actual={e.pagina === pagina}>
              {t(e.clave)}
            </Enlace>
          ))}
          <button type="button" className="si-boton" onClick={() => onElegir('entrar')}>
            {t('nav.entrar')}
          </button>
        </div>
      )}
    </header>
  );
}

export function Franja() {
  const { t, enPruebas } = useSitio();
  if (!enPruebas) return null;
  return (
    <div className="si-franja" role="status">
      {t('franja')}
    </div>
  );
}

/** Los botones que llevan a la villa; `solo` deja uno de los dos. */
export function Acciones({ solo }: { solo?: 'contratar' | 'trabajar' }) {
  const { t, onElegir } = useSitio();
  return (
    <div className="si-acciones">
      {solo !== 'trabajar' && (
        <button type="button" className="si-boton si-principal" onClick={() => onElegir('contratar')}>
          {t('accion.contratar')}
        </button>
      )}
      {solo !== 'contratar' && (
        <button type="button" className="si-boton" onClick={() => onElegir('trabajar')}>
          {t('accion.trabajar')}
        </button>
      )}
    </div>
  );
}

const fotosCierre = {
  cerro: aImagen(crearCerroFrente()),
  banderines: aImagen(crearBanderines()),
  carrito: aImagen(crearCarrito()),
  gato: aImagen(crearGato()),
  flores: aImagen(crearFlores()),
};

/** La última sección de cada página: invita a entrar al pueblo. */
export function Cierre({ titulo, parrafo }: { titulo: ClaveTexto; parrafo: ClaveTexto }) {
  const { t } = useSitio();
  return (
    <Seccion nombre="Cierre" alto={380} fondo="#c8e4ad">
      <Bloque x={80} y={64} w={640} gap={18}>
        <h2 className="si-titulo-l">{t(titulo)}</h2>
        <p className="si-texto-l">{t(parrafo)}</p>
        <Acciones />
      </Bloque>
      <Arte alto={170}>
        <Pieza src={fotosCierre.cerro} x={-80} y={262} w={1600} h={250} m={[-80, 100, 1600]} />
        <Pieza src={fotosCierre.banderines} x={700} y={20} w={702} h={81} />
        <Pieza src={fotosCierre.carrito} x={1120} y={150} w={200} h={190} m={[226, 16, 144]} />
        <Pieza src={fotosCierre.gato} x={1010} y={270} w={90} h={74} m={[126, 96, 63]} />
        <Pieza src={fotosCierre.flores} x={60} y={300} w={110} h={70} m={[12, 100, 96]} />
      </Arte>
    </Seccion>
  );
}

export function Pie() {
  const { t, enPruebas, onLegal } = useSitio();
  return (
    <footer className="si-pie">
      <div className="si-calle si-calle-pie si-con-lineas" />
      <div className="si-pie-contenido">
        <div className="si-pie-marca">
          <p className="si-pie-nombre">WorkVille</p>
          <p className="si-pie-lema">{t('pie.lema')}</p>
          {enPruebas && <p className="si-pie-aviso">{t('pie.franja')}</p>}
        </div>
        <div className="si-pie-enlaces">
          <div className="si-pie-columna">
            {ENLACES.map((e) => (
              <Enlace key={e.pagina} ruta={rutaDePagina(e.pagina)}>
                {t(e.clave)}
              </Enlace>
            ))}
          </div>
          <div className="si-pie-columna">
            <button type="button" onClick={() => onLegal('terminos')}>
              {t('pie.terminos')}
            </button>
            <button type="button" onClick={() => onLegal('privacidad')}>
              {t('pie.privacidad')}
            </button>
            <button type="button" onClick={() => onLegal('comisiones')}>
              {t('pie.reglas')}
            </button>
          </div>
          <SelectorIdioma haciaArriba />
        </div>
      </div>
    </footer>
  );
}
