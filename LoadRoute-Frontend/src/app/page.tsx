'use client';

import { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import ControlPanel from '@/components/ControlPanel';
import SidebarInfo from '@/components/SidebarInfo';
import SidebarFiltroMapa from '@/components/SidebarFiltroMapa';
import ModalEnvio from '@/components/ModalEnvio';
import ModalAeropuerto from '@/components/ModalAeropuerto';
import ModalVuelo from '@/components/ModalVuelo';
import ResultadosPanel from '@/components/ResultadosPanel';
import SidebarVuelos from '@/components/SidebarVuelos';
import AdminPanel from '@/components/AdminPanel';
import { RutaResponse, RutaMuestra, AeropuertoDTO, TramoDTO, FiltrosAvionesMapa } from '@/types/rutas';
import { verificarSaludBackend } from '@/services/ruteoService';
import { calcularUltimasCargasAeropuertos, calcularCargaAeropuertoActual } from '@/utils/capacidad';
import {
  IconPackage, IconBuilding, IconSettings, IconScreen, IconPlane, IconClipboard,
  IconPlay, IconPause, IconStop, IconClose, IconRefresh, IconChart, IconMap,
  IconWarehouse, IconCheck,
} from '@/components/icons';

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
const MAP_FRAME_INTERVAL_MS = 1000 / 30;

const FILTROS_AVIONES_INICIALES: FiltrosAvionesMapa = {
  usarOrigen: false,
  usarDestino: false,
  origenes: [],
  destinos: [],
};

const NAV_TABS: { id: TabId; icon: ReactNode; label: string; color: string }[] = [
  { id: 'aeropuertos',    icon: <IconBuilding size={20} />,   label: 'Aeropuertos', color: 'emerald' },
  { id: 'vuelos',         icon: <IconPlane size={20} />,      label: 'Vuelos',      color: 'orange'  },
  { id: 'pedidos',        icon: <IconPackage size={20} />,    label: 'Pedidos',     color: 'blue'    },
  { id: 'simulacion',     icon: <IconSettings size={20} />,   label: 'Simulación',  color: 'violet'  },
  { id: 'pantalla',       icon: <IconScreen size={20} />,     label: 'Pantalla',    color: 'cyan'    },
  { id: 'resultados',     icon: <IconChart size={20} />,      label: 'Resultados',  color: 'indigo'  },
  { id: 'administracion', icon: <IconClipboard size={20} />,  label: 'Maestros',    color: 'rose'    },
];

function getPanelWidth(tab: TabId | null): string {
  if (!tab) return '0px';
  if (tab === 'administracion') return '600px';
  if (tab === 'resultados') return '520px';
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

function parseFechaRaw(raw?: string, endOfDay = false): Date | null {
  if (!raw || raw.length < 8) return null;
  const y = Number(raw.slice(0, 4));
  const m = Number(raw.slice(4, 6)) - 1;
  const d = Number(raw.slice(6, 8));
  const hh = raw.length >= 12 ? Number(raw.slice(8, 10)) : (endOfDay ? 23 : 0);
  const mm = raw.length >= 12 ? Number(raw.slice(10, 12)) : (endOfDay ? 59 : 0);
  const parsed = new Date(y, m, d, hh, mm);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getInicioOffsetMinutos(fechaInicioRaw?: string): number {
  if (!fechaInicioRaw || fechaInicioRaw.length < 12) return 0;
  const h = Number(fechaInicioRaw.slice(8, 10));
  const m = Number(fechaInicioRaw.slice(10, 12));
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function getFinOffsetMinutos(fechaInicioRaw?: string, fechaFinRaw?: string): number | null {
  const inicio = parseFechaRaw(fechaInicioRaw);
  const fin = parseFechaRaw(fechaFinRaw, true);
  if (!inicio || !fin || fin < inicio) return null;

  const inicioDia = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  const MS_POR_MINUTO = 60 * 1000;
  return Math.max(0, Math.ceil((fin.getTime() - inicioDia.getTime()) / MS_POR_MINUTO));
}

function getMaxSimDia(fechaInicioRaw?: string, fechaFinRaw?: string): number | null {
  const finOffset = getFinOffsetMinutos(fechaInicioRaw, fechaFinRaw);
  if (finOffset === null) return null;
  return Math.max(0, Math.floor(Math.max(0, finOffset - 1) / 1440));
}

const DURACION_ANIM_MIN = 5;
const DURACION_ANIM_MAX = 90;
const DURACION_ANIM_STEP = 5;

function calcularMaxTotalMinutos(
  resultado: RutaResponse | null,
  fechaInicioRaw: string,
  fechaFinRaw: string,
  maxTimelineMinutos: number | null,
): number | null {
  const diasSimulados = resultado?.cancelacionesPorDiaSA?.length ?? 0;
  if (resultado && (resultado.escenario === 2 || resultado.escenario === 3) && diasSimulados > 0) {
    return diasSimulados * 1440;
  }
  const finOffset = getFinOffsetMinutos(fechaInicioRaw, fechaFinRaw);
  if (finOffset !== null) return finOffset;
  return maxTimelineMinutos;
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

function getTimelineMaxMinutos(resultado: RutaResponse | null): number | null {
  if (!resultado) return null;
  const rutas = [
    ...(resultado.resultadoSA?.rutasMuestra || []),
    ...(resultado.resultadoALNS?.rutasMuestra || []),
  ];

  let max = 0;
  for (const ruta of rutas) {
    for (const tramo of ruta.tramos || []) {
      if (tramo.diaOffset === undefined || tramo.llegadaMinutosGMT === undefined) continue;
      let llegada = tramo.diaOffset * 1440 + tramo.llegadaMinutosGMT;
      if (tramo.llegadaMinutosGMT < tramo.salidaMinutosGMT) llegada += 1440;
      max = Math.max(max, llegada);
    }
  }

  return max > 0 ? max : null;
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
  base.resultadoALNS = null;
  base.totalEnviosCargados = chunks.reduce((total, c) => total + (c.totalEnviosCargados || 0), 0);

  base.cancelacionesPorDiaSA = [];
  base.cancelacionesPorDiaALNS = [];

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

// ── Panel ⚙️ Simulación — solo umbrales y reinicio ──────────────────────────
function SimulacionPanel({
  umbralVerde, umbralAmbar, onUmbralVerde, onUmbralAmbar, onReiniciar,
  duracionAnimacionMinutos, onDuracionAnimacion, escenario, diasSimulados,
}: {
  umbralVerde: number;
  umbralAmbar: number;
  onUmbralVerde: (v: number) => void;
  onUmbralAmbar: (v: number) => void;
  onReiniciar: () => void;
  duracionAnimacionMinutos: number;
  onDuracionAnimacion: (v: number) => void;
  escenario: number;
  diasSimulados: number;
}) {
  return (
    <div className="flex flex-col h-full p-4 space-y-5 overflow-y-auto custom-scrollbar">
      {/* Umbral de Capacidad */}
      <div className="bg-slate-900/40 border border-slate-700/50 rounded-xl p-4 backdrop-blur-sm">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Umbral de Capacidad</p>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
            <div className="flex-1">
              <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                <span>Verde</span><span>0–{umbralVerde}%</span>
              </div>
              <input type="range" min={1} max={umbralAmbar - 5} value={umbralVerde}
                onChange={e => onUmbralVerde(Number(e.target.value))}
                className="w-full h-1 cursor-pointer accent-emerald-500" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0 shadow-[0_0_6px_rgba(245,158,11,0.6)]" />
            <div className="flex-1">
              <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                <span>Ámbar</span><span>{umbralVerde + 1}–{umbralAmbar}%</span>
              </div>
              <input type="range" min={umbralVerde + 5} max={95} value={umbralAmbar}
                onChange={e => onUmbralAmbar(Number(e.target.value))}
                className="w-full h-1 cursor-pointer accent-amber-500" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 shadow-[0_0_6px_rgba(239,68,68,0.6)]" />
            <span className="text-[10px] text-slate-400">Rojo — {umbralAmbar + 1}–100%</span>
          </div>
        </div>
      </div>

      <div className="bg-slate-900/40 border border-slate-700/50 rounded-xl p-4 backdrop-blur-sm">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Velocidad de Animación</p>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-slate-400">Tiempo real para completar</span>
          <span className="text-xs font-bold text-violet-300 bg-violet-500/15 border border-violet-400/30 px-2 py-0.5 rounded">
            {duracionAnimacionMinutos} min
          </span>
        </div>
        <input
          type="range"
          min={DURACION_ANIM_MIN}
          max={DURACION_ANIM_MAX}
          step={DURACION_ANIM_STEP}
          value={duracionAnimacionMinutos}
          onChange={e => onDuracionAnimacion(Number(e.target.value))}
          className="w-full h-1 cursor-pointer accent-violet-400"
        />
        <div className="flex justify-between text-[9px] text-slate-500 mt-1">
          <span>{DURACION_ANIM_MIN}m (rápido)</span>
          <span>{DURACION_ANIM_MAX}m</span>
        </div>
        {escenario !== 1 && diasSimulados > 0 && (
          <p className="text-[9px] text-slate-500 mt-2">
            {diasSimulados} días simulados · ~{((duracionAnimacionMinutos * 60) / diasSimulados).toFixed(1)}s reales por día
          </p>
        )}
      </div>

      <div className="border-t border-slate-700/50" />

      <button
        onClick={onReiniciar}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border border-slate-600/50
                   text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 hover:border-slate-500 transition-all"
      >
        <IconRefresh size={16} /> Cargar nuevos datos
      </button>
    </div>
  );
}

// ════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════
export default function Home() {
  const [resultado,       setResultado]       = useState<RutaResponse | null>(null);
  const [error,           setError]           = useState('');
  const [backendActivo,   setBackendActivo]   = useState<boolean | null>(null);
  const [cargando,        setCargando]        = useState(false);

  // Modals
  const [envioModal,  setEnvioModal]  = useState<RutaMuestra | null>(null);
  const [aeroModal,   setAeroModal]   = useState<AeropuertoDTO | null>(null);
  const [vueloModal,  setVueloModal]  = useState<TramoDTO | null>(null);

  // Simulación — un único contador de minutos totales desde el inicio del periodo
  const [simTotalMinutos,  setSimTotalMinutos]  = useState(0);
  const [realElapsedMs,    setRealElapsedMs]    = useState(0);
  const [isPlaying,        setIsPlaying]        = useState(false);
  const [fechaInicioRaw,   setFechaInicioRaw]   = useState(''); // YYYYMMDD o YYYYMMDDHHmm
  const [fechaFinRaw,      setFechaFinRaw]      = useState(''); // YYYYMMDD o YYYYMMDDHHmm
  const [duracionAnimacionMinutos, setDuracionAnimacionMinutos] = useState(60);
  const [horaReal,         setHoraReal]         = useState(() => new Date());
  const timerRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const fechaInicioUsuarioRef = useRef('');
  const fechaFinUsuarioRef = useRef('');

  // Layout
  const [activeTab,        setActiveTab]        = useState<TabId | null>(null);
  const filtrosAvionesInicializadosRef = useRef(false);

  // Umbrales dinámicos de capacidad
  const [umbralVerde, setUmbralVerde] = useState(30);
  const [umbralAmbar, setUmbralAmbar] = useState(70);
  const simInicioMinutos = resultado?.escenario === 1 ? getInicioOffsetMinutos(fechaInicioRaw) : 0;
  const maxSimDia = getMaxSimDia(fechaInicioRaw, fechaFinRaw);
  const maxTimelineMinutos = useMemo(() => getTimelineMaxMinutos(resultado), [resultado]);
  const diasSimulados = resultado?.cancelacionesPorDiaSA?.length ?? 0;
  const maxTotalMinutos = useMemo(
    () => calcularMaxTotalMinutos(resultado, fechaInicioRaw, fechaFinRaw, maxTimelineMinutos),
    [resultado, fechaInicioRaw, fechaFinRaw, maxTimelineMinutos],
  );
  const avanceMinutosPorSegundo = maxTotalMinutos !== null
    ? Math.max(1, maxTotalMinutos - simInicioMinutos) / Math.max(1, duracionAnimacionMinutos * 60)
    : 60;
  const rangoFinalizado   = maxTotalMinutos !== null && simTotalMinutos >= maxTotalMinutos;
  const simTotalVisual    = rangoFinalizado && maxTotalMinutos !== null
    ? Math.max(simInicioMinutos, maxTotalMinutos - (1 / 60))
    : simTotalMinutos;
  const simTranscurridoMinutos = Math.max(0, simTotalVisual - simInicioMinutos);
  const progresoSimulacion = maxTotalMinutos !== null
    ? Math.min(Math.max(simTranscurridoMinutos / Math.max(1, maxTotalMinutos - simInicioMinutos), 0), 1)
    : 0;
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

  // Derivados del contador visual: al finalizar conserva la última ocupación del rango
  const simDia           = Math.floor(simTotalVisual / 1440);
  const simHoraMinutos   = simTotalVisual % 1440;

  useEffect(() => {
    verificarSaludBackend().then(setBackendActivo);
  }, []);

  // Reloj de tiempo real
  useEffect(() => {
    const id = setInterval(() => setHoraReal(new Date()), 1000);
    return () => clearInterval(id);
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

  // Timer — avanza con requestAnimationFrame y limita commits React para mantener fluida la UI.
  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current !== null) cancelAnimationFrame(timerRef.current);
      timerRef.current = null;
      lastFrameRef.current = null;
      return;
    }

    lastFrameRef.current = null;

    const step = (timestamp: number) => {
      if (lastFrameRef.current === null) {
        lastFrameRef.current = timestamp;
        timerRef.current = requestAnimationFrame(step);
        return;
      }

      const deltaMs = timestamp - lastFrameRef.current;

      if (deltaMs < MAP_FRAME_INTERVAL_MS) {
        timerRef.current = requestAnimationFrame(step);
        return;
      }

      lastFrameRef.current = timestamp;

      let continuar = true;
      setSimTotalMinutos(prev => {
        const next = prev + (deltaMs / 1000) * avanceMinutosPorSegundo;
        if (maxTotalMinutos !== null && next >= maxTotalMinutos) {
          continuar = false;
          setIsPlaying(false);
          return maxTotalMinutos;
        }
        return next;
      });

      setRealElapsedMs(prev => prev + deltaMs);

      if (continuar) {
        timerRef.current = requestAnimationFrame(step);
      }
    };

    timerRef.current = requestAnimationFrame(step);

    return () => {
      if (timerRef.current !== null) cancelAnimationFrame(timerRef.current);
      timerRef.current = null;
      lastFrameRef.current = null;
    };
  }, [isPlaying, maxTotalMinutos, avanceMinutosPorSegundo]);

  const handleReiniciar = () => {
    setResultado(null);
    setIsPlaying(false);
    setSimTotalMinutos(0);
    setRealElapsedMs(0);
    setFechaInicioRaw('');
    setFechaFinRaw('');
    fechaInicioUsuarioRef.current = '';
    fechaFinUsuarioRef.current = '';
    filtrosAvionesInicializadosRef.current = false;
    setFiltrosAvionesMapa(FILTROS_AVIONES_INICIALES);
  };

  const handleStop = () => {
    setIsPlaying(false);
    setSimTotalMinutos(simInicioMinutos);
    setRealElapsedMs(0);
  };

  const handleTabClick = useCallback((id: TabId) => {
    setActiveTab(prev => {
      const next = prev === id ? null : id;
      if (next) setVueloModal(null);
      return next;
    });
  }, []);

  const handleSelectVuelo = useCallback((vuelo: TramoDTO) => {
    setActiveTab(null);
    setVueloModal(vuelo);
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
            <p className="text-slate-400 text-sm mt-2">
              Cargue los datos maestros para inicializar el Dashboard de Simulación
            </p>
          </div>
          <ControlPanel
            onResultado={(resChunks) => {
              const res = combineChunks(resChunks);
              if (res) {
                setResultado(res);
                inicializarFiltrosAvionesMapa();
                setSimTotalMinutos(getInicioOffsetMinutos(fechaInicioUsuarioRef.current));
                setRealElapsedMs(0);
                // fechaInicioRaw ya fue seteado por onFechaInicio antes de ejecutar
                // res.fechaFin es el último chunk en YYYYMMDD
                aplicarFechasSimulacion(res, setFechaInicioRaw, setFechaFinRaw, fechaInicioUsuarioRef.current, fechaFinUsuarioRef.current);
                setIsPlaying(true);
              }
            }}
            onProgressJob={(job) => {
              const res = combineChunks(job.chunks);
              if (res) {
                if (!resultado) {
                  setResultado(res);
                  inicializarFiltrosAvionesMapa();
                  setSimTotalMinutos(getInicioOffsetMinutos(fechaInicioUsuarioRef.current));
                  setRealElapsedMs(0);
                  aplicarFechasSimulacion(res, setFechaInicioRaw, setFechaFinRaw, fechaInicioUsuarioRef.current, fechaFinUsuarioRef.current);
                } else {
                  setResultado(res);
                  aplicarFechasSimulacion(res, setFechaInicioRaw, setFechaFinRaw, fechaInicioUsuarioRef.current, fechaFinUsuarioRef.current);
                }
              }
            }}
            onError={setError}
            onCargando={setCargando}
            onFechaInicio={handleFechaInicioPanel}
            onFechaFin={handleFechaFinPanel}
            onDuracionSimulacion={setDuracionAnimacionMinutos}
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
          <div className="mt-8 flex justify-center">
            <div className={`text-[10px] flex items-center gap-1.5 px-3 py-1.5 rounded-full border
              ${backendActivo
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${backendActivo ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
              Backend: {backendActivo ? 'Conectado' : 'Offline'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════
  // VISTA DASHBOARD
  // ══════════════════════════════════════════════
  return (
    <div className="h-screen bg-[#0a1628] flex flex-col overflow-hidden text-slate-200">

      {/* ── HEADER ── */}
      <header className="bg-[#0f1f3d] border-b border-slate-700/50 px-4 py-0 flex items-center gap-3 shrink-0 h-14">
        {/* Logo */}
        <img src="/logo.png" alt="LoadRoute Logo" className="h-8 shrink-0" />
        <div className="w-px h-6 bg-slate-700/60 shrink-0" />

        {/* Fecha simulada + GMT + Transcurrido + Progreso */}
        <div className="flex items-center gap-4 flex-1">
          <div className="flex flex-col justify-center">
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider leading-none mb-1">Simulación</span>
            <span className="text-xs font-semibold text-slate-100 capitalize leading-none">
              {formatFechaSimulacion(fechaInicioRaw, simDia)}
            </span>
          </div>
          <div className="flex flex-col justify-center">
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider leading-none mb-1">Hora GMT</span>
            <span className="text-lg font-mono text-emerald-300 font-bold leading-none tracking-wider">
              {formatoHora(simHoraMinutos)}
            </span>
          </div>

          {/* Tiempo transcurrido */}
          <div className="flex flex-col justify-center">
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider leading-none mb-1">Transcurrido</span>
            <span className="text-xs font-mono text-indigo-200 font-semibold leading-none">
              {formatTiempoTranscurrido(simTranscurridoMinutos)}
            </span>
          </div>

          {/* Tiempo Real Transcurrido */}
          {resultado?.escenario === 1 && (
            <div className="flex flex-col justify-center">
              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider leading-none mb-1">Tiempo Real</span>
              <span className="text-xs font-mono text-cyan-300 font-bold leading-none">
                {formatTiempoReal(realElapsedMs)}
              </span>
            </div>
          )}

          {/* Barra de progreso */}
          {maxTotalMinutos !== null && maxTotalMinutos > 0 && (
            <div className="flex flex-col justify-center w-20">
              <div className="flex justify-between text-[10px] font-bold text-slate-300 mb-1">
                <span>Progreso</span>
                <span>{Math.round(progresoSimulacion * 100)}%</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 rounded-full transition-all duration-300"
                  style={{ width: `${progresoSimulacion * 100}%` }}
                />
              </div>
            </div>
          )}

          {rangoFinalizado && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
              <IconCheck size={12} /> Finalizado
            </span>
          )}

          {/* Controles Play/Pause/Stop */}
          <div className="flex items-center gap-1 ml-2">
            <button
              id="btn-play"
              onClick={() => setIsPlaying(true)}
              disabled={isPlaying || rangoFinalizado}
              title="Iniciar simulación"
              className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-all
                ${isPlaying || rangoFinalizado
                  ? 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
                  : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 hover:text-emerald-300 ring-1 ring-emerald-500/30'}`}
            ><IconPlay size={14} /></button>
            <button
              id="btn-pause"
              onClick={() => setIsPlaying(false)}
              disabled={!isPlaying}
              title="Pausar simulación"
              className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-all
                ${!isPlaying
                  ? 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
                  : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 hover:text-amber-300 ring-1 ring-amber-500/30'}`}
            ><IconPause size={14} /></button>
            <button
              id="btn-stop"
              onClick={handleStop}
              title="Detener y reiniciar tiempo"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-all
                bg-slate-800/50 text-slate-400 hover:bg-red-500/20 hover:text-red-400 ring-1 ring-slate-700/50"
            ><IconStop size={14} /></button>
          </div>
        </div>

        {/* Hora Real */}
        <div className="flex flex-col items-end justify-center shrink-0">
          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider leading-none mb-1">Hora actual</span>
          <span className="text-sm font-mono text-slate-100 font-semibold leading-none">
            {horaReal.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
        <div className="w-px h-6 bg-slate-700/60 shrink-0" />

        {/* Backend status */}
        <div className={`text-[10px] flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border shrink-0
          ${backendActivo
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
            : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${backendActivo ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
          {backendActivo ? 'Conectado' : 'Offline'}
        </div>
      </header>

      {/* ── BODY ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── NAV STRIP (56px, siempre visible, fuera del área del mapa) ── */}
        <nav className="w-14 bg-[#0c1a30]/95 backdrop-blur-sm border-r border-slate-700/50 flex flex-col items-center py-4 gap-2 shrink-0 z-30">
          {NAV_TABS.map(tab => {
            const isActive = activeTab === tab.id;
              const activeColors: Record<string, string> = {
                blue:    'bg-blue-500/20 text-blue-400 shadow-blue-500/20',
                emerald: 'bg-emerald-500/20 text-emerald-400 shadow-emerald-500/20',
                violet:  'bg-violet-500/20 text-violet-400 shadow-violet-500/20',
                cyan:    'bg-cyan-500/20 text-cyan-300 shadow-cyan-500/20',
                orange:  'bg-orange-500/20 text-orange-400 shadow-orange-500/20',
                indigo:  'bg-indigo-500/20 text-indigo-300 shadow-indigo-500/20',
                rose:    'bg-rose-500/20 text-rose-400 shadow-rose-500/20',
              };
            return (
              <div key={tab.id} className="relative group">
                <button
                  onClick={() => handleTabClick(tab.id)}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200
                    ${isActive
                      ? `${activeColors[tab.color]} shadow-lg ring-1 ring-current/20`
                      : 'text-slate-300 hover:text-slate-100 hover:bg-slate-700/60'}`}
                  aria-label={tab.label}
                >
                  {tab.icon}
                </button>
                {/* Tooltip */}
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2.5 py-1.5
                                bg-slate-800 text-slate-100 text-xs rounded-lg border border-slate-700
                                whitespace-nowrap shadow-xl
                                opacity-0 group-hover:opacity-100 transition-opacity duration-150
                                pointer-events-none z-50">
                  {tab.label}
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-800" />
                </div>
              </div>
            );
          })}
        </nav>

        {/* ── MAPA — ocupa TODO el espacio restante. Los paneles flotan encima ── */}
        <main className="flex-1 relative overflow-hidden">
          <MapaRutas
            resultado={resultado}
            simTiempoMinutos={simTotalVisual}
            cargasAeropuertoOverride={cargasAeropuertoFinales}
            onSelectVuelo={handleSelectVuelo}
            selectedVuelo={vueloModal}
            umbralVerde={umbralVerde}
            umbralAmbar={umbralAmbar}
            modoMapa="sa"
            onModoMapa={() => {}}
            filtrosAviones={filtrosAvionesMapa}
          />

          {/* ── INDICADORES GLOBALES (flotante, esquina inferior-izquierda del mapa) ── */}
          {globalStatsAeropuertos && globalStatsAeropuertos.capacidad > 0 && (
            <div className="absolute bottom-10 left-20 z-[500] pointer-events-none">
              <div className="bg-[#0c1a30]/90 border border-slate-700/50 rounded-xl px-3 py-2.5 backdrop-blur-sm min-w-[190px]">
                <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Ocupación Global</p>
                {(() => {
                  const pct = Math.round((globalStatsAeropuertos.carga / globalStatsAeropuertos.capacidad) * 100);
                  const color = pct > umbralAmbar ? 'text-red-400'   : pct > umbralVerde ? 'text-amber-400'  : 'text-emerald-400';
                  const bg    = pct > umbralAmbar ? 'bg-red-500'     : pct > umbralVerde ? 'bg-amber-500'   : 'bg-emerald-500';
                  const dotColor = pct > umbralAmbar ? 'bg-red-500' : pct > umbralVerde ? 'bg-amber-500' : 'bg-emerald-500';
                  return (
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <IconWarehouse size={12} /> Almacenes
                        </span>
                        <span className={`text-[10px] font-bold ${color} flex items-center gap-1`}>
                          <span className={`w-2 h-2 rounded-full ${dotColor}`} /> {pct}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-1">
                        <div className={`h-full rounded-full transition-all duration-500 ${bg}`} style={{ width: `${Math.min(pct,100)}%` }} />
                      </div>
                      <p className="text-[9px] text-slate-500">
                        {globalStatsAeropuertos.carga.toLocaleString()} / {globalStatsAeropuertos.capacidad.toLocaleString()} maletas
                      </p>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* ── PANEL LATERAL IZQUIERDO — flotante, no afecta el ancho del mapa ── */}
          <div
            className="absolute top-0 left-0 h-full z-[1000] overflow-hidden pointer-events-none"
            style={{ width: getPanelWidth(activeTab), transition: 'width 0.25s ease' }}
          >
            <div className="pointer-events-auto h-full bg-[#0c1a30]/95 border-r border-slate-700/50 backdrop-blur-sm flex flex-col"
                 style={{ width: getPanelWidth(activeTab) }}>
              {/* Header del panel con botón cerrar */}
              <div className="px-4 py-3 bg-[#0f1f3d]/80 border-b border-slate-700/50 shrink-0 flex items-center justify-between backdrop-blur-sm">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  {NAV_TABS.find(t => t.id === activeTab)?.label ?? ''}
                </span>
                <button
                  onClick={() => setActiveTab(null)}
                  className="text-slate-600 hover:text-slate-300 text-lg leading-none transition-colors"
                  aria-label="Cerrar panel"
                >
                  <IconClose size={18} />
                </button>
              </div>
              {/* Contenido */}
              <div className="flex-1 min-h-0 overflow-hidden">
                {(activeTab === 'pedidos' || activeTab === 'aeropuertos') && (
                  <SidebarInfo
                    envios={rutasActivas}
                    aeropuertos={resultado.aeropuertos}
                    activeTab={activeTab}
                    simTiempoMinutos={simTotalVisual}
                    cargasAeropuertoOverride={cargasAeropuertoFinales}
                    onSelectEnvio={setEnvioModal}
                    onSelectAeropuerto={setAeroModal}
                  />
                )}
                {activeTab === 'simulacion' && (
                  <SimulacionPanel
                    umbralVerde={umbralVerde}
                    umbralAmbar={umbralAmbar}
                    onUmbralVerde={handleUmbralVerde}
                    onUmbralAmbar={handleUmbralAmbar}
                    onReiniciar={handleReiniciar}
                    duracionAnimacionMinutos={duracionAnimacionMinutos}
                    onDuracionAnimacion={setDuracionAnimacionMinutos}
                    escenario={resultado.escenario}
                    diasSimulados={diasSimulados}
                  />
                )}
                {activeTab === 'pantalla' && (
                  <SidebarFiltroMapa
                    aeropuertos={resultado.aeropuertos}
                    filtros={filtrosAvionesMapa}
                    onChange={setFiltrosAvionesMapa}
                  />
                )}
                {activeTab === 'vuelos' && (
                  <SidebarVuelos
                    vuelos={resultado.vuelosMaestros || []}
                    cancelacionesPorDia={resultado.cancelacionesPorDiaSA || []}
                    simDia={simDia}
                    maxDia={
                      diasSimulados > 0
                        ? diasSimulados - 1
                        : maxSimDia !== null
                          ? maxSimDia
                          : 0
                    }
                    rutasActivas={rutasActivas}
                    umbralVerde={umbralVerde}
                    umbralAmbar={umbralAmbar}
                  />
                )}
                {activeTab === 'administracion' && (
                  <AdminPanel />
                )}
                {activeTab === 'resultados' && (
                  <div className="h-full overflow-y-auto custom-scrollbar p-4">
                    <ResultadosPanel
                      resultadoSA={resultado.resultadoSA || null}
                      resultadoALNS={resultado.resultadoALNS || null}
                      escenario={resultado.escenario}
                      totalVuelos={resultado.totalVuelos}
                      totalEnvios={resultado.totalEnviosCargados}
                      resultadoCompleto={resultado}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* ── MODALS ── */}
      <ModalEnvio envio={envioModal} onClose={() => setEnvioModal(null)} />
      <ModalAeropuerto
        aeropuerto={aeroModal}
        rutasActivas={rutasActivas}
        simTiempoMinutos={simTotalVisual}
        cargasAeropuertoOverride={cargasAeropuertoFinales}
        onClose={() => setAeroModal(null)}
      />
      <ModalVuelo
        vuelo={vueloModal}
        rutasActivas={rutasActivas}
        onClose={() => setVueloModal(null)}
      />
    </div>
  );
}
