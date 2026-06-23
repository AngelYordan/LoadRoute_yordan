import { RutaMuestra } from '@/types/rutas';
import { IconClose, IconPackage } from '@/components/icons';

interface ModalEnvioProps {
  envio: RutaMuestra | null;
  onClose: () => void;
}

function formatGmtMinute(minutos?: number): string {
  if (minutos === undefined) return 'N/D';
  const total = ((Math.floor(minutos) % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60).toString().padStart(2, '0');
  const m = (total % 60).toString().padStart(2, '0');
  return `${h}:${m} GMT`;
}

export default function ModalEnvio({ envio, onClose }: ModalEnvioProps) {
  if (!envio) return null;

  return (
    <div className="fixed left-16 top-16 z-[10000] w-[340px] max-w-[calc(100vw-5rem)] max-h-[calc(100vh-5rem)] flex flex-col bg-[#0f1f3d]/95 border border-slate-700 rounded-lg shadow-2xl animate-in fade-in slide-in-from-left-2 duration-200">
      <div className="px-3 py-2.5 border-b border-slate-700/50 flex items-center justify-between bg-black/15 rounded-t-lg shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
            <IconPackage size={16} className="text-blue-300" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-white leading-tight truncate">Envio</h3>
            <p className="text-[11px] font-mono font-semibold text-blue-300 tracking-wide truncate">
              {envio.envioId}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-full hover:bg-slate-700/50 flex items-center justify-center text-slate-400 hover:text-white transition-colors shrink-0"
          aria-label="Cerrar modal de envio"
        >
          <IconClose size={16} />
        </button>
      </div>

      <div className="p-3 space-y-3 overflow-y-auto custom-scrollbar flex-1 min-h-0">
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-md p-2.5">
          <p className="text-[9px] text-slate-400 uppercase tracking-widest mb-1">Ruta del envio</p>
          <p className="text-base font-bold text-white">
            {envio.origen} <span className="text-slate-500">-&gt;</span> {envio.destino}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {envio.tramos.length} {envio.tramos.length === 1 ? 'tramo' : 'tramos'} asignados
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-md p-2 text-center">
            <p className="text-[9px] text-slate-400 uppercase tracking-widest mb-0.5">Maletas</p>
            <p className="text-base font-bold text-slate-200">{envio.maletas}</p>
          </div>
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-md p-2 text-center">
            <p className="text-[9px] text-slate-400 uppercase tracking-widest mb-0.5">SLA</p>
            <p className="text-base font-bold text-slate-200">{envio.slaHoras}h</p>
          </div>
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-md p-2 text-center">
            <p className="text-[9px] text-slate-400 uppercase tracking-widest mb-0.5">Recep.</p>
            <p className="text-[11px] font-mono font-semibold text-slate-200">
              {formatGmtMinute(envio.recepcionMinutosGMT)}
            </p>
          </div>
        </div>

        <div className="bg-slate-800/40 border border-slate-700/50 rounded-md overflow-hidden">
          <div className="px-2.5 py-2 border-b border-slate-700/50 flex items-center justify-between gap-3">
            <p className="text-[9px] text-slate-400 uppercase tracking-widest">Plan de vuelo</p>
            <span className="text-[10px] font-semibold text-blue-300 bg-blue-500/15 border border-blue-500/20 rounded px-2 py-0.5">
              {envio.tramos.length}
            </span>
          </div>

          {envio.tramos.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-slate-500">
              No hay ruta asignada para este envio.
            </p>
          ) : (
            <div className="max-h-56 overflow-y-auto custom-scrollbar divide-y divide-slate-700/50">
              {envio.tramos.map((tramo, i) => (
                <div key={`${tramo.vueloId}-${i}`} className="px-2.5 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-100">Vuelo #{tramo.vueloId}</p>
                      <p className="mt-0.5 text-[10px] font-mono text-slate-400">
                        {tramo.origen} <span className="text-slate-600">-&gt;</span> {tramo.destino}
                      </p>
                    </div>
                    <span className="shrink-0 bg-slate-900/80 text-[10px] px-2 py-0.5 rounded text-slate-300">
                      {tramo.capacidad} cap.
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div className="rounded bg-slate-900/40 px-2 py-1">
                      <p className="text-[9px] text-slate-500 uppercase tracking-widest">Sale</p>
                      <p className="text-[11px] font-mono text-slate-300">{tramo.horaSalidaLocal}</p>
                    </div>
                    <div className="rounded bg-slate-900/40 px-2 py-1">
                      <p className="text-[9px] text-slate-500 uppercase tracking-widest">Llega</p>
                      <p className="text-[11px] font-mono text-slate-300">{tramo.horaLlegadaLocal}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
