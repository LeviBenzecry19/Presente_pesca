<?php

declare(strict_types=1);

namespace App\Sync;

use App\Dto\CatchPayload;
use App\Dto\ProfilePayload;
use App\Dto\SpotPayload;
use App\Dto\SyncItemInput;
use App\Dto\TripPayload;
use App\Entity\Device;
use App\Entity\FishCatch;
use App\Entity\FishingSpot;
use App\Entity\FishingTrip;
use App\Entity\Profile;
use App\Enum\Ambiente;
use App\Enum\TripStatus;
use App\Repository\FishCatchRepository;
use App\Repository\FishingSpotRepository;
use App\Repository\FishingTripRepository;
use App\Service\PhotoStorage;
use App\Support\Dates;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\Serializer\Exception\ExceptionInterface as SerializerException;
use Symfony\Component\Serializer\Normalizer\DenormalizerInterface;
use Symfony\Component\Validator\Validator\ValidatorInterface;

/**
 * Aplica um lote de alterações vindas do aparelho.
 *
 * Regras do contrato (docs/backend/API.md):
 * - idempotente por id: reenviar o mesmo item não duplica nada;
 * - conflito resolvido por last-write-wins comparando `updatedAt`;
 * - `delete` de algo inexistente responde ok;
 * - exclusão é lógica (`deleted_at`), para que GET /v1/sync consiga propagar
 *   a remoção para os outros aparelhos.
 */
