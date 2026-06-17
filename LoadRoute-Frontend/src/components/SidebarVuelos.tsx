import React, { useState, useEffect, useMemo } from 'react';
import { TramoDTO, RutaMuestra } from '@/types/rutas';
import { IconSearch } from '@/components/icons';

type SortKey = 'none' | 'ocupacion_desc' | 'ocupacion_asc' | 'salida_asc' | 'llegada_asc' | 'origen_az' | 'destino_az';

interface SidebarVuelosProps {
  vuelos: TramoDTO[];
  cancelacionesPorDia: number[][];
  simDia: number;
  maxDia: number;
  rutasActivas?: RutaMuestra[];
  umbralVerde?: number;
  umbralAmbar?: number;
}

/** Calcula maletas cargadas en cada vuelo en el día seleccionado */
function calcularOcupacionPorVuelo(
  rutasActivas: RutaMuestra[],
  diaSeleccionado: number
): Record<number, { carga: number; capacidad: number }> {
  const occ: Record<number, { carga: number; capacidad: number }> = {};
  for (const ruta of rutasActivas) {
    if (!ruta.tramos) continue;
    for (const tramo of ruta.tramos) {
      if ((tramo.diaOffset ?? 0) !== diaSeleccionado) continue;
      if (!occ[tramo.vueloId]) {
        occ[tramo.vueloId] = { carga: 0, capacidad: tramo.capacidad };
      }
      occ[tramo.vueloId].carga += ruta.maletas;
    }
  }
  return occ;
}

