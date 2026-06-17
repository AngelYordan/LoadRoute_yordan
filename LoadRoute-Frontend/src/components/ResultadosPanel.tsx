'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ResultadoAlgoritmo, RutaResponse } from '@/types/rutas';
import { exportarAExcel, exportarAPDF } from '@/utils/exportUtils';
import { IconWarning, IconFilePdf, IconFileExcel } from '@/components/icons';

interface ResultadosPanelProps {
  resultadoSA: ResultadoAlgoritmo | null;
  resultadoALNS: ResultadoAlgoritmo | null;
  escenario: number;
  totalVuelos: number;
  totalEnvios: number;
  resultadoCompleto: RutaResponse | null;
}

function AlgoritmoBloque({ res }: { res: ResultadoAlgoritmo }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Resetear a la página 1 si cambia la lista
  useEffect(() => {
    setCurrentPage(1);
  }, [res.rutasMuestra]);

  // Ajustar cantidad de elementos por página según la altura de la pantalla
  useEffect(() => {
    const handleResize = () => {
      const height = window.innerHeight;
      const occupied = 350; // altura aproximada de cabecera, filtros, botones, etc.
      const available = Math.max(200, height - occupied);
      const calculatedPageSize = Math.max(5, Math.floor(available / 40)); // 40px por fila aprox.
      setPageSize(calculatedPageSize);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const totalPages = Math.max(1, Math.ceil((res.rutasMuestra?.length || 0) / pageSize));

  const paginatedRutas = useMemo(() => {
    if (!res.rutasMuestra) return [];
    const start = (currentPage - 1) * pageSize;
    return res.rutasMuestra.slice(start, start + pageSize);
  }, [res.rutasMuestra, currentPage, pageSize]);

  const coberturaPct = ((res.enviosAsignados / Math.max(res.totalEnvios, 1)) * 100).toFixed(0);
  const noAceptados  = res.enviosNoAceptados || 0;

  return (
    <div className="rounded-lg border border-blue-500/20 overflow-hidden flex flex-col">
      {res.mensajeColapso && (
        <div className="bg-red-900/50 border-b border-red-500/50 p-3 text-red-300 text-xs font-bold text-center animate-pulse shadow-inner">
          <span className="flex items-center justify-center gap-1.5">
            <IconWarning size={14} className="shrink-0" /> {res.mensajeColapso}
          </span>
        </div>
      )}

      {/* Cobertura */}
      <div className="px-4 py-3 bg-blue-500/10 flex items-center justify-between shrink-0">
        <span className="text-sm font-semibold text-blue-400">Cobertura de Envíos</span>
        <span className={`text-sm font-bold ${noAceptados > 0 ? 'text-amber-300' : 'text-emerald-400'}`}>
          {res.enviosAsignados}/{res.totalEnvios} ({coberturaPct}%)
        </span>
      </div>

      {noAceptados > 0 && (
        <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between text-xs shrink-0">
          <span className="text-amber-300 font-semibold">Sin ruta por capacidad</span>
          <span className="font-mono text-amber-200 font-bold">{noAceptados}</span>
        </div>
      )}

      {/* Tabla de rutas */}
      {res.rutasMuestra && res.rutasMuestra.length > 0 && (
        <div className="flex flex-col min-h-0">
          <div className="px-4 py-2 bg-slate-800/30 shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Rutas Planificadas ({res.rutasMuestra.length.toLocaleString()})
            </p>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700/40 text-slate-400">
                  <th className="text-left px-4 py-2 font-medium">Envío</th>
                  <th className="text-left px-4 py-2 font-medium">Ruta</th>
                  <th className="text-right px-4 py-2 font-medium">Maletas</th>
                  <th className="text-right px-4 py-2 font-medium">SLA</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRutas.map((ruta, i) => (
                  <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-2 font-mono text-slate-300">{ruta.envioId.slice(-5)}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="font-semibold text-blue-300">{ruta.origen}</span>
                        {ruta.tramos.map((t, j) => (
                          <React.Fragment key={j}>
                            <span className="text-slate-500">→</span>
                            <span className="text-emerald-300">{t.destino}</span>
                          </React.Fragment>
                        ))}
                      </div>
                    </td>
                    <td className="text-right px-4 py-2 text-slate-300">{ruta.maletas}</td>
                    <td className="text-right px-4 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold
                        ${ruta.slaHoras <= 24 ? 'bg-blue-500/20 text-blue-300' : 'bg-amber-500/20 text-amber-300'}`}>
                        {ruta.slaHoras}h
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {res.rutasMuestra.length > pageSize && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-700/40 bg-slate-900/10 text-xs shrink-0">
              <button
                type="button"
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
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700/60 text-[10px] font-semibold text-slate-300 hover:bg-slate-700/50 hover:text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResultadosPanel({
  resultadoSA,
  resultadoALNS,
  escenario,
  totalVuelos,
  totalEnvios,
  resultadoCompleto,
}: ResultadosPanelProps) {
  const resultado = resultadoSA || resultadoALNS;
  if (!resultado || !resultadoCompleto) return null;

  return (
    <div className="space-y-4 fade-in-up h-full flex flex-col overflow-hidden">
      <div className="flex items-center gap-4 text-xs text-slate-400 px-1 shrink-0">
        <span>Red: <strong className="text-slate-200">{totalVuelos.toLocaleString()}</strong> vuelos</span>
        <span className="text-slate-600">|</span>
        <span>Envíos procesados: <strong className="text-slate-200">{totalEnvios.toLocaleString()}</strong></span>
        <span className="text-slate-600">|</span>
        <span>Escenario: <strong className="text-slate-200">{escenario}</strong></span>
      </div>

      <div className="flex gap-2 shrink-0">
        <button
          onClick={() => exportarAPDF(resultadoCompleto)}
          className="flex-1 bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
        >
          <IconFilePdf size={14} /> Exportar PDF
        </button>
        <button
          onClick={() => exportarAExcel(resultadoCompleto)}
          className="flex-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
        >
          <IconFileExcel size={14} /> Exportar Excel
        </button>
      </div>

      <div className="flex-1 min-h-0">
        <AlgoritmoBloque res={resultado} />
      </div>
    </div>
  );
}

export default React.memo(ResultadosPanel);
