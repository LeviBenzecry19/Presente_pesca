<?php

declare(strict_types=1);

namespace App\Tests\Api;

/**
 * Agregação geográfica das capturas — a base da "previsão de locais por
 * espécie" da seção 5.1 da especificação.
 */
final class SpeciesNearbyTest extends ApiTestCase
{
    /** Brasília. */
    private const LAT = -15.78;
    private const LNG = -47.93;

    /** ~100 km ao norte: 0.9° de latitude × 111,32 km/°. */
    private const LAT_100KM = -14.88;

    private function seedCatches(): void
    {
        $tripId = $this->uuid();
        $items = [$this->tripItem($tripId)];

        // Três tucunarés pertinho, em dias e horários diferentes.
        foreach ([[0, '06', 0.0009, 2.0], [1, '06', 0.0011, 3.0], [2, '17', 0.0013, 4.0]] as [$day, $hour, $offset, $weight]) {
            $items[] = $this->catchItem($this->uuid(), $tripId, [
                'speciesId' => 'tucunare',
                'lat' => self::LAT + $offset,
                'lng' => self::LNG + $offset,
                'weightKg' => $weight,
                'caughtAt' => \sprintf('2026-09-1%dT%s:30:00.000Z', $day, $hour),
            ]);
        }

        // Um dourado no mesmo ponto.
        $items[] = $this->catchItem($this->uuid(), $tripId, [
            'speciesId' => 'dourado',
            'lat' => self::LAT,
            'lng' => self::LNG,
            'weightKg' => 5.5,
        ]);

        // Uma traíra a ~100 km: fora do raio curto, dentro do longo.
        $farTrip = $this->uuid();
        $items[] = $this->tripItem($farTrip, ['lat' => self::LAT_100KM, 'lng' => self::LNG]);
        $items[] = $this->catchItem($this->uuid(), $farTrip, [
            'speciesId' => 'traira',
            'lat' => self::LAT_100KM,
            'lng' => self::LNG,
        ]);

        $body = $this->sync($items);
        self::assertTrue($body['ok'], json_encode($body['results']));
    }

    public function testAggregatesSpeciesWithinRadius(): void
    {
        $this->seedCatches();

        $body = $this->getJson(\sprintf('/v1/species/nearby?lat=%s&lng=%s&radiusKm=25', self::LAT, self::LNG));

        self::assertResponseIsSuccessful();
        self::assertTrue($body['ok']);
        self::assertSame(4, $body['totalCatches'], 'a traíra a 100 km deveria ficar de fora');

        $species = array_column($body['species'], null, 'speciesId');
        self::assertArrayHasKey('tucunare', $species);
        self::assertArrayHasKey('dourado', $species);
        self::assertArrayNotHasKey('traira', $species);

        // Espécie com mais capturas vem primeiro.
        self::assertSame('tucunare', $body['species'][0]['speciesId']);
        self::assertSame(3, $species['tucunare']['catches']);
        self::assertEqualsWithDelta(3.0, $species['tucunare']['avgWeightKg'], 0.01);
        self::assertEqualsWithDelta(4.0, $species['tucunare']['maxWeightKg'], 0.01);
        self::assertLessThan(1.0, $species['tucunare']['nearestKm']);
    }

    public function testWiderRadiusReachesTheDistantCatch(): void
    {
        $this->seedCatches();

        $near = $this->getJson(\sprintf('/v1/species/nearby?lat=%s&lng=%s&radiusKm=25', self::LAT, self::LNG));
        self::assertArrayNotHasKey('traira', array_column($near['species'], null, 'speciesId'));

        $far = $this->getJson(\sprintf('/v1/species/nearby?lat=%s&lng=%s&radiusKm=200', self::LAT, self::LNG));
        $species = array_column($far['species'], null, 'speciesId');

        self::assertArrayHasKey('traira', $species);
        self::assertSame(5, $far['totalCatches']);
        self::assertGreaterThan(90, $species['traira']['nearestKm']);
        self::assertLessThan(110, $species['traira']['nearestKm']);
    }

    public function testDatesUseTheSameIsoFormatAsTheRestOfTheApi(): void
    {
        $this->seedCatches();

        $body = $this->getJson(\sprintf('/v1/species/nearby?lat=%s&lng=%s&radiusKm=25', self::LAT, self::LNG));
        $species = array_column($body['species'], null, 'speciesId');

        self::assertSame('2026-09-10T06:30:00.000Z', $species['tucunare']['firstCaughtAt']);
        self::assertSame('2026-09-12T17:30:00.000Z', $species['tucunare']['lastCaughtAt']);
    }

    public function testBestHoursComeFromTheCatchHistory(): void
    {
        $this->seedCatches();

        $body = $this->getJson(\sprintf('/v1/species/nearby?lat=%s&lng=%s&radiusKm=25', self::LAT, self::LNG));
        $species = array_column($body['species'], null, 'speciesId');

        // Dois tucunarés às 6h e um às 17h.
        self::assertSame(
            ['hour' => 6, 'catches' => 2],
            $species['tucunare']['bestHours'][0],
        );

        // Amostra de uma captura só não sugere horário.
        self::assertSame([], $species['dourado']['bestHours']);
    }

    public function testAggregateCombinesDevicesWithoutRevealingThem(): void
    {
        $this->seedCatches();

        // Um segundo aparelho registra outro tucunaré no mesmo spot.
        $otherDevice = $this->uuid();
        $otherTrip = $this->uuid();
        $this->sync([
            $this->tripItem($otherTrip),
            $this->catchItem($this->uuid(), $otherTrip, ['speciesId' => 'tucunare', 'weightKg' => 1.0]),
        ], $otherDevice);

        $body = $this->getJson(\sprintf('/v1/species/nearby?lat=%s&lng=%s&radiusKm=25', self::LAT, self::LNG));
        $species = array_column($body['species'], null, 'speciesId');

        self::assertSame(4, $species['tucunare']['catches']);
        self::assertSame(2, $species['tucunare']['devices']);
        // A resposta conta aparelhos, mas nunca diz quais.
        self::assertStringNotContainsString($otherDevice, (string) $this->client->getResponse()->getContent());
    }

    public function testDeletedCatchesAreExcluded(): void
    {
        $tripId = $this->uuid();
        $catchId = $this->uuid();
        $this->sync([$this->tripItem($tripId), $this->catchItem($catchId, $tripId)]);

        $this->sync([['entity' => 'catch', 'op' => 'delete', 'id' => $catchId, 'data' => null]]);

        $body = $this->getJson(\sprintf('/v1/species/nearby?lat=%s&lng=%s&radiusKm=25', self::LAT, self::LNG));
        self::assertSame(0, $body['totalCatches']);
    }

    public function testMissingCoordinatesIsRejected(): void
    {
        $this->getJson('/v1/species/nearby?radiusKm=25');

        self::assertResponseStatusCodeSame(422);
    }

    public function testOutOfRangeCoordinatesAreRejected(): void
    {
        $this->getJson('/v1/species/nearby?lat=200&lng=0');

        self::assertResponseStatusCodeSame(422);
    }
}
