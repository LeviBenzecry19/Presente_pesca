<?php

declare(strict_types=1);

namespace App\Dto;

use Symfony\Component\Validator\Constraints as Assert;

/**
 * Espelha `Profile` de src/lib/db/schema.ts.
 *
 * `avatar` é "preset:<id>" ou uma data URL de ~35 KB; o limite acomoda a foto
 * comprimida em 256px que o cliente gera.
 */
final class ProfilePayload
{
    public function __construct(
        #[Assert\NotBlank]
        #[Assert\Uuid]
        public string $id,

        #[Assert\NotBlank]
        #[Assert\Length(max: 60)]
        public string $name,

        #[Assert\NotBlank]
        #[Assert\Length(max: 200_000)]
        public string $avatar,

        #[Assert\NotBlank]
        public string $createdAt,

        #[Assert\NotBlank]
        public string $updatedAt,

        #[Assert\Length(max: 128)]
        public string $passwordHash = '',

        #[Assert\Length(max: 64)]
        public string $passwordSalt = '',
    ) {
    }
}
