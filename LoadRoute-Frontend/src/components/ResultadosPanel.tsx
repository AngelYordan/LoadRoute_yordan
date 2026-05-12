'use client';

import React from 'react';
import { ResultadoAlgoritmo } from '@/types/rutas';

interface ResultadosPanelProps {
  resultadoSA: ResultadoAlgoritmo | null;
  resultadoALNS: ResultadoAlgoritmo | null;
  escenario: number;
  totalVuelos: number;
  totalEnvios: number;
}

function AlgoritmoBloque({ res }: { res: ResultadoAlgoritmo }) {
  const coberturaPct = ((res.enviosAsignados / Math.max(res.totalEnvios, 1)) * 100).toFixed(0);
  const noAceptados  = res.enviosNoAceptados || 0;

  return (
    <div className="rounded-lg border border-blue-500/20 overflow-hidden">
      {res.mensajeColapso && (
        <div className="bg-red-900/50 border-b border-red-500/50 p-3 text-red-300 text-xs font-bold text-center animate-pulse shadow-inner">
          ⚠️ {res.mensajeColapso}
        </div>
      )}

      {/* Cobertura */}
      <div className="px-4 py-3 bg-blue-500/10 flex items-center justify-between">
        <span className="text-sm font-semibold text-blue-400">Cobertura de Envíos</span>
        <span className={`text-sm font-bold ${noAceptados > 0 ? 'text-amber-300' : 'text-emerald-400'}`}>
          {res.enviosAsignados}/{res.totalEnvios} ({coberturaPct}%)
        </span>
      </div>

      {noAceptados > 0 && (
        <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between text-xs">
          <span className="text-amber-300 font-semibold">Sin ruta por capacidad</span>
          <span className="font-mono text-amber-200 font-bold">{noAceptados}</span>
        </div>
      )}

      {/* Tabla de rutas */}
      {res.rutasMuestra && res.rutasMuestra.length > 0 && (
        <div>
          <div className="px-4 py-2 bg-slate-800/30">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Rutas Planificadas ({res.rutasMuestra.length.toLocaleString()})
            </p>
          </div>
          <div className="overflow-x-auto">
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
                {res.rutasMuestra.map((ruta, i) => (
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
}: ResultadosPanelProps) {
  const resultado = resultadoSA || resultadoALNS;
  if (!resultado) return null;

  return (
    <div className="space-y-4 fade-in-up">
      <div className="flex items-center gap-4 text-xs text-slate-400 px-1">
        <span>Red: <strong className="text-slate-200">{totalVuelos.toLocaleString()}</strong> vuelos</span>
        <span className="text-slate-600">|</span>
        <span>Envíos procesados: <strong className="text-slate-200">{totalEnvios.toLocaleString()}</strong></span>
        <span className="text-slate-600">|</span>
        <span>Escenario: <strong className="text-slate-200">{escenario}</strong></span>
      </div>
      <AlgoritmoBloque res={resultado} />
    </div>
  );
}

export default React.memo(ResultadosPanel);
