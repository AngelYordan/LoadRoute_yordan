package com.loadroute.repository;

import com.loadroute.entity.VueloEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface VueloRepository extends JpaRepository<VueloEntity, Long> {
    boolean existsByOrigen_IdOrDestino_Id(Long origenId, Long destinoId);
}
