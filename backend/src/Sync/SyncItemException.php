<?php

declare(strict_types=1);

namespace App\Sync;

/**
 * Falha de um item isolado do lote: os demais continuam sendo aplicados e o
 * cliente recebe `ok: false` só para este, mantendo-o na fila para retentar.
 */
final class SyncItemException extends \RuntimeException
{
}
