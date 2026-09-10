<?php

declare(strict_types=1);

namespace App\Controller;

use App\Dto\SyncPullQuery;
use App\Dto\SyncRequest;
use App\Repository\FishCatchRepository;
use App\Repository\FishingSpotRepository;
use App\Repository\FishingTripRepository;
use App\Repository\ProfileRepository;
use App\Service\DeviceProvider;
use App\Support\Dates;
use App\Sync\SyncPresenter;
use App\Sync\SyncProcessor;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Attribute\MapQueryString;
use Symfony\Component\HttpKernel\Attribute\MapRequestPayload;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Sincronização entre o IndexedDB do aparelho e o banco.
 * Contrato completo em docs/backend/API.md.
 */
final class SyncController extends AbstractController
{
    public function __construct(
        private readonly DeviceProvider $devices,
        private readonly SyncProcessor $processor,
        private readonly SyncPresenter $presenter,
        private readonly ProfileRepository $profiles,
        private readonly FishingSpotRepository $spots,
        private readonly FishingTripRepository $trips,
        private readonly FishCatchRepository $catches,
    ) {
    }

    /**
     * Envio: o aparelho manda a fila de alterações e recebe um resultado por item.
     */
    #[Route('/v1/sync', name: 'sync_push', methods: ['POST'])]
    public function push(
        #[MapRequestPayload] SyncRequest $payload,
        Request $request,
    ): JsonResponse {
        $device = $this->devices->fromRequest($request, $payload->deviceId);

        if ($device->getId() !== $payload->deviceId) {
            throw new BadRequestHttpException('O deviceId do corpo não confere com o header X-Device-Id.');
        }

        $results = $this->processor->process($device, $payload->items);
        $failed = array_filter($results, static fn (array $r) => !$r['ok']);

        return $this->json([
            'ok' => [] === $failed,
            'deviceId' => $device->getId(),
            'serverTime' => Dates::iso(Dates::now()),
            'results' => $results,
        ]);
    }

    /**
     * Download: alterações desde `since`, para outro aparelho do mesmo usuário.
     * Inclui registros apagados (com `deletedAt`) para propagar remoções.
     */
    #[Route('/v1/sync', name: 'sync_pull', methods: ['GET'])]
    public function pull(
        #[MapQueryString(validationFailedStatusCode: Response::HTTP_UNPROCESSABLE_ENTITY)]
        ?SyncPullQuery $query,
        Request $request,
    ): JsonResponse {
        $query ??= new SyncPullQuery();
        $device = $this->devices->fromRequest($request);

        $since = null;
        if (null !== $query->since && '' !== trim($query->since)) {
            try {
                $since = Dates::parseUtc($query->since);
            } catch (\InvalidArgumentException $e) {
                throw new BadRequestHttpException('Parâmetro "since" inválido: use ISO-8601.', $e);
            }
        }

        return $this->json([
            'ok' => true,
            'deviceId' => $device->getId(),
            'since' => Dates::iso($since),
            'serverTime' => Dates::iso(Dates::now()),
            'profiles' => array_map(
                $this->presenter->profile(...),
                $this->profiles->changedSince($device, $since, $query->limit),
            ),
            'spots' => array_map(
                $this->presenter->spot(...),
                $this->spots->changedSince($device, $since, $query->limit),
            ),
            'trips' => array_map(
                $this->presenter->trip(...),
                $this->trips->changedSince($device, $since, $query->limit),
            ),
            'catches' => array_map(
                $this->presenter->catch(...),
                $this->catches->changedSince($device, $since, $query->limit),
            ),
        ]);
    }
}
