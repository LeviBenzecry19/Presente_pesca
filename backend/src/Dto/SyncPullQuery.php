<?php

declare(strict_types=1);

namespace App\Dto;

use Symfony\Component\Validator\Constraints as Assert;

/**
 * Query de GET /v1/sync (download de alterações para outro aparelho).
 */
final class SyncPullQuery
{
    public function __construct(
        public ?string $since = null,

        #[Assert\Range(min: 1, max: 1000)]
        public int $limit = 500,
    ) {
    }
}
