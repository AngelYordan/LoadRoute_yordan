'use client';

import React, { useEffect, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMap,
  Tooltip,
  ZoomControl,
} from 'react-leaflet';
import L from 'leaflet';
import { RutaResponse, AeropuertoDTO, FiltrosAvionesMapa, RutaMuestra, TramoDTO } from '@/types/rutas';
import 'leaflet/dist/leaflet.css';

type ModoMapa = 'sa' | 'alns' | 'ambos';
type IndiceCargaAeropuerto = {
  inicios: number[];
  cargasInicio: number[];
  fines: number[];
  cargasFin: number[];
};
type IndicesCargaAeropuertos = Record<string, IndiceCargaAeropuerto>;

interface MapaRutasProps {
  resultado: RutaResponse | null;
  simTiempoMinutos: number;
  cargasAeropuertoOverride?: Record<string, number> | null;
  onSelectVuelo: (vuelo: any) => void;
  selectedVuelo?: any | null;  // tramo seleccionado — dibuja solo su polilínea
  umbralVerde: number;
  umbralAmbar: number;
  modoMapa: ModoMapa;
  onModoMapa: (modo: ModoMapa) => void;
  filtrosAviones?: FiltrosAvionesMapa;
}

// Semáforo dinámico de Aeropuertos (por % de ocupación real)
function getAirportColor(cargaActual: number, capacidadMax: number, umbralVerde: number, umbralAmbar: number): string {
  if (capacidadMax <= 0) return '#10b981';
  const p = (cargaActual / capacidadMax) * 100;
  if (p <= umbralVerde) return '#10b981';
  if (p <= umbralAmbar) return '#f59e0b';
  return '#ef4444';
}

// Semáforo dinámico de Aviones
function getPlaneColor(cargaActual: number, capacidadMax: number, umbralVerde: number, umbralAmbar: number): string {
  const p = (cargaActual / Math.max(capacidadMax, 1)) * 100;
  if (p <= umbralVerde) return '#10b981';
  if (p <= umbralAmbar) return '#f59e0b';
  return '#ef4444';
}

// Componente para ajustar el mapa a los bounds
const AjustadorMapa: React.FC<{ aeropuertos: AeropuertoDTO[] }> = ({ aeropuertos }) => {
  const map = useMap();

  useEffect(() => {
    if (aeropuertos.length === 0) return;

    const bounds = L.latLngBounds(
      aeropuertos.map(a => [a.latitud, a.longitud] as [number, number])
    );
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 5 });
  }, [aeropuertos, map]);

  return null;
};

