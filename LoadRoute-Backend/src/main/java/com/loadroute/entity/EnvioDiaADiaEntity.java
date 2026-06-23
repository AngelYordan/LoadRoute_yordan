package com.loadroute.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "envios_dia_a_dia", indexes = {
    @Index(name = "idx_fecha_creacion_dia", columnList = "fecha_creacion"),
    @Index(name = "idx_ruta_definida_dia", columnList = "ruta_definida")
})
public class EnvioDiaADiaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "clave_compuesta", unique = true, nullable = false)
    private String claveCompuesta;

    @Column(name = "cliente_id")
    private String clienteId;

    @ManyToOne(optional = false)
    @JoinColumn(name = "origen_id", nullable = false)
    private AeropuertoEntity origen;

    @ManyToOne(optional = false)
    @JoinColumn(name = "destino_id", nullable = false)
    private AeropuertoEntity destino;

    @Column(name = "fecha_creacion", nullable = false)
    private LocalDateTime fechaCreacion;

    @Column(name = "cantidad_maletas", nullable = false)
    private int cantidadMaletas;

    @Column(name = "ruta_definida", nullable = false)
    private boolean rutaDefinida = false;

    public EnvioDiaADiaEntity() {}

    public EnvioDiaADiaEntity(String claveCompuesta, String clienteId, AeropuertoEntity origen,
                              AeropuertoEntity destino, LocalDateTime fechaCreacion, int cantidadMaletas, boolean rutaDefinida) {
        this.claveCompuesta = claveCompuesta;
        this.clienteId = clienteId;
        this.origen = origen;
        this.destino = destino;
        this.fechaCreacion = fechaCreacion;
        this.cantidadMaletas = cantidadMaletas;
        this.rutaDefinida = rutaDefinida;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getClaveCompuesta() { return claveCompuesta; }
    public void setClaveCompuesta(String claveCompuesta) { this.claveCompuesta = claveCompuesta; }

    public String getClienteId() { return clienteId; }
    public void setClienteId(String clienteId) { this.clienteId = clienteId; }

    public AeropuertoEntity getOrigen() { return origen; }
    public void setOrigen(AeropuertoEntity origen) { this.origen = origen; }

    public AeropuertoEntity getDestino() { return destino; }
    public void setDestino(AeropuertoEntity destino) { this.destino = destino; }

    public LocalDateTime getFechaCreacion() { return fechaCreacion; }
    public void setFechaCreacion(LocalDateTime fechaCreacion) { this.fechaCreacion = fechaCreacion; }

    public int getCantidadMaletas() { return cantidadMaletas; }
    public void setCantidadMaletas(int cantidadMaletas) { this.cantidadMaletas = cantidadMaletas; }

    public boolean isRutaDefinida() { return rutaDefinida; }
    public void setRutaDefinida(boolean rutaDefinida) { this.rutaDefinida = rutaDefinida; }
}
