'use client';

import { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import ControlPanel from '@/components/ControlPanel';
import { ColapsoDatos } from '@/components/ModalColapso';
import { RutaResponse, RutaMuestra, AeropuertoDTO, TramoDTO, FiltrosAvionesMapa } from '@/types/rutas';
import { verificarSaludBackend } from '@/services/ruteoService';
import { calcularUltimasCargasAeropuertos, calcularCargaAeropuertoActual } from '@/utils/capacidad';
import {IconRefresh, IconMap
} from '@/components/icons';
import { useSimulationTimer } from '@/hooks/useSimulationTimer';
import { DashboardView } from '@/components/DashboardView';

const MapaRutas = dynamic(() => import('@/components/MapaRutas'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center h-full rounded-lg bg-[#0f1f3d]/50 border border-slate-700/50">
      <IconMap className="mb-3 text-cyan-400/60 animate-pulse" size={40} />
      <p className="text-slate-400 text-sm">Cargando mapa...</p>
    </div>
  ),
});

// ── Tipos de tabs ──
type TabId = 'pedidos' | 'aeropuertos' | 'simulacion' | 'pantalla' | 'vuelos' | 'resultados' | 'administracion';

const FILTROS_AVIONES_INICIALES: FiltrosAvionesMapa = {
  usarOrigen: false,
  usarDestino: false,
  origenes: [],
  destinos: [],
};

function getPanelWidth(tab: TabId | null): string {
  if (!tab) return '0px';
  if (tab === 'administracion' || tab === 'resultados') return '520px';
  return '320px';
}

// ── Helper: tiempo transcurrido legible ──
function formatTiempoTranscurrido(minutos: number): string {
  const m    = Math.floor(minutos);
  const dias  = Math.floor(m / 1440);
  const horas = Math.floor((m % 1440) / 60);
  const mins  = m % 60;
  if (dias > 0)  return `${dias}d ${horas}h ${mins}m`;
  if (horas > 0) return `${horas}h ${mins}m`;
  return `${mins}m`;
}

// ── Helper: tiempo real transcurrido legible ──
function formatTiempoReal(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const tenths = Math.floor((ms % 1000) / 100);

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${tenths}`;
  }
  return `${pad(minutes)}:${pad(seconds)}.${tenths}`;
}

// ── Helper: fecha de simulación ──
function formatFechaSimulacion(fechaInicioRaw: string, simDia: number): string {
  if (!fechaInicioRaw || fechaInicioRaw.length < 8) return `Día ${simDia + 1}`;
  const y = parseInt(fechaInicioRaw.slice(0, 4));
  const m = parseInt(fechaInicioRaw.slice(4, 6)) - 1;
  const d = parseInt(fechaInicioRaw.slice(6, 8));
  const base = new Date(y, m, d);
  base.setDate(base.getDate() + simDia);
  return base.toLocaleDateString('es-PE', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  });
}

function aplicarFechasSimulacion(
  res: RutaResponse,
  setInicio: (v: string) => void,
  setFin: (v: string) => void,
  fechaInicioUsuario?: string,
  fechaFinUsuario?: string,
) {
  if (res.escenario === 2 || res.escenario === 3) {
    setInicio(res.fechaInicio || fechaInicioUsuario || '');
    setFin(res.fechaFin || '');
    return;
  }
  setInicio(fechaInicioUsuario || res.fechaInicio || '');
  setFin(fechaFinUsuario || res.fechaFin || '');
}

function formatoHora(minutos: number): string {
  const h = Math.floor(minutos / 60) % 24;
  const mn = Math.floor(minutos % 60);
  return `${h.toString().padStart(2, '0')}:${mn.toString().padStart(2, '0')} GMT`;
}

function combineChunks(chunks: RutaResponse[] | undefined): RutaResponse | null {
  if (!chunks || chunks.length === 0) return null;
  const base = { ...chunks[0] };
  base.resultadoSA = base.resultadoSA ? { ...base.resultadoSA, rutasMuestra: [...base.resultadoSA.rutasMuestra] } : null;
  base.totalEnviosCargados = chunks.reduce((total, c) => total + (c.totalEnviosCargados || 0), 0);

  base.cancelacionesPorDiaSA = [];

  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    if (base.resultadoSA && c.resultadoSA) {
      base.cancelacionesPorDiaSA.push(c.resultadoSA.vuelosCanceladosIds || []);
    }
    if (i === 0) continue;
    base.fechaFin = c.fechaFin;
    base.loteFin  = c.loteFin || base.loteFin;
    if (base.resultadoSA && c.resultadoSA) {
      base.resultadoSA.costoInicial      += c.resultadoSA.costoInicial;
      base.resultadoSA.costoFinal        += c.resultadoSA.costoFinal;
      base.resultadoSA.tiempoEjecucionMs += c.resultadoSA.tiempoEjecucionMs;
      base.resultadoSA.enviosAsignados   += c.resultadoSA.enviosAsignados;
      base.resultadoSA.enviosNoAceptados  = (base.resultadoSA.enviosNoAceptados || 0) + (c.resultadoSA.enviosNoAceptados || 0);
      base.resultadoSA.totalEnvios       += c.resultadoSA.totalEnvios;
      base.resultadoSA.rutasMuestra.push(...c.resultadoSA.rutasMuestra);
      if (base.resultadoSA.costoInicial > 0) {
        base.resultadoSA.mejoraRelativa = ((base.resultadoSA.costoInicial - base.resultadoSA.costoFinal) / base.resultadoSA.costoInicial) * 100;
      }
    }
  }
  return base;
}

// ════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════
export default function Home() {
  // 1. Estados base del negocio
  const [resultado, setResultado] = useState<RutaResponse | null>(null);
  const [error, setError] = useState('');
  const [backendActivo, setBackendActivo] = useState<boolean | null>(null);
  const [cargando, setCargando] = useState(false);

  // 2. Modals y Layout
  const [envioModal, setEnvioModal] = useState<RutaMuestra | null>(null);
  const [aeroModal, setAeroModal] = useState<AeropuertoDTO | null>(null);
  const [vueloModal, setVueloModal] = useState<TramoDTO | null>(null);
  const [colapsoDatos, setColapsoDatos] = useState<ColapsoDatos | null>(null);
  const colapsoDetectadoRef = useRef(false);
  const [activeTab, setActiveTab] = useState<TabId | null>(null);
  const filtrosAvionesInicializadosRef = useRef(false);

  // 3. Estados crudos de fechas que ingresa el usuario o vienen del backend
  const [fechaInicioRaw, setFechaInicioRaw] = useState('');
  const [fechaFinRaw, setFechaFinRaw] = useState('');
  const fechaInicioUsuarioRef = useRef('');
  const fechaFinUsuarioRef = useRef('');
  const isFirstChunkRef = useRef(true);

  // 4. Umbrales de capacidad (Se quedan en la página porque los controla el Sidebar)
  const [umbralVerde, setUmbralVerde] = useState(30);
  const [umbralAmbar, setUmbralAmbar] = useState(70);
  
  // 🌟 5. LA ÚNICA LÍNEA DEL RELOJ QUE NECESITAS 🌟
  // Extraemos todo lo necesario del hook pasándole las dependencias que pide.
  const {
    simTotalMinutos,
    simTotalVisual,
    realElapsedMs,
    isPlaying,
    horaReal,
    simDia,
    simHoraMinutos,
    simTranscurridoMinutos,
    progresoSimulacion,
    rangoFinalizado,
    maxSimDia,
    maxTotalMinutos,
    simInicioMinutos,
    setIsPlaying,
    handleStop,
    resetTimerCompletamente,
  } = useSimulationTimer({ resultado, fechaInicioRaw, fechaFinRaw });

  const diasSimulados = maxSimDia !== null ? maxSimDia + 1 : 0;

  const rutasActivas = useMemo(
    () => resultado?.resultadoSA?.rutasMuestra || [],
    [resultado?.resultadoSA?.rutasMuestra]
  );
  const rutasParaCargaFinal = useMemo(() => {
    if (!resultado) return [];
    return resultado.resultadoSA?.rutasMuestra || [];
  }, [resultado]);
  const cargasAeropuertoFinales = useMemo(
    () => rangoFinalizado ? calcularUltimasCargasAeropuertos(rutasParaCargaFinal) : null,
    [rangoFinalizado, rutasParaCargaFinal]
  );

  // ── Indicadores globales (almacenes) ──
  const globalStatsAeropuertos = useMemo(() => {
    if (!resultado) return null;
    let totalCarga    = 0;
    let totalCapacidad = 0;
    for (const a of resultado.aeropuertos) {
      const carga = cargasAeropuertoFinales?.[a.codigo]
        ?? calcularCargaAeropuertoActual(a.codigo, rutasActivas, simTotalVisual);
      totalCarga    += carga;
      totalCapacidad += a.capacidadMax;
    }
    return { carga: totalCarga, capacidad: totalCapacidad };
  }, [resultado, cargasAeropuertoFinales, rutasActivas, simTotalVisual]);

  useEffect(() => {
    verificarSaludBackend().then(setBackendActivo);
  }, []);

  const [filtrosAvionesMapa, setFiltrosAvionesMapa] = useState<FiltrosAvionesMapa>(FILTROS_AVIONES_INICIALES);

  const inicializarFiltrosAvionesMapa = useCallback(() => {
    if (filtrosAvionesInicializadosRef.current) return;
    filtrosAvionesInicializadosRef.current = true;
    setFiltrosAvionesMapa(FILTROS_AVIONES_INICIALES);
  }, []);

  const handleFechaInicioPanel = useCallback((fecha: string) => {
    fechaInicioUsuarioRef.current = fecha;
    setFechaInicioRaw(fecha);
  }, []);

  const handleFechaFinPanel = useCallback((fecha: string) => {
    fechaFinUsuarioRef.current = fecha;
    setFechaFinRaw(fecha);
  }, []);

  // ── Detección de colapso (Escenario 3) ──────────────────────────────────
  // Función auxiliar: calcula cargas de aeropuertos en el minuto actual usando
  // el mismo índice usado por el mapa (re-implementado localmente para evitar importar
  // la función interna de MapaRutas).
  const detectarColapsoEnMinuto = useCallback(
    (minutoActual: number, res: RutaResponse): ColapsoDatos | null => {
      if (!res || res.escenario !== 3) return null;

      const rutas = res.resultadoSA?.rutasMuestra || [];
      const aeropuertos = res.aeropuertos || [];

      // 1. Verificar envíos no asignados (SLA incumplido): envíos sin tramos
      const enviosNoAsignados = rutas.filter(r => !r.tramos || r.tramos.length === 0);
      if (enviosNoAsignados.length > 0) {
        const primero = enviosNoAsignados[0];
        return {
          razon: `No fue posible realizar el SLA del envío ${primero.envioId} (${primero.origen} → ${primero.destino}, ${primero.maletas} maletas). El sistema no encontró rutas viables dentro del tiempo límite.`,
          lugar: `${primero.origen} → ${primero.destino}`,
          momentoSimulacion: minutoActual,
          fechaInicioRaw: res.fechaInicio || '',
          tipoColapso: 'sla',
        };
      }

      // 2. Verificar aeropuertos llenos (≥ 100% capacidad)
      for (const aeropuerto of aeropuertos) {
        if (aeropuerto.capacidadMax <= 0) continue;
        const cargaActual = calcularCargaAeropuertoActual(aeropuerto.codigo, rutas, minutoActual);
        if (cargaActual >= aeropuerto.capacidadMax) {
          const pct = Math.round((cargaActual / aeropuerto.capacidadMax) * 100);
          return {
            razon: `El aeropuerto ${aeropuerto.codigo} (${aeropuerto.ciudad}, ${aeropuerto.pais}) ha superado su capacidad máxima de almacenamiento. Carga actual: ${cargaActual} / ${aeropuerto.capacidadMax} maletas (${pct}%).`,
            lugar: `${aeropuerto.codigo} — ${aeropuerto.ciudad}`,
            momentoSimulacion: minutoActual,
            fechaInicioRaw: res.fechaInicio || '',
            tipoColapso: 'aeropuerto',
          };
        }
      }

      // 3. Verificar aviones llenos (≥ 100% capacidad de vuelo)
      // Calculamos carga por vuelo activo en el minuto actual
      const cargaPorVuelo: Record<string, number> = {};
      for (const ruta of rutas) {
        if (!ruta.tramos) continue;
        for (const tramo of ruta.tramos) {
          const key = `${tramo.vueloId}-${tramo.diaOffset}`;
          cargaPorVuelo[key] = (cargaPorVuelo[key] || 0) + ruta.maletas;
        }
      }

      for (const ruta of rutas) {
        if (!ruta.tramos) continue;
        for (const tramo of ruta.tramos) {
          if (tramo.capacidad <= 0) continue;
          const key = `${tramo.vueloId}-${tramo.diaOffset}`;
          const carga = cargaPorVuelo[key] || 0;
          if (carga > tramo.capacidad) {
            const pct = Math.round((carga / tramo.capacidad) * 100);
            return {
              razon: `El vuelo #${tramo.vueloId} (${tramo.origen} → ${tramo.destino}) ha superado su capacidad máxima de carga. Maletas asignadas: ${carga} / ${tramo.capacidad} (${pct}%).`,
              lugar: `Vuelo #${tramo.vueloId} — ${tramo.origen} → ${tramo.destino}`,
              momentoSimulacion: minutoActual,
              fechaInicioRaw: res.fechaInicio || '',
              tipoColapso: 'avion',
            };
          }
        }
      }

      // 4. Verificar mensaje de colapso del backend
      if (res.resultadoSA?.mensajeColapso) {
        return {
          razon: res.resultadoSA.mensajeColapso,
          lugar: 'Red de distribución',
          momentoSimulacion: minutoActual,
          fechaInicioRaw: res.fechaInicio || '',
          tipoColapso: 'general',
        };
      }

      return null;
    },
    []
  );

  // ── Monitoreo de colapso en Escenario 3 ──────────────────────────────────
  useEffect(() => {
    if (!resultado || resultado.escenario !== 3 || !isPlaying) return;
    if (colapsoDetectadoRef.current) return;

    const colapso = detectarColapsoEnMinuto(simTotalMinutos, resultado);
    if (colapso) {
      colapsoDetectadoRef.current = true;
      setIsPlaying(false);
      setColapsoDatos(colapso);
    }
  }, [simTotalMinutos, resultado, isPlaying, detectarColapsoEnMinuto, setIsPlaying]);

  // Acciones adaptadas usando los métodos del Custom Hook
  const handleReiniciar = () => {
    setResultado(null);
    resetTimerCompletamente(0); // <-- Limpia el estado del tiempo del hook
    setFechaInicioRaw('');
    setFechaFinRaw('');
    fechaInicioUsuarioRef.current = '';
    fechaFinUsuarioRef.current = '';
    isFirstChunkRef.current = true;
    filtrosAvionesInicializadosRef.current = false;
    setFiltrosAvionesMapa(FILTROS_AVIONES_INICIALES);
    setColapsoDatos(null);
    colapsoDetectadoRef.current = false;
  };

  const handleTabClick = useCallback((id: TabId) => {
    setActiveTab(prev => {
      const next = prev === id ? null : id;
      if (next) {
        setVueloModal(null);
        setAeroModal(null);
        setEnvioModal(null);
      }
      return next;
    });
  }, []);

  const handleSelectVuelo = useCallback((vuelo: TramoDTO) => {
    setActiveTab(null);
    setAeroModal(null);
    setEnvioModal(null);
    setVueloModal(vuelo);
  }, []);

  const handleSelectAeropuerto = useCallback((aeropuerto: AeropuertoDTO) => {
    setActiveTab(null);
    setVueloModal(null);
    setEnvioModal(null);
    setAeroModal(aeropuerto);
  }, []);

  const handleSelectEnvio = useCallback((envio: RutaMuestra) => {
    setActiveTab(null);
    setVueloModal(null);
    setAeroModal(null);
    setEnvioModal(envio);
  }, []);

  // ── Clamp umbral verde para que no supere ámbar
  const handleUmbralVerde = (val: number) => {
    setUmbralVerde(val);
    if (val >= umbralAmbar) setUmbralAmbar(Math.min(val + 5, 99));
  };
  const handleUmbralAmbar = (val: number) => {
    setUmbralAmbar(val);
    if (val <= umbralVerde) setUmbralVerde(Math.max(val - 5, 1));
  };

  // ══════════════════════════════════════════════
  // VISTA CARGA DE DATOS (pantalla inicial)
  // ══════════════════════════════════════════════
  if (!resultado) {
    return (
      <div className="min-h-screen bg-[#0a1628] flex flex-col items-center justify-center p-6">
        <div className="max-w-xl w-full bg-[#0c1a30] border border-slate-700/40 rounded-xl p-8 shadow-2xl">
          <div className="text-center mb-8 flex flex-col items-center">
            <img src="/logo.png" alt="LoadRoute Logo" className="h-24 mb-4" />
          </div>
          <ControlPanel
            onResultado={(resChunks) => {
              const res = combineChunks(resChunks);
              if (res) {
                colapsoDetectadoRef.current = false;
                setColapsoDatos(null);
                setResultado(res);
                isFirstChunkRef.current = false;
                inicializarFiltrosAvionesMapa();
                // fechaInicioRaw ya fue seteado por onFechaInicio antes de ejecutar
                // res.fechaFin es el último chunk en YYYYMMDD
                aplicarFechasSimulacion(res, setFechaInicioRaw, setFechaFinRaw, fechaInicioUsuarioRef.current, fechaFinUsuarioRef.current);
                setIsPlaying(true);
              }
            }}
            onProgressJob={(job) => {
              const res = combineChunks(job.chunks);
              if (res) {
                if (isFirstChunkRef.current) {
                  isFirstChunkRef.current = false;
                  colapsoDetectadoRef.current = false;
                  setColapsoDatos(null);
                  setResultado(res);
                  inicializarFiltrosAvionesMapa();
                  aplicarFechasSimulacion(res, setFechaInicioRaw, setFechaFinRaw, fechaInicioUsuarioRef.current, fechaFinUsuarioRef.current);
                } else {
                  setResultado(res);
                  aplicarFechasSimulacion(res, setFechaInicioRaw, setFechaFinRaw, fechaInicioUsuarioRef.current, fechaFinUsuarioRef.current);
                }
                setIsPlaying(true);
              }
            }}
            onError={setError}
            onCargando={setCargando}
            onFechaInicio={handleFechaInicioPanel}
            onFechaFin={handleFechaFinPanel}
          />
          {error && (
            <div className="p-3 mt-4 bg-red-900/20 border border-red-500/30 rounded-lg text-red-300 text-xs fade-in-up text-center">
              {error}
            </div>
          )}
          {cargando && (
            <div className="flex justify-center items-center gap-2 p-3 mt-4 text-blue-400 text-sm animate-pulse">
              <div className="w-4 h-4 border-2 border-transparent border-t-current rounded-full animate-spin" />
              Procesando algoritmos en servidor...
            </div>
          )}

        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════
  // VISTA DASHBOARD
  // ══════════════════════════════════════════════
  return (
    <DashboardView
      resultado={resultado}
      fechaInicioRaw={fechaInicioRaw}
      simDia={simDia}
      simHoraMinutos={simHoraMinutos}
      simTranscurridoMinutos={simTranscurridoMinutos}
      realElapsedMs={realElapsedMs}
      progresoSimulacion={progresoSimulacion}
      maxTotalMinutos={maxTotalMinutos}
      rangoFinalizado={rangoFinalizado}
      isPlaying={isPlaying}
      horaReal={horaReal}
      activeTab={activeTab}
      simTotalVisual={simTotalVisual}
      cargasAeropuertoFinales={cargasAeropuertoFinales}
      vueloModal={vueloModal}
      envioModal={envioModal}
      aeroModal={aeroModal}
      colapsoDatos={colapsoDatos}
      umbralVerde={umbralVerde}
      umbralAmbar={umbralAmbar}
      filtrosAvionesMapa={filtrosAvionesMapa}
      globalStatsAeropuertos={globalStatsAeropuertos}
      rutasActivas={rutasActivas}
      diasSimulados={diasSimulados}
      maxSimDia={maxSimDia}
      
      // Funciones / Handlers
      setIsPlaying={setIsPlaying}
      handleStop={handleStop}
      handleTabClick={handleTabClick}
      handleSelectVuelo={handleSelectVuelo}
      handleSelectAeropuerto={handleSelectAeropuerto}
      handleSelectEnvio={handleSelectEnvio}
      getPanelWidth={getPanelWidth}
      setActiveTab={setActiveTab}
      setEnvioModal={setEnvioModal}
      setAeroModal={setAeroModal}
      setVueloModal={setVueloModal}
      setColapsoDatos={setColapsoDatos}
      handleUmbralVerde={handleUmbralVerde}
      handleUmbralAmbar={handleUmbralAmbar}
      handleReiniciar={handleReiniciar}
      setFiltrosAvionesMapa={setFiltrosAvionesMapa}
      
      // Formateadores
      formatFechaSimulacion={formatFechaSimulacion}
      formatoHora={formatoHora}
      formatTiempoTranscurrido={formatTiempoTranscurrido}
      formatTiempoReal={formatTiempoReal}
    />
  );
}
