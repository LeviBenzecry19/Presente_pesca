<?php

declare(strict_types=1);

namespace App\Dto;

use Symfony\Component\Validator\Constraints as Assert;

/**
 * Um item do lote enviado pelo cliente. O conteúdo de `data` varia por
 * entidade e é validado depois, no SyncProcessor.
 */
final class SyncItemInput
{
    public const ENTITIES = ['profile', 'spot', 'trip', 'catch'];
    public const OPS = ['upsert', 'delete'];

    /**
     * @param array<string, mixed>|null $data
     */
    public function __construct(
        #[Assert\NotBlank]
        #[Assert\Choice(choices: self::ENTITIES)]
        public string $entity,

        #[Assert\NotBlank]
        #[Assert\Choice(choices: self::OPS)]
        public string $op,

        #[Assert\NotBlank]
        #[Assert\Uuid]
        public string $id,

        public ?array $data = null,
    ) {
    }
}
