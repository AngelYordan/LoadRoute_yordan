package com.loadroute.repository;

import com.loadroute.entity.VueloCanceladoPeriodoEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface VueloCanceladoPeriodoRepository extends JpaRepository<VueloCanceladoPeriodoEntity, Long> {
    List<VueloCanceladoPeriodoEntity> findByFechaBetween(LocalDate start, LocalDate end);
    Optional<VueloCanceladoPeriodoEntity> findByVueloIdAndFecha(Long vueloId, LocalDate fecha);
    boolean existsByVueloIdAndFecha(Long vueloId, LocalDate fecha);
}
