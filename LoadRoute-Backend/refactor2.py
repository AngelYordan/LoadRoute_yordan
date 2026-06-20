import re

with open('src/main/java/com/loadroute/service/RuteoAsyncJobService.java', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add ScheduledExecutor for simulations
content = content.replace('private final ScheduledExecutorService cleanupExecutor = Executors.newSingleThreadScheduledExecutor();',
'''private final ScheduledExecutorService cleanupExecutor = Executors.newSingleThreadScheduledExecutor();
    private final ScheduledExecutorService simExecutor = Executors.newScheduledThreadPool(10);
    private final Map<String, java.util.concurrent.ScheduledFuture<?>> simTasks = new ConcurrentHashMap<>();''')

# 2. Modify iniciar
old_iniciar = '''        executor.submit(() -> {
            update(jobId, "RUNNING", 5, "Cargando datos e iniciando simulacion...");
            try {
                List<RutaResponseDTO> returnedChunks = ruteoService.ejecutarRuteo(
                        null,
                        null,
                        null,
                        escenario,
                        fechaInicio,
                        fechaFin,
                        new RuteoAlgoritmoService.ProgressReporter() {
                            @Override
                            public void update(int progress, String message) {
                                RuteoAsyncJobService.this.update(jobId, "RUNNING", progress, message);
                            }
                            @Override
                            public void onChunk(RutaResponseDTO chunk) {
                                SimulacionJobDTO current = jobs.get(jobId);
                                if (current != null) {
                                    current.addChunk(chunk);
                                }
                            }
                        }
                );
                SimulacionJobDTO current = jobs.get(jobId);
                if (current != null && current.getChunks().isEmpty() && returnedChunks != null) {
                    for (RutaResponseDTO chunk : returnedChunks) current.addChunk(chunk);
                }
                current = jobs.get(jobId);
                if (current != null) {
                    current.setStatus("DONE");
                    current.setProgress(100);
                    current.setMessage("Simulacion completada.");
                    finishedAt.put(jobId, System.currentTimeMillis());
                    messagingTemplate.convertAndSend("/topic/simulacion", "{\\"event\\": \\"SIMULACION_FINALIZADA\\", \\"jobId\\": \\"" + jobId + "\\"}");
                }
            } catch (Exception e) {
                SimulacionJobDTO current = jobs.get(jobId);
                if (current != null) {
                    current.setStatus("ERROR");
                    current.setProgress(100);
                    current.setMessage("La simulacion fallo.");
                    current.setError(e.getMessage());
                    finishedAt.put(jobId, System.currentTimeMillis());
                    messagingTemplate.convertAndSend("/topic/simulacion", "{\\"event\\": \\"SIMULACION_ERROR\\", \\"jobId\\": \\"" + jobId + "\\"}");
                }
            }
        });'''

new_iniciar = '''        executor.submit(() -> {
            update(jobId, "RUNNING", 5, "Cargando datos e preparando simulacion periodica...");
            try {
                RuteoAlgoritmoService.SimulacionIterator iterator = ruteoService.prepararIteradorRuteo(
                        null, null, null, escenario, fechaInicio, fechaFin,
                        (progress, message) -> RuteoAsyncJobService.this.update(jobId, "RUNNING", progress, message)
                );
                
                update(jobId, "RUNNING", 35, "Ejecutando primer salto (Sc)...");
                
                java.util.concurrent.ScheduledFuture<?> task = simExecutor.scheduleAtFixedRate(() -> {
                    try {
                        if (!iterator.hasNext()) {
                            SimulacionJobDTO current = jobs.get(jobId);
                            if (current != null) {
                                current.setStatus("DONE");
                                current.setProgress(100);
                                current.setMessage("Simulacion completada.");
                                finishedAt.put(jobId, System.currentTimeMillis());
                                messagingTemplate.convertAndSend("/topic/simulacion", "{\\"event\\": \\"SIMULACION_FINALIZADA\\", \\"jobId\\": \\"" + jobId + "\\"}");
                            }
                            cancelarTarea(jobId);
                            return;
                        }

                        RutaResponseDTO chunk = iterator.nextChunk();
                        if (chunk != null) {
                            SimulacionJobDTO current = jobs.get(jobId);
                            if (current != null) current.addChunk(chunk);
                        }

                        if (iterator.hasColapsado()) {
                            SimulacionJobDTO current = jobs.get(jobId);
                            if (current != null) {
                                current.setStatus("ERROR");
                                current.setProgress(100);
                                current.setMessage(iterator.getMensajeColapso());
                                current.setError(iterator.getMensajeColapso());
                                finishedAt.put(jobId, System.currentTimeMillis());
                                messagingTemplate.convertAndSend("/topic/simulacion", "{\\"event\\": \\"SIMULACION_ERROR\\", \\"jobId\\": \\"" + jobId + "\\"}");
                            }
                            cancelarTarea(jobId);
                        }

                    } catch (Exception ex) {
                        SimulacionJobDTO current = jobs.get(jobId);
                        if (current != null) {
                            current.setStatus("ERROR");
                            current.setProgress(100);
                            current.setMessage("Fallo iteracion.");
                            current.setError(ex.getMessage());
                            finishedAt.put(jobId, System.currentTimeMillis());
                        }
                        cancelarTarea(jobId);
                    }
                }, 0, 5, TimeUnit.MINUTES);
                
                simTasks.put(jobId, task);

            } catch (Exception e) {
                SimulacionJobDTO current = jobs.get(jobId);
                if (current != null) {
                    current.setStatus("ERROR");
                    current.setProgress(100);
                    current.setMessage("La simulacion fallo al iniciar.");
                    current.setError(e.getMessage());
                    finishedAt.put(jobId, System.currentTimeMillis());
                    messagingTemplate.convertAndSend("/topic/simulacion", "{\\"event\\": \\"SIMULACION_ERROR\\", \\"jobId\\": \\"" + jobId + "\\"}");
                }
            }
        });'''
content = content.replace(old_iniciar, new_iniciar)

# 3. Handle task cancellation
content = content.replace('finishedAt.remove(jobId);\n        return jobs.remove(jobId) != null;',
'''finishedAt.remove(jobId);
        cancelarTarea(jobId);
        return jobs.remove(jobId) != null;''')

content = content.replace('private void update(String jobId, String status, int progress, String message)',
'''private void cancelarTarea(String jobId) {
        java.util.concurrent.ScheduledFuture<?> task = simTasks.remove(jobId);
        if (task != null) {
            task.cancel(true);
        }
    }

    private void update(String jobId, String status, int progress, String message)''')

content = content.replace('jobs.remove(entry.getKey());', 'jobs.remove(entry.getKey());\n                cancelarTarea(entry.getKey());')

content = content.replace('cleanupExecutor.shutdownNow();', 'cleanupExecutor.shutdownNow();\n        simExecutor.shutdownNow();')

with open('src/main/java/com/loadroute/service/RuteoAsyncJobService.java', 'w', encoding='utf-8') as f:
    f.write(content)
