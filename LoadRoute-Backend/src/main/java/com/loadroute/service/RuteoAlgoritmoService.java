package com.loadroute.service;

import com.loadroute.algorithm.*;
import com.loadroute.algorithm.graph.RedLogistica;
import com.loadroute.algorithm.model.*;
import com.loadroute.algorithm.model.SolucionEstado;
import com.loadroute.algorithm.parser.Parsers;
import com.loadroute.dto.RutaResponseDTO;
import com.loadroute.dto.RutaResponseDTO.*;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.logging.Logger;
import java.util.stream.Collectors;

/**
 * Servicio principal de ruteo de Tasf.B2B.
 * Todos los escenarios usan Simulated Annealing (SA).
 */
@Service
public class RuteoAlgoritmoService {

    private static final Logger LOG = Logger.getLogger(RuteoAlgoritmoService.class.getName());

    private final CargaDatosService cargaDatosService;

    public RuteoAlgoritmoService(CargaDatosService cargaDatosService) {
        this.cargaDatosService = cargaDatosService;
    }

    public interface SimulacionIterator {
        boolean hasNext();

        RutaResponseDTO nextChunk();

        boolean hasColapsado();

        String getMensajeColapso();

        default int getSa() { return 1; }

        default int getK() { return 240; }
    }

    @FunctionalInterface
    public interface ProgressReporter {
        void update(int progress, String message);

        default void onChunk(RutaResponseDTO chunk) {
        }
    }

    private static final DateTimeFormatter FMT_FECHA = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final DateTimeFormatter FMT_FECHA_HORA = DateTimeFormatter.ofPattern("yyyyMMddHHmm");

    public static class ParametrosSimulacion {
        private final int sa;
        private final int k;

        public ParametrosSimulacion(int sa, int k) {
            this.sa = sa;
            this.k = k;
        }

        public int getSa() { return sa; }
        public int getK() { return k; }
        public int getScMinutos() { return sa * k; }
    }

    public static ParametrosSimulacion obtenerParametrosSimulacion(LocalDateTime inicio, LocalDateTime fin) {
        if (inicio == null || fin == null) {
            return new ParametrosSimulacion(3, 240);
        }
        long dias = ChronoUnit.DAYS.between(inicio.toLocalDate(), fin.toLocalDate());
        int sa = 1;
        int k;
        if (dias <= 3)
            k = 144;
        else if (dias <= 5)
            k = 200;
        else
            k = 240;
        return new ParametrosSimulacion(sa, k);
    }

    private int calcularScMinutos(LocalDateTime inicio, LocalDateTime fin) {
        return obtenerParametrosSimulacion(inicio, fin).getScMinutos();
    }

    private static final int MAX_RUTAS_MUESTRA = 10_000;
    private static final int MINUTOS_LOTE_PERIODO = 5;

    public List<RutaResponseDTO> ejecutarRuteo(InputStream aeropuertosIS,
            InputStream vuelosIS,
            List<MultipartFile> enviosFiles,
            int escenario,
            String fechaInicio,
            String fechaFin) throws IOException {
        return ejecutarRuteo(aeropuertosIS, vuelosIS, enviosFiles, escenario, fechaInicio, fechaFin, null);
    }

