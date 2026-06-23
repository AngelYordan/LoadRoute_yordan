package com.loadroute.controller;

import com.loadroute.entity.EnvioDiaADiaEntity;
import com.loadroute.service.CargaDatosService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/rutas/dia-a-dia")
@CrossOrigin(origins = "*")
public class EnvioDiaADiaController {

    private final CargaDatosService cargaDatosService;

    public EnvioDiaADiaController(CargaDatosService cargaDatosService) {
        this.cargaDatosService = cargaDatosService;
    }

    @GetMapping("/envios")
    public ResponseEntity<List<EnvioDiaADiaEntity>> obtenerEnvios() {
        return ResponseEntity.ok(cargaDatosService.obtenerEnviosDiaADiaTodos());
    }

    @PostMapping("/cargar-archivo")
    public ResponseEntity<Map<String, Object>> cargarArchivo(
            @RequestParam("file") MultipartFile file
    ) throws IOException {
        int count = cargaDatosService.cargarEnviosDiaADiaDesdeArchivo(file);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Se cargaron " + count + " envíos exitosamente.",
                "count", count
        ));
    }

    @PostMapping("/crear")
    public ResponseEntity<Map<String, Object>> crearEnvio(
            @RequestBody Map<String, Object> body
    ) {
        String clienteId = (String) body.get("clienteId");
        String origenCodigo = (String) body.get("origenCodigo");
        String destinoCodigo = (String) body.get("destinoCodigo");
        String fechaStr = (String) body.get("fechaCreacionLocal");
        int cantidadMaletas = ((Number) body.get("cantidadMaletas")).intValue();

        LocalDateTime fechaCreacionLocal = LocalDateTime.parse(fechaStr);

        cargaDatosService.crearEnvioDiaADiaManual(clienteId, origenCodigo, destinoCodigo, fechaCreacionLocal, cantidadMaletas);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Envío creado exitosamente."
        ));
    }

    @DeleteMapping("/limpiar")
    public ResponseEntity<Void> limpiar() {
        cargaDatosService.limpiarEnviosDiaADia();
        return ResponseEntity.noContent().build();
    }
}
