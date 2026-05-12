package com.loadroute.controller;

import com.loadroute.dto.RutaResponseDTO;
import com.loadroute.dto.SimulacionJobDTO;
import com.loadroute.service.RuteoAsyncJobService;
import com.loadroute.service.RuteoAlgoritmoService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

/**
 * Controlador REST para los endpoints de ruteo de Tasf.B2B.
 * Todos los escenarios usan Simulated Annealing (SA).
 */
@RestController
@RequestMapping("/api/rutas")
@CrossOrigin(origins = "*")
public class RutasController {

    private final RuteoAlgoritmoService ruteoService;
    private final RuteoAsyncJobService asyncJobService;

    public RutasController(RuteoAlgoritmoService ruteoService, RuteoAsyncJobService asyncJobService) {
        this.ruteoService = ruteoService;
        this.asyncJobService = asyncJobService;
    }

    @GetMapping("/health")
    public ResponseEntity<String> health() {
        return ResponseEntity.ok("OK");
    }

    @PostMapping("/simular")
    public ResponseEntity<List<RutaResponseDTO>> simular(
            @RequestPart("aeropuertosFile") MultipartFile aeropuertosFile,
            @RequestPart("vuelosFile")      MultipartFile vuelosFile,
            @RequestPart("enviosFiles")     List<MultipartFile> enviosFiles,
            @RequestParam(value = "escenario",   defaultValue = "1") int escenario,
            @RequestParam(value = "fechaInicio", required = false)    String fechaInicio,
            @RequestParam(value = "fechaFin",    required = false)    String fechaFin
    ) throws IOException {
        List<RutaResponseDTO> response = ruteoService.ejecutarRuteo(
                aeropuertosFile.getInputStream(),
                vuelosFile.getInputStream(),
                enviosFiles,
                escenario,
                fechaInicio,
                fechaFin
        );
        return ResponseEntity.ok(response);
    }

    @PostMapping("/simular-async")
    public ResponseEntity<SimulacionJobDTO> simularAsync(
            @RequestPart("aeropuertosFile") MultipartFile aeropuertosFile,
            @RequestPart("vuelosFile")      MultipartFile vuelosFile,
            @RequestPart("enviosFiles")     List<MultipartFile> enviosFiles,
            @RequestParam(value = "escenario",   defaultValue = "1") int escenario,
            @RequestParam(value = "fechaInicio", required = false)    String fechaInicio,
            @RequestParam(value = "fechaFin",    required = false)    String fechaFin
    ) throws IOException {
        return ResponseEntity.ok(asyncJobService.iniciar(
                aeropuertosFile,
                vuelosFile,
                enviosFiles,
                escenario,
                fechaInicio,
                fechaFin
        ));
    }

    @GetMapping("/simular-async/{jobId}")
    public ResponseEntity<SimulacionJobDTO> estadoSimulacion(@PathVariable String jobId) {
        SimulacionJobDTO job = asyncJobService.obtenerEstado(jobId);
        return job != null ? ResponseEntity.ok(job) : ResponseEntity.notFound().build();
    }

    @GetMapping("/simular-async/{jobId}/chunks")
    public ResponseEntity<SimulacionJobDTO> chunksSimulacion(
            @PathVariable String jobId,
            @RequestParam(value = "desde", defaultValue = "0") int desde
    ) {
        SimulacionJobDTO job = asyncJobService.obtenerChunks(jobId, desde);
        return job != null ? ResponseEntity.ok(job) : ResponseEntity.notFound().build();
    }

    @DeleteMapping("/simular-async/{jobId}")
    public ResponseEntity<Void> eliminarSimulacion(@PathVariable String jobId) {
        return asyncJobService.eliminar(jobId)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }
}
