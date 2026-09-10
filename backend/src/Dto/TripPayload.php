<?php

declare(strict_types=1);

namespace App\Dto;

use App\Enum\Ambiente;
use App\Enum\TripStatus;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Espelha `FishingTrip` de src/lib/db/schema.ts. `weather` chega como o
 * WeatherSnapshot inteiro e é guardado em JSON, sem reinterpretação.
 */
final class TripPayload
{
    /**
     * @param array<string, mixed>|null    $weather
     * @param list<array<string, mixed>>|null $checklist
     */
    public function __construct(
        #[Assert\NotBlank]
        #[Assert\Uuid]
        public string $id,

        #[Assert\NotBlank]
        public string $plannedAt,

        #[Assert\Range(min: -90, max: 90)]
        public float $lat,

        #[Assert\Range(min: -180, max: 180)]
        public float $lng,

        #[Assert\NotBlank]
        #[Assert\Choice(callback: [Ambiente::class, 'values'])]
        public string $ambiente,

        #[Assert\NotBlank]
        #[Assert\Choice(callback: [TripStatus::class, 'values'])]
        public string $status,

        #[Assert\NotBlank]
        public string $createdAt,

        #[Assert\NotBlank]
        public string $updatedAt,

        #[Assert\Length(max: 160)]
        public ?string $title = null,

        #[Assert\Length(max: 255)]
        public ?string $locationName = null,

        #[Assert\Uuid]
        public ?string $spotId = null,

        public ?string $startedAt = null,
        public ?string $endedAt = null,

        #[Assert\Range(min: -90, max: 90)]
        public ?float $startLat = null,

        #[Assert\Range(min: -180, max: 180)]
        public ?float $startLng = null,

        #[Assert\Range(min: -90, max: 90)]
        public ?float $endLat = null,

        #[Assert\Range(min: -180, max: 180)]
        public ?float $endLng = null,

        public ?array $weather = null,

        #[Assert\Range(min: 0, max: 20160)]
        public ?int $reminderMinutesBefore = null,

        public ?string $reminderFiredAt = null,

        public ?array $checklist = null,

        #[Assert\Length(max: 20000)]
        public ?string $notes = null,

        /** Ausente em clientes anteriores aos perfis. */
        #[Assert\Uuid]
        public ?string $profileId = null,
    ) {
    }
}
