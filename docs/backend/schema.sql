-- Schema do backend (MySQL 8 / MariaDB 10.4+).
--
-- REFERÊNCIA APENAS. A fonte da verdade é a migration do Doctrine em
-- backend/migrations/, aplicada com:
--   cd backend && php bin/console doctrine:migrations:migrate
--
-- Os ids são CHAR(36) porque vêm do cliente: o app gera UUID offline, então o
-- servidor nunca atribui identidade. As datas são DATETIME em UTC.
-- A exclusão é lógica (deleted_at) para que GET /v1/sync consiga propagar
-- remoções para os outros aparelhos do usuário.

CREATE DATABASE IF NOT EXISTS pesca CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pesca;

-- Enquanto não há login, um "usuário" é um aparelho.
CREATE TABLE devices (
  id            CHAR(36)    NOT NULL,
  user_id       CHAR(36)    DEFAULT NULL,   -- reservado para quando houver contas
  created_at    DATETIME    NOT NULL,
  last_seen_at  DATETIME    NOT NULL,
  PRIMARY KEY (id)
) DEFAULT CHARACTER SET utf8mb4;

CREATE TABLE fishing_spots (
  id          CHAR(36)          NOT NULL,
  device_id   CHAR(36)          NOT NULL,
  name        VARCHAR(160)      NOT NULL,
  ambiente    VARCHAR(16)       NOT NULL,   -- agua_doce | mar
  lat         DOUBLE PRECISION  NOT NULL,
  lng         DOUBLE PRECISION  NOT NULL,
  notes       LONGTEXT          DEFAULT NULL,
  created_at  DATETIME          NOT NULL,
  updated_at  DATETIME          NOT NULL,
  deleted_at  DATETIME          DEFAULT NULL,
  PRIMARY KEY (id),
  INDEX idx_spot_device_updated (device_id, updated_at),
  INDEX idx_spot_coords (lat, lng),
  CONSTRAINT fk_spot_device FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4;

CREATE TABLE fishing_trips (
  id                      CHAR(36)          NOT NULL,
  device_id               CHAR(36)          NOT NULL,
  spot_id                 CHAR(36)          DEFAULT NULL,
  title                   VARCHAR(160)      DEFAULT NULL,
  planned_at              DATETIME          NOT NULL,
  lat                     DOUBLE PRECISION  NOT NULL,
  lng                     DOUBLE PRECISION  NOT NULL,
  location_name           VARCHAR(255)      DEFAULT NULL,
  ambiente                VARCHAR(16)       NOT NULL,
  status                  VARCHAR(16)       NOT NULL,   -- planejada | em_andamento | concluida
  started_at              DATETIME          DEFAULT NULL,
  ended_at                DATETIME          DEFAULT NULL,
  start_lat               DOUBLE PRECISION  DEFAULT NULL,
  start_lng               DOUBLE PRECISION  DEFAULT NULL,
  end_lat                 DOUBLE PRECISION  DEFAULT NULL,
  end_lng                 DOUBLE PRECISION  DEFAULT NULL,
  weather                 JSON              DEFAULT NULL,  -- WeatherSnapshot inteiro
  reminder_minutes_before INT               DEFAULT NULL,
  reminder_fired_at       DATETIME          DEFAULT NULL,
  checklist               JSON              DEFAULT NULL,
  notes                   LONGTEXT          DEFAULT NULL,
  created_at              DATETIME          NOT NULL,
  updated_at              DATETIME          NOT NULL,
  deleted_at              DATETIME          DEFAULT NULL,
  PRIMARY KEY (id),
  INDEX idx_trip_device_updated (device_id, updated_at),
  INDEX idx_trip_planned (planned_at),
  INDEX idx_trip_coords (lat, lng),
  CONSTRAINT fk_trip_device FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE CASCADE,
  CONSTRAINT fk_trip_spot   FOREIGN KEY (spot_id)   REFERENCES fishing_spots (id) ON DELETE SET NULL
) DEFAULT CHARACTER SET utf8mb4;

CREATE TABLE catches (
  id              CHAR(36)          NOT NULL,
  trip_id         CHAR(36)          NOT NULL,
  device_id       CHAR(36)          NOT NULL,
  species_id      VARCHAR(64)       NOT NULL,   -- id de src/data/especies.ts, ou "outra"
  species_custom  VARCHAR(120)      DEFAULT NULL,
  weight_kg       DOUBLE PRECISION  DEFAULT NULL,
  length_cm       DOUBLE PRECISION  DEFAULT NULL,
  lat             DOUBLE PRECISION  DEFAULT NULL,
  lng             DOUBLE PRECISION  DEFAULT NULL,
  caught_at       DATETIME          NOT NULL,
  photo_path      VARCHAR(128)      DEFAULT NULL,
  photo_mime      VARCHAR(64)       DEFAULT NULL,
  photo_bytes     INT               DEFAULT NULL,
  photo_expected  TINYINT(1)        NOT NULL,   -- cliente avisou que existe foto a subir
  bait            VARCHAR(160)      DEFAULT NULL,
  notes           LONGTEXT          DEFAULT NULL,
  created_at      DATETIME          NOT NULL,
  updated_at      DATETIME          NOT NULL,
  deleted_at      DATETIME          DEFAULT NULL,
  PRIMARY KEY (id),
  INDEX idx_catch_device_updated (device_id, updated_at),
  INDEX idx_catch_species (species_id),
  INDEX idx_catch_caught_at (caught_at),
  INDEX idx_catch_coords (lat, lng),
  CONSTRAINT fk_catch_trip   FOREIGN KEY (trip_id)   REFERENCES fishing_trips (id) ON DELETE CASCADE,
  CONSTRAINT fk_catch_device FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4;

-- ---------------------------------------------------------------------------
-- Consultas que sustentam as fases 2 e 4 do roadmap
-- ---------------------------------------------------------------------------

-- Espécies mais capturadas num raio de 25 km (o que GET /v1/species/nearby faz).
-- O BETWEEN aproveita idx_catch_coords antes da distância exata.
-- SELECT species_id, COUNT(*) AS capturas, AVG(weight_kg) AS peso_medio
--   FROM catches
--  WHERE deleted_at IS NULL
--    AND lat BETWEEN :min_lat AND :max_lat
--    AND lng BETWEEN :min_lng AND :max_lng
--    AND ST_Distance_Sphere(POINT(lng, lat), POINT(:lng, :lat)) <= 25000
--  GROUP BY species_id
--  ORDER BY capturas DESC;

-- Melhor horário por espécie na região.
-- SELECT species_id, HOUR(caught_at) AS hora, COUNT(*) AS capturas
--   FROM catches
--  WHERE deleted_at IS NULL
--    AND ST_Distance_Sphere(POINT(lng, lat), POINT(:lng, :lat)) <= 25000
--  GROUP BY species_id, hora;

-- Dataset para treinar o modelo da seção 5.1: captura + clima da pescaria.
-- SELECT c.species_id, c.lat, c.lng, c.caught_at, c.weight_kg, t.weather, t.ambiente
--   FROM catches c
--   JOIN fishing_trips t ON t.id = c.trip_id
--  WHERE c.deleted_at IS NULL AND t.weather IS NOT NULL;
