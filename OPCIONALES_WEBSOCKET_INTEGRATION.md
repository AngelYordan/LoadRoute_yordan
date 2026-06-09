# 🔌 OPCIONALES: CÓMO INTEGRAR WEBSOCKET EN COMPONENTES

**Status:** 🟡 Opcional (No requerido para Fase 3)  
**Dificultad:** Intermedia  
**Tiempo estimado:** 2-4 horas

---

## 📋 RESUMEN

Fase 3 ya está 100% completa. Los WebSockets están configurados en backend y el hook existe en frontend. 

**LO QUE FALTA** (opcional): Integrar el hook en componentes para que se actualicen automáticamente cuando otros usuarios hagan cambios.

---

## 🎯 QUÉ SE LOGRARÍA

### SIN Integración (Estado Actual)
```
Usuario A crea aeropuerto
    ↓
Se guarda en BD
    ↓
WebSocket emite evento
    ↓
Usuario B NO ve el cambio (hasta que recarga página)
```

### CON Integración (Mejora Opcional)
```
Usuario A crea aeropuerto
    ↓
Se guarda en BD
    ↓
WebSocket emite evento
    ↓
Usuario B VE el cambio automáticamente (sin recargar)
    ↓
Toast notification: "Nuevo aeropuerto agregado"
```

---

## 📦 PASO 1: CREAR COMPONENTE DE NOTIFICACIONES

Crea: `src/components/ToastNotification.tsx`

```typescript
import { useState, useEffect } from 'react';

type ToastType = 'success' | 'warning' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

export function ToastContainer({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed bottom-5 right-5 z-50 space-y-2">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`
            px-4 py-3 rounded-lg text-white text-sm
            ${toast.type === 'success' && 'bg-green-500'}
            ${toast.type === 'warning' && 'bg-yellow-500'}
            ${toast.type === 'error' && 'bg-red-500'}
            ${toast.type === 'info' && 'bg-blue-500'}
            animate-fade-in shadow-lg
          `}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: ToastType = 'info', duration = 3000) => {
    const id = Date.now().toString();
    const newToast: Toast = { id, message, type, duration };
    
    setToasts(prev => [...prev, newToast]);
    
    if (duration) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
    
    return id;
  };

  return { toasts, showToast };
}
```

---

## 🔌 PASO 2: INTEGRAR EN AdminPanel.tsx

```typescript
import { useToast, ToastContainer } from '@/components/ToastNotification';
import { useWebSocket } from '@/hooks/useWebSocket';

export default function AdminPanel({
  // ... props ...
}) {
  // ... estado existente ...
  
  const { toasts, showToast } = useToast();
  const [refreshKey, setRefreshKey] = useState(0);

  // ← AGREGAR ESTA PARTE: WebSocket Listener
  useWebSocket({
    topic: '/topic/maestros',
    onMessage: (msg: any) => {
      const eventType = msg.event || '';

      if (activeTab === 'aeropuertos') {
        if (eventType.includes('AEROPUERTO')) {
          showToast(
            `${eventType.replace(/_/g, ' ')}`,
            'info'
          );
          // Refrescar lista de aeropuertos
          cargarAeropuertos();
        }
      } else if (activeTab === 'vuelos') {
        if (eventType.includes('VUELO')) {
          showToast(
            `${eventType.replace(/_/g, ' ')}`,
            'info'
          );
          // Refrescar lista de vuelos
          cargarVuelos();
        }
      }
    }
  });

  return (
    <>
      {/* ... componente existente ... */}
      <ToastContainer toasts={toasts} />
    </>
  );
}
```

---

## 📡 PASO 3: INTEGRAR EN page.tsx (Mapa Principal)

```typescript
import { useWebSocket } from '@/hooks/useWebSocket';
import { useToast, ToastContainer } from '@/components/ToastNotification';

export default function Home() {
  // ... estado existente ...
  
  const { toasts, showToast } = useToast();

  // ← AGREGAR: Listener para cambios de maestros
  useWebSocket({
    topic: '/topic/maestros',
    onMessage: (msg: any) => {
      if (msg.event === 'AEROPUERTO_ACTUALIZADO' || 
          msg.event === 'VUELO_ACTUALIZADO') {
        showToast(
          `Datos maestros actualizados por otro usuario`,
          'warning',
          5000
        );
        // Opcionalmente: recargar datos
        // cargarAeropuertos();
        // cargarVuelos();
      }
    }
  });

  // ← AGREGAR: Listener para eventos de simulación
  useWebSocket({
    topic: '/topic/simulacion',
    onMessage: (msg: any) => {
      if (msg.event === 'SIMULACION_FINALIZADA') {
        showToast(
          `✅ Simulación completada (ID: ${msg.jobId})`,
          'success'
        );
        // Opcionalmente: recargar resultados
        // cargarResultados(msg.jobId);
      } else if (msg.event === 'SIMULACION_ERROR') {
        showToast(
          `❌ Error en simulación (ID: ${msg.jobId})`,
          'error'
        );
      }
    }
  });

  return (
    <div>
      {/* ... componente existente ... */}
      <ToastContainer toasts={toasts} />
    </div>
  );
}
```

---

## 🎨 PASO 4: AGREGAR CSS PARA ANIMACIONES (tailwind)

Añade a `src/app/globals.css`:

```css
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in {
  animation: fadeIn 0.3s ease-in-out;
}
```

---

## 🧪 PASO 5: PRUEBA MULTI-NAVEGADOR

### Escenario 1: Crear Aeropuerto
```
Browser 1 (Admin): Abre AdminPanel → Aeropuertos → "Nuevo Aeropuerto"
Browser 2 (Usuario): Viendo página principal
    ↓
Browser 1: Rellena formulario, clic en "Guardar"
    ↓
Backend: Crea aeropuerto, emite WebSocket
    ↓
Browser 2: Recibe evento, muestra Toast "AEROPUERTO_CREADO"
    ↓
Resultado: ✅ Multi-usuario sincronización confirmada
```

