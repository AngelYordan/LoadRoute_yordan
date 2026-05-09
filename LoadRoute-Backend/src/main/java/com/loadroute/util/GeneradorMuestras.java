package com.loadroute.util;

import com.loadroute.algorithm.ALNS;
import com.loadroute.algorithm.SimulatedAnnealing;
import com.loadroute.algorithm.graph.RedLogistica;
import com.loadroute.algorithm.model.Aeropuerto;
import com.loadroute.algorithm.model.Envio;
import com.loadroute.algorithm.model.SolucionEstado;
import com.loadroute.algorithm.model.Vuelo;
import com.loadroute.algorithm.parser.Parsers;

import java.io.*;
import java.util.*;

/**
 * Generador de muestras para experimentación numérica de SA y ALNS.
 * 
 * VERSIÓN FINAL PARA I-10000 (carga pesada):
 * - Capacidad de vuelos reducida al 10% de la original.
 * - Maletas multiplicadas por 10.
 * - Tamaño de instancia: 10.000 envíos (I-10000).
 * - Barajado de envíos en cada muestra (semilla = número de muestra).
 * 
 * Propósito: Demostrar que Simulated Annealing es significativamente más rápido
 * que ALNS en problemas de gran escala, manteniendo una calidad de solución comparable.
 */
public class GeneradorMuestras {

