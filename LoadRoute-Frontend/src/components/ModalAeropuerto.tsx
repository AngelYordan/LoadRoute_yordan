import { AeropuertoDTO, RutaMuestra } from '@/types/rutas';
import { calcularCargaAeropuertoActual, porcentajeOcupacion, formatPorcentaje } from '@/utils/capacidad';
import { IconBuilding, IconClose } from '@/components/icons';

interface ModalAeropuertoProps {
  aeropuerto: AeropuertoDTO | null;
  rutasActivas?: RutaMuestra[];
  simTiempoMinutos?: number;
  cargasAeropuertoOverride?: Record<string, number> | null;
  onClose: () => void;
}

export default function ModalAeropuerto({
  aeropuerto,
  rutasActivas,
  simTiempoMinutos,
  cargasAeropuertoOverride,
  onClose,
}: ModalAeropuertoProps) {
  if (!aeropuerto) return null;

  const rutas = rutasActivas ?? [];
  const cargaActual = cargasAeropuertoOverride?.[aeropuerto.codigo]
    ?? (simTiempoMinutos !== undefined
      ? calcularCargaAeropuertoActual(aeropuerto.codigo, rutas, simTiempoMinutos)
      : 0);
  const porcentajeValor = porcentajeOcupacion(cargaActual, aeropuerto.capacidadMax);
  const porcentaje = formatPorcentaje(porcentajeValor);
  const enColapso = aeropuerto.capacidadMax > 0 && cargaActual >= aeropuerto.capacidadMax;
  const enRiesgo = cargaActual > aeropuerto.capacidadMax * 0.8;

  const actividad = { salidas: 0, llegadas: 0, transito: 0 };
  for (const ruta of rutas) {
    if (!ruta.tramos || ruta.tramos.length === 0) continue;
    if (ruta.origen === aeropuerto.codigo) actividad.salidas++;
    if (ruta.destino === aeropuerto.codigo) actividad.llegadas++;
    for (let i = 0; i < ruta.tramos.length - 1; i++) {
      if (ruta.tramos[i].destino === aeropuerto.codigo) actividad.transito++;
    }
  }

  return (
    <div className="fixed left-16 top-16 z-[10000] w-[340px] max-w-[calc(100vw-5rem)] max-h-[calc(100vh-5rem)] flex flex-col bg-[#0f1f3d]/95 border border-slate-700 rounded-lg shadow-2xl animate-in fade-in slide-in-from-left-2 duration-200">
      <div className="px-3 py-2.5 border-b border-slate-700/50 flex items-center justify-between bg-black/15 rounded-t-lg shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
            <IconBuilding size={16} className="text-emerald-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-white leading-tight truncate">{aeropuerto.codigo}</h3>
            <p className="text-[11px] font-semibold text-emerald-400 tracking-wider truncate">
              {aeropuerto.ciudad}, {aeropuerto.pais}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-full hover:bg-slate-700/50 flex items-center justify-center text-slate-400 hover:text-white transition-colors shrink-0"
          aria-label="Cerrar modal de aeropuerto"
        >
          <IconClose size={16} />
        </button>
      </div>

      <div className="p-3 space-y-3 overflow-y-auto custom-scrollbar flex-1 min-h-0">
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-md p-2.5">
          <div className="flex justify-between items-end gap-3 mb-1.5">
            <div className="min-w-0">
              <p className="text-[9px] text-slate-400 uppercase tracking-widest">Ocupacion actual</p>
              <p className="text-base font-bold text-white">
                {cargaActual} <span className="text-xs font-normal text-slate-500">/ {aeropuerto.capacidadMax} maletas</span>
              </p>
            </div>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded shrink-0 ${
              enColapso ? 'bg-red-500/20 text-red-400' :
              enRiesgo ? 'bg-amber-500/20 text-amber-400' :
              'bg-emerald-500/20 text-emerald-400'
            }`}>
              {porcentaje}%
            </span>
          </div>
          <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                enColapso ? 'bg-red-500' :
                enRiesgo ? 'bg-amber-500' :
                'bg-emerald-500'
              }`}
              style={{ width: `${porcentajeValor}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-md p-2 text-center">
            <p className="text-[9px] text-slate-400 uppercase tracking-widest mb-0.5">Zona</p>
            <p className="text-base font-mono text-slate-200">GMT{aeropuerto.gmt >= 0 ? '+' : ''}{aeropuerto.gmt}</p>
          </div>
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-md p-2 text-center">
            <p className="text-[9px] text-slate-400 uppercase tracking-widest mb-0.5">Region</p>
            <p className="text-xs font-semibold text-slate-200 capitalize truncate">{aeropuerto.continente.replace('_', ' ')}</p>
          </div>
        </div>

        <div className="bg-slate-800/40 border border-slate-700/50 rounded-md overflow-hidden">
          <div className="px-2.5 py-2 border-b border-slate-700/50 flex items-center justify-between gap-3">
            <p className="text-[9px] text-slate-400 uppercase tracking-widest">Actividad del aeropuerto</p>
            {enColapso && (
              <span className="text-[10px] font-semibold text-red-300 bg-red-500/15 border border-red-500/20 rounded px-2 py-0.5">
                Colapso
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 divide-x divide-slate-700/50">
            <div className="px-2 py-3 text-center">
              <p className="text-lg font-bold text-emerald-400">{actividad.salidas}</p>
              <p className="text-[10px] text-slate-500">salen</p>
            </div>
            <div className="px-2 py-3 text-center">
              <p className="text-lg font-bold text-blue-300">{actividad.llegadas}</p>
              <p className="text-[10px] text-slate-500">llegan</p>
            </div>
            <div className="px-2 py-3 text-center">
              <p className="text-lg font-bold text-amber-300">{actividad.transito}</p>
              <p className="text-[10px] text-slate-500">transito</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
