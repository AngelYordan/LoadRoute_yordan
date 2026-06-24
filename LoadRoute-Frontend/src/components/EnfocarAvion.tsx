import React, { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';

interface EnfocarAvionProps {
  selectedVuelo: any | null;
  simTiempoMinutos: number;
  getInterpolatedPosition: (tramo: any, minutos: number) => { lat: number; lon: number; angle: number };
}

export const EnfocarAvion: React.FC<EnfocarAvionProps> = ({
  selectedVuelo,
  simTiempoMinutos,
  getInterpolatedPosition,
}) => {
  const map = useMap();
  
  const [isFollowing, setIsFollowing] = useState(false);
  const prevVueloId = useRef<string | null>(null);

  // ── 1. EFECTO DE VUELO INICIAL ──
  useEffect(() => {
    if (!selectedVuelo) {
      setIsFollowing(false);
      prevVueloId.current = null;
      return;
    }

    if (selectedVuelo.vueloId !== prevVueloId.current) {
      const { lat, lon } = getInterpolatedPosition(selectedVuelo, simTiempoMinutos);
      
      if (typeof lat === 'number' && typeof lon === 'number' && !isNaN(lat) && !isNaN(lon)) {
        
        // 1. APAGAMOS el seguimiento temporalmente para que no interrumpa
        setIsFollowing(false);
        
        // 2. Iniciamos el vuelo cinemático de 1.5 segundos con Zoom 12
        map.flyTo([lat, lon], 5, {
          animate: true,
          duration: 1.5,
        });
        
        prevVueloId.current = selectedVuelo.vueloId;

        // 3. Esperamos EXACTAMENTE 1.5 segundos (lo que dura el flyTo)
        // para encender el seguimiento continuo.
        const timer = setTimeout(() => {
          setIsFollowing(true);
        }, 1500);

        // Limpiamos el timer si el componente se desmonta o el usuario cambia de vuelo rápido
        return () => clearTimeout(timer);
      }
    }
    // NOTA: Intencionalmente omitimos simTiempoMinutos aquí para que no relance el timer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVuelo?.vueloId, map]); 


  // ── 2. EFECTO DE SEGUIMIENTO CONTINUO ──
  useEffect(() => {
    if (!selectedVuelo || !isFollowing) return;

    const { lat, lon } = getInterpolatedPosition(selectedVuelo, simTiempoMinutos);
    
    if (typeof lat === 'number' && typeof lon === 'number' && !isNaN(lat) && !isNaN(lon)) {
      map.panTo([lat, lon], { 
        animate: true, 
        duration: 0.5 
      });
    }
  }, [simTiempoMinutos, isFollowing, selectedVuelo, map, getInterpolatedPosition]);


  // ── 3. EFECTO DE LIBERACIÓN DE CÁMARA INTELIGENTE ──
  useEffect(() => {
    const handleInterrupt = () => {
      setIsFollowing(false);
    };

    const handleZoomEnd = () => {
      if (map.getZoom() < 8) {
        setIsFollowing(false);
      }
    };

    map.on('dragstart', handleInterrupt);
    map.on('zoomend', handleZoomEnd);

    const mapContainer = map.getContainer();
    mapContainer.addEventListener('wheel', handleInterrupt, { passive: true });

    return () => {
      map.off('dragstart', handleInterrupt);
      map.off('zoomend', handleZoomEnd);
      mapContainer.removeEventListener('wheel', handleInterrupt);
    };
  }, [map]);

  return null;
};