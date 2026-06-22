package com.loadroute.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "envios", indexes = {
    @Index(name = "idx_fecha_creacion", columnList = "fecha_creacion")
})
public class EnvioEntity {

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

    public EnvioEntity() {}

    public EnvioEntity(String claveCompuesta, String clienteId, AeropuertoEntity origen,
                       AeropuertoEntity destino, LocalDateTime fechaCreacion, int cantidadMaletas) {
        this.claveCompuesta = claveCompuesta;
        this.clienteId = clienteId;
        this.origen = origen;
        this.destino = destino;
        this.fechaCreacion = fechaCreacion;
        this.cantidadMaletas = cantidadMaletas;
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
}
