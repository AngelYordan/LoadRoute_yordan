package com.loadroute.service;

import com.loadroute.algorithm.*;
import com.loadroute.algorithm.graph.RedLogistica;
import com.loadroute.algorithm.model.*;
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

    @FunctionalInterface
    public interface ProgressReporter {
        void update(int progress, String message);
        default void onChunk(RutaResponseDTO chunk) {}
    }

    private static final DateTimeFormatter FMT_FECHA = DateTimeFormatter.ofPattern("yyyyMMdd");
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
        report(progress, 8, "Parseando archivos de datos...");
        LOG.info("Parseando archivos de datos...");
        Map<String, Aeropuerto> aeropuertos = Parsers.parsearAeropuertos(aeropuertosIS);
        List<Vuelo>             vuelos      = Parsers.parsearVuelos(vuelosIS, aeropuertos);
        report(progress, 18, "Aeropuertos y vuelos cargados. Leyendo envios...");

        LocalDateTime inicioFiltro = fechaInicio != null ? parsearFechaInicio(fechaInicio) : null;
        LocalDateTime finFiltro    = fechaFin    != null ? parsearFechaFin(fechaFin)       : null;
        Map<String, Envio> envios  = new LinkedHashMap<>();
        for (MultipartFile file : enviosFiles) {
            String filename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "_envios_XXXX_.txt";
            envios.putAll(Parsers.parsearEnvios(file.getInputStream(), filename, aeropuertos, 0, inicioFiltro, finFiltro));
        }

        report(progress, 30, String.format("Filtro aplicado: %d envios en el rango.", envios.size()));
        LOG.info(String.format("Datos cargados: %d aeropuertos | %d vuelos | %d envios",
            aeropuertos.size(), vuelos.size(), envios.size()));

        if (envios.isEmpty()) {
            LOG.warning("No hay envíos para el rango de fechas especificado.");
            RutaResponseDTO vacía = new RutaResponseDTO();
            vacía.setEscenario(escenario);
            vacía.setTotalEnviosCargados(0);
            return Collections.singletonList(vacía);
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
            aeropuertos.values().stream().map(this::mapAeropuertoDTO).collect(Collectors.toList())
        );

        Map<LocalDate, Map<String, Envio>> enviosPorDia = agruparEnviosPorDia(envios);
        NavigableMap<LocalDateTime, Map<String, Envio>> enviosPorLotePeriodo = agruparEnviosPorLotePeriodo(envios);

        LocalDateTime fechaInicioRango    = parsearFechaInicio(fechaInicio);
        LocalDate     fechaInicioRangoDia = fechaInicioRango.toLocalDate();
        List<RutaResponseDTO> chunks;
        switch (escenario) {
            case 2  -> chunks = ejecutarEscenario2(enviosPorDia, aeropuertos.values(), vuelos, response, progress, fechaInicioRangoDia);
            case 3  -> chunks = ejecutarEscenario3(enviosPorDia, aeropuertos.values(), vuelos, response, progress, fechaInicioRangoDia);
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
    }

    private void report(ProgressReporter progress, int pct, String message) {
        if (progress != null) progress.update(pct, message);
    }

    private void retirarEnviosProcesados(Map<String, Envio> pendientes, SolucionEstado sol) {
        for (String id : sol.getIdsAsignados()) pendientes.remove(id);
        for (String id : sol.getIdsNoAceptados()) pendientes.remove(id);
        for (String id : sol.getEnviosSinRuta()) pendientes.remove(id);
    }

    private List<Vuelo> clonarVuelos(List<Vuelo> originales) {
        List<Vuelo> copia = new ArrayList<>();
        for (Vuelo v : originales) copia.add(v.clonar());
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

    private NavigableMap<LocalDateTime, Map<String, Envio>> agruparEnviosPorLotePeriodo(Map<String, Envio> envios) {
        NavigableMap<LocalDateTime, Map<String, Envio>> enviosPorLote = new TreeMap<>();
        for (Envio envio : ordenarEnviosCronologicamente(envios)) {
            LocalDateTime inicioLote = inicioLotePeriodo(envio.getFechaHoraRecepcion());
            enviosPorLote.computeIfAbsent(inicioLote, k -> new LinkedHashMap<>()).put(envio.getId(), envio);
        }
        return enviosPorLote;
    }

    List<Map<String, Envio>> agruparEnviosEnLotesCincoMinutos(Collection<Envio> envios) {
        Map<String, Envio> enviosMap = new LinkedHashMap<>();
        for (Envio envio : envios) enviosMap.put(envio.getId(), envio);
        return new ArrayList<>(agruparEnviosPorLotePeriodo(enviosMap).values());
    }

    private List<Envio> ordenarEnviosCronologicamente(Map<String, Envio> envios) {
        return envios.values().stream()
                .sorted(Comparator.comparing(Envio::getFechaHoraRecepcion).thenComparing(Envio::getId))
                .collect(Collectors.toList());
    }

    private LocalDateTime inicioLotePeriodo(LocalDateTime recepcion) {
        int minutoLote = (recepcion.getMinute() / MINUTOS_LOTE_PERIODO) * MINUTOS_LOTE_PERIODO;
        return recepcion.truncatedTo(ChronoUnit.HOURS).plusMinutes(minutoLote);
    }

    Map<String, Envio> filtrarEnviosPorFecha(Map<String, Envio> envios, String fechaInicio, String fechaFin) {
        if (fechaInicio == null && fechaFin == null) return envios;
        LocalDateTime inicio = parsearFechaInicio(fechaInicio);
        LocalDateTime fin    = parsearFechaFin(fechaFin);
        return envios.entrySet().stream()
            .filter(e -> {
                LocalDateTime rec = e.getValue().getFechaHoraRecepcion();
                return !rec.isBefore(inicio) && !rec.isAfter(fin);
            })
            .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue, (a, b) -> a, LinkedHashMap::new));
    }

    private LocalDateTime parsearFechaInicio(String fecha) {
        if (fecha == null) return LocalDateTime.of(1900, 1, 1, 0, 0);
        try { return LocalDate.parse(fecha, FMT_FECHA).atStartOfDay(); }
        catch (DateTimeParseException e) { return LocalDateTime.of(1900, 1, 1, 0, 0); }
    }

    private LocalDateTime parsearFechaFin(String fecha) {
        if (fecha == null) return LocalDateTime.of(2099, 12, 31, 23, 59, 59);
        try { return LocalDate.parse(fecha, FMT_FECHA).atTime(23, 59, 59); }
        catch (DateTimeParseException e) { return LocalDateTime.of(2099, 12, 31, 23, 59, 59); }
    }

    // ── ESCENARIO 1: Simulación de Periodo (SA) ──────────────────────────────
    private List<RutaResponseDTO> ejecutarEscenario1(NavigableMap<LocalDateTime, Map<String, Envio>> enviosPorLote,
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
    }

    // ── ESCENARIO 2: Operación Día a Día (SA) ────────────────────────────────
    private List<RutaResponseDTO> ejecutarEscenario2(Map<LocalDate, Map<String, Envio>> enviosPorDia,
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
    }

    // ── ESCENARIO 3: Colapso Progresivo (SA) ─────────────────────────────────
    private List<RutaResponseDTO> ejecutarEscenario3(Map<LocalDate, Map<String, Envio>> enviosPorDia,
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
                    canceladosSA.add(restantesSA.remove(0).getId());
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
    }

    // ── MAPEO A DTO ───────────────────────────────────────────────────────────
    private ResultadoAlgoritmo buildResultado(String nombre,
                                               double costoIni, double costoFin,
                                               double mejora, int iter, long ms,
                                               SolucionEstado sol,
                                               Map<String, Envio> envios,
                                               int diaOffset,
                                               List<Integer> canceladosIds,
                                               Map<String, List<SolucionEstado.OccupancyEvent>> reservasAeropuerto) {
        sol.aplicarRestriccionCapacidadAeropuertos(reservasAeropuerto);
        int noAceptados = sol.getEnviosSinRuta().size();
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
            if (count >= MAX_RUTAS_MUESTRA) break;
            Envio envio = envios.get(e.getKey());
            if (envio == null || e.getValue().isEmpty()) continue;

            RutaMuestra rm = new RutaMuestra();
            rm.setEnvioId(envio.getId());
            rm.setOrigen(envio.getOrigen().getCodigo());
            rm.setDestino(envio.getDestino().getCodigo());
            rm.setMaletas(envio.getCantidadMaletas());
            rm.setSlaHoras(envio.getSlaHoras());
            LocalDateTime recepcionGMT = envio.getRecepcionGMT();
            rm.setRecepcionMinutosGMT(recepcionGMT.getHour() * 60 + recepcionGMT.getMinute());
            rm.setRecepcionDiaOffset(diaOffset);

            List<TramoDTO> tramos = new ArrayList<>();
            for (Vuelo v : e.getValue()) {
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
                t.setSalidaMinutosGMT(v.getSalidaMinutosGMT());
                t.setLlegadaMinutosGMT(v.getLlegadaMinutosGMT());
                t.setDiaOffset(diaOffset);
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