    public List<RutaResponseDTO> ejecutarRuteo(InputStream aeropuertosIS,
            InputStream vuelosIS,
            List<MultipartFile> enviosFiles,
            int escenario,
            String fechaInicio,
            String fechaFin,
            ProgressReporter progress) throws IOException {
        SimulacionIterator iter = prepararIteradorRuteo(aeropuertosIS, vuelosIS, enviosFiles, escenario, fechaInicio,
                fechaFin, progress);
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
            ProgressReporter progress) throws IOException {

        report(progress, 8, "Cargando datos...");
        LOG.info("Cargando datos para el algoritmo...");

        Map<String, Aeropuerto> aeropuertos;
        if (aeropuertosIS != null) {
            aeropuertos = Parsers.parsearAeropuertos(aeropuertosIS);
        } else {
            aeropuertos = cargaDatosService.obtenerAeropuertosDeBDComoModelos();
        }

        List<Vuelo> vuelos;
        if (vuelosIS != null) {
            vuelos = Parsers.parsearVuelos(vuelosIS, aeropuertos);
        } else {
            vuelos = cargaDatosService.obtenerVuelosDeBDComoModelos(aeropuertos);
        }

        report(progress, 18, "Aeropuertos y vuelos cargados. Leyendo envios...");

        LocalDateTime inicioFiltro = fechaInicio != null ? parsearFechaInicio(fechaInicio) : null;
        LocalDateTime finFiltro = fechaFin != null ? parsearFechaFin(fechaFin) : null;
        Map<String, Envio> envios = new LinkedHashMap<>();
        if (enviosFiles != null && !enviosFiles.isEmpty()
                && !(enviosFiles.size() == 1 && enviosFiles.get(0).isEmpty())) {
            for (MultipartFile file : enviosFiles) {
                String filename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "_envios_XXXX_.txt";
                envios.putAll(Parsers.parsearEnvios(file.getInputStream(), filename, aeropuertos, 0, inicioFiltro,
                        finFiltro));
            }
        } else {
            LocalDateTime inicio = parsearFechaInicio(fechaInicio);
            LocalDateTime fin = parsearFechaFin(fechaFin);
            envios = cargaDatosService.obtenerEnviosDeBDComoModelosEnRango(aeropuertos, inicio, fin);
        }

        report(progress, 30, String.format("Filtro aplicado: %d envios en el rango.", envios.size()));
        LOG.info(String.format("Datos cargados: %d aeropuertos | %d vuelos | %d envios",
                aeropuertos.size(), vuelos.size(), envios.size()));

        if (envios.isEmpty()) {
            LOG.warning("No hay envíos para el rango de fechas especificado.");
            RutaResponseDTO vacía = new RutaResponseDTO();
            vacía.setEscenario(escenario);
            vacía.setTotalEnviosCargados(0);
            return new SimulacionIterator() {
                private boolean done = false;

                @Override
                public boolean hasNext() {
                    return !done;
                }

                @Override
                public RutaResponseDTO nextChunk() {
                    done = true;
                    return vacía;
                }

                @Override
                public boolean hasColapsado() {
                    return false;
                }

                @Override
                public String getMensajeColapso() {
                    return "";
                }
            };
        }

        RedLogistica red = new RedLogistica(aeropuertos.values(), vuelos);
        report(progress, 35, "Red logistica construida.");

        RutaResponseDTO response = new RutaResponseDTO();
        response.setEscenario(escenario);
        response.setTotalVuelos(red.getTotalVuelos());
        response.setTotalEnviosCargados(envios.size());
        response.setFechaInicio(fechaInicio);
        response.setFechaFin(fechaFin);
        response.setAeropuertos(
                aeropuertos.values().stream().map(this::mapAeropuertoDTO).collect(Collectors.toList()));

        ParametrosSimulacion paramsSim = obtenerParametrosSimulacion(inicioFiltro, finFiltro);
        response.setSa(paramsSim.getSa());
        response.setK(paramsSim.getK());

        Map<LocalDate, Map<String, Envio>> enviosPorDia = agruparEnviosPorDia(envios);
        int scMinutos = calcularScMinutos(inicioFiltro, finFiltro);
        NavigableMap<LocalDateTime, Map<String, Envio>> enviosPorLotePeriodo = agruparEnviosPorLotePeriodo(envios,
                scMinutos);

        LocalDateTime fechaInicioRango = parsearFechaInicio(fechaInicio);
        LocalDate fechaInicioRangoDia = fechaInicioRango.toLocalDate();
        // E2/E3: el día 0 de la animación es el primer día con envíos, no 1900-01-01 ni
        // huecos previos al rango
        LocalDate fechaBaseDiaria = enviosPorDia.keySet().stream()
                .min(LocalDate::compareTo)
                .orElse(fechaInicioRangoDia);
        report(progress, 98, "Preparando respuesta para el dashboard...");
        switch (escenario) {
            case 2:
                return new Escenario2Iterator(enviosPorDia, aeropuertos.values(), vuelos, response, progress,
                        fechaBaseDiaria);
            case 3:
                return new Escenario3Iterator(enviosPorDia, aeropuertos.values(), vuelos, response, progress,
                        fechaBaseDiaria);
            default:
                return new Escenario1Iterator(enviosPorLotePeriodo, aeropuertos.values(), vuelos, response, progress,
                        fechaInicioRango, scMinutos);
        }
    }

