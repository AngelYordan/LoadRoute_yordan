package com.loadroute.service;

import com.loadroute.dto.AeropuertoDTO;
import com.loadroute.dto.VueloDTO;
import com.loadroute.entity.AeropuertoEntity;
import com.loadroute.entity.VueloEntity;
import com.loadroute.repository.AeropuertoRepository;
import com.loadroute.repository.EnvioRepository;
import com.loadroute.repository.VueloRepository;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class MaestroService {

    private final AeropuertoRepository aeropuertoRepository;
    private final VueloRepository vueloRepository;
    private final EnvioRepository envioRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public MaestroService(AeropuertoRepository aeropuertoRepository,
                          VueloRepository vueloRepository,
                          EnvioRepository envioRepository,
                          SimpMessagingTemplate messagingTemplate) {
        this.aeropuertoRepository = aeropuertoRepository;
        this.vueloRepository = vueloRepository;
        this.envioRepository = envioRepository;
        this.messagingTemplate = messagingTemplate;
    }

    private void notificarCambio(String tipo) {
        // Enviar notificación simple al cliente
        messagingTemplate.convertAndSend("/topic/maestros", "{\"event\": \"" + tipo + "\"}");
    }

    // --- AEROPUERTOS ---

    public List<AeropuertoDTO> listarAeropuertos() {
        return aeropuertoRepository.findAll().stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    public Optional<AeropuertoDTO> obtenerAeropuertoPorCodigo(String codigo) {
        return aeropuertoRepository.findByCodigo(codigo).map(this::mapToDTO);
    }

    @Transactional
    public AeropuertoDTO crearAeropuerto(AeropuertoDTO dto) {
        if (aeropuertoRepository.findByCodigo(dto.getCodigo()).isPresent()) {
            throw new IllegalArgumentException("Ya existe un aeropuerto con el código " + dto.getCodigo());
        }
        AeropuertoEntity entity = mapToEntity(dto, new AeropuertoEntity());
        entity.setCodigo(dto.getCodigo()); // Asegurarse de setear el código en creación
        AeropuertoDTO guardado = mapToDTO(aeropuertoRepository.save(entity));
        notificarCambio("AEROPUERTO_CREADO");
        return guardado;
    }

    @Transactional
    public AeropuertoDTO actualizarAeropuerto(String codigo, AeropuertoDTO dto) {
        AeropuertoEntity entity = aeropuertoRepository.findByCodigo(codigo)
                .orElseThrow(() -> new IllegalArgumentException("Aeropuerto no encontrado: " + codigo));
        
        mapToEntity(dto, entity);
        // No permitimos cambiar el código primario (o si lo hacemos, requeriría lógica extra)
        
        AeropuertoDTO actualizado = mapToDTO(aeropuertoRepository.save(entity));
        notificarCambio("AEROPUERTO_ACTUALIZADO");
        return actualizado;
    }

    @Transactional
    public void eliminarAeropuerto(String codigo) {
        AeropuertoEntity entity = aeropuertoRepository.findByCodigo(codigo)
                .orElseThrow(() -> new IllegalArgumentException("Aeropuerto no encontrado: " + codigo));

        // Validación de uso
        boolean enUsoVuelos = vueloRepository.existsByOrigen_IdOrDestino_Id(entity.getId(), entity.getId());
        boolean enUsoEnvios = envioRepository.existsByOrigen_IdOrDestino_Id(entity.getId(), entity.getId());

        if (enUsoVuelos || enUsoEnvios) {
            throw new IllegalStateException("No se puede eliminar el aeropuerto porque está en uso por vuelos o envíos.");
        }

        aeropuertoRepository.delete(entity);
        notificarCambio("AEROPUERTO_ELIMINADO");
    }

    // --- VUELOS ---

    public List<VueloDTO> listarVuelos() {
        return vueloRepository.findAll().stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    public Optional<VueloDTO> obtenerVueloPorId(Long id) {
        return vueloRepository.findById(id).map(this::mapToDTO);
    }

    @Transactional
    public VueloDTO crearVuelo(VueloDTO dto) {
        AeropuertoEntity origen = aeropuertoRepository.findByCodigo(dto.getOrigenCodigo())
                .orElseThrow(() -> new IllegalArgumentException("Aeropuerto origen no existe: " + dto.getOrigenCodigo()));
        AeropuertoEntity destino = aeropuertoRepository.findByCodigo(dto.getDestinoCodigo())
                .orElseThrow(() -> new IllegalArgumentException("Aeropuerto destino no existe: " + dto.getDestinoCodigo()));

        VueloEntity entity = new VueloEntity();
        entity.setOrigen(origen);
        entity.setDestino(destino);
        entity.setHoraSalidaLocal(dto.getHoraSalidaLocal());
        entity.setHoraLlegadaLocal(dto.getHoraLlegadaLocal());
        entity.setCapacidadMax(dto.getCapacidadMax());

        VueloDTO guardado = mapToDTO(vueloRepository.save(entity));
        notificarCambio("VUELO_CREADO");
        return guardado;
    }

    @Transactional
    public VueloDTO actualizarVuelo(Long id, VueloDTO dto) {
        VueloEntity entity = vueloRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Vuelo no encontrado: " + id));

        AeropuertoEntity origen = aeropuertoRepository.findByCodigo(dto.getOrigenCodigo())
                .orElseThrow(() -> new IllegalArgumentException("Aeropuerto origen no existe: " + dto.getOrigenCodigo()));
        AeropuertoEntity destino = aeropuertoRepository.findByCodigo(dto.getDestinoCodigo())
                .orElseThrow(() -> new IllegalArgumentException("Aeropuerto destino no existe: " + dto.getDestinoCodigo()));

        entity.setOrigen(origen);
        entity.setDestino(destino);
        entity.setHoraSalidaLocal(dto.getHoraSalidaLocal());
        entity.setHoraLlegadaLocal(dto.getHoraLlegadaLocal());
        entity.setCapacidadMax(dto.getCapacidadMax());

        VueloDTO actualizado = mapToDTO(vueloRepository.save(entity));
        notificarCambio("VUELO_ACTUALIZADO");
        return actualizado;
    }

    @Transactional
    public void eliminarVuelo(Long id) {
        VueloEntity entity = vueloRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Vuelo no encontrado: " + id));
        vueloRepository.delete(entity);
        notificarCambio("VUELO_ELIMINADO");
    }

    // --- MAPPERS ---

    private AeropuertoDTO mapToDTO(AeropuertoEntity e) {
        AeropuertoDTO dto = new AeropuertoDTO();
        dto.setCodigo(e.getCodigo());
        dto.setCiudad(e.getCiudad());
        dto.setPais(e.getPais());
        dto.setContinente(e.getContinente());
        dto.setGmt(e.getGmt());
        dto.setCapacidadMax(e.getCapacidadMax());
        dto.setLatitud(e.getLatitud());
        dto.setLongitud(e.getLongitud());
        return dto;
    }

    private AeropuertoEntity mapToEntity(AeropuertoDTO dto, AeropuertoEntity e) {
        e.setCiudad(dto.getCiudad());
        e.setPais(dto.getPais());
        e.setContinente(dto.getContinente());
        e.setGmt(dto.getGmt());
        e.setCapacidadMax(dto.getCapacidadMax());
        e.setLatitud(dto.getLatitud());
        e.setLongitud(dto.getLongitud());
        return e;
    }

    private VueloDTO mapToDTO(VueloEntity e) {
        VueloDTO dto = new VueloDTO();
        dto.setId(e.getId());
        dto.setOrigenCodigo(e.getOrigen().getCodigo());
        dto.setDestinoCodigo(e.getDestino().getCodigo());
        dto.setHoraSalidaLocal(e.getHoraSalidaLocal());
        dto.setHoraLlegadaLocal(e.getHoraLlegadaLocal());
        dto.setCapacidadMax(e.getCapacidadMax());
        return dto;
    }
}
