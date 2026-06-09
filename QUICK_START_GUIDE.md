# ⚡ GUÍA RÁPIDA - LoadRoute Completo

**Última actualización:** 2026-06-09  
**Versión:** 1.0 (Producción)

---

## 🎯 ESTO YA ESTÁ HECHO (Fase 3 Completa)

### ✅ Lo que puedes hacer AHORA

#### Como Operador
```
1️⃣  Abre LoadRoute
2️⃣  Carga archivos (aeropuertos, vuelos, envíos)
3️⃣  Selecciona escenario (Período, Día a Día, Colapso)
4️⃣  Elige fecha y hora de inicio/fin
5️⃣  Clic en Play → ve simulación en tiempo real
6️⃣  Busca vuelos (barra de búsqueda)
7️⃣  Ordena por ocupación, horario, etc
8️⃣  Descarga reporte (PDF o Excel)
9️⃣  Analiza cancelaciones
🔟 Comparte datos con equipo (WebSocket)
```

#### Como Administrador
```
1️⃣  Ve a tab "Maestros" (📝)
2️⃣  En Aeropuertos:
    ✅ Crea nuevo (+Nuevo Aeropuerto)
    ✅ Edita capacidad, GMT, coordenadas
    ✅ Elimina (si no está en uso)
    ✅ Busca por código o ciudad
3️⃣  En Vuelos:
    ✅ Crea nuevo (+Nuevo Vuelo)
    ✅ Edita origen, destino, horarios
    ✅ Elimina
    ✅ Busca por origen/destino
4️⃣  Los cambios se sincronizan instantáneamente
5️⃣  Otros usuarios ven notificación
```

#### Como Gerente
```
1️⃣  Ejecuta simulación 1 (Escenario Período)
2️⃣  Ejecuta simulación 2 (Escenario Día a Día)
3️⃣  Ejecuta simulación 3 (Escenario Colapso)
4️⃣  Descarga Excel de cada simulación
5️⃣  Compara KPIs en Excel:
    - Costo inicial vs final
    - Envíos asignados
    - Mejora relativa (%)
6️⃣  Analiza cancelaciones por día
7️⃣  Identifica patrones
8️⃣  Presenta datos a stakeholders
```

---

## 📊 LOS 3 ESCENARIOS

| Escenario | Duración | Qué Simula | Cuándo Usar |
|-----------|----------|-----------|------------|
| **Período** | Full date range | Simulación ideal (sin fallos) | Baseline |
| **Día a Día** | Same date range | Falla climática cada día | Worst daily case |
| **Colapso** | Same date range | Múltiples fallos simultáneos | Stress testing |

**Consejo:** Corre los 3 y compara KPIs en Excel

---

## 🎛️ CONTROLES PRINCIPALES

### Header (Arriba)
```
Simulación: LUN 10 JUN        ← Día de simulación
Hora GMT: 14:35               ← Hora en tiempo real
Transcurrido: 1d 5h 30m       ← Tiempo desde inicio
Progreso: ████████░░ 82%      ← Avance visual

▶  Iniciar    ⏸  Pausar    ⏹  Detener
```

### Navegación Lateral (Izquierda)
```
📦 Pedidos        → Ver envíos cargados
🏢 Aeropuertos    → Ver capacidades
⚙️  Simulación    → Ajustar umbrales
🎥 Pantalla       → Filtrar mapa
✈️  Vuelos        → Buscar + ordenar
📝 Maestros       → CRUD (Admin)
```

### Mapa
```
🔵 Círculos azules     = Aeropuertos
✈️  Ícono de avión    = Vuelo en movimiento
🔴 Línea punteada roja = Vuelo cancelado
```

---

## 📥 EXPORTAR REPORTES

### Excel (3 Pestañas)
```bash
Botón: 📊 Exportar Excel

Pestaña 1: Resumen KPIs
├── Total Vuelos Procesados
├── Envíos Asignados
├── Costo Final
└── Mejora Relativa (%)

Pestaña 2: Vuelos Cancelados
├── Día de Simulación
└── Vuelo ID Cancelado

Pestaña 3: Detalle Envíos
├── ID Envío
├── Cantidad Paquetes
├── Origen / Destino
├── Vuelos Utilizados
└── Llegada GMT
```

### PDF (Resumen)
```bash
Botón: 📄 Exportar PDF

Contiene:
├── Tabla KPIs
└── Tabla Cancelaciones
```

---

## 🔍 BÚSQUEDA & FILTRADO

### En Vuelos (SidebarVuelos)
```
Busca por:  ID vuelo
            Código origen (ej. SKBO)
            Código destino (ej. SEQM)

Ejemplo: "SKBO" → muestra todos vuelos de Bogotá
Ejemplo: "SEQM" → muestra todos vuelos a Medellín
```

