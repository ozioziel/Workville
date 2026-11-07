import { BARRIOS, LISTA_BARRIOS, colorLugar, reglasDe, tituloLugar, type Lugar, type RedStellar } from '@cryptoville/shared';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { aImagen, crearCabina, crearNube, medidasNube, type TipoNube } from '../../arte/portada';
import { LogoIcono } from '../components/Iconos';
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

function Cortina({ lugar }: { lugar: Lugar }) {
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
        <p className="pt-texto-llegando">Llegando a {tituloLugar(lugar)}</p>
      </div>
    </div>
  );
}

type TemaInfo = 'como' | 'villas' | 'comisiones';

/** Mientras la portada no tenga secciones debajo, los enlaces del menú abren esta ventana. */
function InfoPortada({ tema, red, onCerrar }: { tema: TemaInfo; red: RedStellar; onCerrar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const c = reglasDe(red).comisiones;
  const porcentaje = (bps: number) => `${bps / 100} %`;
  return (
    <dialog ref={ref} className="pt-info" onClose={onCerrar}>
      {tema === 'como' && (
        <>
          <h2>Cómo funciona</h2>
          <ol>
            <li>Camina por las villas y entra a los locales de las personas que ofrecen servicios.</li>
            <li>Pide un servicio. Cuando el proveedor acepta, eliges cómo pagar: directo, con garantía o por etapas.</li>
            <li>Con garantía, el contrato guarda el dinero hasta que confirmas la entrega. Si hay un problema, decide el árbitro.</li>
          </ol>
        </>
      )}
      {tema === 'villas' && (
        <>
          <h2>Villas</h2>
          <ul>
            {LISTA_BARRIOS.map((b) => (
              <li key={b}>
                <strong>{BARRIOS[b].nombre}:</strong> {BARRIOS[b].descripcion}.
              </li>
            ))}
          </ul>
        </>
      )}
      {tema === 'comisiones' && (
        <>
          <h2>Comisiones</h2>
          <ul>
            <li>
              <strong>Pago directo:</strong> {porcentaje(c.directoBps)}.
            </li>
            <li>
              <strong>Con garantía:</strong> {porcentaje(c.garantiaBps)}.
            </li>
            <li>
              <strong>Por etapas:</strong> {porcentaje(c.etapasBps)} en cada etapa.
            </li>
          </ul>
        </>
      )}
      <form method="dialog">
        <button type="submit" className="pt-boton">
          Cerrar
        </button>
      </form>
    </dialog>
  );
}

interface PropsPortada {
  fase: FasePortada;
  lugar: Lugar;
  red: RedStellar;
  tactil: boolean;
  onElegir: (accion: AccionPortada) => void;
}

export function Portada({ fase, lugar, red, tactil, onElegir }: PropsPortada) {
  const raiz = useRef<HTMLDivElement>(null);
  const [info, setInfo] = useState<TemaInfo | null>(null);

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
      {conEscena && (
        <>
          <EscenaPortada />
          {red === 'testnet' && (
            <div className="pt-franja" role="status">
              Modo de prueba: el dinero no es real
            </div>
          )}
          <header className="pt-nav">
            <div className="pt-marca">
              <LogoIcono tamano={44} />
              WorkVille
            </div>
            <nav className="pt-enlaces" aria-label="Información">
              <button type="button" className="pt-enlace" onClick={() => setInfo('como')}>
                Cómo funciona
              </button>
              <button type="button" className="pt-enlace" onClick={() => setInfo('villas')}>
                Villas
              </button>
              <button type="button" className="pt-enlace" onClick={() => setInfo('comisiones')}>
                Comisiones
              </button>
              <button type="button" className="pt-boton pt-boton-nav" onClick={() => onElegir('entrar')}>
                Entrar
              </button>
            </nav>
          </header>
          <main className="pt-textos">
            <h1 className="pt-titulo">
              Cada freelancer
              <br />
              tiene su local.
              <br />
              Entra y contrata.
            </h1>
            <p className="pt-parrafo">WorkVille es un pueblo 2D de freelancers. Si pagas con garantía, el dinero espera en un contrato hasta que confirmas la entrega.</p>
            <div className="pt-acciones">
              <button type="button" className="pt-boton pt-boton-principal" onClick={() => onElegir('contratar')}>
                Quiero contratar
              </button>
              <button type="button" className="pt-boton" onClick={() => onElegir('trabajar')}>
                Quiero trabajar
              </button>
              <button type="button" className="pt-mirar" onClick={() => onElegir('mirar')}>
                Solo mirar
              </button>
              <button type="button" className="pt-mirar pt-solo-movil" onClick={() => setInfo('como')}>
                Cómo funciona
              </button>
            </div>
          </main>
        </>
      )}
      {conCortina && <Cortina lugar={lugar} />}
      {fase === 'pista' && (
        <p className="pt-pista" role="status">
          {tactil ? 'Camina con el joystick. Entra a un local con el botón «Entrar».' : 'Camina con las flechas o WASD. Entra a un local con E.'}
        </p>
      )}
      {info && <InfoPortada tema={info} red={red} onCerrar={() => setInfo(null)} />}
    </div>
  );
}