    public static void main(String[] args) {
        // --- CONFIGURACIÓN ---
        String archivoAeropuertos = "../c.1inf54.26.1.v1.Aeropuerto.husos.v1.20250818__estudiantes.txt";
        String archivoVuelos = "../planes_vuelo.txt";
        String carpetaPedidos = "../_envios_preliminar";
        
        // TAMAÑO DE INSTANCIA AUMENTADO A 10.000 ENVÍOS (carga realista)
        int TAMAÑO_INSTANCIA = 10000;
        String nombreArchivoSalida = "../muestras_experimento_I" + TAMAÑO_INSTANCIA + "_complejo.csv";
        int NUM_MUESTRAS = 30;
        int MULTIPLICADOR_MALETAS = 10;              // Demanda alta
        double FACTOR_REDUCCION_CAPACIDAD_VUELOS = 0.1; // 1/10 de la capacidad original

        try {
            System.out.println("=== Cargando datos para la experimentación (problema complejo, I-10000) ===");
            
            // 1. Cargar Aeropuertos
            File fAero = new File(archivoAeropuertos);
            if (!fAero.exists()) {
                System.err.println("Error: No se encuentra el archivo de aeropuertos: " + fAero.getAbsolutePath());
                return;
            }
            Map<String, Aeropuerto> aeropuertos = Parsers.parsearAeropuertos(new FileInputStream(fAero));

            // 2. Cargar Vuelos
            File fVuelos = new File(archivoVuelos);
            if (!fVuelos.exists()) {
                System.err.println("Error: No se encuentra el archivo de vuelos: " + fVuelos.getAbsolutePath());
                return;
            }
            List<Vuelo> vuelos = Parsers.parsearVuelos(new FileInputStream(fVuelos), aeropuertos);

            // Reducir capacidad de vuelos drásticamente
            System.out.println("\nReduciendo capacidad de vuelos al " + (FACTOR_REDUCCION_CAPACIDAD_VUELOS * 100) + "% para crear congestión severa...");
            int capacidadOriginalTotal = vuelos.stream().mapToInt(Vuelo::getCapacidadMax).sum();
            for (Vuelo v : vuelos) {
                int nuevaCapacidad = (int) Math.max(1, v.getCapacidadMax() * FACTOR_REDUCCION_CAPACIDAD_VUELOS);
                v.setCapacidadMax(nuevaCapacidad);
            }
            int capacidadNuevaTotal = vuelos.stream().mapToInt(Vuelo::getCapacidadMax).sum();
            System.out.println("- Capacidad total vuelos original: " + capacidadOriginalTotal);
            System.out.println("- Capacidad total vuelos nueva: " + capacidadNuevaTotal);

            // 3. Cargar TODOS los pedidos desde la carpeta "_envios_preliminar"
            File dirPedidos = new File(carpetaPedidos);
            if (!dirPedidos.exists() || !dirPedidos.isDirectory()) {
                System.err.println("Error: No se encuentra la carpeta de pedidos: " + dirPedidos.getAbsolutePath());
                return;
            }

            File[] archivos = dirPedidos.listFiles((dir, name) -> name.startsWith("_envios_") && name.endsWith(".txt"));
            if (archivos == null || archivos.length == 0) {
                System.err.println("Error: No se encontraron archivos de pedidos en " + dirPedidos.getAbsolutePath());
                return;
            }

            Map<String, Envio> todosEnvios = new LinkedHashMap<>();
            System.out.println("Cargando " + archivos.length + " archivos de pedidos...");
            for (File archivo : archivos) {
                System.out.print("  - " + archivo.getName() + " ... ");
                Map<String, Envio> enviosArchivo = Parsers.parsearEnvios(new FileInputStream(archivo), archivo.getName(), aeropuertos, 0);
                todosEnvios.putAll(enviosArchivo);
                System.out.println(enviosArchivo.size() + " envíos");
            }

            if (todosEnvios.isEmpty()) {
                System.err.println("Error: No se cargaron envíos. Verifica el formato de los archivos.");
                return;
            }

            // Tomar los últimos N envios (máximo TAMAÑO_INSTANCIA)
            List<String> keys = new ArrayList<>(todosEnvios.keySet());
            int start = Math.max(0, keys.size() - TAMAÑO_INSTANCIA);
            int tamañoReal = keys.size() - start;
            
            Map<String, Envio> enviosBase = new LinkedHashMap<>();
            for (int i = start; i < keys.size(); i++) {
                String k = keys.get(i);
                enviosBase.put(k, todosEnvios.get(k));
            }
            
            // Multiplicar maletas
            System.out.println("\nMultiplicando maletas x" + MULTIPLICADOR_MALETAS + " para saturar vuelos y aeropuertos...");
            int totalMaletasOriginal = 0;
            int totalMaletasNuevas = 0;
            for (Envio e : enviosBase.values()) {
                totalMaletasOriginal += e.getCantidadMaletas();
                e.setCantidadMaletas(e.getCantidadMaletas() * MULTIPLICADOR_MALETAS);
                totalMaletasNuevas += e.getCantidadMaletas();
            }
            System.out.println("- Maletas originales: " + totalMaletasOriginal);
            System.out.println("- Maletas después: " + totalMaletasNuevas);

            System.out.println("\nDatos cargados correctamente:");
            System.out.println("- Aeropuertos: " + aeropuertos.size());
            System.out.println("- Vuelos: " + vuelos.size());
            System.out.println("- Total envíos en carpeta: " + todosEnvios.size());
            System.out.println("- Envíos seleccionados (final): " + enviosBase.size());
            System.out.println("- Instancia: I" + tamañoReal);
            
            // Mostrar capacidades finales
            int totalCapacidadVuelos = vuelos.stream().mapToInt(Vuelo::getCapacidadMax).sum();
            System.out.println("\n=== CAPACIDADES FINALES ===");
            System.out.println("- Capacidad total VUELOS: " + totalCapacidadVuelos + " maletas");
            System.out.println("- Demanda total maletas: " + totalMaletasNuevas);
            System.out.println("- Ratio capacidad/demanda (vuelos): " + String.format("%.2f", (double)totalCapacidadVuelos / totalMaletasNuevas));
            
            int totalCapacidadAeros = 0;
            for (Aeropuerto a : aeropuertos.values()) {
                totalCapacidadAeros += a.getCapacidadMax();
            }
            System.out.println("- Capacidad total AEROPUERTOS: " + totalCapacidadAeros + " maletas");
            System.out.println("- Ratio capacidad/demanda (aeropuertos): " + String.format("%.2f", (double)totalCapacidadAeros / totalMaletasNuevas));

            // 4. Construir Red Logística
            RedLogistica red = new RedLogistica(aeropuertos.values(), vuelos);

            // 5. Iniciar Muestreo
            try (PrintWriter writer = new PrintWriter(new FileWriter(nombreArchivoSalida))) {
                writer.println("Muestra_N,Algoritmo,Instancia,Tiempo_ms,Envios_Atendidos,Porcentaje_Atendidos,Costo_Final");

                // --- SIMULATED ANNEALING ---
                System.out.println("\nIniciando muestreo de Simulated Annealing (30 muestras) en problema complejo con I-" + tamañoReal + "...");
                for (int i = 1; i <= NUM_MUESTRAS; i++) {
                    for (Vuelo v : vuelos) v.setCapacidadOcupada(0);
                    
                    List<Envio> listaEnvios = new ArrayList<>(enviosBase.values());
                    Collections.shuffle(listaEnvios, new Random(i));
                    Map<String, Envio> enviosBarajados = new LinkedHashMap<>();
                    for (Envio e : listaEnvios) enviosBarajados.put(e.getId(), e);
                    
                    SimulatedAnnealing sa = new SimulatedAnnealing(red)
                            .setTemperaturaInicial(1000.0)
                            .setAlfa(0.995)
                            .setTemperaturaMinima(1.0)
                            .setTiempoMaxMinutos(5);

                    long tInicio = System.currentTimeMillis();
                    SolucionEstado sol = sa.optimizar(enviosBarajados);
                    long tFin = System.currentTimeMillis();
                    
                    sol.aplicarRestriccionCapacidadAeropuertos();
                    
                    int enviosAtendidos = sol.getEnviosAsignados();
                    int totalEnvios = sol.getTotalEnvios();
                    double porcentaje = (totalEnvios > 0) ? (100.0 * enviosAtendidos / totalEnvios) : 0.0;
                    double costo = sol.evaluarCostoTotal();
                    
                    writer.println(i + ",SA,I" + tamañoReal + "," + (tFin - tInicio) + "," + 
                                   enviosAtendidos + "," + String.format("%.2f", porcentaje) + "," + costo);
                    
                    if (i == 1 || i == 30) {
                        System.out.println("\n  [DEBUG SA #" + i + "] Atendidos=" + enviosAtendidos + "/" + totalEnvios + 
                                         " Tiempo=" + (tFin - tInicio) + "ms Costo=" + costo);
                    } else {
                        System.out.print(".");
                    }
                }
                System.out.println(" OK");

                // --- ALNS ---
                System.out.println("Iniciando muestreo de ALNS (30 muestras) en problema complejo con I-" + tamañoReal + "...");
                for (int i = 1; i <= NUM_MUESTRAS; i++) {
                    for (Vuelo v : vuelos) v.setCapacidadOcupada(0);
                    
                    List<Envio> listaEnvios = new ArrayList<>(enviosBase.values());
                    Collections.shuffle(listaEnvios, new Random(i));
                    Map<String, Envio> enviosBarajados = new LinkedHashMap<>();
                    for (Envio e : listaEnvios) enviosBarajados.put(e.getId(), e);

                    ALNS alns = new ALNS(red)
                            .setMaxIteraciones(500)
                            .setGradoDestruccion(0.25)
                            .setTemperaturaInicial(200.0)
                            .setTiempoMaxMinutos(5);

                    long tInicio = System.currentTimeMillis();
                    SolucionEstado sol = alns.optimizarDesdeGreedy(enviosBarajados);
                    long tFin = System.currentTimeMillis();

                    sol.aplicarRestriccionCapacidadAeropuertos();
                    
                    int enviosAtendidos = sol.getEnviosAsignados();
                    int totalEnvios = sol.getTotalEnvios();
                    double porcentaje = (totalEnvios > 0) ? (100.0 * enviosAtendidos / totalEnvios) : 0.0;
                    double costo = sol.evaluarCostoTotal();
                    
                    writer.println(i + ",ALNS,I" + tamañoReal + "," + (tFin - tInicio) + "," + 
                                   enviosAtendidos + "," + String.format("%.2f", porcentaje) + "," + costo);
                    
                    if (i == 1 || i == 30) {
                        System.out.println("\n  [DEBUG ALNS #" + i + "] Atendidos=" + enviosAtendidos + "/" + totalEnvios + 
                                         " Tiempo=" + (tFin - tInicio) + "ms Costo=" + costo);
                    } else {
                        System.out.print(".");
                    }
                }
                System.out.println(" OK");

                System.out.println("\n¡Muestreo finalizado! Datos guardados en: " + nombreArchivoSalida);
            }
        } catch (Exception e) {
            System.err.println("Error durante la experimentación: " + e.getMessage());
            e.printStackTrace();
        }
    }
}