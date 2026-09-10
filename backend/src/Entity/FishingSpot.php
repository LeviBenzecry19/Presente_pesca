<?php

declare(strict_types=1);

namespace App\Entity;

use App\Enum\Ambiente;
use App\Repository\FishingSpotRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Spot salvo. O `id` vem do cliente (UUID gerado offline), por isso não há
 * `#[ORM\GeneratedValue]`: a estratégia é "assigned".
 */
#[ORM\Entity(repositoryClass: FishingSpotRepository::class)]
#[ORM\Table(name: 'fishing_spots')]
#[ORM\Index(name: 'idx_spot_device_updated', columns: ['device_id', 'updated_at'])]
#[ORM\Index(name: 'idx_spot_profile', columns: ['profile_id', 'updated_at'])]
#[ORM\Index(name: 'idx_spot_coords', columns: ['lat', 'lng'])]
class FishingSpot
{
    #[ORM\Id]
    #[ORM\Column(type: Types::GUID)]
    private string $id;

    #[ORM\ManyToOne(targetEntity: Device::class)]
    #[ORM\JoinColumn(name: 'device_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private Device $device;

    /** Nulo só para dados de clientes antigos, anteriores aos perfis. */
    #[ORM\ManyToOne(targetEntity: Profile::class)]
    #[ORM\JoinColumn(name: 'profile_id', referencedColumnName: 'id', nullable: true, onDelete: 'CASCADE')]
    private ?Profile $profile = null;

    #[ORM\Column(length: 160)]
    private string $name;

    #[ORM\Column(type: Types::STRING, length: 16, enumType: Ambiente::class)]
    private Ambiente $ambiente;

    #[ORM\Column(type: Types::FLOAT)]
    private float $lat;

    #[ORM\Column(type: Types::FLOAT)]
    private float $lng;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    private ?string $notes = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $updatedAt;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $deletedAt = null;

    public function __construct(string $id, Device $device)
    {
        $this->id = $id;
        $this->device = $device;
    }

    public function getId(): string
    {
        return $this->id;
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

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getAmbiente(): Ambiente
    {
        return $this->ambiente;
    }

    public function setAmbiente(Ambiente $ambiente): void
    {
        $this->ambiente = $ambiente;
    }

    public function getLat(): float
    {
        return $this->lat;
    }

    public function getLng(): float
    {
        return $this->lng;
    }

    public function setCoords(float $lat, float $lng): void
    {
        $this->lat = $lat;
        $this->lng = $lng;
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
