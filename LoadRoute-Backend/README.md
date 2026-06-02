# ⚙️ LoadRoute Backend - Motor de Optimización

Este es el motor central de LoadRoute, encargado de procesar grandes volúmenes de datos logísticos y generar rutas óptimas utilizando metaheurísticas de vanguardia.

## 🚀 Tecnologías
- **Java 17 & Spring Boot 3.x**
- **MySQL 8+**: Persistencia relacional de aeropuertos, vuelos y envíos.
- **Maven**: Gestión de dependencias y construcción.
- **JUnit 5**: Pruebas unitarias para validación algorítmica.

## 🧠 Algoritmos Implementados

### 1. ALNS (Adaptive Large Neighborhood Search)
El algoritmo principal para planificación masiva. Utiliza operadores de destrucción y reparación para explorar el espacio de soluciones de forma adaptativa.
- **Destrucción**: Random Removal, Worst Removal, Related Removal.
- **Reparación**: Greedy Insertion, Regret-2 Insertion.

### 2. Simulated Annealing (SA)
Utilizado para optimización en tiempo real y refinamiento de soluciones iniciales.
- **Parámetros**: Temperatura inicial, tasa de enfriamiento (alfa) y criterio de aceptación de Metrópolis.

## 📂 Datos de Entrada
El backend procesa tres archivos maestros que deben cargarse desde el frontend:
- `aeropuertos.txt`: Lista de nodos con coordenadas y capacidad de almacenamiento.
- `planes_vuelo.txt`: Catálogo de vuelos disponibles con horarios y capacidad de carga.
- `envios.txt`: Órdenes de carga con origen, destino y cantidad de maletas.

## 🛠️ Instalación y Compilación

### Requisitos
- JDK 17 o superior.
- Maven instalado en el PATH.
- MySQL 8 o superior.

### Base de Datos MySQL
El backend se conecta por defecto a:

```text
jdbc:mysql://localhost:3306/loadroute
usuario: root
password: vacio
```

Para crear la base de datos y sus tablas:

```bash
mysql -u root -p < src/main/resources/db/mysql/schema.sql
```

Tambien puedes cambiar la conexion con variables de entorno:

```bash
DB_URL=jdbc:mysql://localhost:3306/loadroute?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC&rewriteBatchedStatements=true
DB_USERNAME=root
DB_PASSWORD=tu_password
```

### Comandos de Construcción
```bash
# Limpiar y compilar
mvn clean compile

# Ejecutar pruebas unitarias
mvn test

# Ejecutar la aplicación
mvn spring-boot:run
```

## 📍 Endpoints Principales
- `POST /api/rutas/simular`: Carga archivos, persiste datos en MySQL y ejecuta la simulacion sincrona.
- `POST /api/rutas/simular-async`: Carga archivos, persiste datos en MySQL e inicia la simulacion asincrona.
- `GET /api/rutas/simular-async/{jobId}`: Consulta el estado de una simulacion asincrona.
- `GET /api/rutas/simular-async/{jobId}/chunks`: Descarga resultados parciales.
- `GET /api/rutas/health`: Verifica el estado del servicio.

## 📊 Reglas de Negocio Aplicadas
- **SLA**: 24h para vuelos continentales / 48h para intercontinentales.
- **Buffer de Conexión**: Mínimo 30 minutos entre tramos para asegurar transbordos.
- **Capacidad Estricta**: No se permite exceder la capacidad de carga del avión (penalización severa).
- **Capacidad de Almacén**: Los aeropuertos tienen un límite físico de maletas en custodia.

---
**Mantenido por el Equipo de Optimización de LoadRoute.**
