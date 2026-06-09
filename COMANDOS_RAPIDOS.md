# ⚡ COMANDOS RÁPIDOS - EJECUTA LOADROUTE EN 5 MINUTOS

**Para usuarios que solo quieren levantar y probar.**

---

## 📋 REQUISITOS (Verifica ANTES)

```powershell
java -version          # Debe ser Java 17+
mvn -version           # Maven 3.6+
node -version          # Node 18+
npm -version           # npm 9+
```

Si falta algo, instala desde: https://www.oracle.com/java/technologies/downloads/#java17

---

## 🚀 OPCIÓN A: CON BASE DE DATOS (PostgreSQL)

### PASO 1: Base de Datos (Primera Vez Solamente)

```powershell
# Abre PowerShell como Admin y ejecuta:

# Si tienes PostgreSQL instalado:
psql -U postgres

# Luego en la terminal psql:
CREATE DATABASE loadroute_db;
CREATE USER loadroute_user WITH PASSWORD 'password123';
GRANT ALL PRIVILEGES ON DATABASE loadroute_db TO loadroute_user;
\q
```

### PASO 2: Backend

```powershell
cd "C:\Users\BRAULIO\Desktop\Github-R\LoadRoute\LoadRoute-Backend"

mvn clean compile

mvn spring-boot:run
```

**Espera a ver:** `Started LoadRouteApplication`

### PASO 3: Frontend (En otra terminal PowerShell)

```powershell
cd "C:\Users\BRAULIO\Desktop\Github-R\LoadRoute\LoadRoute-Frontend"

npm install

npm run dev
```

**Espera a ver:** `ready on http://0.0.0.0:3000`

### PASO 4: Abre el navegador

```
http://localhost:3000
```

✅ **¡Listo!**

---

## 🚀 OPCIÓN B: SIN BASE DE DATOS (H2 - En Memoria)

Más rápido si no tienes PostgreSQL instalado.

### PASO 1: Configurar Backend para H2

Edita: `LoadRoute-Backend/src/main/resources/application.yml`

```yaml
# Reemplaza la sección "spring:" con:
spring:
  datasource:
    url: jdbc:h2:mem:loadroute
    driver-class-name: org.h2.Driver
    username: sa
    password:
  jpa:
    database-platform: org.hibernate.dialect.H2Dialect
    hibernate:
      ddl-auto: create-drop
  h2:
    console:
      enabled: true
```

### PASO 2: Backend

```powershell
cd "C:\Users\BRAULIO\Desktop\Github-R\LoadRoute\LoadRoute-Backend"

mvn clean compile

mvn spring-boot:run
```

### PASO 3: Frontend (Otra terminal)

```powershell
cd "C:\Users\BRAULIO\Desktop\Github-R\LoadRoute\LoadRoute-Frontend"

npm install

npm run dev
```

### PASO 4: Navegador

```
http://localhost:3000
```

✅ **¡Listo!**

---

## 🎮 PRIMERAS PRUEBAS

### 1. Cargar Datos

```
1. En LoadRoute, busca botón "📥 Cargar Datos"
2. Carga estos archivos (en carpeta LoadRoute/):
   - c.1inf54.26.1.v1.Aeropuerto.husos.v1.20250818__estudiantes.txt
   - planes_vuelo.txt
   - _envios_preliminar/_envios_SKBO_.txt (cualquiera)
```

### 2. Ejecutar Simulación

```
1. Escenario: "Período"
2. Clic en ▶️ Play
3. Espera a que termine (100%)
4. Descarga reporte (PDF o Excel)
```

### 3. Probar WebSocket (Opcional)

```
1. Abre 2 ventanas:
   - Ventana 1: http://localhost:3000
   - Ventana 2: http://localhost:3000

2. En Ventana 1 → Tab "Maestros" (📝) → "+ Nuevo Aeropuerto"
3. Rellena datos → Guardar
4. En Ventana 2, verás el nuevo aeropuerto sin recargar
```

---

## 🛑 ERRORES COMUNES

| Error | Solución |
|-------|----------|
| `Port 8080 already in use` | `netstat -ano \| findstr :8080` → `taskkill /PID <num> /F` |
| `Cannot find module` | `npm install` (en carpeta frontend) |
| `Database connection failed` | Usa Opción B (H2) sin BD |
| `maven command not found` | Instala Maven o usa `mvn.cmd` |

---

## 📍 URLS IMPORTANTES

```
Frontend:     http://localhost:3000
Backend API:  http://localhost:8080
```

---

## ⏸️ PARAR LOS SERVIDORES

```powershell
# Terminal Backend: Ctrl+C
# Terminal Frontend: Ctrl+C
```

---

## ✅ CHECKLIST

- [ ] Requisitos instalados
- [ ] Backend levantado (Terminal 1)
- [ ] Frontend levantado (Terminal 2)
- [ ] Puedo acceder a http://localhost:3000
- [ ] Puedo cargar datos
- [ ] Puedo ejecutar simulación
- [ ] Puedo descargar reporte

---

**Listo. Eso es todo. Si algo falla, abre [COMO_LEVANTAR_LOCAL.md](COMO_LEVANTAR_LOCAL.md) para troubleshooting detallado.**
