<?php

declare(strict_types=1);

namespace App\Dto;

use Symfony\Component\Validator\Constraints as Assert;

/**
 * Corpo de POST /v1/sync. O cliente manda lotes de até 25 itens
 * (SYNC_BATCH_SIZE em src/lib/sync/client.ts); o limite aqui é folgado.
 */
final class SyncRequest
{
    /**
     * @param SyncItemInput[] $items
     */
    public function __construct(
        #[Assert\NotBlank]
        #[Assert\Uuid]
        public string $deviceId,

        #[Assert\Valid]
        #[Assert\Count(min: 1, max: 200)]
        public array $items = [],
    ) {
    }
}
