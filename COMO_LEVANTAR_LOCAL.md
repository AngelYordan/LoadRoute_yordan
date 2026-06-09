# 🚀 GUÍA LOCAL: CÓMO LEVANTAR LoadRoute EN TU MÁQUINA

**Sistema Operativo:** Windows  
**Requisitos:** Java 17, Maven, Node.js 18+, MySQL

---

## 📋 PRE-REQUISITOS

Verifica que tienes instalado:

```powershell
# En PowerShell o CMD

# Java 17
java -version
# Debe mostrar: openjdk version "17.x.x"

# Maven
mvn -version
# Debe mostrar: Apache Maven 3.x.x

# Node.js
node -version
# Debe mostrar: v18.x.x o superior

npm -version
# Debe mostrar: 9.x.x o superior

# MySQL disponible
# Configurable con DB_URL, DB_USERNAME y DB_PASSWORD
```

### Si falta algo:
- **Java 17:** https://jdk.java.net/17/
- **Maven:** https://maven.apache.org/download.cgi
- **Node.js:** https://nodejs.org/ (LTS recomendado)
- **MySQL:** https://dev.mysql.com/downloads/mysql/

---

## 🗄️ PASO 1: CONFIGURAR BASE DE DATOS

### MySQL local o de pruebas

```powershell
cd LoadRoute-Backend
Copy-Item .env.example .env
```

Edita `.env` con los datos de tu base. El backend usa esos valores al iniciar.

---

## 🔧 PASO 2: COMPILAR BACKEND

```powershell
# Abre PowerShell/CMD en la carpeta del proyecto

cd "C:\Users\BRAULIO\Desktop\Github-R\LoadRoute\LoadRoute-Backend"

# Limpiar compilaciones anteriores
mvn clean

# Compilar
mvn compile

# Si necesitas generar JAR
mvn package -DskipTests

# Espera ~2-3 minutos (descargará dependencias)
```

**¿Qué esperar?**
```
BUILD SUCCESS ✅
[INFO] BUILD SUCCESS
[INFO] Total time: 45.234 s
```

Si ves errores:
```powershell
# Intenta con:
mvn clean install -U

# O borra caché y reintentar:
Remove-Item -Recurse -Force .m2/repository
mvn clean compile
```

---

## 📦 PASO 3: COMPILAR FRONTEND

```powershell
# En otra ventana PowerShell, ve a frontend
cd "C:\Users\BRAULIO\Desktop\Github-R\LoadRoute\LoadRoute-Frontend"

# Instalar dependencias (IMPORTANTE - primera vez)
npm install

# Compilar (Next.js)
npm run build

# Espera ~2-3 minutos
```

**¿Qué esperar?**
```
✓ Ready in 125.12s
✓ Compiled successfully
✓ Linting and checking validity of types
```

---

## 🎯 PASO 4: LEVANTAR LOS SERVIDORES

### Opción A: DESARROLLO (Recomendado para Testing)

#### Terminal 1 - Backend

```powershell
cd "C:\Users\BRAULIO\Desktop\Github-R\LoadRoute\LoadRoute-Backend"

# Levantar Spring Boot
mvn spring-boot:run

# O manualmente:
java -jar target/loadroute-backend-0.2.0.jar
```

**Espera:**
```
  .   ____          _            __ _ _
 /\\ / ___'_ __ _ _(_)_ __  __ _ \ \ \ \
( ( )\___ | '_ | '_| | '_ \/ _` | \ \ \ \
 \\/  ___)| |_)| | | | | || (_| |  ) ) ) )
  '  |____| .__|_| |_|_| |_|\__, | / / / /
 =========|_|==============|___/=/_/_/_/

2026-06-09 14:30:45.123  INFO 12345 --- [main] c.loadroute.LoadRouteApplication : Started...

🟢 Backend listo en http://localhost:8080
```

#### Terminal 2 - Frontend

```powershell
cd "C:\Users\BRAULIO\Desktop\Github-R\LoadRoute\LoadRoute-Frontend"

