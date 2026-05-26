package com.loadroute.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "aeropuertos")
public class AeropuertoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 4)
    private String codigo;

    private String ciudad;
    private String pais;
    private String continente;
    private int gmt;

    @Column(name = "capacidad_max")
    private int capacidadMax;

    private double latitud;
    private double longitud;

    public AeropuertoEntity() {}

    public AeropuertoEntity(String codigo, String ciudad, String pais, String continente,
                            int gmt, int capacidadMax, double latitud, double longitud) {
        this.codigo = codigo;
        this.ciudad = ciudad;
        this.pais = pais;
        this.continente = continente;
        this.gmt = gmt;
        this.capacidadMax = capacidadMax;
        this.latitud = latitud;
        this.longitud = longitud;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

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
