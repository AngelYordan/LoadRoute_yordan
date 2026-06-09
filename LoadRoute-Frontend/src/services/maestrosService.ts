import { API_ENDPOINTS } from '@/config/constants';
import { Aeropuerto, Vuelo } from '@/types/rutas';

// DTOs adaptados para las peticiones de creación y actualización
export interface AeropuertoCreateDTO extends Omit<Aeropuerto, 'id'> {}

export interface VueloCreateDTO {
  origenCodigo: string;
  destinoCodigo: string;
  horaSalidaLocal: string;  // formato "HH:mm:ss" o "HH:mm"
  horaLlegadaLocal: string;
  capacidadMax: number;
}

export interface VueloResponseDTO extends VueloCreateDTO {
  id: number;
}

// --- AEROPUERTOS ---

export async function obtenerAeropuertos(): Promise<Aeropuerto[]> {
  const response = await fetch(API_ENDPOINTS.AEROPUERTOS);
  if (!response.ok) throw new Error('Error al obtener aeropuertos');
  return response.json();
}

export async function crearAeropuerto(dto: AeropuertoCreateDTO): Promise<Aeropuerto> {
  const response = await fetch(API_ENDPOINTS.AEROPUERTOS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.error || 'Error al crear aeropuerto');
  }
  return response.json();
}

export async function actualizarAeropuerto(codigo: string, dto: AeropuertoCreateDTO): Promise<Aeropuerto> {
  const response = await fetch(`${API_ENDPOINTS.AEROPUERTOS}/${codigo}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
  if (!response.ok) throw new Error('Error al actualizar aeropuerto');
  return response.json();
}

export async function eliminarAeropuerto(codigo: string): Promise<void> {
  const response = await fetch(`${API_ENDPOINTS.AEROPUERTOS}/${codigo}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.error || 'Error al eliminar aeropuerto');
  }
}

// --- VUELOS ---

export async function obtenerVuelos(): Promise<VueloResponseDTO[]> {
  const response = await fetch(API_ENDPOINTS.VUELOS);
  if (!response.ok) throw new Error('Error al obtener vuelos');
  return response.json();
}

export async function crearVuelo(dto: VueloCreateDTO): Promise<VueloResponseDTO> {
  const response = await fetch(API_ENDPOINTS.VUELOS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
  if (!response.ok) throw new Error('Error al crear vuelo');
  return response.json();
}

export async function actualizarVuelo(id: number, dto: VueloCreateDTO): Promise<VueloResponseDTO> {
  const response = await fetch(`${API_ENDPOINTS.VUELOS}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
  if (!response.ok) throw new Error('Error al actualizar vuelo');
  return response.json();
}

export async function eliminarVuelo(id: number): Promise<void> {
  const response = await fetch(`${API_ENDPOINTS.VUELOS}/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Error al eliminar vuelo');
}
