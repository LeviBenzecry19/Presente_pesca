<?php

declare(strict_types=1);

namespace App\Enum;

/**
 * Ambiente de pesca. Os valores espelham o tipo `Ambiente` do cliente
 * (src/lib/db/schema.ts) e são gravados como string na coluna.
 */
enum Ambiente: string
{
    case AguaDoce = 'agua_doce';
    case Mar = 'mar';

    /**
     * Usado por #[Assert\Choice], que compara strings — por isso devolve os
     * valores, e não os casos do enum.
     *
     * @return list<string>
     */
    public static function values(): array
    {
        return array_map(static fn (self $c) => $c->value, self::cases());
    }
}