final class SyncProcessor
{
    /**
     * Ordem que respeita as chaves estrangeiras dentro de um mesmo lote:
     * cria de fora para dentro, apaga de dentro para fora.
     */
    private const RANK = [
        'upsert' => ['profile' => 0, 'spot' => 1, 'trip' => 2, 'catch' => 3],
        'delete' => ['catch' => 4, 'trip' => 5, 'spot' => 6, 'profile' => 7],
    ];

    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly DenormalizerInterface $denormalizer,
        private readonly ValidatorInterface $validator,
        private readonly FishingSpotRepository $spots,
        private readonly FishingTripRepository $trips,
        private readonly FishCatchRepository $catches,
        private readonly PhotoStorage $photos,
        private readonly LoggerInterface $logger,
    ) {
    }

    /**
     * @param SyncItemInput[] $items
     *
     * @return list<array{id: string, ok: bool, status?: string, error?: string}>
     */
    public function process(Device $device, array $items): array
    {
        // Ordena por dependência, mas mantém a ordem original entre iguais.
        $ordered = [];
        foreach (array_values($items) as $index => $item) {
            $ordered[] = [self::RANK[$item->op][$item->entity] ?? 9, $index, $item];
        }
        usort($ordered, static fn (array $a, array $b) => [$a[0], $a[1]] <=> [$b[0], $b[1]]);

        $results = [];
        $staged = [];
        $now = Dates::now();

        foreach ($ordered as [, $index, $item]) {
            try {
                $status = $this->applyItem($device, $item, $now);
                $results[$index] = ['id' => $item->id, 'ok' => true, 'status' => $status];
                $staged[$index] = true;
            } catch (SyncItemException $e) {
                $results[$index] = ['id' => $item->id, 'ok' => false, 'error' => $e->getMessage()];
            }
        }

        // Um único flush: itens rejeitados acima nunca chegaram ao EntityManager,
        // então aqui só sobram gravações válidas.
        try {
            $this->em->flush();
        } catch (\Throwable $e) {
            $this->logger->error('Falha ao gravar lote de sincronização', ['exception' => $e]);
            foreach (array_keys($staged) as $index) {
                $results[$index] = [
                    'id' => $results[$index]['id'],
                    'ok' => false,
                    'error' => 'Falha ao gravar no banco; tente novamente.',
                ];
            }
        }

        ksort($results);

        return array_values($results);
    }

    private function applyItem(Device $device, SyncItemInput $item, \DateTimeImmutable $now): string
    {
        return match ($item->entity) {
            'profile' => 'upsert' === $item->op
                ? $this->upsertProfile($device, $item)
                : $this->deleteProfile($device, $item->id, $now),
            'spot' => 'upsert' === $item->op
                ? $this->upsertSpot($device, $item)
                : $this->deleteSpot($device, $item->id, $now),
            'trip' => 'upsert' === $item->op
                ? $this->upsertTrip($device, $item)
                : $this->deleteTrip($device, $item->id, $now),
            'catch' => 'upsert' === $item->op
                ? $this->upsertCatch($device, $item)
                : $this->deleteCatch($device, $item->id, $now),
            default => throw new SyncItemException(\sprintf('entidade desconhecida: %s', $item->entity)),
        };
    }

    /* ------------------------------------------------------------------ */
    /* Perfis                                                              */
    /* ------------------------------------------------------------------ */

    private function upsertProfile(Device $device, SyncItemInput $item): string
    {
        /** @var ProfilePayload $payload */
        $payload = $this->payload($item, ProfilePayload::class);
        $updatedAt = $this->date($payload->updatedAt, 'updatedAt');

        $profile = $this->em->find(Profile::class, $item->id);
        if (null === $profile) {
            $profile = new Profile($item->id, $device);
            $profile->setCreatedAt($this->date($payload->createdAt, 'createdAt'));
            $this->em->persist($profile);
        } else {
            $this->assertOwner($profile->getDevice(), $device, 'perfil');
            if ($profile->getUpdatedAt() >= $updatedAt) {
                return 'skipped';
            }
        }

        $profile->setName($payload->name);
        $profile->setAvatar($payload->avatar);
        $profile->setPassword($payload->passwordHash, $payload->passwordSalt);
        $profile->setUpdatedAt($updatedAt);
        $profile->setDeletedAt(null);

        return 'applied';
    }

    private function deleteProfile(Device $device, string $id, \DateTimeImmutable $now): string
    {
        $profile = $this->em->find(Profile::class, $id);
        if (null === $profile) {
            return 'ignored';
        }
        $this->assertOwner($profile->getDevice(), $device, 'perfil');
        if ($profile->isDeleted()) {
            return 'skipped';
        }

        // Apagar o perfil leva junto tudo o que era dele, como no aparelho.
        foreach ($this->catches->findByProfile($profile) as $catch) {
            if (!$catch->isDeleted()) {
                $this->photos->delete($catch->getPhotoPath());
                $catch->setPhoto(null, null, null);
                $catch->setDeletedAt($now);
                $catch->setUpdatedAt($now);
            }
        }
        foreach ($this->trips->findByProfile($profile) as $trip) {
            if (!$trip->isDeleted()) {
                $trip->setDeletedAt($now);
                $trip->setUpdatedAt($now);
            }
        }
        foreach ($this->spots->findByProfile($profile) as $spot) {
            if (!$spot->isDeleted()) {
                $spot->setDeletedAt($now);
                $spot->setUpdatedAt($now);
            }
        }

        $profile->setDeletedAt($now);
        $profile->setUpdatedAt($now);

        return 'deleted';
    }

    /**
     * Resolve o perfil citado num payload.
     *
     * Ausente = cliente antigo, anterior aos perfis: grava sem vínculo.
     * Presente mas desconhecido = erro retentável; o cliente reenvia depois que
     * o perfil subir (a ordenação do lote já cuida do caso normal).
     */
    private function resolveProfile(Device $device, ?string $profileId): ?Profile
    {
        if (null === $profileId) {
            return null;
        }
        $profile = $this->em->find(Profile::class, $profileId);
        if (null === $profile) {
            throw new SyncItemException(\sprintf('perfil desconhecido: %s', $profileId));
        }
        $this->assertOwner($profile->getDevice(), $device, 'perfil');

        return $profile;
    }

    /* ------------------------------------------------------------------ */
    /* Spots                                                          */
    /* ------------------------------------------------------------------ */

    private function upsertSpot(Device $device, SyncItemInput $item): string
    {
        /** @var SpotPayload $payload */
        $payload = $this->payload($item, SpotPayload::class);
        $updatedAt = $this->date($payload->updatedAt, 'updatedAt');

        $spot = $this->em->find(FishingSpot::class, $item->id);
        if (null === $spot) {
            $spot = new FishingSpot($item->id, $device);
            $spot->setCreatedAt($this->date($payload->createdAt, 'createdAt'));
            $this->em->persist($spot);
        } else {
            $this->assertOwner($spot->getDevice(), $device, 'spot');
            if ($spot->getUpdatedAt() >= $updatedAt) {
                return 'skipped';
            }
        }

        $spot->setProfile($this->resolveProfile($device, $payload->profileId));
        $spot->setName($payload->name);
        $spot->setAmbiente(Ambiente::from($payload->ambiente));
        $spot->setCoords($payload->lat, $payload->lng);
        $spot->setNotes($payload->notes);
        $spot->setUpdatedAt($updatedAt);
        $spot->setDeletedAt(null);

        return 'applied';
    }

    private function deleteSpot(Device $device, string $id, \DateTimeImmutable $now): string
    {
        $spot = $this->em->find(FishingSpot::class, $id);
        if (null === $spot) {
            return 'ignored';
        }
        $this->assertOwner($spot->getDevice(), $device, 'spot');
        if ($spot->isDeleted()) {
            return 'skipped';
        }

        // As pescarias mantêm coordenadas próprias; só perdem a referência.
        foreach ($this->trips->findBySpot($spot) as $trip) {
            $trip->setSpot(null);
            $trip->setUpdatedAt($now);
        }

        $spot->setDeletedAt($now);
        $spot->setUpdatedAt($now);

        return 'deleted';
    }

    /* ------------------------------------------------------------------ */
    /* Pescarias                                                           */
    /* ------------------------------------------------------------------ */

    private function upsertTrip(Device $device, SyncItemInput $item): string
    {
        /** @var TripPayload $payload */
        $payload = $this->payload($item, TripPayload::class);
        $updatedAt = $this->date($payload->updatedAt, 'updatedAt');

        $trip = $this->em->find(FishingTrip::class, $item->id);
        if (null === $trip) {
            $trip = new FishingTrip($item->id, $device);
            $trip->setCreatedAt($this->date($payload->createdAt, 'createdAt'));
            $this->em->persist($trip);
        } else {
            $this->assertOwner($trip->getDevice(), $device, 'pescaria');
            if ($trip->getUpdatedAt() >= $updatedAt) {
                return 'skipped';
            }
        }

        $spot = null;
        if (null !== $payload->spotId) {
            $spot = $this->em->find(FishingSpot::class, $payload->spotId);
            if (null !== $spot) {
                $this->assertOwner($spot->getDevice(), $device, 'spot');
            }
            // Spot desconhecido não bloqueia a pescaria: ela guarda as
            // próprias coordenadas, e o cliente já desfaz o vínculo ao apagar
            // um spot. Perder a referência é melhor que travar a fila.
        }

        $trip->setProfile($this->resolveProfile($device, $payload->profileId));
        $trip->setSpot($spot);
        $trip->setTitle($payload->title);
        $trip->setPlannedAt($this->date($payload->plannedAt, 'plannedAt'));
        $trip->setCoords($payload->lat, $payload->lng);
        $trip->setLocationName($payload->locationName);
        $trip->setAmbiente(Ambiente::from($payload->ambiente));
        $trip->setStatus(TripStatus::from($payload->status));
        $trip->setStartedAt($this->dateOrNull($payload->startedAt, 'startedAt'));
        $trip->setEndedAt($this->dateOrNull($payload->endedAt, 'endedAt'));
        $trip->setStartCoords($payload->startLat, $payload->startLng);
        $trip->setEndCoords($payload->endLat, $payload->endLng);
        $trip->setWeather($payload->weather);
        $trip->setReminderMinutesBefore($payload->reminderMinutesBefore);
        $trip->setReminderFiredAt($this->dateOrNull($payload->reminderFiredAt, 'reminderFiredAt'));
        $trip->setChecklist($payload->checklist);
        $trip->setNotes($payload->notes);
        $trip->setUpdatedAt($updatedAt);
        $trip->setDeletedAt(null);

        return 'applied';
    }

    private function deleteTrip(Device $device, string $id, \DateTimeImmutable $now): string
    {
        $trip = $this->em->find(FishingTrip::class, $id);
        if (null === $trip) {
            return 'ignored';
        }
        $this->assertOwner($trip->getDevice(), $device, 'pescaria');
        if ($trip->isDeleted()) {
            return 'skipped';
        }

        // Apagar a pescaria leva junto as capturas dela, como no cliente.
        foreach ($this->catches->findByTrip($trip) as $catch) {
            if (!$catch->isDeleted()) {
                $this->photos->delete($catch->getPhotoPath());
                $catch->setPhoto(null, null, null);
                $catch->setDeletedAt($now);
                $catch->setUpdatedAt($now);
            }
        }

        $trip->setDeletedAt($now);
        $trip->setUpdatedAt($now);

        return 'deleted';
    }

    /* ------------------------------------------------------------------ */
    /* Capturas                                                            */
    /* ------------------------------------------------------------------ */

    private function upsertCatch(Device $device, SyncItemInput $item): string
    {
        /** @var CatchPayload $payload */
        $payload = $this->payload($item, CatchPayload::class);
        $updatedAt = $this->date($payload->updatedAt, 'updatedAt');

        $trip = $this->em->find(FishingTrip::class, $payload->tripId);
        if (null === $trip) {
            // Retentável: o cliente reenvia depois que a pescaria subir.
            throw new SyncItemException(\sprintf('pescaria desconhecida: %s', $payload->tripId));
        }
        $this->assertOwner($trip->getDevice(), $device, 'pescaria');

        $catch = $this->em->find(FishCatch::class, $item->id);
        if (null === $catch) {
            $catch = new FishCatch($item->id, $trip, $device);
            $catch->setCreatedAt($this->date($payload->createdAt, 'createdAt'));
            $this->em->persist($catch);
        } else {
            $this->assertOwner($catch->getDevice(), $device, 'captura');
            if ($catch->getUpdatedAt() >= $updatedAt) {
                return 'skipped';
            }
            $catch->setTrip($trip);
        }

        // Sem profileId no payload, herda o da pescaria: é sempre o mesmo.
        $catch->setProfile($this->resolveProfile($device, $payload->profileId) ?? $trip->getProfile());
        $catch->setSpeciesId($payload->speciesId);
        $catch->setSpeciesCustom($payload->speciesCustom);
        $catch->setWeightKg($payload->weightKg);
        $catch->setLengthCm($payload->lengthCm);
        // Sem GPS na captura, vale o ponto da pescaria — o cliente faz o mesmo.
        $catch->setCoords($payload->lat ?? $trip->getLat(), $payload->lng ?? $trip->getLng());
        $catch->setCaughtAt($this->date($payload->caughtAt, 'caughtAt'));
        $catch->setBait($payload->bait);
        $catch->setNotes($payload->notes);
        $catch->setPhotoExpected($payload->hasPhoto);
        $catch->setUpdatedAt($updatedAt);
        $catch->setDeletedAt(null);

        // O cliente removeu a foto: some também do servidor.
        if (!$payload->hasPhoto && $catch->hasPhoto()) {
            $this->photos->delete($catch->getPhotoPath());
            $catch->setPhoto(null, null, null);
        }

        return 'applied';
    }

    private function deleteCatch(Device $device, string $id, \DateTimeImmutable $now): string
    {
        $catch = $this->em->find(FishCatch::class, $id);
        if (null === $catch) {
            return 'ignored';
        }
        $this->assertOwner($catch->getDevice(), $device, 'captura');
        if ($catch->isDeleted()) {
            return 'skipped';
        }

        $this->photos->delete($catch->getPhotoPath());
        $catch->setPhoto(null, null, null);
        $catch->setPhotoExpected(false);
        $catch->setDeletedAt($now);
        $catch->setUpdatedAt($now);

        return 'deleted';
    }

    /* ------------------------------------------------------------------ */
    /* Apoio                                                               */
    /* ------------------------------------------------------------------ */

    /**
     * @template T of object
     *
     * @param class-string<T> $class
     *
     * @return T
     */
    private function payload(SyncItemInput $item, string $class): object
    {
        if (null === $item->data) {
            throw new SyncItemException('campo "data" ausente para uma operação de upsert');
        }

        try {
            // O formato "json" importa: sem ele o Serializer recusa um inteiro
            // onde o DTO pede float, e o JavaScript serializa 48.0 como 48.
            /** @var T $dto */
            $dto = $this->denormalizer->denormalize($item->data, $class, 'json');
        } catch (SerializerException $e) {
            throw new SyncItemException('payload inválido: '.$e->getMessage());
        }

        $violations = $this->validator->validate($dto);
        if (\count($violations) > 0) {
            $messages = [];
            foreach ($violations as $violation) {
                $messages[] = $violation->getPropertyPath().': '.$violation->getMessage();
            }
            throw new SyncItemException(implode('; ', $messages));
        }

        if (property_exists($dto, 'id') && $dto->id !== $item->id) {
            throw new SyncItemException('o id dentro de "data" não confere com o id do item');
        }

        return $dto;
    }

    private function date(string $value, string $field): \DateTimeImmutable
    {
        try {
            return Dates::parseUtc($value);
        } catch (\InvalidArgumentException $e) {
            throw new SyncItemException($field.': '.$e->getMessage());
        }
    }

    private function dateOrNull(?string $value, string $field): ?\DateTimeImmutable
    {
        return null === $value || '' === trim($value) ? null : $this->date($value, $field);
    }

    private function assertOwner(Device $owner, Device $device, string $what): void
    {
        if ($owner->getId() !== $device->getId()) {
            throw new SyncItemException(\sprintf('este %s pertence a outro aparelho', $what));
        }
    }
}
