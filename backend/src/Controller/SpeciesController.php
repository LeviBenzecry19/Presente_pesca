<?php

declare(strict_types=1);

namespace App\Controller;

use App\Dto\NearbyQuery;
use App\Repository\FishCatchRepository;
use App\Support\Dates;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Attribute\MapQueryString;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Inteligência coletiva (seção 5.1 da especificação): o que anda sendo pescado
 * perto de um ponto, agregado de todos os aparelhos.
 *
 * A resposta é sempre agregada — contagens, médias e horários — e nunca revela
 * quem registrou a captura.
 */
final class SpeciesController extends AbstractController
{
    /** Abaixo disso a amostra é pequena demais para sugerir horário. */
    private const MIN_CATCHES_FOR_HOURS = 3;

    public function __construct(
        private readonly FishCatchRepository $catches,
    ) {
    }

    #[Route('/v1/species/nearby', name: 'species_nearby', methods: ['GET'])]
    public function nearby(
        // O padrão de MapQueryString é responder 404; num JSON de API,
        // "parâmetro inválido" é 422.
        #[MapQueryString(validationFailedStatusCode: Response::HTTP_UNPROCESSABLE_ENTITY)]
        NearbyQuery $query,
    ): JsonResponse {
        $rows = $this->catches->speciesNearby($query->lat, $query->lng, $query->radiusKm, $query->limit);

        $speciesIds = array_map(static fn (array $r) => (string) $r['speciesId'], $rows);
        $histogram = $this->catches->hourHistogram($query->lat, $query->lng, $query->radiusKm, $speciesIds);

        $species = [];
        $total = 0;
        foreach ($rows as $row) {
            $id = (string) $row['speciesId'];
            $count = (int) $row['catches'];
            $total += $count;

            $species[] = [
                'speciesId' => $id,
                'catches' => $count,
                'trips' => (int) $row['trips'],
                'devices' => (int) $row['devices'],
                'avgWeightKg' => null !== $row['avgWeightKg'] ? round((float) $row['avgWeightKg'], 3) : null,
                'maxWeightKg' => null !== $row['maxWeightKg'] ? (float) $row['maxWeightKg'] : null,
                'avgLengthCm' => null !== $row['avgLengthCm'] ? round((float) $row['avgLengthCm'], 1) : null,
                'nearestKm' => round(((float) $row['nearestMeters']) / 1000, 2),
                // O SQL cru devolve "2026-09-08 15:02:45"; o resto da API fala ISO em UTC.
                'firstCaughtAt' => $this->isoFromDatabase($row['firstCaughtAt']),
                'lastCaughtAt' => $this->isoFromDatabase($row['lastCaughtAt']),
                'bestHours' => $count >= self::MIN_CATCHES_FOR_HOURS
                    ? $this->bestHours($histogram[$id] ?? [])
                    : [],
            ];
        }

        return $this->json([
            'ok' => true,
            'center' => ['lat' => $query->lat, 'lng' => $query->lng],
            'radiusKm' => $query->radiusKm,
            'totalCatches' => $total,
            'species' => $species,
            'note' => 'Dados agregados das capturas registradas pelos usuários. Amostras pequenas são pouco confiáveis.',
        ]);
    }

    private function isoFromDatabase(mixed $value): ?string
    {
        if (!\is_string($value) || '' === $value) {
            return null;
        }

        // As colunas são DATETIME sem fuso e o backend grava tudo em UTC.
        return Dates::iso(new \DateTimeImmutable($value, new \DateTimeZone(Dates::UTC)));
    }

    /**
     * @param array<int, int> $byHour
     *
     * @return list<array{hour: int, catches: int}>
     */
    private function bestHours(array $byHour): array
    {
        arsort($byHour);
        $top = \array_slice($byHour, 0, 3, true);

        $out = [];
        foreach ($top as $hour => $catches) {
            $out[] = ['hour' => $hour, 'catches' => $catches];
        }

        return $out;
    }
}
