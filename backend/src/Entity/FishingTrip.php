<?php

declare(strict_types=1);

namespace App\Entity;

use App\Enum\Ambiente;
use App\Enum\TripStatus;
use App\Repository\FishingTripRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Pescaria. `weather` guarda o WeatherSnapshot inteiro consultado no momento do
 * planejamento — é ele que, junto das capturas, alimenta o modelo preditivo
 * previsto na seção 5.1 da especificação.
 */
#[ORM\Entity(repositoryClass: FishingTripRepository::class)]
#[ORM\Table(name: 'fishing_trips')]
#[ORM\Index(name: 'idx_trip_device_updated', columns: ['device_id', 'updated_at'])]
#[ORM\Index(name: 'idx_trip_profile', columns: ['profile_id', 'updated_at'])]
#[ORM\Index(name: 'idx_trip_planned', columns: ['planned_at'])]
#[ORM\Index(name: 'idx_trip_coords', columns: ['lat', 'lng'])]
class FishingTrip
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

    #[ORM\ManyToOne(targetEntity: FishingSpot::class)]
    #[ORM\JoinColumn(name: 'spot_id', referencedColumnName: 'id', nullable: true, onDelete: 'SET NULL')]
    private ?FishingSpot $spot = null;

    #[ORM\Column(length: 160, nullable: true)]
    private ?string $title = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $plannedAt;

    #[ORM\Column(type: Types::FLOAT)]
    private float $lat;

    #[ORM\Column(type: Types::FLOAT)]
    private float $lng;

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $locationName = null;

    #[ORM\Column(type: Types::STRING, length: 16, enumType: Ambiente::class)]
    private Ambiente $ambiente;

    #[ORM\Column(type: Types::STRING, length: 16, enumType: TripStatus::class)]
    private TripStatus $status;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $startedAt = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $endedAt = null;

    #[ORM\Column(type: Types::FLOAT, nullable: true)]
    private ?float $startLat = null;

    #[ORM\Column(type: Types::FLOAT, nullable: true)]
    private ?float $startLng = null;

    #[ORM\Column(type: Types::FLOAT, nullable: true)]
    private ?float $endLat = null;

    #[ORM\Column(type: Types::FLOAT, nullable: true)]
    private ?float $endLng = null;

    /** @var array<string, mixed>|null */
    #[ORM\Column(type: Types::JSON, nullable: true)]
    private ?array $weather = null;

    #[ORM\Column(type: Types::INTEGER, nullable: true)]
    private ?int $reminderMinutesBefore = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $reminderFiredAt = null;

    /** @var list<array<string, mixed>>|null */
    #[ORM\Column(type: Types::JSON, nullable: true)]
    private ?array $checklist = null;

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

    public function getSpot(): ?FishingSpot
    {
        return $this->spot;
    }

    public function setSpot(?FishingSpot $spot): void
    {
        $this->spot = $spot;
    }

    public function getTitle(): ?string
    {
        return $this->title;
    }

    public function setTitle(?string $title): void
    {
        $this->title = $title;
    }

    public function getPlannedAt(): \DateTimeImmutable
    {
        return $this->plannedAt;
    }

    public function setPlannedAt(\DateTimeImmutable $plannedAt): void
    {
        $this->plannedAt = $plannedAt;
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

    public function getLocationName(): ?string
    {
        return $this->locationName;
    }

    public function setLocationName(?string $locationName): void
    {
        $this->locationName = $locationName;
    }

    public function getAmbiente(): Ambiente
    {
        return $this->ambiente;
    }

    public function setAmbiente(Ambiente $ambiente): void
    {
        $this->ambiente = $ambiente;
    }

    public function getStatus(): TripStatus
    {
        return $this->status;
    }

    public function setStatus(TripStatus $status): void
    {
        $this->status = $status;
    }

    public function getStartedAt(): ?\DateTimeImmutable
    {
        return $this->startedAt;
    }

    public function setStartedAt(?\DateTimeImmutable $startedAt): void
    {
        $this->startedAt = $startedAt;
    }

    public function getEndedAt(): ?\DateTimeImmutable
    {
        return $this->endedAt;
    }

    public function setEndedAt(?\DateTimeImmutable $endedAt): void
    {
        $this->endedAt = $endedAt;
    }

    public function getStartLat(): ?float
    {
        return $this->startLat;
    }

    public function getStartLng(): ?float
    {
        return $this->startLng;
    }

    public function setStartCoords(?float $lat, ?float $lng): void
    {
        $this->startLat = $lat;
        $this->startLng = $lng;
    }

    public function getEndLat(): ?float
    {
        return $this->endLat;
    }

    public function getEndLng(): ?float
    {
        return $this->endLng;
    }

    public function setEndCoords(?float $lat, ?float $lng): void
    {
        $this->endLat = $lat;
        $this->endLng = $lng;
    }

    /** @return array<string, mixed>|null */
    public function getWeather(): ?array
    {
        return $this->weather;
    }

    /** @param array<string, mixed>|null $weather */
    public function setWeather(?array $weather): void
    {
        $this->weather = $weather;
    }

    public function getReminderMinutesBefore(): ?int
    {
        return $this->reminderMinutesBefore;
    }

    public function setReminderMinutesBefore(?int $minutes): void
    {
        $this->reminderMinutesBefore = $minutes;
    }

    public function getReminderFiredAt(): ?\DateTimeImmutable
    {
        return $this->reminderFiredAt;
    }

    public function setReminderFiredAt(?\DateTimeImmutable $firedAt): void
    {
        $this->reminderFiredAt = $firedAt;
    }

    /** @return list<array<string, mixed>>|null */
    public function getChecklist(): ?array
    {
        return $this->checklist;
    }

    /** @param list<array<string, mixed>>|null $checklist */
    public function setChecklist(?array $checklist): void
    {
        $this->checklist = $checklist;
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
