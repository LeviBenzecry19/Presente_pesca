<?php

declare(strict_types=1);

namespace App\Entity;

use App\Repository\FishCatchRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Captura. O nome da classe é `FishCatch` porque `catch` é palavra reservada do
 * PHP; a tabela continua sendo `catches`, como no schema do cliente.
 *
 * Espécie + coordenadas + horário aqui, mais o `weather` da pescaria, são
 * exatamente as features do modelo preditivo da seção 5.1 da especificação.
 */
#[ORM\Entity(repositoryClass: FishCatchRepository::class)]
#[ORM\Table(name: 'catches')]
#[ORM\Index(name: 'idx_catch_device_updated', columns: ['device_id', 'updated_at'])]
#[ORM\Index(name: 'idx_catch_profile', columns: ['profile_id', 'updated_at'])]
#[ORM\Index(name: 'idx_catch_species', columns: ['species_id'])]
#[ORM\Index(name: 'idx_catch_caught_at', columns: ['caught_at'])]
#[ORM\Index(name: 'idx_catch_coords', columns: ['lat', 'lng'])]
class FishCatch
{
    #[ORM\Id]
    #[ORM\Column(type: Types::GUID)]
    private string $id;

    #[ORM\ManyToOne(targetEntity: FishingTrip::class)]
    #[ORM\JoinColumn(name: 'trip_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private FishingTrip $trip;

    #[ORM\ManyToOne(targetEntity: Device::class)]
    #[ORM\JoinColumn(name: 'device_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private Device $device;

    /** Nulo só para dados de clientes antigos, anteriores aos perfis. */
    #[ORM\ManyToOne(targetEntity: Profile::class)]
    #[ORM\JoinColumn(name: 'profile_id', referencedColumnName: 'id', nullable: true, onDelete: 'CASCADE')]
    private ?Profile $profile = null;

    /** ID da espécie em src/data/especies.ts, ou "outra". */
    #[ORM\Column(length: 64)]
    private string $speciesId;

    #[ORM\Column(length: 120, nullable: true)]
    private ?string $speciesCustom = null;

    #[ORM\Column(type: Types::FLOAT, nullable: true)]
    private ?float $weightKg = null;

    #[ORM\Column(type: Types::FLOAT, nullable: true)]
    private ?float $lengthCm = null;

    #[ORM\Column(type: Types::FLOAT, nullable: true)]
    private ?float $lat = null;

    #[ORM\Column(type: Types::FLOAT, nullable: true)]
    private ?float $lng = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $caughtAt;

    /** Nome do arquivo em %app.photo_dir%; nulo enquanto a foto não subiu. */
    #[ORM\Column(length: 128, nullable: true)]
    private ?string $photoPath = null;

    #[ORM\Column(length: 64, nullable: true)]
    private ?string $photoMime = null;

    #[ORM\Column(type: Types::INTEGER, nullable: true)]
    private ?int $photoBytes = null;

    /** O cliente avisa que existe foto antes de enviá-la; isso deixa a pendência visível. */
    #[ORM\Column(type: Types::BOOLEAN)]
    private bool $photoExpected = false;

    #[ORM\Column(length: 160, nullable: true)]
    private ?string $bait = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    private ?string $notes = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $updatedAt;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $deletedAt = null;

    public function __construct(string $id, FishingTrip $trip, Device $device)
    {
        $this->id = $id;
        $this->trip = $trip;
        $this->device = $device;
    }

    public function getId(): string
    {
        return $this->id;
    }

    public function getTrip(): FishingTrip
    {
        return $this->trip;
    }

    public function setTrip(FishingTrip $trip): void
    {
        $this->trip = $trip;
    }

    public function getDevice(): Device
    {
        return $this->device;
    }

    public function getProfile(): ?Profile
    {
        return $this->profile;
    }

    public function setProfile(?Profile $profile): void
    {
        $this->profile = $profile;
    }

    public function getSpeciesId(): string
    {
        return $this->speciesId;
    }

    public function setSpeciesId(string $speciesId): void
    {
        $this->speciesId = $speciesId;
    }

    public function getSpeciesCustom(): ?string
    {
        return $this->speciesCustom;
    }

    public function setSpeciesCustom(?string $speciesCustom): void
    {
        $this->speciesCustom = $speciesCustom;
    }

    public function getWeightKg(): ?float
    {
        return $this->weightKg;
    }

    public function setWeightKg(?float $weightKg): void
    {
        $this->weightKg = $weightKg;
    }

    public function getLengthCm(): ?float
    {
        return $this->lengthCm;
    }

    public function setLengthCm(?float $lengthCm): void
    {
        $this->lengthCm = $lengthCm;
    }

    public function getLat(): ?float
    {
        return $this->lat;
    }

    public function getLng(): ?float
    {
        return $this->lng;
    }

    public function setCoords(?float $lat, ?float $lng): void
    {
        $this->lat = $lat;
        $this->lng = $lng;
    }

    public function getCaughtAt(): \DateTimeImmutable
    {
        return $this->caughtAt;
    }

    public function setCaughtAt(\DateTimeImmutable $caughtAt): void
    {
        $this->caughtAt = $caughtAt;
    }

    public function getPhotoPath(): ?string
    {
        return $this->photoPath;
    }

    public function getPhotoMime(): ?string
    {
        return $this->photoMime;
    }

    public function getPhotoBytes(): ?int
    {
        return $this->photoBytes;
    }

    public function setPhoto(?string $path, ?string $mime, ?int $bytes): void
    {
        $this->photoPath = $path;
        $this->photoMime = $mime;
        $this->photoBytes = $bytes;
    }

    public function hasPhoto(): bool
    {
        return null !== $this->photoPath;
    }

    public function isPhotoExpected(): bool
    {
        return $this->photoExpected;
    }

    public function setPhotoExpected(bool $expected): void
    {
        $this->photoExpected = $expected;
    }

    public function getBait(): ?string
    {
        return $this->bait;
    }

    public function setBait(?string $bait): void
    {
        $this->bait = $bait;
    }

    public function getNotes(): ?string
    {
        return $this->notes;
    }

    public function setNotes(?string $notes): void
    {
        $this->notes = $notes;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function setCreatedAt(\DateTimeImmutable $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getUpdatedAt(): \DateTimeImmutable
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(\DateTimeImmutable $updatedAt): void
    {
        $this->updatedAt = $updatedAt;
    }

    public function getDeletedAt(): ?\DateTimeImmutable
    {
        return $this->deletedAt;
    }

    public function setDeletedAt(?\DateTimeImmutable $deletedAt): void
    {
        $this->deletedAt = $deletedAt;
    }

    public function isDeleted(): bool
    {
        return null !== $this->deletedAt;
    }
}
