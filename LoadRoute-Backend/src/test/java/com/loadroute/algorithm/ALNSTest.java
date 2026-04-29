package com.loadroute.algorithm;

import com.loadroute.algorithm.graph.RedLogistica;
import com.loadroute.algorithm.model.Aeropuerto;
import com.loadroute.algorithm.model.Envio;
import com.loadroute.algorithm.model.SolucionEstado;
import com.loadroute.algorithm.model.Vuelo;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ALNSTest {

    @Test
    void replanificarColapsoSoloBloqueaLaOcurrenciaCancelada() {
        Vuelo.resetContador();
        Aeropuerto origen = aeropuerto("AAA");
        Aeropuerto conexion = aeropuerto("CCC");
        Aeropuerto destino = aeropuerto("BBB");

        Vuelo vueloCancelado = new Vuelo(origen, destino, LocalTime.of(1, 0), LocalTime.of(3, 0), 100);
        Vuelo tramo1 = new Vuelo(origen, conexion, LocalTime.of(2, 0), LocalTime.of(4, 0), 100);
        Vuelo tramo2 = new Vuelo(conexion, destino, LocalTime.of(5, 0), LocalTime.of(7, 0), 100);

        RedLogistica red = new RedLogistica(
                List.of(origen, conexion, destino),
                List.of(vueloCancelado, tramo1, tramo2));

        Envio envio = new Envio(
                "E1",
                "C1",
                origen,
                destino,
                LocalDateTime.of(2026, 1, 1, 0, 0),
                10);
        Envio envioDiaSiguiente = new Envio(
                "E2",
                "C2",
                origen,
                destino,
                LocalDateTime.of(2026, 1, 2, 0, 0),
                10);
        Map<String, Envio> envios = new LinkedHashMap<>();
        envios.put(envio.getId(), envio);
        envios.put(envioDiaSiguiente.getId(), envioDiaSiguiente);

        SolucionEstado solucionActual = new SolucionEstado(envios);
        solucionActual.asignarRuta(envio.getId(), List.of(vueloCancelado));
        solucionActual.asignarRuta(envioDiaSiguiente.getId(), List.of(vueloCancelado));

        ALNS alns = new ALNS(red)
                .setMaxIteraciones(20)
                .setGradoDestruccion(1.0)
                .setTemperaturaInicial(50.0)
                .setTiempoMaxMinutos(1);

        SolucionEstado reparada = alns.replanificarColapso(
                solucionActual,
                List.of(vueloCancelado),
                Map.of(vueloCancelado.getId(), Set.of(LocalDate.of(2026, 1, 1))),
                envios);

        List<Vuelo> ruta = reparada.getRuta(envio.getId());
        assertFalse(ruta.isEmpty());
        assertFalse(ruta.stream().anyMatch(v -> v.getId() == vueloCancelado.getId()));
        assertTrue(ruta.stream().anyMatch(v -> v.getId() == tramo1.getId()));
        assertTrue(ruta.stream().anyMatch(v -> v.getId() == tramo2.getId()));

        List<Vuelo> rutaDiaSiguiente = reparada.getRuta(envioDiaSiguiente.getId());
        assertTrue(rutaDiaSiguiente.stream().anyMatch(v -> v.getId() == vueloCancelado.getId()));
        assertTrue(alns.getRouteCacheHits() > 0);
    }

    private static Aeropuerto aeropuerto(String codigo) {
        return new Aeropuerto(codigo, codigo, "PE", "america_sur", 0, 500, 0.0, 0.0);
    }
}
