<?php

declare(strict_types=1);

namespace App\Enum;

/**
 * Estado da pescaria. Espelha `TripStatus` do cliente (src/lib/db/schema.ts).
 */
enum TripStatus: string
{
    case Planejada = 'planejada';
    case EmAndamento = 'em_andamento';
    case Concluida = 'concluida';

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_map(static fn (self $c) => $c->value, self::cases());
    }
}