# Modo desarrollo (hot reload)
npm run dev

# O producción:
npm run start
```

**Espera:**
```
  ▲ Next.js 14.0.0
  - ready on http://0.0.0.0:3000 (opened)
  - event compiled successfully
  
🟢 Frontend listo en http://localhost:3000
```

### Opción B: PRODUCCIÓN

```powershell
# Backend
cd LoadRoute-Backend
mvn clean package -DskipTests
java -jar target/loadroute-backend-0.2.0.jar

# Frontend
cd LoadRoute-Frontend
npm run build
npm run start
```

---

## 🌐 PASO 5: ACCEDER A LA APLICACIÓN

Abre tu navegador:

```
http://localhost:3000
```

Deberías ver:
- Logo LoadRoute
- Panel de control
- Sidebar izquierdo con 6 tabs
- Mapa vacío (porque no hay datos aún)

---

## ✅ PASO 6: VERIFICAR QUE TODO FUNCIONA

### Test 1: Cargar Datos

```
1. Ve a la carpeta: LoadRoute/
2. Busca carpeta: _envios_preliminar/
3. En LoadRoute, haz clic en "Cargar Datos"
4. Carga los 3 archivos:
   - c.1inf54.26.1.v1.Aeropuerto.husos.v1.20250818__estudiantes.txt
   - planes_vuelo.txt
   - Elige un archivo de envíos (_envios_SKBO_.txt)
```

Verás:
- ✅ Datos cargados (toast notification)
- ✅ Aeropuertos en lista
- ✅ Vuelos en lista
- ✅ Mapa se actualiza

### Test 2: Ejecutar Simulación

```
1. Selecciona escenario (Período / Día a Día / Colapso)
2. Verifica fechas (inicio/fin)
3. Clic en ▶️ Play
4. Mira progreso en barra superior
5. Cuando termine (100%), descarga reporte
```

Deberías ver:
- ✅ Progreso visual (0-100%)
- ✅ Aviones en el mapa
- ✅ Tiempos actualizándose
- ✅ Botones PDF/Excel habilitados

### Test 3: WebSocket

```
1. Abre 2 navegadores:
   - Browser 1: http://localhost:3000
   - Browser 2: http://localhost:3000

2. En Browser 1:
   - Ve a tab "Maestros" (📝)
   - Clic "+ Nuevo Aeropuerto"
   - Rellena datos
   - Clic "Guardar"

3. En Browser 2:
   - Deberías ver el nuevo aeropuerto aparecer
   - Sin recargar página
```

✅ Si lo ves = WebSocket funcionando

### Test 4: Reportes

```
1. Ejecuta una simulación
2. Cuando termine:
   - Clic en "📊 Exportar Excel"
   - Clic en "📄 Exportar PDF"
3. Abre los archivos descargados
```

Verifica:
- ✅ Excel tiene 3 pestañas
- ✅ PDF tiene tablas
- ✅ Datos coinciden con simulación

---

## 🔍 TROUBLESHOOTING LOCAL

### Backend no levanta

```powershell
# Error: Port 8080 already in use
# Solución: Mata el proceso
netstat -ano | findstr :8080
taskkill /PID <PID> /F

# O usa otro puerto:
# En application.yml:
server:
  port: 8081
```

### Frontend no compila

```powershell
# Error: node_modules corrupto
# Solución:
rm -Recurse -Force node_modules
rm package-lock.json
npm install
npm run dev
```

### WebSocket no conecta

```powershell
# Error: WebSocket connection failed
# Solución:
# 1. Verifica que backend está en puerto 8080
# 2. Revisa console (F12) para errores
# 3. Asegúrate que /ws endpoint es accesible:
#    http://localhost:8080/ws

# 4. En PowerShell, prueba:
Invoke-WebRequest http://localhost:8080/ws -ErrorAction Ignore
```

### MySQL no conecta

```powershell
# Error: Connection refused
# Solución:
# 1. Verifica que el host configurado responde:
Test-NetConnection <host_mysql> -Port 3306

