import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { emitir, escuchar, type ModoVilla } from '../../game/EventBus';
import { modoDeRuta } from '../../lib/rutas';
import { TIEMPOS, TIEMPOS_SIN_MOVIMIENTO, debeMostrarPortada, estadoInicial, reducirPortada, type AccionPortada } from './fases';

const CLAVE_PISTA = 'workville-pista-vista';

function pistaYaVista(): boolean {
  try {
    return localStorage.getItem(CLAVE_PISTA) === '1';
  } catch {
    return false;
  }
}

function guardarPistaVista(): void {
  try {
    localStorage.setItem(CLAVE_PISTA, '1');
  } catch {
    // Sin almacenamiento local: la pista se volverá a mostrar.
  }
}

const sinMovimiento = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Opciones {
  /** Antes de cerrar las nubes. Devuelve si la villa se va a volver a armar (porque cambia de modo). */
  alElegir: (accion: AccionPortada) => boolean;
  /** Las nubes ya se abrieron. */
  alTerminarDeAbrir: (accion: AccionPortada | null) => void;
  /** «Atrás» o «Adelante» del navegador llevaron a la portada. */
  alVolverAPortada: () => void;
  /** «Atrás» o «Adelante» del navegador llevaron a la villa de ese modo. */
  alVolverAVilla: (modo: ModoVilla) => void;
}

/** Lleva las fases de la portada: los relojes, el historial del navegador y la conversación con el juego. */
export function usePortada({ alElegir, alTerminarDeAbrir, alVolverAPortada, alVolverAVilla }: Opciones) {
  const [mostrarAlInicio] = useState(() => debeMostrarPortada(location.pathname, location.search));
  const [estado, despachar] = useReducer(reducirPortada, mostrarAlInicio, estadoInicial);
  const { fase, accion } = estado;
  const tiempos = useRef(sinMovimiento() ? TIEMPOS_SIN_MOVIMIENTO : TIEMPOS);

  const faseRef = useRef(fase);
  faseRef.current = fase;
  const villaListaRef = useRef(estado.villaLista);
  villaListaRef.current = estado.villaLista;
  const alNavegar = useRef({ alVolverAPortada, alVolverAVilla });
  alNavegar.current = { alVolverAPortada, alVolverAVilla };
  useEffect(() => {
    const alCambiarHistorial = () => {
      const modo = modoDeRuta(location.pathname);
      if (modo) {
        emitir('juego-dormir', false);
        despachar({ tipo: 'terminar' });
        alNavegar.current.alVolverAVilla(modo);
      } else {
        // Si la villa todavía se está armando, se dormirá al avisar `villa-lista`.
        if (villaListaRef.current) emitir('juego-dormir', true);
        despachar({ tipo: 'volver' });
        alNavegar.current.alVolverAPortada();
      }
    };
    window.addEventListener('popstate', alCambiarHistorial);
    return () => window.removeEventListener('popstate', alCambiarHistorial);
  }, []);

  useEffect(
    () =>
      escuchar('villa-lista', () => {
        despachar({ tipo: 'villa-lista' });
        // Mientras se mira la portada, el juego no gasta batería dibujando algo que está tapado.
        if (faseRef.current === 'portada') emitir('juego-dormir', true);
      }),
    [],
  );

  const elegir = useCallback(
    (a: AccionPortada) => {
      if (faseRef.current !== 'portada') return;
      emitir('juego-dormir', false);
      despachar({ tipo: 'elegir', accion: a, reiniciaVilla: alElegir(a) });
    },
    [alElegir],
  );

  const alAbrir = useRef(alTerminarDeAbrir);
  alAbrir.current = alTerminarDeAbrir;
  useEffect(() => {
    const t = tiempos.current;
    const relojes: ReturnType<typeof setTimeout>[] = [];
    const en = (ms: number, fn: () => void) => relojes.push(setTimeout(fn, ms));
    if (fase === 'saliendo') {
      en(t.cubrir, () => despachar({ tipo: 'cubierto' }));
      en(t.esperaMinima, () => despachar({ tipo: 'espera-cumplida' }));
      en(t.tope, () => despachar({ tipo: 'tope' }));
    } else if (fase === 'abriendo') {
      en(t.aterrizar, () => emitir('llegada'));
      en(t.abrir, () => {
        alAbrir.current(accion);
        despachar({ tipo: 'abierto', conPista: !pistaYaVista() });
      });
    } else if (fase === 'pista') {
      // La portada se ve en cada entrada; la ayuda de los controles, solo la primera vez.
      guardarPistaVista();
      en(t.pista, () => despachar({ tipo: 'terminar' }));
    }
    return () => relojes.forEach(clearTimeout);
    // `tope` y `esperaMinima` cuentan desde «saliendo»: no se reinician al pasar a «cubierta».
  }, [fase === 'cubierta' ? 'saliendo' : fase, accion]);

  return { fase, elegir, activa: fase !== 'fin', mostrarAlInicio };
}
