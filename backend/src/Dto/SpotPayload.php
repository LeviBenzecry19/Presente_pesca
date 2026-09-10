<?php

declare(strict_types=1);

namespace App\Dto;

use App\Enum\Ambiente;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Espelha `FishingSpot` de src/lib/db/schema.ts. Campos extras enviados pelo
 * cliente (ex.: syncedAt) são simplesmente ignorados na desserialização.
 */
final class SpotPayload
{
    public function __construct(
        #[Assert\NotBlank]
        #[Assert\Uuid]
        public string $id,

        #[Assert\NotBlank]
        #[Assert\Length(max: 160)]
        public string $name,

        #[Assert\NotBlank]
        #[Assert\Choice(callback: [Ambiente::class, 'values'])]
        public string $ambiente,

        #[Assert\Range(min: -90, max: 90)]
        public float $lat,

        #[Assert\Range(min: -180, max: 180)]
        public float $lng,

        #[Assert\NotBlank]
        public string $createdAt,

        #[Assert\NotBlank]
        public string $updatedAt,

        #[Assert\Length(max: 5000)]
        public ?string $notes = null,

        /** Ausente em clientes anteriores aos perfis. */
        #[Assert\Uuid]
        public ?string $profileId = null,
    ) {
    }
}