# 2. Prueba credenciales:
mysql -h <host_mysql> -P 3306 -u <usuario> -p <base>

# 3. En application.yml, verifica:
spring:
  datasource:
    url: ${DB_URL:jdbc:mysql://localhost:3306/loadroute?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC&rewriteBatchedStatements=true}
    username: ${DB_USERNAME:root}
    password: ${DB_PASSWORD:}
```

---

## 🎯 CHECKLIST RÁPIDO

```
☐ Java 17 instalado (java -version)
☐ Maven instalado (mvn -version)
☐ Node.js 18+ instalado (node -version)
☐ MySQL accesible segun `.env`
☐ Backend compilado (mvn compile)
☐ npm install ejecutado
☐ Backend levantado (puerto 8080)
☐ Frontend levantado (puerto 3000)
☐ Puedes acceder a http://localhost:3000
☐ Puedes cargar datos
☐ Puedes ejecutar simulación
☐ WebSocket funciona (2 navegadores)
☐ Reportes descargan
```

---

## 📊 URLS DE ACCESO

```
Frontend:          http://localhost:3000
Backend API:       http://localhost:8080/api
Backend Swagger:   http://localhost:8080/swagger-ui.html
WebSocket:         ws://localhost:8080/ws
MySQL:             configurado en `DB_URL`
```

---

## 🚨 LOGS MÁS IMPORTANTES

### Backend
```powershell
# Ver logs en tiempo real:
# En Terminal 1, mira la salida mvn spring-boot:run

# Busca estas líneas:
"Started LoadRouteApplication" → ✅ Backend listo
"Tomcat started on port(s): 8080" → ✅ Puerto correcto
"WebSocketConfig" → ✅ WebSocket habilitado

# Errores comunes:
"Caused by: com.mysql.cj.jdbc.exceptions" → BD no conecta
"Port 8080 already in use" → Otro proceso usando puerto
```

### Frontend
```powershell
# En Terminal 2, mira la salida npm run dev

# Busca estas líneas:
"ready on http://0.0.0.0:3000" → ✅ Frontend listo
"event compiled successfully" → ✅ Compilado sin errores

# Errores comunes:
"EADDRINUSE: address already in use :::3000" → Otro proceso
"Module not found" → npm install no completó
```

---

## 💡 TIPS DE DESARROLLO

### Hot Reload
```powershell
# Frontend tiene hot reload automático
# Edita cualquier archivo en src/
# Se recompila automáticamente (5-10s)

# Backend NO tiene hot reload por defecto
# Para cambios rápidos:
mvn spring-boot:run -Dspring-boot.run.fork=false
```

### Debug
```powershell
# Frontend: F12 → DevTools → Console
# Backend: Ver terminal donde corre mvn

# Para debug profundo en Frontend:
# En VSCode: Click en Run → "Add Configuration"
# Selecciona "Chrome" y configura puerto 3000
```

### Reiniciar sin Recargar BD
```powershell
# Si cambias esquema en Spring:
# Asegúrate que en application.yml:

spring:
  jpa:
    hibernate:
      ddl-auto: update  # Crea/actualiza tablas
      # O: create-drop  # Borra y recrea cada vez
```

---

## 📈 SIGUIENTE PASO

Una vez verificado localmente:

```
1. ✅ Backend compila y levanta
2. ✅ Frontend compila y levanta
3. ✅ Datos se cargan correctamente
4. ✅ Simulación ejecuta
5. ✅ Reportes descargan
6. ✅ WebSocket funciona (2 usuarios)

→ Entonces está listo para PRODUCCIÓN
```

---

## 📞 PROBLEMAS?

Si algo no funciona, revisa:

1. **Console (F12)** en navegador → errores de frontend
2. **Terminal backend** → errores de compilación/ejecución
3. **application.yml** → configuración incorrecta
4. **MySQL** → BD no accesible
5. **Puertos** → 3000 o 8080 en uso

---

**¿Preguntas específicas? Dimelo y te ayudo a resolver.** 🚀
