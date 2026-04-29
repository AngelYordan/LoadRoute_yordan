# Reporte de verificacion y optimizacion del algoritmo ALNS

Fecha de revision: 2026-04-28, hora local del entorno.

## Resumen ejecutivo

Se reviso la implementacion de `ALNS` en el backend de LoadRoute y se comprobo que el algoritmo ejecuta correctamente el ciclo principal de Adaptive Large Neighborhood Search: seleccion por ruleta de operadores, destruccion de rutas, reparacion greedy/regret, aceptacion tipo Simulated Annealing y actualizacion adaptativa de pesos.

Durante la revision se encontro un problema funcional en el escenario de colapso: despues de cancelar vuelos, ALNS removia los envios afectados, pero al reparar podia volver a seleccionar rutas que usaban la misma ocurrencia cancelada, porque `RedLogistica` modela el plan de vuelo recurrente. Se corrigio este comportamiento agregando vetos por ocurrencia `vueloId + fecha local de salida`, no por vuelo completo.

Tambien se implemento una optimizacion de rendimiento: cache interno de rutas por envio para evitar recalcular `red.buscarRutas(...)` y `red.buscarRutasRelajadas(...)` en cada iteracion de reparacion. Esta mejora conserva la logica de solucion, pero reduce consultas repetidas al BFS de la red logistica.

## Archivos revisados

- `LoadRoute-Backend/src/main/java/com/loadroute/algorithm/ALNS.java`
- `LoadRoute-Backend/src/main/java/com/loadroute/algorithm/graph/RedLogistica.java`
- `LoadRoute-Backend/src/main/java/com/loadroute/algorithm/model/SolucionEstado.java`
- `LoadRoute-Backend/src/main/java/com/loadroute/service/RuteoAlgoritmoService.java`
- `experiment_balanced_tmp/balanced_summary.json`

## Funcionamiento actual observado

El ALNS se usa en dos flujos principales:

- Escenario 2: se ejecuta despues de Simulated Annealing para optimizar una solucion inicial.
- Escenario 3: se usa para replanificar envios afectados por vuelos cancelados.

El ciclo principal esta en `ALNS.ejecutarALNS(...)`:

1. Clona la solucion actual y guarda el mejor costo encontrado.
2. Selecciona operadores de destruccion y reparacion mediante ruleta ponderada.
3. Destruye una fraccion `q` de los envios candidatos.
4. Repara envios sin ruta con greedy o regret-2.
5. Evalua el costo total con `SolucionEstado.evaluarCostoTotal()`.
6. Acepta o rechaza la solucion con criterio de Simulated Annealing.
7. Actualiza pesos adaptativos de operadores.

La funcion objetivo de `SolucionEstado` penaliza:

- tiempo de transito;
- incumplimiento de SLA;
- exceso de capacidad por vuelo;
- exceso temporal de capacidad en aeropuertos.

## Evidencia con datos existentes

El archivo `experiment_balanced_tmp/balanced_summary.json` contiene corridas balanceadas previas:

| Instancia | Envios | ALNS costo inicial | ALNS costo final | Mejora | Iteraciones | Tiempo ALNS | Asignacion |
|---|---:|---:|---:|---:|---:|---:|---|
| I-100 | 100 | 1235.0 | 1235.0 | 0.0% | 500 | 1.017 s | 100/100 |
| I-500 | 500 | 6573.0 | 6573.0 | 0.0% | 500 | 5.886 s | 500/500 |
| I-1000 | 1000 | 12979.0 | 12979.0 | 0.0% | 500 | 12.391 s | 1000/1000 |
| I-5000 | 5000 | 66181.0 | 66181.0 | 0.0% | 500 | 83.000 s | 5000/5000 |

Interpretacion:

- El algoritmo preserva asignacion completa en estas instancias.
- No se observo mejora de costo frente a la solucion inicial entregada por SA.
- El tiempo crece de forma importante con el numero de envios, especialmente por busquedas de rutas repetidas durante reparacion.

## Hallazgos

### H1. Reutilizacion de vuelos cancelados en colapso

Se encontro que `replanificarColapso(...)` detectaba envios afectados y removia sus rutas, pero los operadores de reparacion volvian a consultar la red completa. Como la red no excluia fisicamente las ocurrencias canceladas, una ruta reparada podia volver a contener el mismo vuelo en la fecha cancelada.

Impacto: en escenario 3, el resultado podia parecer replanificado aunque operacionalmente seguia usando una ocurrencia no disponible.

Estado: corregido.

Cambio aplicado:

- Se agrego `ocurrenciasVetadas`, un conjunto de pares `vueloId + fecha local de salida`.
- Las rutas candidatas se simulan cronologicamente y se filtran antes de asignarse.
- Si todas las rutas con capacidad contienen ocurrencias vetadas, se prueba con rutas relajadas y tambien se filtran.
- Se agrego una sobrecarga de `replanificarColapso(...)` que acepta `Map<Integer, Set<LocalDate>>` para expresar cancelaciones por fecha. Esto permite cancelar el vuelo X el dia D sin bloquear el mismo vuelo el dia D+1.