function getSemaforoColor(pct: number, umbralVerde: number, umbralAmbar: number) {
  if (pct <= umbralVerde) return { text: 'text-emerald-400', bg: 'bg-emerald-500', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', row: 'border-emerald-700/30 bg-emerald-950/10' };
  if (pct <= umbralAmbar) return { text: 'text-amber-400',   bg: 'bg-amber-500',   badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',     row: 'border-amber-700/30 bg-amber-950/10'   };
  return                         { text: 'text-red-400',     bg: 'bg-red-500',     badge: 'bg-red-500/20 text-red-300 border-red-500/30',             row: 'border-red-700/30 bg-red-950/10'       };
}

export default function SidebarVuelos({
  vuelos,
  cancelacionesPorDia,
  simDia,
  maxDia,
  rutasActivas = [],
  umbralVerde = 30,
  umbralAmbar = 70,
}: SidebarVuelosProps) {
  const [selectedDia, setSelectedDia] = useState<number>(simDia);
  const [searchTerm,  setSearchTerm]  = useState('');
  const [sortKey,     setSortKey]     = useState<SortKey>('none');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize,    setPageSize]    = useState(10);

  // Sincronizar selectedDia con simDia cuando avanza la simulación
  useEffect(() => {
    setSelectedDia(Math.min(simDia, maxDia));
  }, [simDia, maxDia]);

  // Resetear página cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortKey, selectedDia]);

  // Ajustar cantidad de elementos por página según la altura de la pantalla
  useEffect(() => {
    const handleResize = () => {
      const height = window.innerHeight;
      // Header is about 180px + paginación 45px + padding/márgenes. Fila de vuelo mide 110px aprox.
      const size = Math.max(3, Math.floor((height - 250) / 110));
      setPageSize(size);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const cancelacionesActivas = useMemo(
    () => new Set(cancelacionesPorDia[selectedDia] || []),
    [cancelacionesPorDia, selectedDia]
  );

  const ocupacionPorVuelo = useMemo(
    () => calcularOcupacionPorVuelo(rutasActivas, selectedDia),
    [rutasActivas, selectedDia]
  );

  const filtered = useMemo(() => {
    let result = vuelos.filter(v => {
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase();
      return (
        v.vueloId.toString().includes(q) ||
        v.origen.toLowerCase().includes(q) ||
        v.destino.toLowerCase().includes(q)
      );
    });

    if (sortKey !== 'none') {
      result = [...result].sort((a, b) => {
        const ocA = ocupacionPorVuelo[a.vueloId];
        const ocB = ocupacionPorVuelo[b.vueloId];
        switch (sortKey) {
          case 'ocupacion_desc': {
            const pA = ocA ? (ocA.carga / Math.max(ocA.capacidad, 1)) * 100 : 0;
            const pB = ocB ? (ocB.carga / Math.max(ocB.capacidad, 1)) * 100 : 0;
            return pB - pA;
          }
          case 'ocupacion_asc': {
            const pA = ocA ? (ocA.carga / Math.max(ocA.capacidad, 1)) * 100 : 0;
            const pB = ocB ? (ocB.carga / Math.max(ocB.capacidad, 1)) * 100 : 0;
            return pA - pB;
          }
          case 'salida_asc':  return a.salidaMinutosGMT - b.salidaMinutosGMT;
          case 'llegada_asc': return a.llegadaMinutosGMT - b.llegadaMinutosGMT;
          case 'origen_az':   return a.origen.localeCompare(b.origen);
          case 'destino_az':  return a.destino.localeCompare(b.destino);
          default: return 0;
        }
      });
    }

    return result;
  }, [vuelos, searchTerm, sortKey, ocupacionPorVuelo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedVuelos = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const cancelados = filtered.filter(v => cancelacionesActivas.has(v.vueloId)).length;
  const activos    = filtered.length - cancelados;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header ── */}
      <div className="px-3 pt-3 pb-2 bg-[#0f1f3d]/80 border-b border-slate-700/50 shrink-0 space-y-2 backdrop-blur-sm">
        <div className="flex justify-between items-center">
          <p className="text-xs font-semibold text-orange-400 uppercase tracking-wider">
            Vuelos de la Red
          </p>
          <select
            value={selectedDia}
            onChange={e => setSelectedDia(Number(e.target.value))}
            className="bg-slate-800 text-slate-200 text-xs border border-slate-700 rounded px-2 py-1 outline-none focus:border-orange-500/50"
          >
            {Array.from({ length: maxDia + 1 }).map((_, i) => (
              <option key={i} value={i}>Día {i + 1}</option>
            ))}
          </select>
        </div>

        {/* Búsqueda */}
        <div className="relative">
          <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por ID, origen o destino..."
            className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg pl-7 pr-3 py-1.5
                       text-xs text-slate-200 placeholder-slate-500
                       focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20"
          />
        </div>

        {/* Ordenar */}
        <select
          value={sortKey}
          onChange={e => setSortKey(e.target.value as SortKey)}
          className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-2 py-1.5
                     text-xs text-slate-300 outline-none focus:border-orange-500/50"
        >
          <option value="none">Ordenar por...</option>
          <option value="ocupacion_desc">↓ Ocupación (mayor primero)</option>
          <option value="ocupacion_asc">↑ Ocupación (menor primero)</option>
          <option value="salida_asc">Hora salida (próxima)</option>
          <option value="llegada_asc">Hora llegada (próxima)</option>
          <option value="origen_az">Origen (A–Z)</option>
          <option value="destino_az">Destino (A–Z)</option>
        </select>

        {/* Stats */}
        <div className="flex justify-between text-[10px] px-0.5">
          <span className="text-slate-400">{activos} programados</span>
          {cancelados > 0 && (
            <span className="text-red-400 font-bold">{cancelados} cancelados</span>
          )}
        </div>
      </div>

      {/* ── Lista ── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
        {paginatedVuelos.map(v => {
          const isCancelled = cancelacionesActivas.has(v.vueloId);
          const oc = ocupacionPorVuelo[v.vueloId];
          const pct = oc ? Math.round((oc.carga / Math.max(oc.capacidad, 1)) * 100) : 0;
          const sem = !isCancelled && oc ? getSemaforoColor(pct, umbralVerde, umbralAmbar) : null;

          const rowClass = isCancelled
            ? 'bg-red-950/20 border-red-900/50'
            : sem
              ? `${sem.row} hover:brightness-110`
              : 'bg-[#122340] border-slate-700/50 hover:bg-[#162a4d]';

          return (
            <div
              key={`${v.vueloId}-${v.diaOffset ?? 0}`}
              className={`border rounded-lg p-3 transition-all ${rowClass}`}
            >
              {/* Fila superior: ID + badge */}
              <div className="flex justify-between items-start mb-1.5">
                <span className={`font-mono text-sm font-bold ${isCancelled ? 'text-red-300' : 'text-slate-200'}`}>
                  Vuelo #{v.vueloId}
                </span>
                {isCancelled ? (
                  <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-[10px] rounded border border-red-500/30 font-semibold uppercase tracking-wider">
                    Cancelado
                  </span>
                ) : oc ? (
                  <span className={`px-2 py-0.5 text-[10px] rounded border font-semibold ${sem!.badge}`}>
                    {pct}%
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-slate-700/40 text-slate-400 text-[10px] rounded border border-slate-600/30">
                    Sin datos
                  </span>
                )}
              </div>

              {/* Ruta */}
              <div className="flex items-center gap-2 text-xs font-mono mb-1.5">
                <span className={isCancelled ? 'text-red-300/70' : 'text-orange-300'}>{v.origen}</span>
                <span className="text-slate-400">→</span>
                <span className={isCancelled ? 'text-red-300/70' : 'text-orange-300'}>{v.destino}</span>
              </div>

              {/* Barra de ocupación */}
              {oc && !isCancelled && (
                <div className="mb-1.5">
                  <div className="flex justify-between text-[10px] text-slate-200 mb-1">
                    <span>{oc.carga.toLocaleString()} / {oc.capacidad.toLocaleString()} maletas</span>
                    <span className={sem!.text}>{pct}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-900/80">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${sem!.bg}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Horarios */}
              <div className="flex justify-between text-[10px] text-slate-300">
                <span>Sale: {v.horaSalidaLocal}</span>
                <span>Llega: {v.horaLlegadaLocal}</span>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <p className="text-center text-xs text-slate-500 py-8">No se encontraron vuelos.</p>
        )}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-slate-700/40 bg-[#0f1f3d]/40 shrink-0">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700/60 text-[10px] font-semibold text-slate-300 hover:bg-slate-700/50 hover:text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Anterior
          </button>
          <span className="text-[10px] font-mono text-slate-400">
            Pág. {currentPage} de {totalPages}
          </span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700/60 text-[10px] font-semibold text-slate-300 hover:bg-slate-700/50 hover:text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
