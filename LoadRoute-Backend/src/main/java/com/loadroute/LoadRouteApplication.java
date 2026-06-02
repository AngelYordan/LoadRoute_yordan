package com.loadroute;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Aplicación principal de LoadRoute - PoC de Sistema de Planificación Logística
 * 
 * Expone APIs REST para carga de datos en MySQL y simulacion de ruteo:
 * - POST /api/rutas/simular
 * - POST /api/rutas/simular-async
 * - GET /api/rutas/health
 */
@SpringBootApplication
public class LoadRouteApplication {

    public static void main(String[] args) {
        SpringApplication.run(LoadRouteApplication.class, args);
    }
}
