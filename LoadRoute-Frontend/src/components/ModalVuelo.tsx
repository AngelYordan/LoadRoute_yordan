import { RutaMuestra, TramoDTO } from '@/types/rutas';
import { porcentajeOcupacion, formatPorcentaje } from '@/utils/capacidad';
import { IconPlane, IconClose } from '@/components/icons';

interface ModalVueloProps {
  vuelo: TramoDTO | null;
  rutasActivas: RutaMuestra[];
  onClose: () => void;
  onSelectEnvio: (envio: RutaMuestra) => void;
}

export default function ModalVuelo({ vuelo, rutasActivas, onClose, onSelectEnvio }: ModalVueloProps) {
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

  const porcentaje = formatPorcentaje(porcentajeOcupacion(cargaActual, vuelo.capacidad));

  return (
    <div className="fixed left-16 top-16 z-[10000] w-[340px] max-w-[calc(100vw-5rem)] max-h-[calc(100vh-5rem)] flex flex-col bg-[#0f1f3d]/95 border border-slate-700 rounded-lg shadow-2xl animate-in fade-in slide-in-from-left-2 duration-200">
        
        {/* Header */}
        <div className="px-3 py-2.5 border-b border-slate-700/50 flex items-center justify-between bg-black/15 rounded-t-lg shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
              <IconPlane size={16} className="text-blue-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-white leading-tight truncate">Vuelo #{vuelo.vueloId}</h3>
              <p className="text-[11px] font-semibold text-emerald-400 tracking-wider">
                {vuelo.origen} → {vuelo.destino}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full hover:bg-slate-700/50 flex items-center justify-center text-slate-400 hover:text-white transition-colors shrink-0"
          >
            <IconClose size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-3 space-y-3 overflow-y-auto custom-scrollbar flex-1 min-h-0">
            
          {/* Horarios */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-md p-2 text-center">
              <p className="text-[9px] text-slate-400 uppercase tracking-widest mb-0.5">Despegue</p>
              <p className="text-base font-mono text-slate-200">{vuelo.horaSalidaLocal}</p>
              <p className="text-[9px] text-slate-500">{vuelo.salidaMinutosGMT}m GMT</p>
            </div>
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-md p-2 text-center">
              <p className="text-[9px] text-slate-400 uppercase tracking-widest mb-0.5">Aterrizaje</p>
              <p className="text-base font-mono text-slate-200">{vuelo.horaLlegadaLocal}</p>
              <p className="text-[9px] text-slate-500">{vuelo.llegadaMinutosGMT}m GMT</p>
            </div>
          </div>
          
          {/* Capacidad en Vivo */}
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-md p-2.5">
            <div className="flex justify-between items-end mb-1.5">
              <div>
                 <p className="text-[9px] text-slate-400 uppercase tracking-widest">Ocupación Actual</p>
                 <p className="text-base font-bold text-white">
                   {cargaActual} <span className="text-xs font-normal text-slate-500">/ {vuelo.capacidad} maletas</span>
                 </p>
              </div>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                  cargaActual > vuelo.capacidad ? 'bg-red-500/20 text-red-400' :
                  cargaActual > vuelo.capacidad * 0.8 ? 'bg-amber-500/20 text-amber-400' :
                  'bg-emerald-500/20 text-emerald-400'
               }`}>
                 {porcentaje}%
              </span>
            </div>
            {/* ProgressBar */}
            <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
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
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-md overflow-hidden">
            <div className="px-2.5 py-2 border-b border-slate-700/50 flex items-center justify-between gap-3">
              <p className="text-[9px] text-slate-400 uppercase tracking-widest">Envíos en este avión</p>
              <span className="text-[10px] font-semibold text-blue-300 bg-blue-500/15 border border-blue-500/20 rounded px-2 py-0.5">
                {enviosEnVuelo.length}
              </span>
            </div>

            {enviosEnVuelo.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-slate-500">
                No hay envíos asignados a este vuelo.
              </p>
            ) : (
              <div className="max-h-44 overflow-y-auto custom-scrollbar divide-y divide-slate-700/50">
                {enviosEnVuelo.map(envio => (
                  <button
                    key={envio.envioId}
                    type="button"
                    onClick={() => onSelectEnvio(envio)}
                    className="w-full px-2.5 py-2 text-left hover:bg-blue-500/10 focus:outline-none focus-visible:bg-blue-500/15 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-blue-300 truncate">{envio.envioId}</p>
                        <p className="mt-0.5 text-[10px] font-mono text-slate-400">
                          {envio.origen} <span className="text-slate-600">→</span> {envio.destino}
                        </p>
                      </div>
                      <span className="shrink-0 bg-slate-900/80 text-[10px] px-2 py-0.5 rounded text-slate-300">
                        {envio.maletas} maletas
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>
    </div>
  );
}