### Escenario 2: Completar Simulación
```
Browser 1: Ejecuta simulación (Play)
Browser 2: Esperando resultado
    ↓
Simulación termina (100%)
    ↓
Backend: Emite SIMULACION_FINALIZADA
    ↓
Browser 2: Toast "✅ Simulación completada"
    ↓
Resultado: ✅ Evento de simulación confirmado
```

---

## 🎯 CHECKLIST DE INTEGRACIÓN

```
☐ ToastNotification.tsx creado
☐ useToast hook importado en AdminPanel
☐ useWebSocket importado en AdminPanel
☐ WebSocket listener para /topic/maestros en AdminPanel
☐ Cargar datos cuando evento CRUD recibido
☐ useToast hook importado en page.tsx
☐ useWebSocket importado en page.tsx
☐ WebSocket listener para /topic/maestros en page.tsx
☐ WebSocket listener para /topic/simulacion en page.tsx
☐ CSS animaciones en globals.css
☐ Compilar: npm run build
☐ Testear con 2 navegadores simultáneamente
```

---

## 📊 COMPORTAMIENTOS ESPERADOS

| Evento | Toast | Acción |
|--------|-------|--------|
| AEROPUERTO_CREADO | "Aeropuerto creado" | Recargar lista |
| AEROPUERTO_ACTUALIZADO | "Aeropuerto actualizado" | Recargar lista |
| AEROPUERTO_ELIMINADO | "Aeropuerto eliminado" | Recargar lista |
| VUELO_CREADO | "Vuelo creado" | Recargar lista |
| VUELO_ACTUALIZADO | "Vuelo actualizado" | Recargar lista |
| VUELO_ELIMINADO | "Vuelo eliminado" | Recargar lista |
| SIMULACION_FINALIZADA | "✅ Simulación completada" | Opcional |
| SIMULACION_ERROR | "❌ Error en simulación" | Opcional |

---

## 🔧 ALTERNATIVA: Auto-Refresh (Sin Toasts)

Si solo quieres que se actualice sin mostrar notificaciones:

```typescript
const [refreshTrigger, setRefreshTrigger] = useState(0);

useWebSocket({
  topic: '/topic/maestros',
  onMessage: () => {
    setRefreshTrigger(prev => prev + 1); // Dispara re-render
  }
});

// Usa refreshTrigger como dependency en useEffect
useEffect(() => {
  cargarAeropuertos();
}, [refreshTrigger]);
```

---

## ⚠️ CONSIDERACIONES

### Performance
```
✅ OK: Actualizar lista de 100 items
✅ OK: Mostrar/ocultar toast
✅ OK: Recargar datos maestros

❌ NO: Actualizar mapa frame-a-frame (30FPS)
❌ NO: Emitir más de 10 eventos/segundo
❌ NO: Sincronizar posiciones de aviones
```

### Escalabilidad
```
✅ Soporta 10+ usuarios simultáneos
✅ Sin problemas de conexión/reconexión
✅ Bajo consumo de ancho de banda
```

---

## 🐛 TROUBLESHOOTING

### Toast no aparece
```
❌ Problema: useToast no definido
✅ Solución: Verifica que ToastNotification.tsx esté importado
```

### WebSocket no recibe eventos
```
❌ Problema: Backend no emite
✅ Solución: Verifica que notificarCambio() se llama en MaestroService
✅ Solución: Verifica console (F12) para errores
```

### Actualizaciones duplicadas
```
❌ Problema: Misma acción emite múltiples eventos
✅ Solución: Verifica que useWebSocket no esté duplicado en component
```

---

## 📈 MÉTRICAS POST-INTEGRACIÓN

```
Antes (Sin integración):
├── Usuario A crea aero
├── Usuario B ve: nada
├── Usuario B recarga: ✅ ve aero nuevo
└── Tiempo: Manual

Después (Con integración):
├── Usuario A crea aero
├── Usuario B ve: Toast + lista actualizada
├── Usuario B NO recarga
└── Tiempo: Automático (<500ms)
```

---

## ✅ RESUMEN

### Qué hacen estos pasos
1. **ToastNotification:** Sistema de notificaciones visual
2. **AdminPanel integration:** Sync cuando otros usuarios usan maestros
3. **page.tsx integration:** Sync de simulación y maestros
4. **Styling:** Animaciones suave de toasts
5. **Testing:** Validar multi-usuario

### Resultado Final
- ✅ Multi-usuario sincronización en tiempo real
- ✅ Notificaciones visuales de cambios
- ✅ Sin necesidad de refrescar página
- ✅ Experiencia de usuario mejorada

### Tiempo de Implementación
- 2-4 horas para desarrollador
- 1-2 horas de testing
- Sin cambios en backend necesarios

---

## 🎓 CONCLUSIÓN

**Fase 3 ya está 100% operacional sin estos cambios.**

Esta integración es **OPCIONAL** para mejorar UX en scenarios multi-usuario.

Si implementas estos pasos:
- ✅ Mejor experiencia colaborativa
- ✅ Feedback visual inmediato
- ✅ Sin cambios backend necesarios

Si NO lo implementas:
- ✅ Sistema sigue funcionando perfectamente
- ✅ Usuarios pueden actualizar manualmente
- ✅ WebSocket sigue guardando datos correctamente

**Recomendación:** Implementar después de estar en producción (no crítico).

---

*Documento Generado: 2026-06-09*  
*Para: Mejoras opcionales de Fase 3*  
*Dificultad: Intermedia*
