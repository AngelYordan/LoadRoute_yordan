CREATE DATABASE IF NOT EXISTS loadroute
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE loadroute;

CREATE TABLE IF NOT EXISTS aeropuertos (
  id BIGINT NOT NULL AUTO_INCREMENT,
  codigo VARCHAR(4) NOT NULL,
  ciudad VARCHAR(255),
  pais VARCHAR(255),
  continente VARCHAR(255),
  gmt INT NOT NULL,
  capacidad_max INT NOT NULL,
  latitud DOUBLE NOT NULL,
  longitud DOUBLE NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_aeropuertos_codigo (codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vuelos (
  id BIGINT NOT NULL AUTO_INCREMENT,
  origen_id BIGINT NOT NULL,
  destino_id BIGINT NOT NULL,
  hora_salida_local TIME(6) NOT NULL,
  hora_llegada_local TIME(6) NOT NULL,
  capacidad_max INT NOT NULL,
  PRIMARY KEY (id),
  KEY idx_vuelos_origen (origen_id),
  KEY idx_vuelos_destino (destino_id),
  CONSTRAINT fk_vuelos_origen
    FOREIGN KEY (origen_id) REFERENCES aeropuertos (id),
  CONSTRAINT fk_vuelos_destino
    FOREIGN KEY (destino_id) REFERENCES aeropuertos (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS envios (
  id BIGINT NOT NULL AUTO_INCREMENT,
  clave_compuesta VARCHAR(255) NOT NULL,
  cliente_id VARCHAR(255),
  origen_id BIGINT NOT NULL,
  destino_id BIGINT NOT NULL,
  fecha_creacion DATETIME(6) NOT NULL,
  cantidad_maletas INT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_envios_clave_compuesta (clave_compuesta),
  KEY idx_envios_fecha_creacion (fecha_creacion),
  KEY idx_envios_origen (origen_id),
  KEY idx_envios_destino (destino_id),
  CONSTRAINT fk_envios_origen
    FOREIGN KEY (origen_id) REFERENCES aeropuertos (id),
  CONSTRAINT fk_envios_destino
    FOREIGN KEY (destino_id) REFERENCES aeropuertos (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
