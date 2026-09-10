<?php

declare(strict_types=1);

namespace App\Tests\Api;

/**
 * Exercita o contrato de POST /v1/sync do jeito que o cliente usa:
 * lotes fora de ordem, reenvio, conflito por updatedAt e exclusões.
 */
final class SyncApiTest extends ApiTestCase
{
    public function testCreatesSpotTripAndCatchInOneBatch(): void
    {
        $spotId = $this->uuid();
        $tripId = $this->uuid();
        $catchId = $this->uuid();

        // De propósito na ordem "errada": a captura vem antes da pescaria.
        $body = $this->sync([
            $this->catchItem($catchId, $tripId),
            $this->tripItem($tripId, ['spotId' => $spotId]),
            $this->spotItem($spotId),
        ]);

        self::assertResponseIsSuccessful();
        self::assertTrue($body['ok'], json_encode($body['results']));

        $results = $this->byId($body['results']);
        self::assertTrue($results[$spotId]['ok']);
        self::assertTrue($results[$tripId]['ok']);
        self::assertTrue($results[$catchId]['ok']);
        self::assertSame('applied', $results[$catchId]['status']);

        // Os resultados voltam na ordem em que o cliente mandou.
        self::assertSame(
            [$catchId, $tripId, $spotId],
            array_column($body['results'], 'id'),
        );
    }

    public function testPullReturnsWhatWasPushed(): void
    {
        $spotId = $this->uuid();
        $tripId = $this->uuid();
        $catchId = $this->uuid();

        $this->sync([
            $this->spotItem($spotId),
            $this->tripItem($tripId, ['spotId' => $spotId]),
            $this->catchItem($catchId, $tripId),
        ]);

        $body = $this->getJson('/v1/sync');

        self::assertResponseIsSuccessful();
        self::assertCount(1, $body['spots']);
        self::assertCount(1, $body['trips']);
        self::assertCount(1, $body['catches']);

        self::assertSame('Barranco da curva', $body['spots'][0]['name']);
        self::assertSame($spotId, $body['trips'][0]['spotId']);
        self::assertSame('planejada', $body['trips'][0]['status']);
        self::assertSame([['id' => 'a', 'label' => 'Iscas', 'done' => false]], $body['trips'][0]['checklist']);
        self::assertSame('tucunare', $body['catches'][0]['speciesId']);
        self::assertEqualsWithDelta(2.4, $body['catches'][0]['weightKg'], 0.001);
        self::assertFalse($body['catches'][0]['hasPhoto']);
        self::assertSame('2026-09-10T11:30:00.000Z', $body['catches'][0]['caughtAt']);
    }

    public function testResendingTheSameItemIsIdempotent(): void
    {
        $spotId = $this->uuid();
        $item = $this->spotItem($spotId);

        $this->sync([$item]);
        $second = $this->sync([$item]);

        self::assertTrue($second['ok']);
        // Mesmo updatedAt: nada a fazer, mas continua sendo sucesso.
        self::assertSame('skipped', $second['results'][0]['status']);
        self::assertCount(1, $this->getJson('/v1/sync')['spots']);
    }

    public function testOlderUpdateLosesToNewerOne(): void
    {
        $spotId = $this->uuid();

        $this->sync([$this->spotItem($spotId, [
            'name' => 'Nome novo',
            'updatedAt' => '2026-09-05T10:00:00.000Z',
        ])]);

        $body = $this->sync([$this->spotItem($spotId, [
            'name' => 'Nome antigo',
            'updatedAt' => '2026-09-02T10:00:00.000Z',
        ])]);

        self::assertSame('skipped', $body['results'][0]['status']);
        self::assertSame('Nome novo', $this->getJson('/v1/sync')['spots'][0]['name']);
    }

    public function testNewerUpdateWins(): void
    {
        $spotId = $this->uuid();
        $this->sync([$this->spotItem($spotId)]);

        $this->sync([$this->spotItem($spotId, [
            'name' => 'Ponte velha',
            'ambiente' => 'mar',
            'updatedAt' => '2026-09-09T10:00:00.000Z',
        ])]);

        $spot = $this->getJson('/v1/sync')['spots'][0];
        self::assertSame('Ponte velha', $spot['name']);
        self::assertSame('mar', $spot['ambiente']);
    }

    public function testCatchWithUnknownTripFailsButKeepsBatchGoing(): void
    {
        $spotId = $this->uuid();
        $catchId = $this->uuid();

        $body = $this->sync([
            $this->spotItem($spotId),
            $this->catchItem($catchId, $this->uuid()),
        ]);

        self::assertFalse($body['ok']);
        $results = $this->byId($body['results']);
        self::assertTrue($results[$spotId]['ok'], 'o spot válido deveria ter sido gravado');
        self::assertFalse($results[$catchId]['ok']);
        self::assertStringContainsString('pescaria desconhecida', $results[$catchId]['error']);
    }

