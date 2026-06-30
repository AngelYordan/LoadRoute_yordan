package com.loadroute.repository;

import com.loadroute.entity.VueloCanceladoEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface VueloCanceladoRepository extends JpaRepository<VueloCanceladoEntity, Long> {
    List<VueloCanceladoEntity> findByFechaBetween(LocalDate start, LocalDate end);
    Optional<VueloCanceladoEntity> findByVueloIdAndFecha(Long vueloId, LocalDate fecha);
    boolean existsByVueloIdAndFecha(Long vueloId, LocalDate fecha);
}
