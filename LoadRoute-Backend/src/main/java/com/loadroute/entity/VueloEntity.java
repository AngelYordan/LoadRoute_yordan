package com.loadroute.entity;

import jakarta.persistence.*;
import java.time.LocalTime;

@Entity
@Table(name = "vuelos")
public class VueloEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "origen_id", nullable = false)
    private AeropuertoEntity origen;

    @ManyToOne(optional = false)
    @JoinColumn(name = "destino_id", nullable = false)
    private AeropuertoEntity destino;

    @Column(name = "hora_salida_local", nullable = false)
    private LocalTime horaSalidaLocal;

    @Column(name = "hora_llegada_local", nullable = false)
    private LocalTime horaLlegadaLocal;

    @Column(name = "capacidad_max", nullable = false)
    private int capacidadMax;

    public VueloEntity() {}

    public VueloEntity(AeropuertoEntity origen, AeropuertoEntity destino,
                       LocalTime horaSalidaLocal, LocalTime horaLlegadaLocal,
                       int capacidadMax) {
        this.origen = origen;
        this.destino = destino;
        this.horaSalidaLocal = horaSalidaLocal;
        this.horaLlegadaLocal = horaLlegadaLocal;
        this.capacidadMax = capacidadMax;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public AeropuertoEntity getOrigen() { return origen; }
    public void setOrigen(AeropuertoEntity origen) { this.origen = origen; }

    public AeropuertoEntity getDestino() { return destino; }
    public void setDestino(AeropuertoEntity destino) { this.destino = destino; }

    public LocalTime getHoraSalidaLocal() { return horaSalidaLocal; }
    public void setHoraSalidaLocal(LocalTime horaSalidaLocal) { this.horaSalidaLocal = horaSalidaLocal; }

    public LocalTime getHoraLlegadaLocal() { return horaLlegadaLocal; }
    public void setHoraLlegadaLocal(LocalTime horaLlegadaLocal) { this.horaLlegadaLocal = horaLlegadaLocal; }

    public int getCapacidadMax() { return capacidadMax; }
    public void setCapacidadMax(int capacidadMax) { this.capacidadMax = capacidadMax; }
}
