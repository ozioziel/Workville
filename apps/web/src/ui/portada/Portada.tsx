import { colorLugar, tituloLugar, type DocumentoLegal, type Lugar, type RedStellar } from '@cryptoville/shared';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { aImagen, crearCabina, crearNube, medidasNube, type TipoNube } from '../../arte/portada';
import { useIdioma, type Idioma } from '../../lib/idioma';
import { paginaDeRuta, rutaDePagina, type PaginaSitio } from '../../lib/rutas';
import { LogoIcono } from '../components/Iconos';
import { SelectorIdioma } from '../sitio/SelectorIdioma';
import { Sitio } from '../sitio/Sitio';
import { traducir, type ClaveTexto } from '../sitio/textos';
import { EscenaPortada } from './EscenaPortada';
import { medirPortada, type AccionPortada, type FasePortada } from './fases';
import './portada.css';

/** Nubes de la cortina: forman un anillo y dejan el centro limpio para la cabina y el texto. */
const NUBES_CORTINA: { tipo: TipoNube; escala: number; x: number; y: number; lado: -1 | 1 }[] = [
  { tipo: 'c', escala: 3.2, x: -640, y: -130, lado: -1 },
  { tipo: 'a', escala: 3.6, x: -520, y: 230, lado: -1 },
  { tipo: 'c', escala: 3.2, x: -650, y: 560, lado: -1 },
  { tipo: 'b', escala: 4, x: 230, y: -225, lado: -1 },
  { tipo: 'a', escala: 3.6, x: 130, y: 700, lado: -1 },
  { tipo: 'c', escala: 3.2, x: 1090, y: -120, lado: 1 },
  { tipo: 'a', escala: 3.6, x: 1105, y: 220, lado: 1 },
  { tipo: 'c', escala: 3.2, x: 1085, y: 560, lado: 1 },
  { tipo: 'b', escala: 4, x: 590, y: -215, lado: 1 },
  { tipo: 'a', escala: 3.6, x: 610, y: 735, lado: 1 },
];

function Cortina({ lugar, idioma }: { lugar: Lugar; idioma: Idioma }) {
  return (
    <div className="pt-cortina" role="status">
      <div className="pt-velo" />
      <div className="pt-anillo" aria-hidden="true">
        {NUBES_CORTINA.map((n, i) => {
          const m = medidasNube(n.tipo);
          const pausa = (i % 5) * 0.05;
          const estilo = {
            left: n.x,
            top: n.y,
            width: m.ancho * n.escala,
            height: m.alto * n.escala,
            '--lado': `${n.lado * 1800}px`,
            '--entrada': `${0.35 + pausa}s`,
            '--salida': `${pausa}s`,
          } as CSSProperties;
          return <img key={i} className="pt-nube-cortina" src={aImagen(crearNube(n.tipo))} alt="" style={estilo} />;
        })}
      </div>
      <div className="pt-llegando">
        <div className="pt-cable-llegada" />
        <img className="pt-cabina-llegada" src={aImagen(crearCabina(colorLugar(lugar).color))} alt="" />
        <p className="pt-texto-llegando">{traducir(idioma, 'portada.llegando', { lugar: tituloLugar(lugar) })}</p>
      </div>
    </div>
  );
}

const ENLACES: { pagina: PaginaSitio; clave: ClaveTexto }[] = [
  { pagina: 'quees', clave: 'nav.quees' },
  { pagina: 'como', clave: 'nav.como' },
  { pagina: 'villas', clave: 'nav.villas' },
  { pagina: 'comisiones', clave: 'nav.comisiones' },
];

interface PropsPortada {
  fase: FasePortada;
  lugar: Lugar;
  red: RedStellar;
  tactil: boolean;
  onElegir: (accion: AccionPortada) => void;
  onLegal: (documento: DocumentoLegal) => void;
}

