import re

with open('src/main/java/com/loadroute/service/RuteoAlgoritmoService.java.bak', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add SimulacionIterator interface
content = content.replace('public interface ProgressReporter {', '''public interface SimulacionIterator {
        boolean hasNext();
        RutaResponseDTO nextChunk();
        boolean hasColapsado();
        String getMensajeColapso();
    }

    public interface ProgressReporter {''')

# 2. Add calcularScMinutos
sc_method = '''
    private int calcularScMinutos(LocalDateTime inicio, LocalDateTime fin) {
        if (inicio == null || fin == null) return 240;
        long dias = ChronoUnit.DAYS.between(inicio.toLocalDate(), fin.toLocalDate());
        if (dias <= 3) return 168; // 2.8h
        if (dias <= 5) return 240; // 4h
        return 360; // 6h
    }
'''
content = content.replace('private static final int MAX_RUTAS_MUESTRA = 10_000;', sc_method + '\n    private static final int MAX_RUTAS_MUESTRA = 10_000;')

# 3. Rename ejecutarRuteo and add Iterator setup
old_ejecutar = '''    public List<RutaResponseDTO> ejecutarRuteo(InputStream aeropuertosIS,
                                          InputStream vuelosIS,
                                          List<MultipartFile> enviosFiles,
                                          int escenario,
                                          String fechaInicio,
                                          String fechaFin,
                                          ProgressReporter progress) throws IOException {'''

new_ejecutar = '''    public List<RutaResponseDTO> ejecutarRuteo(InputStream aeropuertosIS,
                                          InputStream vuelosIS,
                                          List<MultipartFile> enviosFiles,
                                          int escenario,
                                          String fechaInicio,
                                          String fechaFin,
                                          ProgressReporter progress) throws IOException {
        SimulacionIterator iter = prepararIteradorRuteo(aeropuertosIS, vuelosIS, enviosFiles, escenario, fechaInicio, fechaFin, progress);
        List<RutaResponseDTO> chunks = new ArrayList<>();
        while (iter.hasNext() && !iter.hasColapsado()) {
            chunks.add(iter.nextChunk());
        }
        return chunks;
    }

    public SimulacionIterator prepararIteradorRuteo(InputStream aeropuertosIS,
                                          InputStream vuelosIS,
                                          List<MultipartFile> enviosFiles,
                                          int escenario,
                                          String fechaInicio,
                                          String fechaFin,
                                          ProgressReporter progress) throws IOException {'''

content = content.replace(old_ejecutar, new_ejecutar)

# 4. Modify agruparEnviosPorLotePeriodo calls in prepararIteradorRuteo
old_lote = '''NavigableMap<LocalDateTime, Map<String, Envio>> enviosPorLotePeriodo = agruparEnviosPorLotePeriodo(envios);'''
new_lote = '''int scMinutos = calcularScMinutos(inicioFiltro, finFiltro);
        NavigableMap<LocalDateTime, Map<String, Envio>> enviosPorLotePeriodo = agruparEnviosPorLotePeriodo(envios, scMinutos);'''
content = content.replace(old_lote, new_lote)

# 5. Modify the switch block to return iterator
old_switch = '''        List<RutaResponseDTO> chunks;
        switch (escenario) {
            case 2  -> chunks = ejecutarEscenario2(enviosPorDia, aeropuertos.values(), vuelos, response, progress, fechaBaseDiaria);
            case 3  -> chunks = ejecutarEscenario3(enviosPorDia, aeropuertos.values(), vuelos, response, progress, fechaBaseDiaria);
            default -> chunks = ejecutarEscenario1(enviosPorLotePeriodo, aeropuertos.values(), vuelos, response, progress, fechaInicioRango);
        }

        if (!chunks.isEmpty()) {
            chunks.get(0).setVuelosMaestros(vuelos.stream().map(v -> {
                RutaResponseDTO.TramoDTO t = new RutaResponseDTO.TramoDTO();
                t.setOrigen(v.getOrigen().getCodigo());
                t.setDestino(v.getDestino().getCodigo());
                t.setOrigenLat(v.getOrigen().getLatitud());
                t.setOrigenLon(v.getOrigen().getLongitud());
                t.setDestinoLat(v.getDestino().getLatitud());
                t.setDestinoLon(v.getDestino().getLongitud());
                t.setCapacidad(v.getCapacidadMax());
                t.setVueloId(v.getId());
                t.setHoraSalidaLocal(v.getHoraSalidaLocal().toString());
                t.setHoraLlegadaLocal(v.getHoraLlegadaLocal().toString());
                t.setSalidaMinutosGMT(v.getSalidaMinutosGMT());
                t.setLlegadaMinutosGMT(v.getLlegadaMinutosGMT());
                return t;
            }).collect(Collectors.toList()));
        }

        report(progress, 98, "Preparando respuesta para el dashboard...");
        return chunks;
    }'''

new_switch = '''        report(progress, 98, "Preparando respuesta para el dashboard...");
        switch (escenario) {
            case 2  -> return new Escenario2Iterator(enviosPorDia, aeropuertos.values(), vuelos, response, progress, fechaBaseDiaria);
            case 3  -> return new Escenario3Iterator(enviosPorDia, aeropuertos.values(), vuelos, response, progress, fechaBaseDiaria);
            default -> return new Escenario1Iterator(enviosPorLotePeriodo, aeropuertos.values(), vuelos, response, progress, fechaInicioRango, scMinutos);
        }
    }'''

content = content.replace(old_switch, new_switch)

# 6. Update agruparEnviosPorLotePeriodo definition
content = content.replace('private NavigableMap<LocalDateTime, Map<String, Envio>> agruparEnviosPorLotePeriodo(Map<String, Envio> envios) {',
                          'private NavigableMap<LocalDateTime, Map<String, Envio>> agruparEnviosPorLotePeriodo(Map<String, Envio> envios, int scMinutos) {')
content = content.replace('LocalDateTime inicioLote = inicioLotePeriodo(envio.getFechaHoraRecepcion());',
                          'LocalDateTime inicioLote = inicioLotePeriodo(envio.getFechaHoraRecepcion(), scMinutos);')
content = content.replace('agruparEnviosPorLotePeriodo(enviosMap).values()', 'agruparEnviosPorLotePeriodo(enviosMap, 5).values()')

# 7. Update inicioLotePeriodo definition
content = content.replace('private LocalDateTime inicioLotePeriodo(LocalDateTime recepcion) {',
                          'private LocalDateTime inicioLotePeriodo(LocalDateTime recepcion, int scMinutos) {')
content = content.replace('int minutoLote = (recepcion.getMinute() / MINUTOS_LOTE_PERIODO) * MINUTOS_LOTE_PERIODO;\n        return recepcion.truncatedTo(ChronoUnit.HOURS).plusMinutes(minutoLote);',
                          'LocalDateTime base = recepcion.truncatedTo(ChronoUnit.DAYS);\n        long mins = ChronoUnit.MINUTES.between(base, recepcion);\n        long loteMins = (mins / scMinutos) * scMinutos;\n        return base.plusMinutes(loteMins);')

# 8. Replace Escenario 1 logic with Escenario1Iterator
old_esc1 = '''    private List<RutaResponseDTO> ejecutarEscenario1(NavigableMap<LocalDateTime, Map<String, Envio>> enviosPorLote,
                                    Collection<Aeropuerto> aeropuertos, List<Vuelo> vuelos,
                                    RutaResponseDTO baseResponse, ProgressReporter progress,
                                    LocalDateTime fechaInicioRango) {
        List<Vuelo> vuelosSA = clonarVuelos(vuelos);
        RedLogistica redSA   = new RedLogistica(aeropuertos, vuelosSA);
        Map<String, Envio> pendientesSA = new LinkedHashMap<>();
        Map<String, List<SolucionEstado.OccupancyEvent>> reservasSA = new HashMap<>();
        List<RutaResponseDTO> chunks = new ArrayList<>();
        int loteCount = 0, totalLotes = Math.max(1, enviosPorLote.size());

        for (Map.Entry<LocalDateTime, Map<String, Envio>> entry : enviosPorLote.entrySet()) {
            LocalDateTime loteInicio = entry.getKey();
            LocalDateTime loteFin    = loteInicio.plusMinutes(MINUTOS_LOTE_PERIODO);
            pendientesSA.putAll(entry.getValue());
            loteCount++;
            int  diaOffset = (int) ChronoUnit.DAYS.between(fechaInicioRango.toLocalDate(), loteInicio.toLocalDate());
            long tiempoMin = Math.min(15L, Math.max(1L, pendientesSA.size() / 150L));

            RutaResponseDTO chunk = clonarBaseResponse(baseResponse, loteInicio, loteFin);
            chunk.setTotalEnviosCargados(pendientesSA.size());

            SimulatedAnnealing sa = new SimulatedAnnealing(redSA)
                    .setTemperaturaInicial(1_000.0).setAlfa(0.995)
                    .setTemperaturaMinima(1.0).setTiempoMaxMinutos(tiempoMin);
            report(progress, 35 + (60 * loteCount / totalLotes), "SA lote: " + formatoLote(loteInicio, loteFin));
            long t0 = System.currentTimeMillis();
            SolucionEstado solSA = sa.optimizar(pendientesSA);
            long msSA = System.currentTimeMillis() - t0;

            chunk.setResultadoSA(buildResultado("SA (Periodo)", sa.getCostoInicial(), sa.getCostoFinal(),
                    sa.getMejoraRelativa(), sa.getIteraciones(), msSA, solSA, pendientesSA, diaOffset,
                    Collections.emptyList(), reservasSA));
            retirarEnviosProcesados(pendientesSA, solSA);
            chunks.add(chunk);
            if (progress != null) progress.onChunk(chunk);
        }
        return chunks;
    }'''

new_esc1 = '''    private void addVuelosMaestros(RutaResponseDTO chunk, List<Vuelo> vuelos) {
        chunk.setVuelosMaestros(vuelos.stream().map(v -> {
            RutaResponseDTO.TramoDTO t = new RutaResponseDTO.TramoDTO();
            t.setOrigen(v.getOrigen().getCodigo());
            t.setDestino(v.getDestino().getCodigo());
            t.setOrigenLat(v.getOrigen().getLatitud());
            t.setOrigenLon(v.getOrigen().getLongitud());
            t.setDestinoLat(v.getDestino().getLatitud());
            t.setDestinoLon(v.getDestino().getLongitud());
            t.setCapacidad(v.getCapacidadMax());
            t.setVueloId(v.getId());
            t.setHoraSalidaLocal(v.getHoraSalidaLocal().toString());
            t.setHoraLlegadaLocal(v.getHoraLlegadaLocal().toString());
            t.setSalidaMinutosGMT(v.getSalidaMinutosGMT());
            t.setLlegadaMinutosGMT(v.getLlegadaMinutosGMT());
            return t;
        }).collect(Collectors.toList()));
    }

    private class Escenario1Iterator implements SimulacionIterator {
        private final Iterator<Map.Entry<LocalDateTime, Map<String, Envio>>> iterator;
        private final RedLogistica redSA;
        private final Map<String, Envio> pendientesSA = new LinkedHashMap<>();
        private final Map<String, List<SolucionEstado.OccupancyEvent>> reservasSA = new HashMap<>();
        private final RutaResponseDTO baseResponse;
        private final ProgressReporter progress;
        private final LocalDateTime fechaInicioRango;
        private final int totalLotes;
        private final int scMinutos;
        private final List<Vuelo> vuelosOriginales;
        private int loteCount = 0;
        private boolean colapsado = false;
        private String mensajeColapso = "";
        private boolean isFirst = true;

        public Escenario1Iterator(NavigableMap<LocalDateTime, Map<String, Envio>> enviosPorLote,
                                  Collection<Aeropuerto> aeropuertos, List<Vuelo> vuelos,
                                  RutaResponseDTO baseResponse, ProgressReporter progress,
                                  LocalDateTime fechaInicioRango, int scMinutos) {
            this.iterator = enviosPorLote.entrySet().iterator();
            this.vuelosOriginales = vuelos;
            this.redSA = new RedLogistica(aeropuertos, clonarVuelos(vuelos));
            this.baseResponse = baseResponse;
            this.progress = progress;
            this.fechaInicioRango = fechaInicioRango;
            this.totalLotes = Math.max(1, enviosPorLote.size());
            this.scMinutos = scMinutos;
        }

        @Override public boolean hasNext() { return iterator.hasNext() && !colapsado; }
        @Override public boolean hasColapsado() { return colapsado; }
        @Override public String getMensajeColapso() { return mensajeColapso; }

        @Override
        public RutaResponseDTO nextChunk() {
            if (!hasNext()) return null;
            Map.Entry<LocalDateTime, Map<String, Envio>> entry = iterator.next();
            LocalDateTime loteInicio = entry.getKey();
            LocalDateTime loteFin    = loteInicio.plusMinutes(scMinutos);
            pendientesSA.putAll(entry.getValue());
            loteCount++;
            int diaOffset = (int) ChronoUnit.DAYS.between(fechaInicioRango.toLocalDate(), loteInicio.toLocalDate());
            
            RutaResponseDTO chunk = clonarBaseResponse(baseResponse, loteInicio, loteFin);
            chunk.setTotalEnviosCargados(pendientesSA.size());

            // 1 minute real time strictly for algorithm Ta (60 seconds)
            SimulatedAnnealing sa = new SimulatedAnnealing(redSA)
                    .setTemperaturaInicial(1_000.0).setAlfa(0.995)
                    .setTemperaturaMinima(1.0).setTiempoMaxMinutos(1L);
            report(progress, 35 + (60 * loteCount / totalLotes), "SA lote: " + formatoLote(loteInicio, loteFin));
            long t0 = System.currentTimeMillis();
            SolucionEstado solSA = sa.optimizar(pendientesSA);
            long msSA = System.currentTimeMillis() - t0;

            chunk.setResultadoSA(buildResultado("SA (Periodo)", sa.getCostoInicial(), sa.getCostoFinal(),
                    sa.getMejoraRelativa(), sa.getIteraciones(), msSA, solSA, pendientesSA, diaOffset,
                    Collections.emptyList(), reservasSA));
            
            if (!solSA.getEnviosSinRuta().isEmpty()) {
                colapsado = true;
                mensajeColapso = "Algoritmo colapso: " + solSA.getEnviosSinRuta().size() + " envios varados o SLA incumplido.";
                chunk.getResultadoSA().setMensajeColapso(mensajeColapso);
            }

            retirarEnviosProcesados(pendientesSA, solSA);
            
            if (isFirst) {
                addVuelosMaestros(chunk, vuelosOriginales);
                isFirst = false;
            }

            if (progress != null) progress.onChunk(chunk);
            return chunk;
        }
    }'''

content = content.replace(old_esc1, new_esc1)

# 9. Replace Escenario2 and Escenario3 similarly using iterators
# For Escenario2
old_esc2 = '''    private List<RutaResponseDTO> ejecutarEscenario2(Map<LocalDate, Map<String, Envio>> enviosPorDia,
                                    Collection<Aeropuerto> aeropuertos, List<Vuelo> vuelos,
                                    RutaResponseDTO baseResponse, ProgressReporter progress,
                                    LocalDate fechaInicioRango) {
        List<Vuelo> vuelosSA      = clonarVuelos(vuelos);
        List<Vuelo> disponiblesSA = new ArrayList<>(vuelosSA);
        Collections.shuffle(disponiblesSA, new Random(123));
        Set<Integer>       canceladosAcumulados = new HashSet<>();
        Map<String, Envio> pendientesSA         = new LinkedHashMap<>();
        Map<String, List<SolucionEstado.OccupancyEvent>> reservasSA = new HashMap<>();
        List<RutaResponseDTO> chunks = new ArrayList<>();
        int diaCount = 0, totalDias = enviosPorDia.size();

        for (Map.Entry<LocalDate, Map<String, Envio>> entry : enviosPorDia.entrySet()) {
            LocalDate dia = entry.getKey();
            pendientesSA.putAll(entry.getValue());
            diaCount++;
            int  diaOffset = (int) fechaInicioRango.until(dia, ChronoUnit.DAYS);
            int  cancelar  = Math.max(1, (int)(vuelos.size() * 0.01));
            for (int i = 0; i < cancelar && !disponiblesSA.isEmpty(); i++) {
                Vuelo vsa = disponiblesSA.remove(0);
                vsa.setCapacidadMax(0);
                canceladosAcumulados.add(vsa.getId());
            }
            long tiempoMin = Math.min(10L, Math.max(1L, pendientesSA.size() / 150L));

            SimulatedAnnealing sa = new SimulatedAnnealing(new RedLogistica(aeropuertos, vuelosSA))
                    .setTemperaturaInicial(1_000.0).setAlfa(0.995)
                    .setTemperaturaMinima(0.1).setTiempoMaxMinutos(tiempoMin);
            report(progress, 35 + (60 * diaCount / totalDias), "E2-SA dia: " + dia);
            long t0  = System.currentTimeMillis();
            SolucionEstado solSA = sa.optimizar(pendientesSA);
            long msSA = System.currentTimeMillis() - t0;

            RutaResponseDTO chunk = clonarBaseResponse(baseResponse, dia);
            chunk.setTotalEnviosCargados(pendientesSA.size());
            chunk.setResultadoSA(buildResultado("SA (Dia a Dia)", sa.getCostoInicial(), sa.getCostoFinal(),
                    sa.getMejoraRelativa(), sa.getIteraciones(), msSA, solSA, pendientesSA, diaOffset,
                    new ArrayList<>(canceladosAcumulados), reservasSA));
            chunks.add(chunk);
            if (progress != null) progress.onChunk(chunk);
            retirarEnviosProcesados(pendientesSA, solSA);
        }
        return chunks;
    }'''

new_esc2 = '''    private class Escenario2Iterator implements SimulacionIterator {
        private final Iterator<Map.Entry<LocalDate, Map<String, Envio>>> iterator;
        private final List<Vuelo> vuelosSA;
        private final List<Vuelo> disponiblesSA;
        private final Set<Integer> canceladosAcumulados = new HashSet<>();
        private final Map<String, Envio> pendientesSA = new LinkedHashMap<>();
        private final Map<String, List<SolucionEstado.OccupancyEvent>> reservasSA = new HashMap<>();
        private final Collection<Aeropuerto> aeropuertos;
        private final List<Vuelo> vuelosOriginales;
        private final RutaResponseDTO baseResponse;
        private final ProgressReporter progress;
        private final LocalDate fechaInicioRango;
        private final int totalDias;
        private int diaCount = 0;
        private boolean isFirst = true;

        public Escenario2Iterator(Map<LocalDate, Map<String, Envio>> enviosPorDia,
                                  Collection<Aeropuerto> aeropuertos, List<Vuelo> vuelos,
                                  RutaResponseDTO baseResponse, ProgressReporter progress,
                                  LocalDate fechaInicioRango) {
            this.iterator = enviosPorDia.entrySet().iterator();
            this.vuelosOriginales = vuelos;
            this.vuelosSA = clonarVuelos(vuelos);
            this.disponiblesSA = new ArrayList<>(this.vuelosSA);
            Collections.shuffle(this.disponiblesSA, new Random(123));
            this.aeropuertos = aeropuertos;
            this.baseResponse = baseResponse;
            this.progress = progress;
            this.fechaInicioRango = fechaInicioRango;
            this.totalDias = enviosPorDia.size();
        }

        @Override public boolean hasNext() { return iterator.hasNext(); }
        @Override public boolean hasColapsado() { return false; }
        @Override public String getMensajeColapso() { return ""; }

        @Override
        public RutaResponseDTO nextChunk() {
            if (!hasNext()) return null;
            Map.Entry<LocalDate, Map<String, Envio>> entry = iterator.next();
            LocalDate dia = entry.getKey();
            pendientesSA.putAll(entry.getValue());
            diaCount++;
            int diaOffset = (int) fechaInicioRango.until(dia, ChronoUnit.DAYS);
            int cancelar = Math.max(1, (int)(vuelosOriginales.size() * 0.01));
            for (int i = 0; i < cancelar && !disponiblesSA.isEmpty(); i++) {
                Vuelo vsa = disponiblesSA.remove(0);
                vsa.setCapacidadMax(0);
                canceladosAcumulados.add(vsa.getId());
            }
            long tiempoMin = Math.min(10L, Math.max(1L, pendientesSA.size() / 150L));

            SimulatedAnnealing sa = new SimulatedAnnealing(new RedLogistica(aeropuertos, vuelosSA))
                    .setTemperaturaInicial(1_000.0).setAlfa(0.995)
                    .setTemperaturaMinima(0.1).setTiempoMaxMinutos(tiempoMin);
            report(progress, 35 + (60 * diaCount / totalDias), "E2-SA dia: " + dia);
            long t0 = System.currentTimeMillis();
            SolucionEstado solSA = sa.optimizar(pendientesSA);
            long msSA = System.currentTimeMillis() - t0;

            RutaResponseDTO chunk = clonarBaseResponse(baseResponse, dia);
            chunk.setTotalEnviosCargados(pendientesSA.size());
            chunk.setResultadoSA(buildResultado("SA (Dia a Dia)", sa.getCostoInicial(), sa.getCostoFinal(),
                    sa.getMejoraRelativa(), sa.getIteraciones(), msSA, solSA, pendientesSA, diaOffset,
                    new ArrayList<>(canceladosAcumulados), reservasSA));

            if (isFirst) { addVuelosMaestros(chunk, vuelosOriginales); isFirst = false; }
            if (progress != null) progress.onChunk(chunk);
            retirarEnviosProcesados(pendientesSA, solSA);
            return chunk;
        }
    }'''
content = content.replace(old_esc2, new_esc2)

old_esc3 = '''    private List<RutaResponseDTO> ejecutarEscenario3(Map<LocalDate, Map<String, Envio>> enviosPorDia,
                                    Collection<Aeropuerto> aeropuertos, List<Vuelo> vuelos,
                                    RutaResponseDTO baseResponse, ProgressReporter progress,
                                    LocalDate fechaInicioRango) {
        List<Vuelo> vuelosSA    = clonarVuelos(vuelos);
        List<Vuelo> restantesSA = new ArrayList<>(vuelosSA);
        Collections.shuffle(restantesSA, new Random(42));
        Set<Integer>       canceladosSA = new HashSet<>();
        Map<String, Envio> pendientesSA = new LinkedHashMap<>();
        Map<String, List<SolucionEstado.OccupancyEvent>> reservasSA = new HashMap<>();
        List<RutaResponseDTO> chunks = new ArrayList<>();
        int diaCount = 0, totalDias = enviosPorDia.size();
        int totalVuelos = vuelos.size(), canceladosTotal = 0;
        boolean colapsado = false;
        String mensajeColapso = "";

        for (Map.Entry<LocalDate, Map<String, Envio>> entry : enviosPorDia.entrySet()) {
            LocalDate dia = entry.getKey();
            pendientesSA.putAll(entry.getValue());
            diaCount++;
            int diaOffset = (int) fechaInicioRango.until(dia, ChronoUnit.DAYS);
            if (!colapsado) {
                int n = Math.max(1, (int)(totalVuelos * 0.05));
                for (int i = 0; i < n && !restantesSA.isEmpty(); i++) {
                    Vuelo vsa = restantesSA.remove(0);
                    vsa.setCapacidadMax(0); // ERROR CORREGIDO: ahora el avión realmente no tiene espacio
                    canceladosSA.add(vsa.getId());
                    canceladosTotal++;
                }
            }
            long tiempoMin = Math.min(10L, Math.max(1L, pendientesSA.size() / 200L));

            SimulatedAnnealing sa = new SimulatedAnnealing(new RedLogistica(aeropuertos, vuelosSA))
                    .setTemperaturaInicial(800.0).setAlfa(0.99)
                    .setTemperaturaMinima(0.5).setTiempoMaxMinutos(tiempoMin);
            report(progress, 35 + (60 * diaCount / totalDias), "E3-SA dia: " + dia);
            long t0  = System.currentTimeMillis();
            SolucionEstado solSA = sa.optimizar(pendientesSA);
            long msSA = System.currentTimeMillis() - t0;

            int huerfanos = solSA.getEnviosSinRuta().size();
            double proporcion = (double) huerfanos / Math.max(1, pendientesSA.size());
            if (proporcion > 0.10 && !colapsado) {
                colapsado = true;
                int pctFlota  = (int)((double) canceladosTotal / totalVuelos * 100);
                int pctHuerfa = (int)(proporcion * 100);
                mensajeColapso = String.format("COLAPSO: %d envios varados (%d%%) tras perder %d%% flota.",
                        huerfanos, pctHuerfa, pctFlota);
            }

            RutaResponseDTO chunk = clonarBaseResponse(baseResponse, dia);
            chunk.setTotalEnviosCargados(pendientesSA.size());
            ResultadoAlgoritmo resSA = buildResultado("SA (Colapso)", sa.getCostoInicial(), sa.getCostoFinal(),
                    sa.getMejoraRelativa(), sa.getIteraciones(), msSA, solSA, pendientesSA, diaOffset,
                    new ArrayList<>(canceladosSA), reservasSA);
            resSA.setMensajeColapso(mensajeColapso);
            chunk.setResultadoSA(resSA);
            chunks.add(chunk);
            if (progress != null) progress.onChunk(chunk);
            retirarEnviosProcesados(pendientesSA, solSA);
        }
        return chunks;
    }'''

new_esc3 = '''    private class Escenario3Iterator implements SimulacionIterator {
        private final Iterator<Map.Entry<LocalDate, Map<String, Envio>>> iterator;
        private final List<Vuelo> vuelosSA;
        private final List<Vuelo> restantesSA;
        private final Set<Integer> canceladosSA = new HashSet<>();
        private final Map<String, Envio> pendientesSA = new LinkedHashMap<>();
        private final Map<String, List<SolucionEstado.OccupancyEvent>> reservasSA = new HashMap<>();
        private final Collection<Aeropuerto> aeropuertos;
        private final List<Vuelo> vuelosOriginales;
        private final RutaResponseDTO baseResponse;
        private final ProgressReporter progress;
        private final LocalDate fechaInicioRango;
        private final int totalDias;
        private int diaCount = 0;
        private int canceladosTotal = 0;
        private boolean colapsado = false;
        private String mensajeColapso = "";
        private boolean isFirst = true;

        public Escenario3Iterator(Map<LocalDate, Map<String, Envio>> enviosPorDia,
                                  Collection<Aeropuerto> aeropuertos, List<Vuelo> vuelos,
                                  RutaResponseDTO baseResponse, ProgressReporter progress,
                                  LocalDate fechaInicioRango) {
            this.iterator = enviosPorDia.entrySet().iterator();
            this.vuelosOriginales = vuelos;
            this.vuelosSA = clonarVuelos(vuelos);
            this.restantesSA = new ArrayList<>(this.vuelosSA);
            Collections.shuffle(this.restantesSA, new Random(42));
            this.aeropuertos = aeropuertos;
            this.baseResponse = baseResponse;
            this.progress = progress;
            this.fechaInicioRango = fechaInicioRango;
            this.totalDias = enviosPorDia.size();
        }

        @Override public boolean hasNext() { return iterator.hasNext(); }
        @Override public boolean hasColapsado() { return colapsado; }
        @Override public String getMensajeColapso() { return mensajeColapso; }

        @Override
        public RutaResponseDTO nextChunk() {
            if (!hasNext()) return null;
            Map.Entry<LocalDate, Map<String, Envio>> entry = iterator.next();
            LocalDate dia = entry.getKey();
            pendientesSA.putAll(entry.getValue());
            diaCount++;
            int diaOffset = (int) fechaInicioRango.until(dia, ChronoUnit.DAYS);
            if (!colapsado) {
                int n = Math.max(1, (int)(vuelosOriginales.size() * 0.05));
                for (int i = 0; i < n && !restantesSA.isEmpty(); i++) {
                    Vuelo vsa = restantesSA.remove(0);
                    vsa.setCapacidadMax(0);
                    canceladosSA.add(vsa.getId());
                    canceladosTotal++;
                }
            }
            long tiempoMin = Math.min(10L, Math.max(1L, pendientesSA.size() / 200L));

            SimulatedAnnealing sa = new SimulatedAnnealing(new RedLogistica(aeropuertos, vuelosSA))
                    .setTemperaturaInicial(800.0).setAlfa(0.99)
                    .setTemperaturaMinima(0.5).setTiempoMaxMinutos(tiempoMin);
            report(progress, 35 + (60 * diaCount / totalDias), "E3-SA dia: " + dia);
            long t0 = System.currentTimeMillis();
            SolucionEstado solSA = sa.optimizar(pendientesSA);
            long msSA = System.currentTimeMillis() - t0;

            int huerfanos = solSA.getEnviosSinRuta().size();
            double proporcion = (double) huerfanos / Math.max(1, pendientesSA.size());
            if (proporcion > 0.10 && !colapsado) {
                colapsado = true;
                int pctFlota  = (int)((double) canceladosTotal / vuelosOriginales.size() * 100);
                int pctHuerfa = (int)(proporcion * 100);
                mensajeColapso = String.format("COLAPSO: %d envios varados (%d%%) tras perder %d%% flota.",
                        huerfanos, pctHuerfa, pctFlota);
            }

            RutaResponseDTO chunk = clonarBaseResponse(baseResponse, dia);
            chunk.setTotalEnviosCargados(pendientesSA.size());
            ResultadoAlgoritmo resSA = buildResultado("SA (Colapso)", sa.getCostoInicial(), sa.getCostoFinal(),
                    sa.getMejoraRelativa(), sa.getIteraciones(), msSA, solSA, pendientesSA, diaOffset,
                    new ArrayList<>(canceladosSA), reservasSA);
            resSA.setMensajeColapso(mensajeColapso);
            chunk.setResultadoSA(resSA);

            if (isFirst) { addVuelosMaestros(chunk, vuelosOriginales); isFirst = false; }
            if (progress != null) progress.onChunk(chunk);
            retirarEnviosProcesados(pendientesSA, solSA);
            return chunk;
        }
    }'''
content = content.replace(old_esc3, new_esc3)

with open('src/main/java/com/loadroute/service/RuteoAlgoritmoService.java', 'w', encoding='utf-8') as f:
    f.write(content)
