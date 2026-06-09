package com.loadroute.controller;

import com.loadroute.dto.AeropuertoDTO;
import com.loadroute.service.MaestroService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/aeropuertos")
@CrossOrigin(origins = "*")
public class AeropuertoController {

    private final MaestroService maestroService;

    public AeropuertoController(MaestroService maestroService) {
        this.maestroService = maestroService;
    }

    @GetMapping
    public ResponseEntity<List<AeropuertoDTO>> listar() {
        return ResponseEntity.ok(maestroService.listarAeropuertos());
    }

    @GetMapping("/{codigo}")
    public ResponseEntity<AeropuertoDTO> obtenerPorCodigo(@PathVariable String codigo) {
        return maestroService.obtenerAeropuertoPorCodigo(codigo)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<AeropuertoDTO> crear(@RequestBody AeropuertoDTO dto) {
        try {
            return ResponseEntity.ok(maestroService.crearAeropuerto(dto));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/{codigo}")
    public ResponseEntity<AeropuertoDTO> actualizar(@PathVariable String codigo, @RequestBody AeropuertoDTO dto) {
        try {
            return ResponseEntity.ok(maestroService.actualizarAeropuerto(codigo, dto));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{codigo}")
    public ResponseEntity<Object> eliminar(@PathVariable String codigo) {
        try {
            maestroService.eliminarAeropuerto(codigo);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (IllegalStateException e) {
            java.util.Map<String, String> response = new java.util.HashMap<>();
            response.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }
}
