<?php

declare(strict_types=1);

namespace App\Sync;

use App\Entity\FishCatch;
use App\Entity\FishingSpot;
use App\Entity\FishingTrip;
use App\Entity\Profile;
use App\Support\Dates;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;

/**
 * Converte entidades para o formato que o cliente entende.
 *
 * A montagem é explícita (em vez de grupos do Serializer) porque isto é a
 * fronteira do contrato: os nomes precisam bater exatamente com os tipos de
 * src/lib/db/schema.ts, e um campo renomeado sem querer quebraria o app.
 */
final class SyncPresenter
{
    public function __construct(
        private readonly UrlGeneratorInterface $urls,
    ) {
    }

    /**
     * O hash da senha volta junto porque é o que permite restaurar um backup
     * com a proteção do perfil intacta. Nunca é a senha, e a rota já é
     * restrita ao próprio aparelho.
     *
     * @return array<string, mixed>
     */
    public function profile(Profile $profile): array
    {
        return [
            'id' => $profile->getId(),
            'name' => $profile->getName(),
            'avatar' => $profile->getAvatar(),
            'passwordHash' => $profile->getPasswordHash(),
            'passwordSalt' => $profile->getPasswordSalt(),
            'createdAt' => Dates::iso($profile->getCreatedAt()),
            'updatedAt' => Dates::iso($profile->getUpdatedAt()),
            'deletedAt' => Dates::iso($profile->getDeletedAt()),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function spot(FishingSpot $spot): array
    {
        return [
            'id' => $spot->getId(),
            'profileId' => $spot->getProfile()?->getId(),
            'name' => $spot->getName(),
            'ambiente' => $spot->getAmbiente()->value,
            'lat' => $spot->getLat(),
            'lng' => $spot->getLng(),
            'notes' => $spot->getNotes(),
            'createdAt' => Dates::iso($spot->getCreatedAt()),
            'updatedAt' => Dates::iso($spot->getUpdatedAt()),
            'deletedAt' => Dates::iso($spot->getDeletedAt()),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function trip(FishingTrip $trip): array
    {
        return [
            'id' => $trip->getId(),
            'profileId' => $trip->getProfile()?->getId(),
            'title' => $trip->getTitle(),
            'plannedAt' => Dates::iso($trip->getPlannedAt()),
            'lat' => $trip->getLat(),
            'lng' => $trip->getLng(),
            'locationName' => $trip->getLocationName(),
            'spotId' => $trip->getSpot()?->getId(),
            'ambiente' => $trip->getAmbiente()->value,
            'status' => $trip->getStatus()->value,
            'startedAt' => Dates::iso($trip->getStartedAt()),
            'endedAt' => Dates::iso($trip->getEndedAt()),
            'startLat' => $trip->getStartLat(),
            'startLng' => $trip->getStartLng(),
            'endLat' => $trip->getEndLat(),
            'endLng' => $trip->getEndLng(),
            'weather' => $trip->getWeather(),
            'reminderMinutesBefore' => $trip->getReminderMinutesBefore(),
            'reminderFiredAt' => Dates::iso($trip->getReminderFiredAt()),
            'checklist' => $trip->getChecklist(),
            'notes' => $trip->getNotes(),
            'createdAt' => Dates::iso($trip->getCreatedAt()),
            'updatedAt' => Dates::iso($trip->getUpdatedAt()),
            'deletedAt' => Dates::iso($trip->getDeletedAt()),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function catch(FishCatch $catch): array
    {
        return [
            'id' => $catch->getId(),
            'profileId' => $catch->getProfile()?->getId(),
            'tripId' => $catch->getTrip()->getId(),
            'speciesId' => $catch->getSpeciesId(),
            'speciesCustom' => $catch->getSpeciesCustom(),
            'weightKg' => $catch->getWeightKg(),
            'lengthCm' => $catch->getLengthCm(),
            'lat' => $catch->getLat(),
            'lng' => $catch->getLng(),
            'caughtAt' => Dates::iso($catch->getCaughtAt()),
            'bait' => $catch->getBait(),
            'notes' => $catch->getNotes(),
            'hasPhoto' => $catch->hasPhoto(),
            'photoUrl' => $catch->hasPhoto() ? $this->photoUrl($catch->getId()) : null,
            'photoBytes' => $catch->getPhotoBytes(),
            'createdAt' => Dates::iso($catch->getCreatedAt()),
            'updatedAt' => Dates::iso($catch->getUpdatedAt()),
            'deletedAt' => Dates::iso($catch->getDeletedAt()),
        ];
    }

    public function photoUrl(string $catchId): string
    {
        return $this->urls->generate(
            'catch_photo_get',
            ['id' => $catchId],
            UrlGeneratorInterface::ABSOLUTE_URL,
        );
    }
}
