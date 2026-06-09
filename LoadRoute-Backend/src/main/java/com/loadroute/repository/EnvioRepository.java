package com.loadroute.repository;

import com.loadroute.entity.EnvioEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface EnvioRepository extends JpaRepository<EnvioEntity, Long> {
    List<EnvioEntity> findByFechaCreacionBetween(LocalDateTime inicio, LocalDateTime fin);
    boolean existsByOrigen_IdOrDestino_Id(Long origenId, Long destinoId);
}