### En Administrativo (Maestros)
```
Aeropuertos:
├── Por código (ej. SKBO)
└── Por ciudad (ej. Bogotá)

Vuelos:
├── Por origen (ej. SKBO)
└── Por destino (ej. SEQM)
```

### En Mapa
```
Tab "Pantalla":
├── Filtrar por origen
└── Filtrar por destino
```

---

## 🌐 MULTI-USUARIO (WebSocket)

### Cómo funciona
```
Usuario A crea un aeropuerto
    ↓
Se guarda en BD
    ↓
Sistema envía notificación por WebSocket
    ↓
Usuario B recibe evento
    ↓
Datos de Usuario B se actualizan automáticamente
```

### Eventos que se sincronizan
```
AEROPUERTO_CREADO          → Nuevo aero en lista
AEROPUERTO_ACTUALIZADO     → Cambios de capacidad
AEROPUERTO_ELIMINADO       → Aero desaparece
VUELO_CREADO               → Nuevo vuelo
VUELO_ACTUALIZADO          → Cambios horario
VUELO_ELIMINADO            → Vuelo desaparece
SIMULACION_FINALIZADA      → Reporte listo
SIMULACION_ERROR           → Error en simulación
```

---

## ⚙️ UMBRALES DE CAPACIDAD

### Ajusta en Tab "Simulación"
```
Verde:  0% - 30%   (sin problemas)
Ámbar: 31% - 70%   (advertencia)
Rojo:  71% - 100%  (crítico)

Los porcentajes afectan:
├── Color de ocupación en lista
├── Color de aviones en mapa
└── Color del indicador global
```

---

## 🐛 TROUBLESHOOTING RÁPIDO

| Problema | Qué hacer |
|----------|-----------|
| Datos no cargan | Reinicia página (Ctrl+R) |
| WebSocket offline | Espera reconexión (5s) |
| Reporte no descarga | Verifica si simulación terminó |
| Búsqueda lenta | Clear cache (Ctrl+Shift+R) |
| Mapa no se ve | Desactiva ad-blocker |

---

## 📱 ATAJOS DE TECLADO

```
Ctrl+R              Recargar página
Ctrl+Shift+R        Limpiar cache
Ctrl+P              Imprimir (si necesitas)
```

---

## 📞 NECESITAS AYUDA?

### Si algo no funciona
1. **Recarga página:** Ctrl+R
2. **Limpia cache:** Ctrl+Shift+R
3. **Abre DevTools:** F12 (ve la consola)
4. **Reporta error** con screenshot de consola

### Documentación técnica
- [Fase 3 Verificación Completa](FASE3_VERIFICACION_COMPLETA.md)
- [Respuestas Arquitectónicas](RESPUESTAS_ARQUITECTONICAS_FASE3.md)
- [Estado Final Completo](README_FINAL_ESTADO_PROYECTO.md)

---

## 🎓 TIPS & TRUCOS

```
1️⃣  Abre en 2 navegadores para ver WebSocket sincronización
2️⃣  Exporta Excel y abre en PowerPoint para presentar
3️⃣  Compara KPIs entre 3 escenarios en 3 pestañas
4️⃣  Usa filtros de mapa para enfocarse en ruta específica
5️⃣  Ajusta umbrales de color antes de simular
6️⃣  Descarga reporte ANTES de cerrar (WebSocket puede caer)
7️⃣  Crea captura de pantalla del mapa para reportes
8️⃣  Documenta cambios CRUD en AdminPanel
```

---

## ✅ CHECKLIST PRE-SIMULACIÓN

```
☐ Datos cargados (archivos .txt)
☐ Escenario seleccionado (Período/Día/Colapso)
☐ Fechas configuradas (inicio/fin)
☐ Umbrales ajustados
☐ Navegadores secundarios abiertos (si multi-usuario)
☐ Reportes anteriores descargados
☐ Internet conexión estable (WebSocket)

Listo para ejecutar simulación →  Click ▶️
```

---

## 🎉 RESUMEN FINAL

| Característica | Status | Dónde Usarla |
|---|---|---|
| Simulación 3D | ✅ | Tab Mapa |
| Búsqueda | ✅ | Tab Vuelos / Maestros |
| Reportes | ✅ | Botones en Panel |
| Cancelaciones | ✅ | Líneas rojas en Mapa |
| Multi-usuario | ✅ | Cambios instantáneos |
| CRUD | ✅ | Tab Maestros |

**TODO ESTÁ LISTO - ¡A DISFRUTAR!** 🚀

---

*Última actualización: 2026-06-09*  
*¿Preguntas? Ver documentación técnica en carpeta LoadRoute*
