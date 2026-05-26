package com.loadroute.repository;

import com.loadroute.entity.AeropuertoEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AeropuertoRepository extends JpaRepository<AeropuertoEntity, Long> {
    Optional<AeropuertoEntity> findByCodigo(String codigo);
}