// Iconos de avión según semáforo
function crearIconoAvion(color: string, angle: number): L.DivIcon {
  const svg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <path fill="${color}" stroke="white" stroke-width="1.25" stroke-linejoin="round"
        d="M30 16c0 .85-.62 1.56-1.46 1.7l-9.36 1.47-4.86 9.1c-.34.64-1.2.75-1.7.22l-2.17-2.28 2.73-6.08-5.78.84-2.9 2.95c-.36.36-.9.45-1.36.22l-1.1-.55 2.18-5.43v-4.32L2.04 8.41l1.1-.55c.46-.23 1-.14 1.36.22l2.9 2.95 5.78.84-2.73-6.08 2.17-2.28c.5-.53 1.36-.42 1.7.22l4.86 9.1 9.36 1.47c.84.14 1.46.85 1.46 1.7z"/>
    </svg>
  `);

  return L.divIcon({
    className: 'loadroute-plane-marker',
    html: `<div style="width:28px;height:28px;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.55));transform:rotate(${angle}deg);transform-origin:center;will-change:transform;background:url('data:image/svg+xml,${svg}') center/contain no-repeat;"></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function crearIconoAeropuerto(color: string): L.DivIcon {
  const svg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 76">
      <path fill="${color}" stroke="white" stroke-width="2.2"
        d="M32 2C18.2 2 7 13.1 7 26.9 7 44.3 32 74 32 74s25-29.7 25-47.1C57 13.1 45.8 2 32 2z"/>
      <g transform="translate(32 29) rotate(-38) scale(.92) translate(-16 -16)">
        <path fill="white"
          d="M30 16c0 .85-.62 1.56-1.46 1.7l-9.36 1.47-4.86 9.1c-.34.64-1.2.75-1.7.22l-2.17-2.28 2.73-6.08-5.78.84-2.9 2.95c-.36.36-.9.45-1.36.22l-1.1-.55 2.18-5.43v-4.32L2.04 8.41l1.1-.55c.46-.23 1-.14 1.36.22l2.9 2.95 5.78.84-2.73-6.08 2.17-2.28c.5-.53 1.36-.42 1.7.22l4.86 9.1 9.36 1.47c.84.14 1.46.85 1.46 1.7z"/>
      </g>
    </svg>
  `);

  return L.divIcon({
    className: 'loadroute-airport-marker',
    html: `<div style="width:34px;height:40px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.45));background:url('data:image/svg+xml,${svg}') center/contain no-repeat;"></div>`,
    iconSize: [34, 40],
    iconAnchor: [17, 39],
  });
}

const AirportMarker: React.FC<{
  aeropuerto: AeropuertoDTO;
  cargaActual: number;
  umbralVerde: number;
  umbralAmbar: number;
}> = React.memo(function AirportMarker({
  aeropuerto,
  cargaActual,
  umbralVerde,
  umbralAmbar,
}) {
  const pct = aeropuerto.capacidadMax > 0
    ? Math.round((cargaActual / aeropuerto.capacidadMax) * 100)
    : 0;
  const colorAeropuerto = getAirportColor(
    cargaActual,
    aeropuerto.capacidadMax,
    umbralVerde,
    umbralAmbar
  );
  const icon = useMemo(() => crearIconoAeropuerto(colorAeropuerto), [colorAeropuerto]);

  return (
    <Marker
      position={[aeropuerto.latitud, aeropuerto.longitud]}
      icon={icon}
    >
      <Tooltip direction="top" offset={[0, -8]} className="airport-tooltip">
        <div style={{ fontSize: '11px', lineHeight: 1.4 }}>
          <strong>{aeropuerto.codigo}</strong> — {aeropuerto.ciudad}<br/>
          {aeropuerto.pais} | GMT{aeropuerto.gmt >= 0 ? '+' : ''}{aeropuerto.gmt}<br/>
          Carga: {cargaActual}/{aeropuerto.capacidadMax} ({pct}%)
        </div>
      </Tooltip>
    </Marker>
  );
});

const PlaneMarker: React.FC<{
  tramo: any;
  carga: number;
  simTiempoMinutos: number;
  umbralVerde: number;
  umbralAmbar: number;
  prefix: string;
  onSelectVuelo: (vuelo: any) => void;
}> = React.memo(function PlaneMarker({
  tramo,
  carga,
  simTiempoMinutos,
  umbralVerde,
  umbralAmbar,
  prefix,
  onSelectVuelo,
}) {
  const { lat, lon, angle } = getInterpolatedPosition(tramo, simTiempoMinutos);
  const color = getPlaneColor(carga, tramo.capacidad, umbralVerde, umbralAmbar);
  const icon = useMemo(() => crearIconoAvion(color, angle), [color, angle]);
  const eventHandlers = useMemo(() => ({ click: () => onSelectVuelo(tramo) }), [onSelectVuelo, tramo]);

  return (
    <Marker
      key={`plane-${prefix}-${tramo.vueloId}`}
      position={[lat, lon]}
      icon={icon}
      eventHandlers={eventHandlers}
    />
  );
});

export default function MapaRutas({
  resultado,
  simTiempoMinutos,
  cargasAeropuertoOverride,
  onSelectVuelo,
  selectedVuelo,
  umbralVerde,
  umbralAmbar,
  modoMapa,
  onModoMapa,
  filtrosAviones,
}: MapaRutasProps) {
  const aeropuertos = resultado?.aeropuertos || [];
  const resultadoSA = resultado?.resultadoSA;
  const resultadoALNS = resultado?.resultadoALNS;
  const mostrarSA = modoMapa === 'sa' || modoMapa === 'ambos' || !resultadoALNS;
  const mostrarALNS = modoMapa === 'alns' || modoMapa === 'ambos';

  const rutasMuestraSA = useMemo(() => resultadoSA?.rutasMuestra || [], [resultadoSA?.rutasMuestra]);
  const rutasMuestraALNS = useMemo(() => resultadoALNS?.rutasMuestra || [], [resultadoALNS?.rutasMuestra]);
  const tramosSA = useMemo(() => rutasMuestraSA.flatMap(r => r.tramos), [rutasMuestraSA]);
  const tramosALNS = useMemo(() => rutasMuestraALNS.flatMap(r => r.tramos), [rutasMuestraALNS]);
  const tramosVisiblesSA = useMemo(
    () => filtrarAvionesPorAeropuerto(tramosSA, filtrosAviones),
    [tramosSA, filtrosAviones]
  );
  const tramosVisiblesALNS = useMemo(
    () => filtrarAvionesPorAeropuerto(tramosALNS, filtrosAviones),
    [tramosALNS, filtrosAviones]
  );
  const cargaPorVueloSA = useMemo(() => calcularCargaPorVuelo(rutasMuestraSA), [rutasMuestraSA]);
  const cargaPorVueloALNS = useMemo(() => calcularCargaPorVuelo(rutasMuestraALNS), [rutasMuestraALNS]);
  const rutasParaCarga = useMemo(() => {
    if (modoMapa === 'sa') return resultadoSA?.rutasMuestra || [];
    if (modoMapa === 'alns') return resultadoALNS?.rutasMuestra || resultadoSA?.rutasMuestra || [];
    return [
      ...(resultadoSA?.rutasMuestra || []),
      ...(resultadoALNS?.rutasMuestra || []),
    ];
  }, [modoMapa, resultadoSA?.rutasMuestra, resultadoALNS?.rutasMuestra]);
  const indiceCargasAeropuertos = useMemo(
    () => construirIndiceCargasAeropuertos(rutasParaCarga),
    [rutasParaCarga]
  );
  const cargasAeropuertos = useMemo(
    () => cargasAeropuertoOverride
      ?? calcularCargasAeropuertosEnMinuto(indiceCargasAeropuertos, simTiempoMinutos),
    [cargasAeropuertoOverride, indiceCargasAeropuertos, simTiempoMinutos]
  );

  const activePlanesSA = useMemo(
    () => mostrarSA ? getActiveFlights(tramosVisiblesSA, simTiempoMinutos) : [],
    [mostrarSA, tramosVisiblesSA, simTiempoMinutos]
  );
  const activePlanesALNS = useMemo(
    () => mostrarALNS ? getActiveFlights(tramosVisiblesALNS, simTiempoMinutos) : [],
    [mostrarALNS, tramosVisiblesALNS, simTiempoMinutos]
  );

  if (aeropuertos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full rounded-lg bg-transparent">
        <span className="text-4xl mb-3 opacity-60">🗺️</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative overflow-hidden">
      {/* Toggle SA/ALNS — z-[600] para quedar sobre paneles flotantes */}
      <div className="absolute left-4 top-4 z-[600] flex overflow-hidden rounded-lg border border-slate-700/60 bg-[#0c1a30]/95 shadow-xl">
        {([
          ['sa', 'SA'],
          ['alns', 'ALNS'],
          ['ambos', 'Ambos'],
        ] as const).map(([modo, label]) => (
          <button
            key={modo}
            onClick={() => onModoMapa(modo)}
            className={`px-3 py-2 text-xs font-semibold transition-colors
              ${modoMapa === modo ? 'bg-blue-500 text-white' : 'text-slate-300 hover:bg-slate-700/70'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <MapContainer
        center={[20, 30]}
        zoom={3}
        minZoom={2}
        maxZoom={12}
        maxBounds={[[-85, -180], [85, 180]]}
        maxBoundsViscosity={1.0}
        worldCopyJump={false}
        style={{ width: '100%', height: '100%', backgroundColor: '#aadaff' }}
        zoomControl={false}
      >
        <ZoomControl position="bottomleft" />
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
          attribution='&copy; CARTO'
          maxZoom={12}
          minZoom={2}
          noWrap={true}
        />

        {/* Polilínea solo para el vuelo seleccionado */}
        {selectedVuelo && (
          <Polyline
            positions={[[selectedVuelo.origenLat, selectedVuelo.origenLon], [selectedVuelo.destinoLat, selectedVuelo.destinoLon]]}
            color="#60a5fa"
            weight={3}
            opacity={0.85}
            dashArray="8, 5"
          />
        )}

        {/* Marcadores de aeropuertos */}
        {aeropuertos.map(a => (
          <AirportMarker
            key={a.codigo}
            aeropuerto={a}
            cargaActual={cargasAeropuertos[a.codigo] || 0}
            umbralVerde={umbralVerde}
            umbralAmbar={umbralAmbar}
          />
        ))}

        {/* Aviones SA en vuelo */}
        {mostrarSA && activePlanesSA.map((t) => (
          <PlaneMarker
            key={`plane-sa-${t.vueloId}`}
            tramo={t}
            carga={cargaPorVueloSA[t.vueloId] || 0}
            simTiempoMinutos={simTiempoMinutos}
            umbralVerde={umbralVerde}
            umbralAmbar={umbralAmbar}
            prefix="sa"
            onSelectVuelo={onSelectVuelo}
          />
        ))}

        {/* Aviones ALNS en vuelo */}
        {mostrarALNS && activePlanesALNS.map((t) => (
          <PlaneMarker
            key={`plane-alns-${t.vueloId}`}
            tramo={t}
            carga={cargaPorVueloALNS[t.vueloId] || 0}
            simTiempoMinutos={simTiempoMinutos}
            umbralVerde={umbralVerde}
            umbralAmbar={umbralAmbar}
            prefix="alns"
            onSelectVuelo={onSelectVuelo}
          />
        ))}

        <AjustadorMapa aeropuertos={aeropuertos} />
      </MapContainer>
      <style jsx global>{`
        .loadroute-plane-marker {
          transition: transform 16ms linear;
          will-change: transform;
        }
      `}</style>
    </div>
  );
}

// ========================== UTILS ========================== 

function filtrarAvionesPorAeropuerto(tramos: TramoDTO[], filtros?: FiltrosAvionesMapa) {
  if (!filtros || (!filtros.usarOrigen && !filtros.usarDestino)) return tramos;
  if (filtros.usarOrigen && filtros.origenes.length === 0) return [];
  if (filtros.usarDestino && filtros.destinos.length === 0) return [];

  const origenes = new Set(filtros.origenes);
  const destinos = new Set(filtros.destinos);

  return tramos.filter(t => {
    const coincideOrigen = !filtros.usarOrigen || origenes.has(t.origen);
    const coincideDestino = !filtros.usarDestino || destinos.has(t.destino);
    return coincideOrigen && coincideDestino;
  });
}

function salidaTotalMinutos(t: TramoDTO): number {
  return (t.diaOffset || 0) * 1440 + t.salidaMinutosGMT;
}

function llegadaTotalMinutos(t: TramoDTO): number {
  let llegada = (t.diaOffset || 0) * 1440 + t.llegadaMinutosGMT;
  if (t.llegadaMinutosGMT < t.salidaMinutosGMT) {
    llegada += 1440;
  }
  return llegada;
}

function agregarIntervaloCarga(
  intervalos: Record<string, { inicio: number; fin: number; maletas: number }[]>,
  airportCode: string,
  inicio: number,
  fin: number,
  maletas: number
) {
  if (fin < inicio) return;
  if (!intervalos[airportCode]) intervalos[airportCode] = [];
  intervalos[airportCode].push({ inicio, fin, maletas });
}

function construirIndiceCargasAeropuertos(rutas: RutaMuestra[]): IndicesCargaAeropuertos {
  const intervalos: Record<string, { inicio: number; fin: number; maletas: number }[]> = {};

  for (const ruta of rutas) {
    if (!ruta.tramos || ruta.tramos.length === 0) continue;

    const primerVuelo = ruta.tramos[0];
    const primeraSalida = salidaTotalMinutos(primerVuelo);
    const recepcionTotal = ((ruta.recepcionDiaOffset ?? primerVuelo.diaOffset) || 0) * 1440
      + (ruta.recepcionMinutosGMT ?? 0);

    agregarIntervaloCarga(intervalos, ruta.origen, recepcionTotal, primeraSalida, ruta.maletas);

    for (let i = 0; i < ruta.tramos.length - 1; i++) {
      const vueloLlegada = ruta.tramos[i];
      const vueloSalida = ruta.tramos[i + 1];

      agregarIntervaloCarga(
        intervalos,
        vueloLlegada.destino,
        llegadaTotalMinutos(vueloLlegada),
        salidaTotalMinutos(vueloSalida),
        ruta.maletas
      );
    }
  }

  const indices: IndicesCargaAeropuertos = {};

  for (const [airportCode, registros] of Object.entries(intervalos)) {
    const iniciosOrdenados = [...registros].sort((a, b) => a.inicio - b.inicio);
    const finesOrdenados = [...registros].sort((a, b) => a.fin - b.fin);
    const inicios: number[] = [];
    const cargasInicio: number[] = [];
    const fines: number[] = [];
    const cargasFin: number[] = [];
    let totalInicio = 0;
    let totalFin = 0;

    for (const registro of iniciosOrdenados) {
      totalInicio += registro.maletas;
      inicios.push(registro.inicio);
      cargasInicio.push(totalInicio);
    }

    for (const registro of finesOrdenados) {
      totalFin += registro.maletas;
      fines.push(registro.fin);
      cargasFin.push(totalFin);
    }

    indices[airportCode] = { inicios, cargasInicio, fines, cargasFin };
  }

  return indices;
}

function upperBound(valores: number[], objetivo: number): number {
  let lo = 0;
  let hi = valores.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (valores[mid] <= objetivo) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function lowerBound(valores: number[], objetivo: number): number {
  let lo = 0;
  let hi = valores.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (valores[mid] < objetivo) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function calcularCargasAeropuertosEnMinuto(
  indices: IndicesCargaAeropuertos,
  simTotalMinutos: number
): Record<string, number> {
  const cargas: Record<string, number> = {};

  for (const [airportCode, indice] of Object.entries(indices)) {
    const iniciosIncluidos = upperBound(indice.inicios, simTotalMinutos);
    const finesVencidos = lowerBound(indice.fines, simTotalMinutos);
    const cargaInicio = iniciosIncluidos > 0 ? indice.cargasInicio[iniciosIncluidos - 1] : 0;
    const cargaFin = finesVencidos > 0 ? indice.cargasFin[finesVencidos - 1] : 0;
    const carga = cargaInicio - cargaFin;

    if (carga > 0) cargas[airportCode] = carga;
  }

  return cargas;
}

function calcularCargaPorVuelo(rutas: RutaMuestra[]): Record<number, number> {
  const cargas: Record<number, number> = {};

  for (const ruta of rutas) {
    if (!ruta.tramos) continue;
    const vuelosRuta = new Set<number>();
    for (const tramo of ruta.tramos) {
      if (vuelosRuta.has(tramo.vueloId)) continue;
      vuelosRuta.add(tramo.vueloId);
      cargas[tramo.vueloId] = (cargas[tramo.vueloId] || 0) + ruta.maletas;
    }
  }

  return cargas;
}

function isFlying(t: TramoDTO, simTotalMinutos: number) {
  if (t.llegadaMinutosGMT === undefined || t.salidaMinutosGMT === undefined || t.diaOffset === undefined) return false;

  const salidaTotal = salidaTotalMinutos(t);
  const llegadaTotal = llegadaTotalMinutos(t);

  return simTotalMinutos >= salidaTotal && simTotalMinutos <= llegadaTotal;
}

function getInterpolatedPosition(t: TramoDTO, simTotalMinutos: number) {
  const salidaTotal = salidaTotalMinutos(t);
  const llegadaTotal = llegadaTotalMinutos(t);

  const duration = llegadaTotal - salidaTotal;
  const passed = simTotalMinutos - salidaTotal;
  
  let p = duration === 0 ? 1 : passed / duration;
  if (p < 0) p = 0;
  if (p > 1) p = 1;
  
  const lat = t.origenLat + (t.destinoLat - t.origenLat) * p;
  const lon = t.origenLon + (t.destinoLon - t.origenLon) * p;
  
  const dLat = t.destinoLat - t.origenLat;
  const dLon = t.destinoLon - t.origenLon;
  const midLatRad = ((t.origenLat + t.destinoLat) / 2) * (Math.PI / 180);
  const dx = dLon * Math.cos(midLatRad);
  const dy = -dLat;
  const angle = dx === 0 && dy === 0 ? 0 : Math.atan2(dy, dx) * (180 / Math.PI);
  
  return { lat, lon, angle };
}

function getActiveFlights(tramos: TramoDTO[], current: number) {
  const seen = new Set<number>();
  const active: TramoDTO[] = [];
  
  for (const t of tramos) {
    if (!t.vueloId || seen.has(t.vueloId)) continue;
    if (isFlying(t, current)) {
      seen.add(t.vueloId);
      active.push(t);
    }
  }
  return active;
}
