<?php

declare(strict_types=1);

namespace App\Dto;

use Symfony\Component\Validator\Constraints as Assert;

/**
 * Query de GET /v1/species/nearby. `lat` e `lng` não têm padrão de propósito:
 * sem eles a requisição falha com 422 em vez de responder sobre o ponto errado.
 */
final class NearbyQuery
{
    public function __construct(
        #[Assert\Range(min: -90, max: 90)]
        public float $lat,

        #[Assert\Range(min: -180, max: 180)]
        public float $lng,

        #[Assert\Range(min: 0.1, max: 500)]
        public float $radiusKm = 25.0,

        #[Assert\Range(min: 1, max: 50)]
        public int $limit = 15,
    ) {
    }
}