    public function testDeleteRemovesFromPullAndIsIdempotent(): void
    {
        $tripId = $this->uuid();
        $catchId = $this->uuid();
        $this->sync([$this->tripItem($tripId), $this->catchItem($catchId, $tripId)]);

        $body = $this->sync([['entity' => 'trip', 'op' => 'delete', 'id' => $tripId, 'data' => null]]);
        self::assertSame('deleted', $body['results'][0]['status']);

        // Apagar a pescaria leva a captura junto.
        $pull = $this->getJson('/v1/sync');
        self::assertNotNull($pull['trips'][0]['deletedAt']);
        self::assertNotNull($pull['catches'][0]['deletedAt']);

        // Repetir o delete continua sendo sucesso.
        $again = $this->sync([['entity' => 'trip', 'op' => 'delete', 'id' => $tripId, 'data' => null]]);
        self::assertTrue($again['results'][0]['ok']);
        self::assertSame('skipped', $again['results'][0]['status']);
    }

    public function testDeletingUnknownIdIsAccepted(): void
    {
        $body = $this->sync([['entity' => 'catch', 'op' => 'delete', 'id' => $this->uuid(), 'data' => null]]);

        self::assertTrue($body['ok']);
        self::assertSame('ignored', $body['results'][0]['status']);
    }

    public function testDeletingSpotUnlinksTripButKeepsIt(): void
    {
        $spotId = $this->uuid();
        $tripId = $this->uuid();
        $this->sync([$this->spotItem($spotId), $this->tripItem($tripId, ['spotId' => $spotId])]);

        $this->sync([['entity' => 'spot', 'op' => 'delete', 'id' => $spotId, 'data' => null]]);

        $pull = $this->getJson('/v1/sync');
        self::assertNotNull($pull['spots'][0]['deletedAt']);
        self::assertNull($pull['trips'][0]['deletedAt'], 'a pescaria deve sobreviver ao spot');
        self::assertNull($pull['trips'][0]['spotId']);
    }

    public function testAnotherDeviceCannotOverwriteYourRecords(): void
    {
        $spotId = $this->uuid();
        $this->sync([$this->spotItem($spotId)]);

        $intruder = $this->uuid();
        $body = $this->sync([$this->spotItem($spotId, [
            'name' => 'Sequestrado',
            'updatedAt' => '2026-12-01T10:00:00.000Z',
        ])], $intruder);

        self::assertFalse($body['results'][0]['ok']);
        self::assertStringContainsString('outro aparelho', $body['results'][0]['error']);
        self::assertSame('Barranco da curva', $this->getJson('/v1/sync')['spots'][0]['name']);
    }

    public function testEachDeviceOnlySeesItsOwnData(): void
    {
        $this->sync([$this->spotItem($this->uuid())]);

        $other = $this->uuid();
        self::assertSame([], $this->getJson('/v1/sync', $other)['spots']);
    }

    public function testSincePullReturnsOnlyNewerChanges(): void
    {
        $first = $this->uuid();
        $this->sync([$this->spotItem($first, ['updatedAt' => '2026-09-01T10:00:00.000Z'])]);
        $second = $this->uuid();
        $this->sync([$this->spotItem($second, ['updatedAt' => '2026-09-20T10:00:00.000Z'])]);

        $body = $this->getJson('/v1/sync?since=2026-09-10T00:00:00.000Z');

        self::assertCount(1, $body['spots']);
        self::assertSame($second, $body['spots'][0]['id']);
    }

    public function testWeatherSnapshotSurvivesRoundTrip(): void
    {
        $tripId = $this->uuid();
        $weather = [
            'source' => 'open-meteo',
            'date' => '2026-09-10',
            'timezone' => 'America/Sao_Paulo',
            'moon' => ['phase' => 0.48, 'illuminationPct' => 96, 'label' => 'Lua cheia'],
            'hours' => [['time' => '2026-09-10T06:00', 'temperatureC' => 18.1, 'pressureHpa' => 1019.2]],
        ];

        $this->sync([$this->tripItem($tripId, ['weather' => $weather])]);

        self::assertSame($weather, $this->getJson('/v1/sync')['trips'][0]['weather']);
    }

    public function testInvalidPayloadIsRejectedPerItem(): void
    {
        $body = $this->sync([
            $this->spotItem($this->uuid(), ['lat' => 999.0]),
            $this->spotItem($this->uuid(), ['ambiente' => 'lua']),
        ]);

        self::assertFalse($body['ok']);
        self::assertFalse($body['results'][0]['ok']);
        self::assertStringContainsString('lat', $body['results'][0]['error']);
        self::assertFalse($body['results'][1]['ok']);
        self::assertStringContainsString('ambiente', $body['results'][1]['error']);
    }

    public function testMalformedBodyReturns422(): void
    {
        $this->postJson('/v1/sync', ['deviceId' => 'nao-e-uuid', 'items' => []]);

        self::assertResponseStatusCodeSame(422);
    }

    public function testMissingDeviceHeaderIsRejected(): void
    {
        $this->client->request(
            'POST',
            '/v1/sync',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode(['deviceId' => $this->deviceId, 'items' => [$this->spotItem($this->uuid())]], \JSON_THROW_ON_ERROR),
        );

        // Sem header o corpo ainda identifica o aparelho; o que não pode é divergir.
        self::assertResponseIsSuccessful();

        $this->client->request(
            'POST',
            '/v1/sync',
            server: ['CONTENT_TYPE' => 'application/json', 'HTTP_X_DEVICE_ID' => $this->uuid()],
            content: json_encode(['deviceId' => $this->deviceId, 'items' => [$this->spotItem($this->uuid())]], \JSON_THROW_ON_ERROR),
        );

        self::assertResponseStatusCodeSame(400);
    }
}
