import { API_ENDPOINTS } from '@/config/constants';
import { AeropuertoDTO } from '@/types/rutas';

// DTOs adaptados para las peticiones de creación y actualización
export interface AeropuertoCreateDTO extends Omit<AeropuertoDTO, 'id'> {}

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

export async function obtenerAeropuertos(): Promise<AeropuertoDTO[]> {
  const response = await fetch(API_ENDPOINTS.AEROPUERTOS);
  if (!response.ok) throw new Error('Error al obtener aeropuertos');
  return response.json();
}

export async function crearAeropuerto(dto: AeropuertoCreateDTO): Promise<AeropuertoDTO> {
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

export async function actualizarAeropuerto(codigo: string, dto: AeropuertoCreateDTO): Promise<AeropuertoDTO> {
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

// --- ENVÍOS DÍA A DÍA ---

export interface EnvioDiaADiaResponse {
  id: number;
  claveCompuesta: string;
  clienteId: string;
  origen: AeropuertoDTO;
  destino: AeropuertoDTO;
  fechaCreacion: string; // formato ISO
  cantidadMaletas: number;
  rutaDefinida: boolean;
}

export interface EnvioDiaADiaCreateDTO {
  clienteId: string;
  origenCodigo: string;
  destinoCodigo: string;
  fechaCreacionLocal: string; // formato "YYYY-MM-DDTHH:mm"
  cantidadMaletas: number;
}

export async function obtenerEnviosDiaADia(): Promise<EnvioDiaADiaResponse[]> {
  const response = await fetch(`${API_ENDPOINTS.ENVIO_DIA_A_DIA}/envios`);
  if (!response.ok) throw new Error('Error al obtener envíos día a día');
  return response.json();
}

export async function crearEnvioDiaADia(dto: EnvioDiaADiaCreateDTO): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_ENDPOINTS.ENVIO_DIA_A_DIA}/crear`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
  if (!response.ok) throw new Error('Error al registrar envío manual');
  return response.json();
}

export async function cargarArchivosDiaADia(file: File): Promise<{ success: boolean; message: string; count: number }> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_ENDPOINTS.ENVIO_DIA_A_DIA}/cargar-archivo`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) throw new Error('Error al subir archivo de envíos');
  return response.json();
}

export async function limpiarEnviosDiaADia(): Promise<void> {
  const response = await fetch(`${API_ENDPOINTS.ENVIO_DIA_A_DIA}/limpiar`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Error al limpiar envíos día a día');
}
