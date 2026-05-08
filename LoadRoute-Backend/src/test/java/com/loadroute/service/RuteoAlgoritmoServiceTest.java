package com.loadroute.service;

import com.loadroute.algorithm.model.Aeropuerto;
import com.loadroute.algorithm.model.Envio;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class RuteoAlgoritmoServiceTest {

    private final Aeropuerto origen = new Aeropuerto("SPIM", "Lima", "Peru", "america_sur", -5, 440, -12.0, -77.0);
    private final Aeropuerto destino = new Aeropuerto("SKBO", "Bogota", "Colombia", "america_sur", -5, 430, 4.7, -74.1);

    @Test
    void agrupaEnviosEnVentanasCronologicasDeCincoMinutos() {
        RuteoAlgoritmoService service = new RuteoAlgoritmoService();

        Envio cincoCeroCinco = envio("C", LocalDateTime.of(2026, 5, 1, 0, 5));
        Envio ceroCeroCuatro = envio("B", LocalDateTime.of(2026, 5, 1, 0, 4));
        Envio ceroCeroCero = envio("A", LocalDateTime.of(2026, 5, 1, 0, 0));
        Envio ceroCeroNueve = envio("D", LocalDateTime.of(2026, 5, 1, 0, 9));
        Envio ceroDiez = envio("E", LocalDateTime.of(2026, 5, 1, 0, 10));

        List<RuteoAlgoritmoService.LoteEnvios> lotes = service.agruparEnviosEnLotesCincoMinutos(
                List.of(cincoCeroCinco, ceroCeroCuatro, ceroCeroCero, ceroCeroNueve, ceroDiez)
        );

        assertThat(lotes).hasSize(3);
        assertThat(lotes.get(0).inicio()).isEqualTo(LocalDateTime.of(2026, 5, 1, 0, 0));
        assertThat(lotes.get(0).fin()).isEqualTo(LocalDateTime.of(2026, 5, 1, 0, 5));
        assertThat(lotes.get(0).envios().keySet()).containsExactly("A", "B");

        assertThat(lotes.get(1).inicio()).isEqualTo(LocalDateTime.of(2026, 5, 1, 0, 5));
        assertThat(lotes.get(1).envios().keySet()).containsExactly("C", "D");

        assertThat(lotes.get(2).inicio()).isEqualTo(LocalDateTime.of(2026, 5, 1, 0, 10));
        assertThat(lotes.get(2).envios().keySet()).containsExactly("E");
    }

    private Envio envio(String id, LocalDateTime recepcion) {
        return new Envio(id, "cliente-" + id, origen, destino, recepcion, 1);
    }
}
