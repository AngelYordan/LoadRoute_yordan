package com.loadroute.dto;

import java.time.LocalTime;

public class VueloDTO {
    private Long id;
    private String origenCodigo;
    private String destinoCodigo;
    private LocalTime horaSalidaLocal;
    private LocalTime horaLlegadaLocal;
    private int capacidadMax;

    public VueloDTO() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getOrigenCodigo() { return origenCodigo; }
    public void setOrigenCodigo(String origenCodigo) { this.origenCodigo = origenCodigo; }

    public String getDestinoCodigo() { return destinoCodigo; }
    public void setDestinoCodigo(String destinoCodigo) { this.destinoCodigo = destinoCodigo; }

    public LocalTime getHoraSalidaLocal() { return horaSalidaLocal; }
    public void setHoraSalidaLocal(LocalTime horaSalidaLocal) { this.horaSalidaLocal = horaSalidaLocal; }

    public LocalTime getHoraLlegadaLocal() { return horaLlegadaLocal; }
    public void setHoraLlegadaLocal(LocalTime horaLlegadaLocal) { this.horaLlegadaLocal = horaLlegadaLocal; }

    public int getCapacidadMax() { return capacidadMax; }
    public void setCapacidadMax(int capacidadMax) { this.capacidadMax = capacidadMax; }
}
