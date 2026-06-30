import { useState, useEffect, useRef, useMemo } from 'react';
import { RutaResponse } from '@/types/rutas';

const MAP_FRAME_INTERVAL_MS = 1000 / 30;

function getInicioOffsetMinutos(fechaInicioRaw?: string): number {
  if (!fechaInicioRaw || fechaInicioRaw.length < 12) return 0;
  const h = Number(fechaInicioRaw.slice(8, 10));
  const m = Number(fechaInicioRaw.slice(10, 12));
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function parseFechaRaw(raw?: string, endOfDay = false): Date | null {
  if (!raw || raw.length < 8) return null;
  const cleanRaw = raw.replace(/[- :T]/g, '');
  if (cleanRaw.length < 8) return null;
  const y = Number(cleanRaw.slice(0, 4));
  const m = Number(cleanRaw.slice(4, 6)) - 1;
  const d = Number(cleanRaw.slice(6, 8));
  const hh = cleanRaw.length >= 12 ? Number(cleanRaw.slice(8, 10)) : (endOfDay ? 23 : 0);
  const mm = cleanRaw.length >= 12 ? Number(cleanRaw.slice(10, 12)) : (endOfDay ? 59 : 0);
  const parsed = new Date(y, m, d, hh, mm);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getFinOffsetMinutos(fechaInicioRaw?: string, fechaFinRaw?: string): number | null {
  const inicio = parseFechaRaw(fechaInicioRaw);
  const fin = parseFechaRaw(fechaFinRaw, true);
  if (!inicio || !fin || fin < inicio) return null;

  const inicioDia = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  const MS_POR_MINUTO = 60 * 1000;
  return Math.max(0, Math.ceil((fin.getTime() - inicioDia.getTime()) / MS_POR_MINUTO));
}

function getMaxSimDia(fechaInicioRaw?: string, fechaFinRaw?: string): number | null {
  const finOffset = getFinOffsetMinutos(fechaInicioRaw, fechaFinRaw);
  if (finOffset === null) return null;
  return Math.max(0, Math.floor(Math.max(0, finOffset - 1) / 1440));
}

function calcularMaxTotalMinutos(
  resultado: RutaResponse | null,
  fechaInicioRaw: string,
  fechaFinRaw: string,
  maxTimelineMinutos: number | null,
): number | null {
  // PRIORIDAD 1: Forzar el cálculo real por las fechas del panel (ej: 3 días = 4320)
  const finOffset = getFinOffsetMinutos(fechaInicioRaw, fechaFinRaw);
  if (finOffset !== null) return finOffset;

  // PRIORIDAD 2: Solo si las fechas fallan, miramos el lote del backend
  if (resultado && resultado.escenario === 1 && resultado.loteFin) {
    const finLoteOffset = getFinOffsetMinutos(fechaInicioRaw, resultado.loteFin);
    if (finLoteOffset !== null) return finLoteOffset;
  }

  return maxTimelineMinutos;
}

interface UseSimulationTimerProps {
  resultado: RutaResponse | null;
  fechaInicioRaw: string;
  fechaFinRaw: string;
}

export function useSimulationTimer({ resultado, fechaInicioRaw, fechaFinRaw }: UseSimulationTimerProps) {
  const simInicioMinutos = useMemo(() => {
    if (resultado?.escenario === 1) {
      return getInicioOffsetMinutos(fechaInicioRaw);
    }
    if (resultado?.loteInicio) {
      const parts = resultado.loteInicio.split('T');
      if (parts.length >= 2) {
        const timeParts = parts[1].split(':');
        if (timeParts.length >= 2) {
          const h = Number(timeParts[0]);
          const m = Number(timeParts[1]);
          if (!Number.isNaN(h) && !Number.isNaN(m)) {
            return h * 60 + m;
          }
        }
      }
    }
    return 0;
  }, [resultado, fechaInicioRaw]);

  const [simTotalMinutos, setSimTotalMinutos] = useState(0);
  const [realElapsedMs, setRealElapsedMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [horaReal, setHoraReal] = useState(() => new Date());

  const timerRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const hasAlignedRef = useRef(false);

  // Reset alignment when scenario changes or starts fresh
  useEffect(() => {
    hasAlignedRef.current = false;
  }, [resultado?.escenario, resultado?.fechaInicio]);

  useEffect(() => {
    if (!resultado) {
      setSimTotalMinutos(0);
      setRealElapsedMs(0);
      hasAlignedRef.current = false;
      return;
    }

    let targetMinutos = 0;
    if (resultado.escenario === 1) {
      targetMinutos = getInicioOffsetMinutos(fechaInicioRaw);
    } else {
      const timeStr = (!hasAlignedRef.current && resultado.chunksCount && resultado.chunksCount > 1)
        ? resultado.loteFin
        : resultado.loteInicio;

      if (timeStr) {
        const parts = timeStr.split('T');
        if (parts.length >= 2) {
          const timeParts = parts[1].split(':');
          if (timeParts.length >= 2) {
            const h = Number(timeParts[0]);
            const m = Number(timeParts[1]);
            if (!Number.isNaN(h) && !Number.isNaN(m)) {
              targetMinutos = h * 60 + m;
            }
          }
        }
      }
    }

    if (!hasAlignedRef.current) {
      setSimTotalMinutos(targetMinutos);
      setRealElapsedMs(0);
      hasAlignedRef.current = true;
    }
  }, [resultado, fechaInicioRaw]);

  const maxTimelineMinutos = useMemo(() => {
    if (!resultado) return null;
    const rutas = resultado.resultadoSA?.rutasMuestra || [];
    let max = 0;
    for (const ruta of rutas) {
      for (const tramo of ruta.tramos || []) {
        if (tramo.diaOffset === undefined || tramo.llegadaMinutosGMT === undefined) continue;
        let llegada = tramo.diaOffset * 1440 + tramo.llegadaMinutosGMT;
        if (tramo.llegadaMinutosGMT < tramo.salidaMinutosGMT) llegada += 1440;
        max = Math.max(max, llegada);
      }
    }
    return max > 0 ? max : null;
  }, [resultado]);

  const maxTotalMinutos = useMemo(
    () => calcularMaxTotalMinutos(resultado, fechaInicioRaw, fechaFinRaw, maxTimelineMinutos),
    [resultado, fechaInicioRaw, fechaFinRaw, maxTimelineMinutos],
  );

  const maxSimDia = useMemo(() => getMaxSimDia(fechaInicioRaw, fechaFinRaw), [fechaInicioRaw, fechaFinRaw]);

  // Velocidades calculadas
  const kRate = resultado?.k ?? 240;
  const saRate = resultado?.sa ?? 1;
  
  // 🌟 CAMBIO AQUÍ: Avance real basado en los milisegundos transcurridos, no en tasas fijas por frame
  const avanceMinutosPorMilsegundo = (kRate * saRate) / 60 / 1000;

  const rangoFinalizado = maxTotalMinutos !== null && simTotalMinutos >= maxTotalMinutos;

  const simTotalVisual = rangoFinalizado && maxTotalMinutos !== null
    ? Math.max(simInicioMinutos, maxTotalMinutos - (1 / 60))
    : simTotalMinutos;

  const simTranscurridoMinutos = Math.max(0, simTotalVisual - simInicioMinutos);
  
  const escenarioActual = resultado?.escenario ?? 1;
  const mostrarProgreso = escenarioActual === 1;
  
  const progresoSimulacion = mostrarProgreso && maxTotalMinutos !== null && maxTotalMinutos > simInicioMinutos
    ? Math.min(Math.max(simTranscurridoMinutos / (maxTotalMinutos - simInicioMinutos), 0), 1)
    : 0;

  const simDia = Math.floor(simTotalVisual / 1440);
  const simHoraMinutos = simTotalVisual % 1440;

  useEffect(() => {
    const id = setInterval(() => setHoraReal(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Bucle de simulación por delta matemático exacto
  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current !== null) cancelAnimationFrame(timerRef.current);
      timerRef.current = null;
      lastFrameRef.current = null;
      return;
    }

    const step = (timestamp: number) => {
      if (lastFrameRef.current === null) {
        lastFrameRef.current = timestamp;
        timerRef.current = requestAnimationFrame(step);
        return;
      }

      const deltaMs = timestamp - lastFrameRef.current;

      if (deltaMs < MAP_FRAME_INTERVAL_MS) {
        timerRef.current = requestAnimationFrame(step);
        return;
      }

      lastFrameRef.current = timestamp;

      setSimTotalMinutos(prev => {
        // 🌟 MATEMÁTICA EXACTA: Avanza proporcionalmente al tiempo exacto que pasó (deltaMs)
        const avanceMinutos = deltaMs * avanceMinutosPorMilsegundo;
        const next = prev + avanceMinutos;
        
        if (maxTotalMinutos !== null && next >= maxTotalMinutos) {
          setIsPlaying(false);
          return maxTotalMinutos;
        }
        return next;
      });

      setRealElapsedMs(prev => prev + deltaMs);
      timerRef.current = requestAnimationFrame(step);
    };

    timerRef.current = requestAnimationFrame(step);

    return () => {
      if (timerRef.current !== null) cancelAnimationFrame(timerRef.current);
      timerRef.current = null;
    };
  }, [isPlaying, maxTotalMinutos, avanceMinutosPorMilsegundo]);

  const handleStop = () => {
    setIsPlaying(false);
    setSimTotalMinutos(simInicioMinutos);
    setRealElapsedMs(0);
  };

  const resetTimerCompletamente = (nuevoMinutoInicial = simInicioMinutos) => {
    setIsPlaying(false);
    setSimTotalMinutos(nuevoMinutoInicial);
    setRealElapsedMs(0);
  };

  return {
    simTotalMinutos,
    simTotalVisual,
    realElapsedMs,
    isPlaying,
    horaReal,
    simDia,
    simHoraMinutos,
    simTranscurridoMinutos,
    progresoSimulacion,
    mostrarProgreso,
    rangoFinalizado,
    maxSimDia,
    maxTotalMinutos,
    simInicioMinutos,
    setIsPlaying,
    handleStop,
    resetTimerCompletamente,
  };
}