export function Portada({ fase, lugar, red, tactil, onElegir, onLegal }: PropsPortada) {
  const raiz = useRef<HTMLDivElement>(null);
  const idioma = useIdioma();
  const t = (clave: ClaveTexto) => traducir(idioma, clave);
  // Las páginas informativas viven aquí para poder salir a la villa con la misma transición por las nubes.
  const [pagina, setPagina] = useState<PaginaSitio | null>(() => paginaDeRuta(location.pathname));

  useEffect(() => {
    const alCambiarHistorial = () => setPagina(paginaDeRuta(location.pathname));
    window.addEventListener('popstate', alCambiarHistorial);
    return () => window.removeEventListener('popstate', alCambiarHistorial);
  }, []);

  const irA = useCallback((ruta: string) => {
    if (ruta !== location.pathname) history.pushState(null, '', ruta);
    setPagina(paginaDeRuta(ruta));
  }, []);

  const alPulsarEnlace = (e: MouseEvent<HTMLAnchorElement>, ruta: string) => {
    // Con Ctrl, Cmd o el botón del medio, el navegador abre otra pestaña.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    irA(ruta);
  };

  useLayoutEffect(() => {
    const div = raiz.current;
    if (!div) return;
    const medir = () => {
      const m = medirPortada(div.clientWidth, div.clientHeight);
      div.style.setProperty('--pt-escala', String(m.escala));
      div.style.setProperty('--pt-x', `${m.desplazamiento}px`);
      div.style.setProperty('--pt-texto', String(m.texto));
      div.style.setProperty('--pt-cortina', String(m.cortina));
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(div);
    return () => observador.disconnect();
  }, []);

  const conEscena = fase === 'portada' || fase === 'saliendo' || fase === 'cubierta';
  const conCortina = fase === 'saliendo' || fase === 'cubierta' || fase === 'abriendo';

  return (
    <div ref={raiz} className="portada" data-fase={fase}>
      {conEscena && pagina && <Sitio pagina={pagina} irA={irA} onElegir={onElegir} onLegal={onLegal} />}
      {conEscena && !pagina && (
        <>
          <EscenaPortada />
          {red === 'testnet' && (
            <div className="pt-franja" role="status">
              {t('franja')}
            </div>
          )}
          <header className="pt-nav">
            <div className="pt-marca">
              <LogoIcono tamano={44} />
              <span>WorkVille</span>
            </div>
            <nav className="pt-enlaces" aria-label={t('nav.aria')}>
              {ENLACES.map((e) => (
                <a key={e.pagina} className="pt-enlace" href={rutaDePagina(e.pagina)} onClick={(ev) => alPulsarEnlace(ev, rutaDePagina(e.pagina))}>
                  {t(e.clave)}
                </a>
              ))}
              <SelectorIdioma />
              <button type="button" className="pt-boton pt-boton-nav" onClick={() => onElegir('entrar')}>
                {t('nav.entrar')}
              </button>
            </nav>
          </header>
          <main className="pt-textos">
            <h1 className="pt-titulo">
              {t('portada.titulo')
                .split('\n')
                .map((linea, i) => (
                  <span key={linea} className="pt-titulo-linea">
                    {i > 0 && <br />}
                    {linea}
                  </span>
                ))}
            </h1>
            <p className="pt-parrafo">{t('portada.parrafo')}</p>
            <div className="pt-acciones">
              <button type="button" className="pt-boton pt-boton-principal" onClick={() => onElegir('contratar')}>
                {t('accion.contratar')}
              </button>
              <button type="button" className="pt-boton" onClick={() => onElegir('trabajar')}>
                {t('accion.trabajar')}
              </button>
              <button type="button" className="pt-mirar" onClick={() => onElegir('mirar')}>
                {t('portada.mirar')}
              </button>
              <a className="pt-mirar pt-solo-movil" href={rutaDePagina('como')} onClick={(ev) => alPulsarEnlace(ev, rutaDePagina('como'))}>
                {t('nav.como')}
              </a>
            </div>
          </main>
        </>
      )}
      {conCortina && <Cortina lugar={lugar} idioma={idioma} />}
      {fase === 'pista' && (
        <p className="pt-pista" role="status">
          {t(tactil ? 'portada.pista.tactil' : 'portada.pista.teclado')}
        </p>
      )}
    </div>
  );
}
