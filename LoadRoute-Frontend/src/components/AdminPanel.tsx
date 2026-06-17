import React, { useEffect, useState, useMemo } from 'react';
import {
  obtenerAeropuertos,
  crearAeropuerto,
  actualizarAeropuerto,
  eliminarAeropuerto,
  obtenerVuelos,
  crearVuelo,
  actualizarVuelo,
  eliminarVuelo,
  AeropuertoCreateDTO,
  VueloCreateDTO,
  VueloResponseDTO
} from '@/services/maestrosService';
import { Aeropuerto } from '@/types/rutas';
import { useWebSocket } from '@/hooks/useWebSocket';
import {
  IconBuilding, IconPlane, IconSearch, IconPlus, IconEdit, IconTrash, IconClose,
} from '@/components/icons';

type AdminTab = 'aeropuertos' | 'vuelos';

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<AdminTab>('aeropuertos');
  const [aeropuertos, setAeropuertos] = useState<Aeropuerto[]>([]);
  const [vuelos, setVuelos] = useState<VueloResponseDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [searchAero, setSearchAero] = useState('');
  const [searchVuelo, setSearchVuelo] = useState('');
  const [aeroForm, setAeroForm] = useState<AeropuertoCreateDTO | null>(null);
  const [vueloForm, setVueloForm] = useState<VueloCreateDTO & { id?: number } | null>(null);

  const [aeroPage, setAeroPage] = useState(1);
  const [vueloPage, setVueloPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  useWebSocket({
    topic: '/topic/maestros',
    onMessage: () => cargarDatos(true),
  });

  useEffect(() => {
    cargarDatos();
  }, [activeTab]);

  const cargarDatos = async (silent = false) => {
    if (!silent) setLoading(true);
    setErrorMsg('');
    try {
      if (activeTab === 'aeropuertos') {
        setAeropuertos(await obtenerAeropuertos());
      } else {
        setVuelos(await obtenerVuelos());
      }
    } catch (error: unknown) {
      setErrorMsg(error instanceof Error ? error.message : 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (msg: string, isError = false) => {
    if (isError) setErrorMsg(msg);
    else setSuccessMsg(msg);
    setTimeout(() => { setErrorMsg(''); setSuccessMsg(''); }, 5000);
  };

  const handleGuardarAeropuerto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aeroForm) return;
    try {
      const elementHtml = document.getElementById('isEditAero') as HTMLInputElement;
      const isEdit = elementHtml?.value === 'true';
      if (isEdit) {
        await actualizarAeropuerto(aeroForm.codigo, aeroForm);
        showMessage('Aeropuerto actualizado correctamente');
      } else {
        await crearAeropuerto(aeroForm);
        showMessage('Aeropuerto creado correctamente');
      }
      setAeroForm(null);
      cargarDatos();
    } catch (error: unknown) {
      showMessage(error instanceof Error ? error.message : 'Error', true);
    }
  };

  const handleEliminarAeropuerto = async (codigo: string) => {
    if (!confirm(`¿Estás seguro de eliminar el aeropuerto ${codigo}?`)) return;
    try {
      await eliminarAeropuerto(codigo);
      showMessage('Aeropuerto eliminado');
      cargarDatos();
    } catch (error: unknown) {
      showMessage(error instanceof Error ? error.message : 'Error', true);
    }
  };

  const handleGuardarVuelo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vueloForm) return;
    try {
      if (vueloForm.id) {
        await actualizarVuelo(vueloForm.id, vueloForm);
        showMessage('Vuelo actualizado correctamente');
      } else {
        await crearVuelo(vueloForm);
        showMessage('Vuelo creado correctamente');
      }
      setVueloForm(null);
      cargarDatos();
    } catch (error: unknown) {
      showMessage(error instanceof Error ? error.message : 'Error', true);
    }
  };

  const handleEliminarVuelo = async (id: number) => {
    if (!confirm(`¿Estás seguro de eliminar el vuelo #${id}?`)) return;
    try {
      await eliminarVuelo(id);
      showMessage('Vuelo eliminado');
      cargarDatos();
    } catch (error: unknown) {
      showMessage(error instanceof Error ? error.message : 'Error', true);
    }
  };

  // Resetear páginas cuando cambian búsquedas o pestañas
  useEffect(() => {
    setAeroPage(1);
  }, [searchAero]);

  useEffect(() => {
    setVueloPage(1);
  }, [searchVuelo]);

  useEffect(() => {
    setAeroPage(1);
    setVueloPage(1);
  }, [activeTab]);

  // Ajustar cantidad de elementos por página según la altura de la pantalla
  useEffect(() => {
    const handleResize = () => {
      const height = window.innerHeight;
      // Tabs ocupan 45px, header 80px + paginación 45px + padding/márgenes. Cada fila mide 70px aprox.
      const size = Math.max(3, Math.floor((height - 210) / 70));
      setPageSize(size);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Paginación Aeropuertos
  const filteredAeropuertos = useMemo(() => {
    return aeropuertos.filter(a => !searchAero || a.codigo.toLowerCase().includes(searchAero.toLowerCase()) || a.ciudad.toLowerCase().includes(searchAero.toLowerCase()));
  }, [aeropuertos, searchAero]);

  const totalAeroPages = Math.max(1, Math.ceil(filteredAeropuertos.length / pageSize));
  const paginatedAeropuertos = useMemo(() => {
    const start = (aeroPage - 1) * pageSize;
    return filteredAeropuertos.slice(start, start + pageSize);
  }, [filteredAeropuertos, aeroPage, pageSize]);

  // Paginación Vuelos
  const filteredVuelos = useMemo(() => {
    return vuelos.filter(v => !searchVuelo || v.origenCodigo.toLowerCase().includes(searchVuelo.toLowerCase()) || v.destinoCodigo.toLowerCase().includes(searchVuelo.toLowerCase()));
  }, [vuelos, searchVuelo]);

  const totalVueloPages = Math.max(1, Math.ceil(filteredVuelos.length / pageSize));
  const paginatedVuelos = useMemo(() => {
    const start = (vueloPage - 1) * pageSize;
    return filteredVuelos.slice(start, start + pageSize);
  }, [filteredVuelos, vueloPage, pageSize]);

  const inputClass = 'w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/20 transition-all';
  const labelClass = 'block text-[10px] text-slate-500 uppercase tracking-wider mb-1';

  return (
    <div className="flex flex-col h-full overflow-hidden text-slate-200">
      {/* Sub-tabs */}
      <div className="flex border-b border-slate-700/50 bg-[#0f1f3d]/80 shrink-0">
        <button
          className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5
            ${activeTab === 'aeropuertos'
              ? 'text-rose-400 border-b-2 border-rose-500 bg-rose-500/5'
              : 'text-slate-500 hover:text-slate-300'}`}
          onClick={() => setActiveTab('aeropuertos')}
        >
          <IconBuilding size={14} /> Aeropuertos
        </button>
        <button
          className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5
            ${activeTab === 'vuelos'
              ? 'text-rose-400 border-b-2 border-rose-500 bg-rose-500/5'
              : 'text-slate-500 hover:text-slate-300'}`}
          onClick={() => setActiveTab('vuelos')}
        >
          <IconPlane size={14} /> Vuelos
        </button>
      </div>

      {/* Alertas */}
      {errorMsg && (
        <div className="px-3 py-2 bg-red-500/10 border-b border-red-500/30 text-red-400 text-xs shrink-0">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="px-3 py-2 bg-emerald-500/10 border-b border-emerald-500/30 text-emerald-400 text-xs shrink-0">
          {successMsg}
        </div>
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col min-h-0">
        {activeTab === 'aeropuertos' && (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="px-3 pt-3 pb-2 bg-[#0f1f3d]/70 border-b border-slate-700/50 shrink-0 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-rose-400 uppercase tracking-wider">
                  Aeropuertos ({filteredAeropuertos.length})
                </p>
                <button
                  onClick={() => setAeroForm({ codigo: '', ciudad: '', pais: '', continente: '', gmt: 0, capacidadMax: 1000, latitud: 0, longitud: 0 })}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-semibold hover:bg-rose-500/30 transition-colors"
                >
                  <IconPlus size={12} /> Nuevo
                </button>
              </div>
              <div className="relative">
                <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                <input
                  type="text"
                  placeholder="Buscar por código o ciudad..."
                  className={`${inputClass} pl-7`}
                  value={searchAero}
                  onChange={e => setSearchAero(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
              {aeroForm && (
                <form onSubmit={handleGuardarAeropuerto} className="bg-[#122340] border border-rose-500/30 rounded-lg p-3 space-y-2 mb-2">
                  <input type="hidden" id="isEditAero" value={aeropuertos.some(a => a.codigo === aeroForm.codigo) ? 'true' : 'false'} />
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold text-rose-300">
                      {aeropuertos.some(a => a.codigo === aeroForm.codigo) ? 'Editar aeropuerto' : 'Nuevo aeropuerto'}
                    </p>
                    <button type="button" onClick={() => setAeroForm(null)} className="text-slate-500 hover:text-slate-300">
                      <IconClose size={16} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelClass}>Código</label>
                      <input required maxLength={4} className={inputClass} value={aeroForm.codigo}
                        onChange={e => setAeroForm({ ...aeroForm, codigo: e.target.value.toUpperCase() })}
                        disabled={aeropuertos.some(a => a.codigo === aeroForm.codigo)} />
                    </div>
                    <div>
                      <label className={labelClass}>Ciudad</label>
                      <input required className={inputClass} value={aeroForm.ciudad} onChange={e => setAeroForm({ ...aeroForm, ciudad: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelClass}>País</label>
                      <input required className={inputClass} value={aeroForm.pais} onChange={e => setAeroForm({ ...aeroForm, pais: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelClass}>Continente</label>
                      <input required className={inputClass} value={aeroForm.continente} onChange={e => setAeroForm({ ...aeroForm, continente: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelClass}>GMT</label>
                      <input required type="number" className={inputClass} value={aeroForm.gmt} onChange={e => setAeroForm({ ...aeroForm, gmt: parseInt(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className={labelClass}>Capacidad</label>
                      <input required type="number" min="0" className={inputClass} value={aeroForm.capacidadMax} onChange={e => setAeroForm({ ...aeroForm, capacidadMax: parseInt(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className={labelClass}>Latitud</label>
                      <input required type="number" step="0.000001" className={inputClass} value={aeroForm.latitud} onChange={e => setAeroForm({ ...aeroForm, latitud: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className={labelClass}>Longitud</label>
                      <input required type="number" step="0.000001" className={inputClass} value={aeroForm.longitud} onChange={e => setAeroForm({ ...aeroForm, longitud: parseFloat(e.target.value) || 0 })} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={() => setAeroForm(null)} className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:bg-slate-700/50">Cancelar</button>
                    <button type="submit" className="px-3 py-1.5 rounded-lg text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold hover:bg-emerald-500/30">Guardar</button>
                  </div>
                </form>
              )}

              {loading ? (
                <p className="text-slate-500 text-xs text-center py-8">Cargando...</p>
              ) : (
                paginatedAeropuertos.map(a => (
                  <div key={a.codigo} className="bg-[#122340] border border-slate-700/50 rounded-lg p-3 hover:border-rose-500/30 transition-all">
                    <div className="flex justify-between items-start">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-mono text-sm font-bold text-rose-300">{a.codigo}</span>
                          <span className="text-xs text-slate-200 truncate">{a.ciudad}, {a.pais}</span>
                        </div>
                        <div className="text-[10px] text-slate-300 flex gap-3">
                          <span>GMT{a.gmt > 0 ? `+${a.gmt}` : a.gmt}</span>
                          <span>Cap: {a.capacidadMax.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => setAeroForm(a)} className="p-1.5 text-slate-500 hover:text-rose-300 rounded hover:bg-rose-500/10 transition-colors" title="Editar">
                          <IconEdit size={14} />
                        </button>
                        <button onClick={() => handleEliminarAeropuerto(a.codigo)} className="p-1.5 text-slate-500 hover:text-red-400 rounded hover:bg-red-500/10 transition-colors" title="Eliminar">
                          <IconTrash size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
              {!loading && filteredAeropuertos.length === 0 && (
                <p className="text-center text-slate-500 text-xs py-8">No hay aeropuertos registrados</p>
              )}
            </div>

            {/* Paginación Aeropuertos */}
            {!loading && totalAeroPages > 1 && (
              <div className="flex items-center justify-between px-3 py-2 border-t border-slate-700/40 bg-[#0f1f3d]/40 shrink-0">
                <button
                  type="button"
                  disabled={aeroPage === 1}
                  onClick={() => setAeroPage(prev => Math.max(1, prev - 1))}
                  className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700/60 text-[10px] font-semibold text-slate-300 hover:bg-slate-700/50 hover:text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  Anterior
                </button>
                <span className="text-[10px] font-mono text-slate-400">
                  Pág. {aeroPage} de {totalAeroPages}
                </span>
                <button
                  type="button"
                  disabled={aeroPage === totalAeroPages}
                  onClick={() => setAeroPage(prev => Math.min(totalAeroPages, prev + 1))}
                  className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700/60 text-[10px] font-semibold text-slate-300 hover:bg-slate-700/50 hover:text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'vuelos' && (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="px-3 pt-3 pb-2 bg-[#0f1f3d]/70 border-b border-slate-700/50 shrink-0 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-rose-400 uppercase tracking-wider">
                  Vuelos ({filteredVuelos.length})
                </p>
                <button
                  onClick={() => setVueloForm({ origenCodigo: '', destinoCodigo: '', horaSalidaLocal: '08:00:00', horaLlegadaLocal: '10:00:00', capacidadMax: 300 })}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-semibold hover:bg-rose-500/30 transition-colors"
                >
                  <IconPlus size={12} /> Nuevo
                </button>
              </div>
              <div className="relative">
                <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                <input
                  type="text"
                  placeholder="Buscar por código (ej. SPJC)..."
                  className={`${inputClass} pl-7`}
                  value={searchVuelo}
                  onChange={e => setSearchVuelo(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
              {vueloForm && (
                <form onSubmit={handleGuardarVuelo} className="bg-[#122340] border border-rose-500/30 rounded-lg p-3 space-y-2 mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold text-rose-300">
                      {vueloForm.id ? 'Editar vuelo' : 'Nuevo vuelo'}
                    </p>
                    <button type="button" onClick={() => setVueloForm(null)} className="text-slate-500 hover:text-slate-300">
                      <IconClose size={16} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelClass}>Origen</label>
                      <input required maxLength={4} className={inputClass} value={vueloForm.origenCodigo} onChange={e => setVueloForm({ ...vueloForm, origenCodigo: e.target.value.toUpperCase() })} placeholder="SKBO" />
                    </div>
                    <div>
                      <label className={labelClass}>Destino</label>
                      <input required maxLength={4} className={inputClass} value={vueloForm.destinoCodigo} onChange={e => setVueloForm({ ...vueloForm, destinoCodigo: e.target.value.toUpperCase() })} placeholder="SPJC" />
                    </div>
                    <div>
                      <label className={labelClass}>Hora salida</label>
                      <input required type="time" step="1" className={inputClass} value={vueloForm.horaSalidaLocal} onChange={e => setVueloForm({ ...vueloForm, horaSalidaLocal: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelClass}>Hora llegada</label>
                      <input required type="time" step="1" className={inputClass} value={vueloForm.horaLlegadaLocal} onChange={e => setVueloForm({ ...vueloForm, horaLlegadaLocal: e.target.value })} />
                    </div>
                    <div className="col-span-2">
                      <label className={labelClass}>Capacidad</label>
                      <input required type="number" min="1" className={inputClass} value={vueloForm.capacidadMax} onChange={e => setVueloForm({ ...vueloForm, capacidadMax: parseInt(e.target.value) || 0 })} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={() => setVueloForm(null)} className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:bg-slate-700/50">Cancelar</button>
                    <button type="submit" className="px-3 py-1.5 rounded-lg text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold hover:bg-emerald-500/30">Guardar</button>
                  </div>
                </form>
              )}

              {loading ? (
                <p className="text-slate-500 text-xs text-center py-8">Cargando...</p>
              ) : (
                paginatedVuelos.map(v => (
                  <div key={v.id} className="bg-[#122340] border border-slate-700/50 rounded-lg p-3 hover:border-rose-500/30 transition-all">
                    <div className="flex justify-between items-start">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-mono text-sm font-bold text-slate-200">
                            {v.origenCodigo} <span className="text-rose-400">→</span> {v.destinoCodigo}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">#{v.id}</span>
                        </div>
                        <div className="text-[10px] text-slate-300 flex gap-3">
                          <span>Sal: {v.horaSalidaLocal}</span>
                          <span>Lleg: {v.horaLlegadaLocal}</span>
                          <span>Cap: {v.capacidadMax.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => setVueloForm(v)} className="p-1.5 text-slate-500 hover:text-rose-300 rounded hover:bg-rose-500/10 transition-colors" title="Editar">
                          <IconEdit size={14} />
                        </button>
                        <button onClick={() => handleEliminarVuelo(v.id)} className="p-1.5 text-slate-500 hover:text-red-400 rounded hover:bg-red-500/10 transition-colors" title="Eliminar">
                          <IconTrash size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
              {!loading && filteredVuelos.length === 0 && (
                <p className="text-center text-slate-500 text-xs py-8">No hay vuelos registrados</p>
              )}
            </div>

            {/* Paginación Vuelos */}
            {!loading && totalVueloPages > 1 && (
              <div className="flex items-center justify-between px-3 py-2 border-t border-slate-700/40 bg-[#0f1f3d]/40 shrink-0">
                <button
                  type="button"
                  disabled={vueloPage === 1}
                  onClick={() => setVueloPage(prev => Math.max(1, prev - 1))}
                  className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700/60 text-[10px] font-semibold text-slate-300 hover:bg-slate-700/50 hover:text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  Anterior
                </button>
                <span className="text-[10px] font-mono text-slate-400">
                  Pág. {vueloPage} de {totalVueloPages}
                </span>
                <button
                  type="button"
                  disabled={vueloPage === totalVueloPages}
                  onClick={() => setVueloPage(prev => Math.min(totalVueloPages, prev + 1))}
                  className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700/60 text-[10px] font-semibold text-slate-300 hover:bg-slate-700/50 hover:text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