    private void report(ProgressReporter progress, int pct, String message) {
        if (progress != null)
            progress.update(pct, message);
    }

    private void retirarEnviosProcesados(Map<String, Envio> pendientes, SolucionEstado sol) {
        for (String id : sol.getIdsAsignados())
            pendientes.remove(id);
        for (String id : sol.getIdsNoAceptados())
            pendientes.remove(id);
        for (String id : sol.getEnviosSinRuta())
            pendientes.remove(id);
    }

    private List<Vuelo> clonarVuelos(List<Vuelo> originales) {
        List<Vuelo> copia = new ArrayList<>();
        for (Vuelo v : originales)
            copia.add(v.clonar());
        return copia;
    }

    private Map<LocalDate, Map<String, Envio>> agruparEnviosPorDia(Map<String, Envio> envios) {
        Map<LocalDate, Map<String, Envio>> enviosPorDia = new TreeMap<>();
        for (Envio envio : ordenarEnviosCronologicamente(envios)) {
            LocalDate dia = envio.getFechaHoraRecepcion().toLocalDate();
            enviosPorDia.computeIfAbsent(dia, k -> new LinkedHashMap<>()).put(envio.getId(), envio);
        }
        return enviosPorDia;
    }

    private NavigableMap<LocalDateTime, Map<String, Envio>> agruparEnviosPorLotePeriodo(Map<String, Envio> envios,
            int scMinutos) {
        NavigableMap<LocalDateTime, Map<String, Envio>> enviosPorLote = new TreeMap<>();
        for (Envio envio : ordenarEnviosCronologicamente(envios)) {
            LocalDateTime inicioLote = inicioLotePeriodo(envio.getFechaHoraRecepcion(), scMinutos);
            enviosPorLote.computeIfAbsent(inicioLote, k -> new LinkedHashMap<>()).put(envio.getId(), envio);
        }
        return enviosPorLote;
    }

    List<Map<String, Envio>> agruparEnviosEnLotesCincoMinutos(Collection<Envio> envios) {
        Map<String, Envio> enviosMap = new LinkedHashMap<>();
        for (Envio envio : envios)
            enviosMap.put(envio.getId(), envio);
        return new ArrayList<>(agruparEnviosPorLotePeriodo(enviosMap, 5).values());
    }

    private List<Envio> ordenarEnviosCronologicamente(Map<String, Envio> envios) {
        return envios.values().stream()
                .sorted(Comparator.comparing(Envio::getFechaHoraRecepcion).thenComparing(Envio::getId))
                .collect(Collectors.toList());
    }

    private LocalDateTime inicioLotePeriodo(LocalDateTime recepcion, int scMinutos) {
        LocalDateTime base = recepcion.truncatedTo(ChronoUnit.DAYS);
        long mins = ChronoUnit.MINUTES.between(base, recepcion);
        long loteMins = (mins / scMinutos) * scMinutos;
        return base.plusMinutes(loteMins);
    }

