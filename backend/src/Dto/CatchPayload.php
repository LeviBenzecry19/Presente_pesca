<?php

declare(strict_types=1);

namespace App\Dto;

use Symfony\Component\Validator\Constraints as Assert;

/**
 * Espelha `Catch` de src/lib/db/schema.ts, menos o Blob da foto: o cliente
 * manda `hasPhoto` aqui e sobe a imagem depois, em PUT /v1/catches/{id}/photo.
 */
final class CatchPayload
{
    public function __construct(
        #[Assert\NotBlank]
        #[Assert\Uuid]
        public string $id,

        #[Assert\NotBlank]
        #[Assert\Uuid]
        public string $tripId,

        #[Assert\NotBlank]
        #[Assert\Length(max: 64)]
        public string $speciesId,

        #[Assert\NotBlank]
        public string $caughtAt,

        #[Assert\NotBlank]
        public string $createdAt,

        #[Assert\NotBlank]
        public string $updatedAt,

        #[Assert\Length(max: 120)]
        public ?string $speciesCustom = null,

        #[Assert\Range(min: 0, max: 2000)]
        public ?float $weightKg = null,

        #[Assert\Range(min: 0, max: 1000)]
        public ?float $lengthCm = null,

        #[Assert\Range(min: -90, max: 90)]
        public ?float $lat = null,

        #[Assert\Range(min: -180, max: 180)]
        public ?float $lng = null,

        #[Assert\Length(max: 160)]
        public ?string $bait = null,

        #[Assert\Length(max: 20000)]
        public ?string $notes = null,

        public bool $hasPhoto = false,

        /** Ausente em clientes anteriores aos perfis. */
        #[Assert\Uuid]
        public ?string $profileId = null,
    ) {
    }
}
