import { RutaMuestra, TramoDTO } from '@/types/rutas';

interface ModalVueloProps {
  vuelo: TramoDTO | null;
  rutasActivas: RutaMuestra[];
  onClose: () => void;
}

export default function ModalVuelo({ vuelo, rutasActivas, onClose }: ModalVueloProps) {
  if (!vuelo) return null;

  const coincideConVuelo = (tramo: TramoDTO) => (
    tramo.vueloId === vuelo.vueloId &&
    tramo.origen === vuelo.origen &&
    tramo.destino === vuelo.destino &&
    tramo.salidaMinutosGMT === vuelo.salidaMinutosGMT &&
    tramo.llegadaMinutosGMT === vuelo.llegadaMinutosGMT &&
    (tramo.diaOffset ?? 0) === (vuelo.diaOffset ?? 0)
  );

  const enviosEnVuelo = rutasActivas
    .filter(r => r.tramos && r.tramos.some(coincideConVuelo));

  // Calcular ocupación actual 
  const cargaActual = enviosEnVuelo.reduce((sum, r) => sum + r.maletas, 0);

  const porcentaje = Math.min((cargaActual / Math.max(vuelo.capacidad, 1)) * 100, 100).toFixed(1);

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#0f1f3d] border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-700/50 flex items-center justify-between bg-black/20 rounded-t-xl shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <span className="text-xl">✈️</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white leading-tight">Vuelo #{vuelo.vueloId}</h3>
              <p className="text-[11px] font-semibold text-emerald-400 tracking-wider">
                {vuelo.origen} → {vuelo.destino}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-700/50 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1 min-h-0">
            
          {/* Horarios */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Despegue</p>
              <p className="text-xl font-mono text-slate-200">{vuelo.horaSalidaLocal}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{vuelo.salidaMinutosGMT}m GMT</p>
            </div>
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Aterrizaje</p>
              <p className="text-xl font-mono text-slate-200">{vuelo.horaLlegadaLocal}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{vuelo.llegadaMinutosGMT}m GMT</p>
            </div>
          </div>
          
          {/* Capacidad en Vivo */}
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
            <div className="flex justify-between items-end mb-2">
              <div>
                 <p className="text-[10px] text-slate-400 uppercase tracking-widest">Ocupación Actual</p>
                 <p className="text-lg font-bold text-white">
                   {cargaActual} <span className="text-sm font-normal text-slate-500">/ {vuelo.capacidad} maletas</span>
                 </p>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  cargaActual > vuelo.capacidad ? 'bg-red-500/20 text-red-400' :
                  cargaActual > vuelo.capacidad * 0.8 ? 'bg-amber-500/20 text-amber-400' :
                  'bg-emerald-500/20 text-emerald-400'
               }`}>
                 {porcentaje}%
              </span>
            </div>
            {/* ProgressBar */}
            <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
               <div 
                 className={`h-full transition-all duration-500 ${
                    cargaActual > vuelo.capacidad ? 'bg-red-500' :
                    cargaActual > vuelo.capacidad * 0.8 ? 'bg-amber-500' :
                    'bg-emerald-500'
                 }`} 
                 style={{ width: `${porcentaje}%` }}
               />
            </div>
          </div>
          
          {/* Envíos del vuelo */}
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-700/50 flex items-center justify-between gap-3">
              <p className="text-[10px] text-slate-400 uppercase tracking-widest">Envíos en este avión</p>
              <span className="text-[10px] font-semibold text-blue-300 bg-blue-500/15 border border-blue-500/20 rounded px-2 py-0.5">
                {enviosEnVuelo.length}
              </span>
            </div>

            {enviosEnVuelo.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-slate-500">
                No hay envíos asignados a este vuelo.
              </p>
            ) : (
              <div className="max-h-56 overflow-y-auto custom-scrollbar divide-y divide-slate-700/50">
                {enviosEnVuelo.map(envio => (
                  <div key={envio.envioId} className="px-3 py-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-blue-300 truncate">{envio.envioId}</p>
                        <p className="mt-1 text-[11px] font-mono text-slate-400">
                          {envio.origen} <span className="text-slate-600">→</span> {envio.destino}
                        </p>
                      </div>
                      <span className="shrink-0 bg-slate-900/80 text-[10px] px-2 py-0.5 rounded text-slate-300">
                        {envio.maletas} maletas
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
