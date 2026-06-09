package com.loadroute.dto;

public class AeropuertoDTO {
    private String codigo;
    private String ciudad;
    private String pais;
    private String continente;
    private int gmt;
    private int capacidadMax;
    private double latitud;
    private double longitud;

    public AeropuertoDTO() {}

    public String getCodigo() { return codigo; }
    public void setCodigo(String codigo) { this.codigo = codigo; }

    public String getCiudad() { return ciudad; }
    public void setCiudad(String ciudad) { this.ciudad = ciudad; }

    public String getPais() { return pais; }
    public void setPais(String pais) { this.pais = pais; }

    public String getContinente() { return continente; }
    public void setContinente(String continente) { this.continente = continente; }

    public int getGmt() { return gmt; }
    public void setGmt(int gmt) { this.gmt = gmt; }

    public int getCapacidadMax() { return capacidadMax; }
    public void setCapacidadMax(int capacidadMax) { this.capacidadMax = capacidadMax; }

    public double getLatitud() { return latitud; }
    public void setLatitud(double latitud) { this.latitud = latitud; }

    public double getLongitud() { return longitud; }
    public void setLongitud(double longitud) { this.longitud = longitud; }
}
