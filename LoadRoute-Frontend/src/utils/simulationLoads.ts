import { RutaMuestra } from '@/types/rutas';

export function getAirportCurrentLoad(
  airportCode: string,
  rutas: RutaMuestra[],
  currentMinute: number,
  simDay = 0
): number {
  const currentAbsMinute = simDay * 1440 + currentMinute;
  let total = 0;

  for (const ruta of rutas) {
    if (!ruta.tramos || ruta.tramos.length === 0) continue;

    const firstFlight = ruta.tramos[0];
    const lastFlight = ruta.tramos[ruta.tramos.length - 1];

    if (airportCode === ruta.origen && currentAbsMinute <= firstFlight.salidaMinutosGMT) {
      total += ruta.maletas;
    }

    if (airportCode === ruta.destino && currentAbsMinute >= lastFlight.llegadaMinutosGMT) {
      total += ruta.maletas;
    }

    for (let i = 0; i < ruta.tramos.length - 1; i++) {
      const arrFlight = ruta.tramos[i];
      const depFlight = ruta.tramos[i + 1];
      if (airportCode !== arrFlight.destino) continue;

      const arrival = arrFlight.llegadaMinutosGMT;
      let departure = depFlight.salidaMinutosGMT;
      if (departure < arrival) departure += 1440;

      if (currentAbsMinute >= arrival && currentAbsMinute <= departure) {
        total += ruta.maletas;
      }
    }
  }

  return total;
}

export function getRoutesForMode(
  mode: 'sa' | 'alns' | 'ambos',
  rutasSA: RutaMuestra[] = [],
  rutasALNS: RutaMuestra[] = []
): RutaMuestra[] {
  if (mode === 'sa') return rutasSA;
  if (mode === 'alns') return rutasALNS.length > 0 ? rutasALNS : rutasSA;
  return [...rutasSA, ...rutasALNS];
}