### H2. Recalculo repetido de rutas por envio

En cada iteracion de ALNS, los metodos de reparacion llamaban repetidamente:

- `red.buscarRutas(envio, true)`
- `red.buscarRutasRelajadas(envio)`

Estas busquedas dependen principalmente del envio y de la red, no de la solucion candidata del ALNS. Por eso, recalcularlas en cada reparacion genera costo innecesario.

Impacto estimado: para 5000 envios, `gradoDestruccion = 0.25` y 500 iteraciones, se pueden producir hasta unas 625000 consultas de reparacion en el peor caso. Con cache por envio, el numero de BFS distintos baja hacia el numero de envios consultados, mas un filtrado liviano de vuelos vetados.

Estado: optimizado.

Cambio aplicado:

- Cache separado para rutas con capacidad y rutas relajadas.
- Contadores `getRouteCacheHits()` y `getRouteCacheMisses()` para observabilidad.
- Reset del cache al iniciar `optimizar(...)`.
- Persistencia del cache durante replanificaciones sucesivas de colapso, con filtro dinamico de ocurrencias vetadas.

### H3. ALNS no mejora el costo en las corridas balanceadas revisadas

Las corridas existentes muestran 0.0% de mejora para I-100, I-500, I-1000 e I-5000. Esto no significa que ALNS falle, pero si indica que el vecindario actual no esta encontrando alternativas mejores que la solucion inicial.

Posibles causas:

- La solucion inicial de SA ya usa la ruta mas corta por envio en instancias poco congestionadas.
- Los operadores de reparacion suelen reasignar `rutas.get(0)`, que ya viene ordenada por menor transito.
- Las capacidades se penalizan al evaluar, pero la reparacion no hace una insercion costo-aware que compare impacto marginal sobre capacidad y SLA global.

Recomendacion futura: implementar una reparacion por costo marginal que evalue varias rutas candidatas y elija la que minimice el delta de la funcion objetivo, no solo la primera ruta.

## Cambios implementados

### 1. Filtro de ocurrencias canceladas en ALNS

Se modifico `ALNS.replanificarColapso(...)` para registrar ocurrencias canceladas en `ocurrenciasVetadas`. Luego, `obtenerRutasDisponibles(...)` filtra cualquier ruta que contenga el mismo `vueloId` en la misma fecha local de salida antes de asignarla.

Resultado esperado: en colapso, ALNS ya no devuelve rutas que reutilizan la ocurrencia cancelada, pero mantiene disponible el mismo plan de vuelo en dias posteriores.

### 2. Cache de rutas candidatas

Se agregaron:

- `rutasConCapacidadCache`
- `rutasRelajadasCache`
- `routeCacheHits`
- `routeCacheMisses`

Resultado esperado: menor tiempo de ejecucion en instancias medianas y grandes, especialmente cuando los mismos envios son destruidos/reparados muchas veces.

### 3. Prueba unitaria de colapso

Se agrego `LoadRoute-Backend/src/test/java/com/loadroute/algorithm/ALNSTest.java`.

La prueba crea una red minima con:

- un vuelo directo cancelado;
- una ruta alternativa de dos tramos;
- un envio inicialmente asignado al vuelo cancelado el 2026-01-01;
- otro envio asignado al mismo vuelo el 2026-01-02.

La prueba verifica que ALNS:

- repara el envio;
- no reutiliza el vuelo cancelado en la fecha afectada;
- mantiene disponible el mismo vuelo al dia siguiente;
- usa la ruta alternativa;
- registra hits del cache.

## Verificacion ejecutada

Comando:

```powershell
mvn test
```

Resultado:

- Build success.
- Tests run: 1.
- Failures: 0.
- Errors: 0.
- Skipped: 0.

Log relevante:

```text
ALNS colapso: 1 vuelos cancelados -> 1 envios afectados | ocurrencias vetadas: 1
ALNS fin -> iter: 20 | costo: 240000.00 -> 7.00 | tiempo: 0 s
```

## Recomendaciones siguientes

1. Medir el cache con una corrida de I-1000 e I-5000 despues del cambio para cuantificar reduccion real de tiempo.
2. Agregar una reparacion por costo marginal: evaluar las primeras `k` rutas candidatas y asignar la que menor delta produzca en `SolucionEstado`.
3. Separar capacidad operacional de `Vuelo.capacidadOcupada` y capacidad de la solucion candidata. Actualmente la busqueda de rutas con capacidad consulta capacidad del objeto `Vuelo`, mientras el ALNS evalua capacidad en `SolucionEstado`; conviene unificar esa fuente para evitar restricciones obsoletas.
4. Registrar en el DTO o logs los pesos finales de operadores, cache hits/misses y porcentaje de aceptacion. Eso permitiria diagnosticar si ALNS explora o solo reconstruye la misma solucion.
