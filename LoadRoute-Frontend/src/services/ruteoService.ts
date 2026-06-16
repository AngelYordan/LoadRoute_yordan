/**
 * Servicio de API — Tasf.B2B Logistics
 * Envía archivos .txt al backend y recibe resultados de algoritmos reales.
 *
 * CAMBIO v3: escenario, fechaInicio y fechaFin van como @RequestParam en la URL
 * (no en el FormData), conforme al controlador Spring Boot.
 * Los archivos van como @RequestPart con sus nombres correctos.
 */

import { API_ENDPOINTS } from '@/config/constants';
import { AlgoritmoSeleccion, RutaResponse, SimulacionJob } from '@/types/rutas';

/**
 * Ejecuta la simulación subiendo los 3 archivos de datos al backend.
 */
export async function ejecutarSimulacion(
  aeropuertosFile: File | undefined,
  vuelosFile: File | undefined,
  enviosFiles: File[] | undefined,
  escenario: number,
  fechaInicio?: string,  // formato YYYYMMDD o YYYYMMDDHHmm, opcional
  fechaFin?: string,     // formato YYYYMMDD o YYYYMMDDHHmm, opcional
  algoritmos: AlgoritmoSeleccion = 'ambos',
  onProgress?: (job: SimulacionJob) => void
): Promise<RutaResponse[]> {
  const started = await iniciarSimulacion(
    aeropuertosFile,
    vuelosFile,
    enviosFiles,
    escenario,
    fechaInicio,
    fechaFin,
    algoritmos
  );
  onProgress?.(started);

  return esperarResultadoSimulacion(started.jobId, onProgress);
}

export async function iniciarSimulacion(
  aeropuertosFile: File | undefined,
  vuelosFile: File | undefined,
  enviosFiles: File[] | undefined,
  escenario: number,
  fechaInicio?: string,
  fechaFin?: string,
  algoritmos: AlgoritmoSeleccion = 'ambos'
): Promise<SimulacionJob> {
  const formData = new FormData();
  // Nombres de campo deben coincidir con @RequestPart del controlador
  if (aeropuertosFile) {
    formData.append('aeropuertosFile', aeropuertosFile);
  }
  if (vuelosFile) {
    formData.append('vuelosFile', vuelosFile);
  }
  if (enviosFiles) {
    enviosFiles.forEach(file => {
      formData.append('enviosFiles', file);
    });
  }

  // Los @RequestParam van en la URL, no en el body multipart
  const params = new URLSearchParams({ escenario: String(escenario) });
  if (fechaInicio) params.set('fechaInicio', fechaInicio);
  if (fechaFin) params.set('fechaFin', fechaFin);
  params.set('algoritmos', algoritmos);

  const response = await fetch(`${API_ENDPOINTS.SIMULAR_ASYNC}?${params.toString()}`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const msg = errorBody?.error || `Error del servidor: ${response.status}`;
    throw new Error(msg);
  }

  return response.json();
}

export async function obtenerEstadoSimulacion(jobId: string): Promise<SimulacionJob> {
  const response = await fetch(`${API_ENDPOINTS.SIMULAR_ASYNC}/${jobId}`);
  if (!response.ok) {
    throw new Error(`No se pudo consultar la simulacion: ${response.status}`);
  }
  return response.json();
}

export async function obtenerChunksSimulacion(jobId: string, desde = 0): Promise<SimulacionJob> {
  const params = new URLSearchParams({ desde: String(Math.max(0, desde)) });
  const response = await fetch(`${API_ENDPOINTS.SIMULAR_ASYNC}/${jobId}/chunks?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`No se pudieron descargar los resultados: ${response.status}`);
  }
  return response.json();
}

export async function eliminarSimulacion(jobId: string): Promise<void> {
  await fetch(`${API_ENDPOINTS.SIMULAR_ASYNC}/${jobId}`, { method: 'DELETE' }).catch(() => undefined);
}

async function esperarResultadoSimulacion(
  jobId: string,
  onProgress?: (job: SimulacionJob) => void
): Promise<RutaResponse[]> {
  while (true) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const job = await obtenerEstadoSimulacion(jobId);
    onProgress?.(job);

    if (job.status === 'DONE') {
      const result = await obtenerChunksSimulacion(jobId, 0);
      await eliminarSimulacion(jobId);
      return result.chunks || [];
    }

    if (job.status === 'ERROR') {
      await eliminarSimulacion(jobId);
      throw new Error(job.error || job.message || 'La simulacion fallo');
    }
  }
}

/**
 * Verifica si el backend está disponible
 */
export async function verificarSaludBackend(): Promise<boolean> {
  try {
    const response = await fetch(API_ENDPOINTS.HEALTH);
    return response.ok;
  } catch {
    return false;
  }
}
