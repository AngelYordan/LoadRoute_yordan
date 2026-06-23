/**
 * Constantes de configuración del Frontend — Tasf.B2B Logistics
 */

export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';
export const BASE_URL = BACKEND_URL;

export const API_ENDPOINTS = {
  SIMULAR: `${BACKEND_URL}/api/rutas/simular`,
  SIMULAR_ASYNC: `${BACKEND_URL}/api/rutas/simular-async`,
  HEALTH: `${BACKEND_URL}/api/rutas/health`,
  AEROPUERTOS: `${BACKEND_URL}/api/aeropuertos`,
  VUELOS: `${BACKEND_URL}/api/vuelos`,
  ENVIO_DIA_A_DIA: `${BACKEND_URL}/api/rutas/dia-a-dia`,
};
