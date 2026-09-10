<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Schema inicial: aparelhos, spots, pescarias e capturas.
 *
 * Os ids são CHAR(36) porque vêm do cliente (UUID gerado offline), e as datas
 * são DATETIME em UTC. Exclusão é lógica (deleted_at) para que o download
 * incremental consiga propagar remoções para os outros aparelhos.
 */
final class Version20260908162514 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Schema inicial do Pesca App: devices, fishing_spots, fishing_trips e catches.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE catches (id CHAR(36) NOT NULL, species_id VARCHAR(64) NOT NULL, species_custom VARCHAR(120) DEFAULT NULL, weight_kg DOUBLE PRECISION DEFAULT NULL, length_cm DOUBLE PRECISION DEFAULT NULL, lat DOUBLE PRECISION DEFAULT NULL, lng DOUBLE PRECISION DEFAULT NULL, caught_at DATETIME NOT NULL, photo_path VARCHAR(128) DEFAULT NULL, photo_mime VARCHAR(64) DEFAULT NULL, photo_bytes INT DEFAULT NULL, photo_expected TINYINT NOT NULL, bait VARCHAR(160) DEFAULT NULL, notes LONGTEXT DEFAULT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, deleted_at DATETIME DEFAULT NULL, trip_id CHAR(36) NOT NULL, device_id CHAR(36) NOT NULL, INDEX idx_catch_device_updated (device_id, updated_at), INDEX idx_catch_species (species_id), INDEX idx_catch_caught_at (caught_at), INDEX idx_catch_coords (lat, lng), INDEX IDX_56196EE7A5BC2E0E (trip_id), INDEX IDX_56196EE794A4C7D4 (device_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE devices (id CHAR(36) NOT NULL, user_id CHAR(36) DEFAULT NULL, created_at DATETIME NOT NULL, last_seen_at DATETIME NOT NULL, PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE fishing_spots (id CHAR(36) NOT NULL, name VARCHAR(160) NOT NULL, ambiente VARCHAR(16) NOT NULL, lat DOUBLE PRECISION NOT NULL, lng DOUBLE PRECISION NOT NULL, notes LONGTEXT DEFAULT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, deleted_at DATETIME DEFAULT NULL, device_id CHAR(36) NOT NULL, INDEX idx_spot_device_updated (device_id, updated_at), INDEX idx_spot_coords (lat, lng), INDEX IDX_2398023B94A4C7D4 (device_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE fishing_trips (id CHAR(36) NOT NULL, title VARCHAR(160) DEFAULT NULL, planned_at DATETIME NOT NULL, lat DOUBLE PRECISION NOT NULL, lng DOUBLE PRECISION NOT NULL, location_name VARCHAR(255) DEFAULT NULL, ambiente VARCHAR(16) NOT NULL, status VARCHAR(16) NOT NULL, started_at DATETIME DEFAULT NULL, ended_at DATETIME DEFAULT NULL, start_lat DOUBLE PRECISION DEFAULT NULL, start_lng DOUBLE PRECISION DEFAULT NULL, end_lat DOUBLE PRECISION DEFAULT NULL, end_lng DOUBLE PRECISION DEFAULT NULL, weather JSON DEFAULT NULL, reminder_minutes_before INT DEFAULT NULL, reminder_fired_at DATETIME DEFAULT NULL, checklist JSON DEFAULT NULL, notes LONGTEXT DEFAULT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, deleted_at DATETIME DEFAULT NULL, device_id CHAR(36) NOT NULL, spot_id CHAR(36) DEFAULT NULL, INDEX idx_trip_device_updated (device_id, updated_at), INDEX idx_trip_planned (planned_at), INDEX idx_trip_coords (lat, lng), INDEX IDX_5B50AF1694A4C7D4 (device_id), INDEX IDX_5B50AF162DF1D37C (spot_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('ALTER TABLE catches ADD CONSTRAINT FK_56196EE7A5BC2E0E FOREIGN KEY (trip_id) REFERENCES fishing_trips (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE catches ADD CONSTRAINT FK_56196EE794A4C7D4 FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE fishing_spots ADD CONSTRAINT FK_2398023B94A4C7D4 FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE fishing_trips ADD CONSTRAINT FK_5B50AF1694A4C7D4 FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE fishing_trips ADD CONSTRAINT FK_5B50AF162DF1D37C FOREIGN KEY (spot_id) REFERENCES fishing_spots (id) ON DELETE SET NULL');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE catches DROP FOREIGN KEY FK_56196EE7A5BC2E0E');
        $this->addSql('ALTER TABLE catches DROP FOREIGN KEY FK_56196EE794A4C7D4');
        $this->addSql('ALTER TABLE fishing_spots DROP FOREIGN KEY FK_2398023B94A4C7D4');
        $this->addSql('ALTER TABLE fishing_trips DROP FOREIGN KEY FK_5B50AF1694A4C7D4');
        $this->addSql('ALTER TABLE fishing_trips DROP FOREIGN KEY FK_5B50AF162DF1D37C');
        $this->addSql('DROP TABLE catches');
        $this->addSql('DROP TABLE devices');
        $this->addSql('DROP TABLE fishing_spots');
        $this->addSql('DROP TABLE fishing_trips');
    }
}
