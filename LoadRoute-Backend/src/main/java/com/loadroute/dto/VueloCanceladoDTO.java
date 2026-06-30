package com.loadroute.dto;

public class VueloCanceladoDTO {
    private Long id;
    private Long vueloId;
    private String fecha;

    public VueloCanceladoDTO() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getVueloId() { return vueloId; }
    public void setVueloId(Long vueloId) { this.vueloId = vueloId; }

    public String getFecha() { return fecha; }
    public void setFecha(String fecha) { this.fecha = fecha; }
}
