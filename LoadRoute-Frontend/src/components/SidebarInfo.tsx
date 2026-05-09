import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RutaMuestra, AeropuertoDTO } from '@/types/rutas';
import { calcularCargaAeropuertoActual, porcentajeOcupacion } from '@/utils/capacidad';

interface SidebarInfoProps {
  envios: RutaMuestra[];
  aeropuertos: AeropuertoDTO[];
  activeTab: 'pedidos' | 'aeropuertos' | 'simulacion' | null;
  simTiempoMinutos?: number;
  cargasAeropuertoOverride?: Record<string, number> | null;
  onSelectEnvio: (e: RutaMuestra) => void;
  onSelectAeropuerto: (a: AeropuertoDTO) => void;
}

const PEDIDO_ROW_HEIGHT = 78;
const PEDIDO_OVERSCAN = 8;

function SidebarInfo({
  envios,
  aeropuertos,
  activeTab,
  simTiempoMinutos = 0,
  cargasAeropuertoOverride,
  onSelectEnvio,
  onSelectAeropuerto,
}: SidebarInfoProps) {
  const [searchEnvios, setSearchEnvios] = useState('');
  const [searchAero, setSearchAero] = useState('');
  const pedidosScrollRef = useRef<HTMLDivElement | null>(null);
  const [pedidosScrollTop, setPedidosScrollTop] = useState(0);
  const [pedidosViewportHeight, setPedidosViewportHeight] = useState(0);

  const filteredEnvios = useMemo(() => envios.filter(e => {
    const q = searchEnvios.toLowerCase();
    if (!q) return true;
    return (
      e.envioId.toLowerCase().includes(q) ||
      e.origen.toLowerCase().includes(q) ||
      e.destino.toLowerCase().includes(q)
    );
  }), [envios, searchEnvios]);

  useEffect(() => {
    const el = pedidosScrollRef.current;
    if (!el) return;

    const updateHeight = () => setPedidosViewportHeight(el.clientHeight);
    updateHeight();

    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, [activeTab]);

  useEffect(() => {
    setPedidosScrollTop(0);
    if (pedidosScrollRef.current) pedidosScrollRef.current.scrollTop = 0;
  }, [searchEnvios]);

  const pedidosVirtuales = useMemo(() => {
    const total = filteredEnvios.length;
    const start = Math.max(0, Math.floor(pedidosScrollTop / PEDIDO_ROW_HEIGHT) - PEDIDO_OVERSCAN);
    const visible = Math.ceil(Math.max(pedidosViewportHeight, PEDIDO_ROW_HEIGHT) / PEDIDO_ROW_HEIGHT);
    const end = Math.min(total, start + visible + PEDIDO_OVERSCAN * 2);

    return {
      start,
      end,
      totalHeight: total * PEDIDO_ROW_HEIGHT,
      items: filteredEnvios.slice(start, end),
    };
  }, [filteredEnvios, pedidosScrollTop, pedidosViewportHeight]);

  const filteredAero = useMemo(() => aeropuertos.filter(a => {
    const q = searchAero.toLowerCase();
    if (!q) return true;
    return (
      a.codigo.toLowerCase().includes(q) ||
      a.ciudad.toLowerCase().includes(q) ||
      a.pais.toLowerCase().includes(q)
    );
  }), [aeropuertos, searchAero]);

  const renderAeropuerto = (a: AeropuertoDTO) => {
    const cargaActual = cargasAeropuertoOverride?.[a.codigo]
      ?? calcularCargaAeropuertoActual(a.codigo, envios, simTiempoMinutos);
    const porcentaje = porcentajeOcupacion(cargaActual, a.capacidadMax);
    const colorCarga =
      cargaActual > a.capacidadMax
        ? 'text-red-400'
        : cargaActual > a.capacidadMax * 0.8
          ? 'text-amber-400'
          : 'text-emerald-400';

    return (
      <div
        key={a.codigo}
        onClick={() => onSelectAeropuerto(a)}
        className="bg-[#122340] border border-slate-700/50 rounded-lg p-3 cursor-pointer
                   hover:border-emerald-500/50 hover:bg-[#162a4d] transition-all"
      >
        <div className="flex justify-between items-center mb-1">
          <span className="font-bold text-slate-200">{a.codigo}</span>
          <span className="text-[10px] text-slate-400">{a.pais}</span>
        </div>
        <p className="text-xs text-slate-400 truncate">{a.ciudad}</p>
        <p className="text-xs mt-1 text-slate-500">
          Actual: <span className={`font-semibold ${colorCarga}`}>{cargaActual}</span>
          <span className="text-slate-600">/{a.capacidadMax}</span>
          <span className="mx-1.5 text-slate-700">|</span>
          GMT{a.gmt >= 0 ? '+' : ''}{a.gmt}
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-900/80">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              cargaActual > a.capacidadMax
                ? 'bg-red-500'
                : cargaActual > a.capacidadMax * 0.8
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
            }`}
            style={{ width: `${porcentaje}%` }}
          />
        </div>
      </div>
    );
  };

  if (activeTab === 'pedidos') {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="px-3 pt-3 pb-2 bg-[#0f1f3d] border-b border-slate-700/50 shrink-0">
          <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">
            Pedidos ({filteredEnvios.length}/{envios.length})
          </p>
          {/* Search */}
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">🔍</span>
            <input
              type="text"
              value={searchEnvios}
              onChange={e => setSearchEnvios(e.target.value)}
              placeholder="Buscar por ID, origen o destino..."
              className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg pl-7 pr-3 py-2
                         text-xs text-slate-200 placeholder-slate-500
                         focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20
                         transition-all"
            />
          </div>
        </div>
        {/* List */}
        <div
          ref={pedidosScrollRef}
          onScroll={e => setPedidosScrollTop(e.currentTarget.scrollTop)}
          className="flex-1 overflow-y-auto p-3 custom-scrollbar"
        >
          {filteredEnvios.length === 0 ? (
            <p className="text-center text-slate-600 text-xs pt-8">Sin resultados</p>
          ) : (
            <div className="relative" style={{ height: `${pedidosVirtuales.totalHeight}px` }}>
              {pedidosVirtuales.items.map((e, index) => (
                <div
                  key={e.envioId}
                  style={{
                    position: 'absolute',
                    top: `${(pedidosVirtuales.start + index) * PEDIDO_ROW_HEIGHT}px`,
                    left: 0,
                    right: 0,
                    height: `${PEDIDO_ROW_HEIGHT - 8}px`,
                  }}
                  onClick={() => onSelectEnvio(e)}
                  className="bg-[#122340] border border-slate-700/50 rounded-lg p-3 cursor-pointer
                             hover:border-blue-500/50 hover:bg-[#162a4d] transition-all"
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-mono text-xs text-blue-400">{e.envioId}</span>
                    <span className="bg-slate-800 text-[10px] px-2 py-0.5 rounded text-slate-400">
                      {e.maletas} maletas
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-xs font-mono text-slate-300">
                    <span>{e.origen}</span>
                    <span className="text-slate-500 text-[10px]">→</span>
                    <span>{e.destino}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (activeTab === 'aeropuertos') {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="px-3 pt-3 pb-2 bg-[#0f1f3d] border-b border-slate-700/50 shrink-0">
          <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">
            Aeropuertos ({filteredAero.length}/{aeropuertos.length})
          </p>
          {/* Search */}
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">🔍</span>
            <input
              type="text"
              value={searchAero}
              onChange={e => setSearchAero(e.target.value)}
              placeholder="Buscar por código, ciudad o país..."
              className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg pl-7 pr-3 py-2
                         text-xs text-slate-200 placeholder-slate-500
                         focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20
                         transition-all"
            />
          </div>
        </div>
        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
          {filteredAero.length === 0 ? (
            <p className="text-center text-slate-600 text-xs pt-8">Sin resultados</p>
          ) : (
            filteredAero.map(renderAeropuerto)
          )}
        </div>
      </div>
    );
  }

  return null;
}

export default React.memo(SidebarInfo, (prev, next) => {
  if (
    prev.envios !== next.envios ||
    prev.aeropuertos !== next.aeropuertos ||
    prev.activeTab !== next.activeTab ||
    prev.onSelectEnvio !== next.onSelectEnvio ||
    prev.onSelectAeropuerto !== next.onSelectAeropuerto
  ) {
    return false;
  }

  if (next.activeTab === 'aeropuertos') {
    return (
      prev.simTiempoMinutos === next.simTiempoMinutos &&
      prev.cargasAeropuertoOverride === next.cargasAeropuertoOverride
    );
  }

  return true;
});
