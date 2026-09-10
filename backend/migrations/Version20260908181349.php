<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Perfis: o app vira presente de familia, com um historico por pessoa.
 *
 * profile_id nasce anulavel porque pode existir dado gravado por um cliente
 * anterior aos perfis; o cliente novo sempre preenche.
 */
final class Version20260908181349 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Perfis por pessoa: tabela profiles e profile_id em spots, pescarias e capturas.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE profiles (id CHAR(36) NOT NULL, name VARCHAR(60) NOT NULL, avatar LONGTEXT NOT NULL, password_hash VARCHAR(128) NOT NULL, password_salt VARCHAR(64) NOT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, deleted_at DATETIME DEFAULT NULL, device_id CHAR(36) NOT NULL, INDEX idx_profile_device_updated (device_id, updated_at), INDEX IDX_8B30853094A4C7D4 (device_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('ALTER TABLE profiles ADD CONSTRAINT FK_8B30853094A4C7D4 FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE catches ADD profile_id CHAR(36) DEFAULT NULL');
        $this->addSql('ALTER TABLE catches ADD CONSTRAINT FK_56196EE7CCFA12B8 FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE');
        $this->addSql('CREATE INDEX idx_catch_profile ON catches (profile_id, updated_at)');
        $this->addSql('CREATE INDEX IDX_56196EE7CCFA12B8 ON catches (profile_id)');
        $this->addSql('ALTER TABLE fishing_spots ADD profile_id CHAR(36) DEFAULT NULL');
        $this->addSql('ALTER TABLE fishing_spots ADD CONSTRAINT FK_2398023BCCFA12B8 FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE');
        $this->addSql('CREATE INDEX idx_spot_profile ON fishing_spots (profile_id, updated_at)');
        $this->addSql('CREATE INDEX IDX_2398023BCCFA12B8 ON fishing_spots (profile_id)');
        $this->addSql('ALTER TABLE fishing_trips ADD profile_id CHAR(36) DEFAULT NULL');
        $this->addSql('ALTER TABLE fishing_trips ADD CONSTRAINT FK_5B50AF16CCFA12B8 FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE');
        $this->addSql('CREATE INDEX idx_trip_profile ON fishing_trips (profile_id, updated_at)');
        $this->addSql('CREATE INDEX IDX_5B50AF16CCFA12B8 ON fishing_trips (profile_id)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE profiles DROP FOREIGN KEY FK_8B30853094A4C7D4');
        $this->addSql('DROP TABLE profiles');
        $this->addSql('ALTER TABLE catches DROP FOREIGN KEY FK_56196EE7CCFA12B8');
        $this->addSql('DROP INDEX idx_catch_profile ON catches');
        $this->addSql('DROP INDEX IDX_56196EE7CCFA12B8 ON catches');
        $this->addSql('ALTER TABLE catches DROP profile_id');
        $this->addSql('ALTER TABLE fishing_spots DROP FOREIGN KEY FK_2398023BCCFA12B8');
        $this->addSql('DROP INDEX idx_spot_profile ON fishing_spots');
        $this->addSql('DROP INDEX IDX_2398023BCCFA12B8 ON fishing_spots');
        $this->addSql('ALTER TABLE fishing_spots DROP profile_id');
        $this->addSql('ALTER TABLE fishing_trips DROP FOREIGN KEY FK_5B50AF16CCFA12B8');
        $this->addSql('DROP INDEX idx_trip_profile ON fishing_trips');
        $this->addSql('DROP INDEX IDX_5B50AF16CCFA12B8 ON fishing_trips');
        $this->addSql('ALTER TABLE fishing_trips DROP profile_id');
    }
}
