package com.loadroute.controller;

import com.loadroute.dto.VueloDTO;
import com.loadroute.service.MaestroService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/vuelos")
@CrossOrigin(origins = "*")
public class VueloController {

    private final MaestroService maestroService;

    public VueloController(MaestroService maestroService) {
        this.maestroService = maestroService;
    }

    @GetMapping
    public ResponseEntity<List<VueloDTO>> listar() {
        return ResponseEntity.ok(maestroService.listarVuelos());
    }

    @GetMapping("/{id}")
    public ResponseEntity<VueloDTO> obtenerPorId(@PathVariable Long id) {
        return maestroService.obtenerVueloPorId(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<VueloDTO> crear(@RequestBody VueloDTO dto) {
        try {
            return ResponseEntity.ok(maestroService.crearVuelo(dto));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<VueloDTO> actualizar(@PathVariable Long id, @RequestBody VueloDTO dto) {
        try {
            return ResponseEntity.ok(maestroService.actualizarVuelo(id, dto));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        try {
            maestroService.eliminarVuelo(id);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }
}
