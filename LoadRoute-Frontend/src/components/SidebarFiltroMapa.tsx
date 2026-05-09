import { useMemo, useState } from 'react';
import { AeropuertoDTO, FiltrosAvionesMapa } from '@/types/rutas';

interface SidebarFiltroMapaProps {
  aeropuertos: AeropuertoDTO[];
  filtros: FiltrosAvionesMapa;
  onChange: (filtros: FiltrosAvionesMapa) => void;
}

type TipoFiltro = 'origen' | 'destino';

const filtroConfig = {
  origen: {
    titulo: 'Aeropuerto de origen',
    searchPlaceholder: 'Buscar origen...',
    color: 'cyan',
  },
  destino: {
    titulo: 'Aeropuerto de destino',
    searchPlaceholder: 'Buscar destino...',
    color: 'blue',
  },
} as const;

export default function SidebarFiltroMapa({
  aeropuertos,
  filtros,
  onChange,
}: SidebarFiltroMapaProps) {
  const [searchOrigen, setSearchOrigen] = useState('');
  const [searchDestino, setSearchDestino] = useState('');

  const codigosAeropuertos = useMemo(
    () => aeropuertos.map(a => a.codigo),
    [aeropuertos]
  );

  const filtrarAeropuertos = (searchTerm: string) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return aeropuertos;
    return aeropuertos.filter(a =>
      a.codigo.toLowerCase().includes(q) ||
      a.ciudad.toLowerCase().includes(q) ||
      a.pais.toLowerCase().includes(q)
    );
  };

  const updateFiltros = (patch: Partial<FiltrosAvionesMapa>) => {
    onChange({ ...filtros, ...patch });
  };

  const getSeleccionados = (tipo: TipoFiltro) =>
    tipo === 'origen' ? filtros.origenes : filtros.destinos;

  const getActivo = (tipo: TipoFiltro) =>
    tipo === 'origen' ? filtros.usarOrigen : filtros.usarDestino;

  const toggleActivo = (tipo: TipoFiltro) => {
    if (tipo === 'origen') {
      updateFiltros({ usarOrigen: !filtros.usarOrigen });
      return;
    }
    updateFiltros({ usarDestino: !filtros.usarDestino });
  };

  const toggleAeropuerto = (tipo: TipoFiltro, codigo: string) => {
    const key = tipo === 'origen' ? 'origenes' : 'destinos';
    const seleccionados = new Set(filtros[key]);

    if (seleccionados.has(codigo)) {
      seleccionados.delete(codigo);
    } else {
      seleccionados.add(codigo);
    }

    if (key === 'origenes') {
      updateFiltros({ origenes: Array.from(seleccionados) });
      return;
    }
    updateFiltros({ destinos: Array.from(seleccionados) });
  };

  const seleccionarTodos = (tipo: TipoFiltro) => {
    const key = tipo === 'origen' ? 'origenes' : 'destinos';
    if (key === 'origenes') {
      updateFiltros({ origenes: codigosAeropuertos });
      return;
    }
    updateFiltros({ destinos: codigosAeropuertos });
  };

  const limpiarSeleccion = (tipo: TipoFiltro) => {
    const key = tipo === 'origen' ? 'origenes' : 'destinos';
    if (key === 'origenes') {
      updateFiltros({ origenes: [] });
      return;
    }
    updateFiltros({ destinos: [] });
  };

  const renderSelector = (tipo: TipoFiltro) => {
    const config = filtroConfig[tipo];
    const activo = getActivo(tipo);
    const seleccionados = getSeleccionados(tipo);
    const seleccionadosSet = new Set(seleccionados);
    const searchTerm = tipo === 'origen' ? searchOrigen : searchDestino;
    const setSearch = tipo === 'origen' ? setSearchOrigen : setSearchDestino;
    const aeropuertosFiltrados = filtrarAeropuertos(searchTerm);
    const colorClasses = config.color === 'cyan'
      ? {
        text: 'text-cyan-300',
        border: 'focus:border-cyan-500/50 focus:ring-cyan-500/20',
        dot: 'bg-cyan-400',
        checked: 'accent-cyan-500',
        selected: 'bg-[#122d4a] border-cyan-500/40',
      }
      : {
        text: 'text-blue-300',
        border: 'focus:border-blue-500/50 focus:ring-blue-500/20',
        dot: 'bg-blue-400',
        checked: 'accent-blue-500',
        selected: 'bg-[#122d4a] border-blue-500/40',
      };

    return (
      <section className="border-b border-slate-700/40 last:border-b-0">
        <div className="px-3 py-3 bg-[#0f1f3d]/70">
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 min-w-0 cursor-pointer">
              <input
                type="checkbox"
                checked={activo}
                onChange={() => toggleActivo(tipo)}
                className={`h-4 w-4 rounded border-slate-600 bg-slate-800 ${colorClasses.checked}`}
              />
              <span className={`text-xs font-semibold uppercase tracking-wider truncate ${colorClasses.text}`}>
                {config.titulo}
              </span>
            </label>
            <span className="text-[10px] text-slate-400 shrink-0">
              {seleccionados.length}/{aeropuertos.length}
            </span>
          </div>

          <div className="relative mt-2">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">🔍</span>
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearch(e.target.value)}
              disabled={!activo}
              placeholder={config.searchPlaceholder}
              className={`w-full bg-slate-800/60 border border-slate-700/60 rounded-lg pl-7 pr-3 py-2
                         text-xs text-slate-200 placeholder-slate-500 disabled:opacity-50 disabled:cursor-not-allowed
                         focus:outline-none focus:ring-1 transition-all ${colorClasses.border}`}
            />
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => seleccionarTodos(tipo)}
              disabled={!activo || aeropuertos.length === 0}
              className="rounded-md border border-slate-700/60 bg-slate-800/70 px-2 py-1.5 text-[10px] font-semibold text-slate-300
                         hover:bg-slate-700/70 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => limpiarSeleccion(tipo)}
              disabled={!activo || seleccionados.length === 0}
              className="rounded-md border border-slate-700/60 bg-slate-800/70 px-2 py-1.5 text-[10px] font-semibold text-slate-300
                         hover:bg-slate-700/70 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Limpiar
            </button>
          </div>
        </div>

        <div className={`max-h-64 overflow-y-auto p-3 space-y-2 custom-scrollbar ${activo ? '' : 'opacity-50'}`}>
          {aeropuertosFiltrados.length === 0 ? (
            <p className="text-center text-slate-600 text-xs py-5">Sin resultados</p>
          ) : (
            aeropuertosFiltrados.map(a => {
              const checked = seleccionadosSet.has(a.codigo);
              return (
                <label
                  key={`${tipo}-${a.codigo}`}
                  className={`flex items-center gap-3 rounded-lg border p-3 transition-all
                    ${checked
                      ? colorClasses.selected
                      : 'bg-[#122340] border-slate-700/50 hover:bg-[#162a4d]'}
                    ${activo ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!activo}
                    onChange={() => toggleAeropuerto(tipo, a.codigo)}
                    className={`h-4 w-4 rounded border-slate-600 bg-slate-800 ${colorClasses.checked}`}
                  />
                  <span className={`h-2 w-2 rounded-full shrink-0 ${checked ? colorClasses.dot : 'bg-slate-600'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-slate-100">{a.codigo}</span>
                      <span className="text-[10px] text-slate-500 truncate">{a.pais}</span>
                    </span>
                    <span className="block truncate text-[11px] text-slate-400">{a.ciudad}</span>
                  </span>
                </label>
              );
            })
          )}
        </div>
      </section>
    );
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="px-3 pt-3 pb-2 bg-[#0f1f3d] border-b border-slate-700/50 shrink-0">
        <p className="text-xs font-semibold text-cyan-300 uppercase tracking-wider">
          Aviones en pantalla
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-slate-400">
          <div className="rounded-md bg-slate-900/50 px-2 py-1.5">
            Origen <span className="font-semibold text-slate-200">{filtros.origenes.length}</span>
          </div>
          <div className="rounded-md bg-slate-900/50 px-2 py-1.5">
            Destino <span className="font-semibold text-slate-200">{filtros.destinos.length}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {renderSelector('origen')}
        {renderSelector('destino')}
      </div>
    </div>
  );
}
