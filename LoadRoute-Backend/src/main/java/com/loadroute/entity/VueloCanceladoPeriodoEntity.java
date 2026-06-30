package com.loadroute.entity;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "vuelos_cancelados_periodo", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"vuelo_id", "fecha"})
})
public class VueloCanceladoPeriodoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "vuelo_id", nullable = false)
    private VueloEntity vuelo;

    @Column(name = "fecha", nullable = false)
    private LocalDate fecha;

    public VueloCanceladoPeriodoEntity() {}

    public VueloCanceladoPeriodoEntity(VueloEntity vuelo, LocalDate fecha) {
        this.vuelo = vuelo;
        this.fecha = fecha;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public VueloEntity getVuelo() { return vuelo; }
    public void setVuelo(VueloEntity vuelo) { this.vuelo = vuelo; }

    public LocalDate getFecha() { return fecha; }
    public void setFecha(LocalDate fecha) { this.fecha = fecha; }
}
