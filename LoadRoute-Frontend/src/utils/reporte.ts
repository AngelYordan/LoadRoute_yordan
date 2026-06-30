import { RutaResponse, RutaMuestra, TramoDTO } from '@/types/rutas';

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

export function obtenerPicoCargasAeropuertos(rutas: RutaMuestra[]): Record<string, number> {
  const picos: Record<string, number> = {};
  const eventosPorAeropuerto: Record<string, { tiempo: number; delta: number }[]> = {};

  for (const ruta of rutas) {
    if (!ruta.tramos || ruta.tramos.length === 0) continue;

    const primerVuelo = ruta.tramos[0];
    const primeraSalida = salidaTotalMinutos(primerVuelo);
    const recepcionTotal = ((ruta.recepcionDiaOffset ?? primerVuelo.diaOffset) || 0) * 1440
      + (ruta.recepcionMinutosGMT ?? 0);

    if (primeraSalida >= recepcionTotal) {
      if (!eventosPorAeropuerto[ruta.origen]) eventosPorAeropuerto[ruta.origen] = [];
      eventosPorAeropuerto[ruta.origen].push({ tiempo: recepcionTotal, delta: ruta.maletas });
      eventosPorAeropuerto[ruta.origen].push({ tiempo: primeraSalida, delta: -ruta.maletas });
    }

    for (let i = 0; i < ruta.tramos.length - 1; i++) {
      const vueloLlegada = ruta.tramos[i];
      const vueloSalida = ruta.tramos[i + 1];
      const llegadaEscala = llegadaTotalMinutos(vueloLlegada);
      const salidaEscala = salidaTotalMinutos(vueloSalida);

      if (salidaEscala >= llegadaEscala) {
        if (!eventosPorAeropuerto[vueloLlegada.destino]) eventosPorAeropuerto[vueloLlegada.destino] = [];
        eventosPorAeropuerto[vueloLlegada.destino].push({ tiempo: llegadaEscala, delta: ruta.maletas });
        eventosPorAeropuerto[vueloLlegada.destino].push({ tiempo: salidaEscala, delta: -ruta.maletas });
      }
    }
  }

  for (const [airportCode, eventos] of Object.entries(eventosPorAeropuerto)) {
    eventos.sort((a, b) => {
      if (a.tiempo !== b.tiempo) return a.tiempo - b.tiempo;
      return b.delta - a.delta; // Entradas primero
    });

    let cargaActual = 0;
    let maxCarga = 0;
    for (const e of eventos) {
      cargaActual += e.delta;
      if (cargaActual > maxCarga) maxCarga = cargaActual;
    }
    picos[airportCode] = maxCarga;
  }

  return picos;
}

export interface MetricasReporte {
  totalEnvios: number;
  enviosAsignados: number;
  enviosNoAceptados: number;
  coberturaPct: number;
  totalMaletas: number;
  cumpleSLACount: number;
  excedeSLACount: number;
  cumpleSLAPct: number;
  tiempoTransitoPromedioHoras: number;
  picoCargas: Record<string, number>;
  costoInicial: number;
  costoFinal: number;
  mejoraRelativa: number;
  iteraciones: number;
  tiempoEjecucionMs: number;
}

export function calcularMetricasReporte(resultado: RutaResponse): MetricasReporte {
  const sa = resultado.resultadoSA;
  const rutas = sa?.rutasMuestra || [];

  const totalEnvios = sa?.totalEnvios || 0;
  const enviosAsignados = sa?.enviosAsignados || 0;
  const enviosNoAceptados = sa?.enviosNoAceptados || 0;
  const coberturaPct = totalEnvios > 0 ? (enviosAsignados / totalEnvios) * 100 : 0;

  let totalMaletas = 0;
  let cumpleSLACount = 0;
  let excedeSLACount = 0;
  let tiempoTransitoAcumuladoMinutos = 0;

  for (const ruta of rutas) {
    totalMaletas += ruta.maletas;
    if (!ruta.tramos || ruta.tramos.length === 0) continue;

    const primerVuelo = ruta.tramos[0];
    const ultimoVuelo = ruta.tramos[ruta.tramos.length - 1];

    const recepcionTotal = ((ruta.recepcionDiaOffset ?? primerVuelo.diaOffset) || 0) * 1440
      + (ruta.recepcionMinutosGMT ?? 0);
    const llegadaFinal = llegadaTotalMinutos(ultimoVuelo);

    const transitoMinutos = Math.max(0, llegadaFinal - recepcionTotal);
    tiempoTransitoAcumuladoMinutos += transitoMinutos;

    const transitoHoras = transitoMinutos / 60;
    if (transitoHoras <= ruta.slaHoras) {
      cumpleSLACount++;
    } else {
      excedeSLACount++;
    }
  }

  const cumpleSLAPct = enviosAsignados > 0 ? (cumpleSLACount / enviosAsignados) * 100 : 0;
  const tiempoTransitoPromedioHoras = enviosAsignados > 0
    ? (tiempoTransitoAcumuladoMinutos / enviosAsignados) / 60
    : 0;

  const picoCargas = obtenerPicoCargasAeropuertos(rutas);

  return {
    totalEnvios,
    enviosAsignados,
    enviosNoAceptados,
    coberturaPct,
    totalMaletas,
    cumpleSLACount,
    excedeSLACount,
    cumpleSLAPct,
    tiempoTransitoPromedioHoras,
    picoCargas,
    costoInicial: sa?.costoInicial || 0,
    costoFinal: sa?.costoFinal || 0,
    mejoraRelativa: sa?.mejoraRelativa || 0,
    iteraciones: sa?.iteraciones || 0,
    tiempoEjecucionMs: sa?.tiempoEjecucionMs || 0,
  };
}
