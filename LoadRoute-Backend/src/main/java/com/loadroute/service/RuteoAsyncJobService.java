package com.loadroute.service;

import com.loadroute.dto.RutaResponseDTO;
import com.loadroute.dto.SimulacionJobDTO;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@Service
public class RuteoAsyncJobService {

    private static final long COMPLETED_JOB_TTL_MS = TimeUnit.MINUTES.toMillis(30);
    private static final long ERROR_JOB_TTL_MS = TimeUnit.MINUTES.toMillis(15);

    private final RuteoAlgoritmoService ruteoService;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final ScheduledExecutorService cleanupExecutor = Executors.newSingleThreadScheduledExecutor();
    private final Map<String, SimulacionJobDTO> jobs = new ConcurrentHashMap<>();
    private final Map<String, Long> finishedAt = new ConcurrentHashMap<>();

    public RuteoAsyncJobService(RuteoAlgoritmoService ruteoService) {
        this.ruteoService = ruteoService;
        cleanupExecutor.scheduleAtFixedRate(this::cleanupExpiredJobs, 5, 5, TimeUnit.MINUTES);
    }

    public SimulacionJobDTO iniciar(int escenario,
                                    String fechaInicio,
                                    String fechaFin) {
        cleanupExpiredJobs();

        String jobId = UUID.randomUUID().toString();
        SimulacionJobDTO job = new SimulacionJobDTO(jobId, "PENDING", 0, "Iniciando simulacion...");
        jobs.put(jobId, job);

        executor.submit(() -> {
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
                }
            } catch (Exception e) {
                SimulacionJobDTO current = jobs.get(jobId);
                if (current != null) {
                    current.setStatus("ERROR");
                    current.setProgress(100);
                    current.setMessage("La simulacion fallo.");
                    current.setError(e.getMessage());
                    finishedAt.put(jobId, System.currentTimeMillis());
                }
            }
        });

        return job.copyStatus();
    }

    public SimulacionJobDTO obtenerEstado(String jobId) {
        cleanupExpiredJobs();
        SimulacionJobDTO job = jobs.get(jobId);
        return job != null ? job.copyStatus() : null;
    }

    public SimulacionJobDTO obtenerChunks(String jobId, int desde) {
        cleanupExpiredJobs();
        SimulacionJobDTO job = jobs.get(jobId);
        return job != null ? job.copyChunks(desde) : null;
    }

    public boolean eliminar(String jobId) {
        finishedAt.remove(jobId);
        return jobs.remove(jobId) != null;
    }

    private void update(String jobId, String status, int progress, String message) {
        SimulacionJobDTO job = jobs.get(jobId);
        if (job == null) return;
        job.setStatus(status);
        job.setProgress(Math.max(0, Math.min(100, progress)));
        job.setMessage(message);
    }

    private void cleanupExpiredJobs() {
        long now = System.currentTimeMillis();
        for (Map.Entry<String, Long> entry : finishedAt.entrySet()) {
            SimulacionJobDTO job = jobs.get(entry.getKey());
            if (job == null) {
                finishedAt.remove(entry.getKey());
                continue;
            }

            long ttl = "ERROR".equals(job.getStatus()) ? ERROR_JOB_TTL_MS : COMPLETED_JOB_TTL_MS;
            if (now - entry.getValue() > ttl) {
                jobs.remove(entry.getKey());
                finishedAt.remove(entry.getKey());
            }
        }
    }

    @jakarta.annotation.PreDestroy
    public void shutdown() {
        executor.shutdownNow();
        cleanupExecutor.shutdownNow();
    }

    private Path persistMultipart(Path dir, MultipartFile file, String fallbackName) throws IOException {
        String original = file.getOriginalFilename();
        String safeName = original != null && !original.isBlank()
                ? original.replaceAll("[^A-Za-z0-9._-]", "_")
                : fallbackName;
        Path target = dir.resolve(safeName);
        int suffix = 1;
        while (Files.exists(target)) {
            int dot = safeName.lastIndexOf('.');
            String base = dot >= 0 ? safeName.substring(0, dot) : safeName;
            String ext = dot >= 0 ? safeName.substring(dot) : "";
            target = dir.resolve(base + "-" + suffix + ext);
            suffix++;
        }
        file.transferTo(target.toFile());
        return target;
    }

    private void deleteRecursively(Path root) {
        if (root == null || !Files.exists(root)) return;
        try {
            Files.walk(root)
                    .sorted(Comparator.reverseOrder())
                    .map(Path::toFile)
                    .forEach(File::delete);
        } catch (IOException ignored) {
        }
    }

    private static class TempMultipartFile implements MultipartFile {
        private final String name;
        private final String originalFilename;
        private final String contentType;
        private final Path path;

        private TempMultipartFile(String name, String originalFilename, String contentType, Path path) {
            this.name = name;
            this.originalFilename = originalFilename;
            this.contentType = contentType;
            this.path = path;
        }

        @Override public String getName() { return name; }
        @Override public String getOriginalFilename() { return originalFilename; }
        @Override public String getContentType() { return contentType; }
        @Override public boolean isEmpty() { return getSize() == 0; }
        @Override public long getSize() {
            try { return Files.size(path); }
            catch (IOException e) { return 0; }
        }
        @Override public byte[] getBytes() throws IOException { return Files.readAllBytes(path); }
        @Override public InputStream getInputStream() throws IOException { return Files.newInputStream(path); }
        @Override public void transferTo(java.io.File dest) throws IOException {
            Files.copy(path, dest.toPath());
        }
    }
}