    Map<String, Envio> filtrarEnviosPorFecha(Map<String, Envio> envios, String fechaInicio, String fechaFin) {
        if (fechaInicio == null && fechaFin == null)
            return envios;
        LocalDateTime inicio = parsearFechaInicio(fechaInicio);
        LocalDateTime fin = parsearFechaFin(fechaFin);
        return envios.entrySet().stream()
                .filter(e -> {
                    LocalDateTime rec = e.getValue().getFechaHoraRecepcion();
                    return !rec.isBefore(inicio) && !rec.isAfter(fin);
                })
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue, (a, b) -> a, LinkedHashMap::new));
    }

    public LocalDateTime parsearFechaInicio(String fecha) {
        if (fecha == null)
            return LocalDateTime.of(1900, 1, 1, 0, 0);
        return parsearFechaParametro(fecha, false, LocalDateTime.of(1900, 1, 1, 0, 0));
    }

    public LocalDateTime parsearFechaFin(String fecha) {
        if (fecha == null)
            return LocalDateTime.of(2099, 12, 31, 23, 59, 59);
        return parsearFechaParametro(fecha, true, LocalDateTime.of(2099, 12, 31, 23, 59, 59));
    }

    private LocalDateTime parsearFechaParametro(String fecha, boolean finDeDia, LocalDateTime fallback) {
        if (fecha == null || fecha.isBlank())
            return fallback;
        String valor = fecha.trim();
        try {
            if (valor.matches("\\d{12}")) {
                return LocalDateTime.parse(valor, FMT_FECHA_HORA);
            }
            if (valor.matches("\\d{8}")) {
                LocalDate dia = LocalDate.parse(valor, FMT_FECHA);
                return finDeDia ? dia.atTime(23, 59, 59) : dia.atStartOfDay();
            }
            return LocalDateTime.parse(valor);
        } catch (DateTimeParseException e) {
            return fallback;
        }
    }

    // ── ESCENARIO 1: Simulación de Periodo (SA) ──────────────────────────────
    private void addVuelosMaestros(RutaResponseDTO chunk, List<Vuelo> vuelos) {
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

        @Override
        public boolean hasNext() {
            return iterator.hasNext() && !colapsado;
        }

        @Override
        public boolean hasColapsado() {
            return colapsado;
        }

        @Override
        public String getMensajeColapso() {
            return mensajeColapso;
        }

        @Override
        public RutaResponseDTO nextChunk() {
            if (!hasNext())
                return null;
            Map.Entry<LocalDateTime, Map<String, Envio>> entry = iterator.next();
            LocalDateTime loteInicio = entry.getKey();
            LocalDateTime loteFin = loteInicio.plusMinutes(scMinutos);
            pendientesSA.putAll(entry.getValue());
            loteCount++;
            int diaOffset = (int) ChronoUnit.DAYS.between(fechaInicioRango.toLocalDate(), loteInicio.toLocalDate());

            RutaResponseDTO chunk = clonarBaseResponse(baseResponse, loteInicio, loteFin);
            chunk.setTotalEnviosCargados(pendientesSA.size());

            SimulatedAnnealing sa = new SimulatedAnnealing(redSA)
                    .setTemperaturaInicial(1_000.0)
                    .setTemperaturaMinima(1.0)
                    .setTiempoPlanificacion(loteFin)
                    .setPeriodoString(formatoLote(loteInicio, loteFin));
            report(progress, 35 + (60 * loteCount / totalLotes), "SA lote: " + formatoLote(loteInicio, loteFin));
            long t0 = System.currentTimeMillis();
            SolucionEstado solSA = sa.optimizar(pendientesSA);
            long msSA = System.currentTimeMillis() - t0;

            chunk.setResultadoSA(buildResultado("SA (Periodo)", sa.getCostoInicial(), sa.getCostoFinal(),
                    sa.getMejoraRelativa(), sa.getIteraciones(), msSA, solSA, pendientesSA,
                    Collections.emptyList(), reservasSA, loteFin, fechaInicioRango.toLocalDate()));

            if (!solSA.getEnviosSinRuta().isEmpty()) {
                colapsado = true;
                mensajeColapso = "Algoritmo colapso: " + solSA.getEnviosSinRuta().size()
                        + " envios varados o SLA incumplido.";
                chunk.getResultadoSA().setMensajeColapso(mensajeColapso);
            }

            retirarEnviosProcesados(pendientesSA, solSA);

            if (isFirst) {
                addVuelosMaestros(chunk, vuelosOriginales);
                isFirst = false;
            }

            if (progress != null)
                progress.onChunk(chunk);
            return chunk;
        }

        @Override
        public int getSa() {
            return baseResponse.getSa();
        }

        @Override
        public int getK() {
            return baseResponse.getK();
        }
    }

    // ── ESCENARIO 2: Operación Día a Día (SA) ────────────────────────────────
    private class Escenario2Iterator implements SimulacionIterator {
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

        @Override
        public boolean hasNext() {
            return iterator.hasNext();
        }

        @Override
        public boolean hasColapsado() {
            return false;
        }

        @Override
        public String getMensajeColapso() {
            return "";
        }

        @Override
        public RutaResponseDTO nextChunk() {
            if (!hasNext())
                return null;
            Map.Entry<LocalDate, Map<String, Envio>> entry = iterator.next();
            LocalDate dia = entry.getKey();
            pendientesSA.putAll(entry.getValue());
            diaCount++;
            int diaOffset = (int) fechaInicioRango.until(dia, ChronoUnit.DAYS);
            int cancelar = Math.max(1, (int) (vuelosOriginales.size() * 0.01));
            for (int i = 0; i < cancelar && !disponiblesSA.isEmpty(); i++) {
                Vuelo vsa = disponiblesSA.remove(0);
                vsa.setCapacidadMax(0);
                canceladosAcumulados.add(vsa.getId());
            }
            SimulatedAnnealing sa = new SimulatedAnnealing(new RedLogistica(aeropuertos, vuelosSA))
                    .setTemperaturaInicial(1_000.0)
                    .setTemperaturaMinima(0.1)
                    .setTiempoPlanificacion(dia.atTime(23, 59, 59))
                    .setPeriodoString(dia.toString());
            report(progress, 35 + (60 * diaCount / totalDias), "E2-SA dia: " + dia);
            long t0 = System.currentTimeMillis();
            SolucionEstado solSA = sa.optimizar(pendientesSA);
            long msSA = System.currentTimeMillis() - t0;

            RutaResponseDTO chunk = clonarBaseResponse(baseResponse, dia);
            chunk.setTotalEnviosCargados(pendientesSA.size());
            chunk.setResultadoSA(buildResultado("SA (Dia a Dia)", sa.getCostoInicial(), sa.getCostoFinal(),
                    sa.getMejoraRelativa(), sa.getIteraciones(), msSA, solSA, pendientesSA,
                    new ArrayList<>(canceladosAcumulados), reservasSA, dia.atTime(23, 59, 59), fechaInicioRango));

            if (isFirst) {
                addVuelosMaestros(chunk, vuelosOriginales);
                isFirst = false;
            }
            if (progress != null)
                progress.onChunk(chunk);
            retirarEnviosProcesados(pendientesSA, solSA);
            return chunk;
        }

        @Override
        public int getSa() {
            return baseResponse.getSa();
        }

        @Override
        public int getK() {
            return baseResponse.getK();
        }
    }

    // ── ESCENARIO 3: Colapso Progresivo (SA) ─────────────────────────────────
    private class Escenario3Iterator implements SimulacionIterator {
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

        @Override
        public boolean hasNext() {
            return iterator.hasNext();
        }

        @Override
        public boolean hasColapsado() {
            return colapsado;
        }

        @Override
        public String getMensajeColapso() {
            return mensajeColapso;
        }

        @Override
        public RutaResponseDTO nextChunk() {
            if (!hasNext())
                return null;
            Map.Entry<LocalDate, Map<String, Envio>> entry = iterator.next();
            LocalDate dia = entry.getKey();
            pendientesSA.putAll(entry.getValue());
            diaCount++;
            int diaOffset = (int) fechaInicioRango.until(dia, ChronoUnit.DAYS);
            if (!colapsado) {
                int n = Math.max(1, (int) (vuelosOriginales.size() * 0.05));
                for (int i = 0; i < n && !restantesSA.isEmpty(); i++) {
                    Vuelo vsa = restantesSA.remove(0);
                    vsa.setCapacidadMax(0);
                    canceladosSA.add(vsa.getId());
                    canceladosTotal++;
                }
            }
            SimulatedAnnealing sa = new SimulatedAnnealing(new RedLogistica(aeropuertos, vuelosSA))
                    .setTemperaturaInicial(800.0)
                    .setTemperaturaMinima(0.5)
                    .setTiempoPlanificacion(dia.atTime(23, 59, 59))
                    .setPeriodoString(dia.toString());
            report(progress, 35 + (60 * diaCount / totalDias), "E3-SA dia: " + dia);
            long t0 = System.currentTimeMillis();
            SolucionEstado solSA = sa.optimizar(pendientesSA);
            long msSA = System.currentTimeMillis() - t0;

            int huerfanos = solSA.getEnviosSinRuta().size();
            double proporcion = (double) huerfanos / Math.max(1, pendientesSA.size());
            if (proporcion > 0.10 && !colapsado) {
                colapsado = true;
                int pctFlota = (int) ((double) canceladosTotal / vuelosOriginales.size() * 100);
                int pctHuerfa = (int) (proporcion * 100);
                mensajeColapso = String.format("COLAPSO: %d envios varados (%d%%) tras perder %d%% flota.",
                        huerfanos, pctHuerfa, pctFlota);
            }

            RutaResponseDTO chunk = clonarBaseResponse(baseResponse, dia);
            chunk.setTotalEnviosCargados(pendientesSA.size());
            ResultadoAlgoritmo resSA = buildResultado("SA (Colapso)", sa.getCostoInicial(), sa.getCostoFinal(),
                    sa.getMejoraRelativa(), sa.getIteraciones(), msSA, solSA, pendientesSA,
                    new ArrayList<>(canceladosSA), reservasSA, dia.atTime(23, 59, 59), fechaInicioRango);
            resSA.setMensajeColapso(mensajeColapso);
            chunk.setResultadoSA(resSA);

            if (isFirst) {
                addVuelosMaestros(chunk, vuelosOriginales);
                isFirst = false;
            }
            if (progress != null)
                progress.onChunk(chunk);
            retirarEnviosProcesados(pendientesSA, solSA);
            return chunk;
        }

        @Override
        public int getSa() {
            return baseResponse.getSa();
        }

        @Override
        public int getK() {
            return baseResponse.getK();
        }
    }

    // ── MAPEO A DTO ───────────────────────────────────────────────────────────
    private ResultadoAlgoritmo buildResultado(String nombre,
            double costoIni, double costoFin,
            double mejora, int iter, long ms,
            SolucionEstado sol,
            Map<String, Envio> envios,
            List<Integer> canceladosIds,
            Map<String, List<SolucionEstado.OccupancyEvent>> reservasAeropuerto,
            LocalDateTime tiempoPlanificacion,
            LocalDate fechaInicioRangoDia) {
        List<String> colapsados = sol.verificarCapacidadAeropuertos(reservasAeropuerto);
        int noAceptados = colapsados.size();

        // Add collapsed IDs to sol.idsNoAceptados just for getEnviosSinRuta
        // compatibility
        for (String c : colapsados) {
            if (!sol.getEnviosSinRuta().contains(c)) {
                sol.getEnviosSinRuta().add(c);
            }
        }

        double costoFinalAjustado = sol.evaluarCostoTotal();
        ResultadoAlgoritmo r = new ResultadoAlgoritmo();
        r.setAlgoritmo(nombre);
        r.setCostoInicial(costoIni);
        r.setCostoFinal(costoFinalAjustado);
        r.setMejoraRelativa(costoIni > 0 ? ((costoIni - costoFinalAjustado) / costoIni) * 100.0 : mejora);
        r.setIteraciones(iter);
        r.setTiempoEjecucionMs(ms);
        r.setEnviosAsignados(sol.getEnviosAsignados());
        r.setEnviosNoAceptados(noAceptados);
        r.setTotalEnvios(sol.getTotalEnvios());
        r.setMensajeColapso("");
        r.setVuelosCanceladosIds(canceladosIds);

        List<RutaMuestra> muestras = new ArrayList<>();
        int count = 0;
        for (Map.Entry<String, List<Vuelo>> e : sol.getAsignaciones().entrySet()) {
            if (count >= MAX_RUTAS_MUESTRA)
                break;
            Envio envio = envios.get(e.getKey());
            if (envio == null || e.getValue().isEmpty())
                continue;

            RutaMuestra rm = new RutaMuestra();
            rm.setEnvioId(envio.getId());
            rm.setOrigen(envio.getOrigen().getCodigo());
            rm.setDestino(envio.getDestino().getCodigo());
            rm.setMaletas(envio.getCantidadMaletas());
            rm.setSlaHoras(envio.getSlaHoras());
            LocalDateTime recepcionGMT = envio.getRecepcionGMT();
            rm.setRecepcionMinutosGMT(recepcionGMT.getHour() * 60 + recepcionGMT.getMinute());
            long recDia = ChronoUnit.DAYS.between(fechaInicioRangoDia, recepcionGMT.toLocalDate());
            rm.setRecepcionDiaOffset((int) recDia);

            LocalDateTime tiempoActual = (tiempoPlanificacion != null && tiempoPlanificacion.isAfter(recepcionGMT))
                    ? tiempoPlanificacion
                    : recepcionGMT;

            List<TramoDTO> tramos = new ArrayList<>();
            for (Vuelo v : e.getValue()) {
                LocalDateTime proximaSalida = v.getProximaSalidaGMT(tiempoActual, 30);
                LocalDateTime llegada = v.getLlegadaGMT(proximaSalida);
                tiempoActual = llegada;

                TramoDTO t = new TramoDTO();
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

                t.setSalidaMinutosGMT(proximaSalida.getHour() * 60 + proximaSalida.getMinute());
                t.setLlegadaMinutosGMT(llegada.getHour() * 60 + llegada.getMinute());

                int diaSalida = (int) ChronoUnit.DAYS.between(fechaInicioRangoDia, proximaSalida.toLocalDate());
                t.setDiaOffset(diaSalida);
                tramos.add(t);
            }
            rm.setTramos(tramos);
            muestras.add(rm);
            count++;
        }

        r.setRutasMuestra(muestras);
        return r;
    }

    private RutaResponseDTO clonarBaseResponse(RutaResponseDTO base, LocalDate dia) {
        String fechaStr = dia.format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        RutaResponseDTO c = new RutaResponseDTO();
        c.setEscenario(base.getEscenario());
        c.setTotalVuelos(base.getTotalVuelos());
        c.setAeropuertos(base.getAeropuertos());
        c.setFechaInicio(fechaStr);
        c.setFechaFin(fechaStr);
        c.setSa(base.getSa());
        c.setK(base.getK());
        return c;
    }

    private RutaResponseDTO clonarBaseResponse(RutaResponseDTO base, LocalDateTime loteInicio, LocalDateTime loteFin) {
        RutaResponseDTO c = clonarBaseResponse(base, loteInicio.toLocalDate());
        c.setLoteInicio(loteInicio.toString());
        c.setLoteFin(loteFin.toString());
        return c;
    }

    private String formatoLote(LocalDateTime loteInicio, LocalDateTime loteFin) {
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
        return loteInicio.format(fmt) + " - " + loteFin.format(fmt);
    }

    private AeropuertoDTO mapAeropuertoDTO(Aeropuerto a) {
        AeropuertoDTO dto = new AeropuertoDTO();
        dto.setCodigo(a.getCodigo());
        dto.setCiudad(a.getCiudad());
        dto.setPais(a.getPais());
        dto.setContinente(a.getContinente());
        dto.setLatitud(a.getLatitud());
        dto.setLongitud(a.getLongitud());
        dto.setCapacidadMax(a.getCapacidadMax());
        dto.setGmt(a.getGmt());
        return dto;
    }
}
