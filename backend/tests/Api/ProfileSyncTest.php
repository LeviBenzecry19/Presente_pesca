<?php

declare(strict_types=1);

namespace App\Tests\Api;

/**
 * Perfis: cada pessoa da família tem o próprio histórico, e o vínculo precisa
 * sobreviver à sincronização para que restaurar um backup não misture tudo.
 */
final class ProfileSyncTest extends ApiTestCase
{
    public function testCreatesProfileAndLinksEverythingToIt(): void
    {
        $profileId = $this->uuid();
        $spotId = $this->uuid();
        $tripId = $this->uuid();
        $catchId = $this->uuid();

        // Ordem embaralhada de propósito: o servidor reordena o lote.
        $body = $this->sync([
            $this->catchItem($catchId, $tripId, ['profileId' => $profileId]),
            $this->tripItem($tripId, ['profileId' => $profileId, 'spotId' => $spotId]),
            $this->spotItem($spotId, ['profileId' => $profileId]),
            $this->profileItem($profileId),
        ]);

        self::assertTrue($body['ok'], json_encode($body['results']));

        $pull = $this->getJson('/v1/sync');
        self::assertCount(1, $pull['profiles']);
        self::assertSame('Levi', $pull['profiles'][0]['name']);
        self::assertSame('preset:pescador', $pull['profiles'][0]['avatar']);
        self::assertSame($profileId, $pull['spots'][0]['profileId']);
        self::assertSame($profileId, $pull['trips'][0]['profileId']);
        self::assertSame($profileId, $pull['catches'][0]['profileId']);
    }

    public function testCatchInheritsProfileFromItsTrip(): void
    {
        $profileId = $this->seedProfile();
        $tripId = $this->uuid();
        $catchId = $this->uuid();

        // Captura sem profileId: deve herdar o da pescaria.
        $this->sync([
            $this->tripItem($tripId, ['profileId' => $profileId]),
            $this->catchItem($catchId, $tripId),
        ]);

        self::assertSame($profileId, $this->getJson('/v1/sync')['catches'][0]['profileId']);
    }

    public function testUnknownProfileIsRetryable(): void
    {
        $body = $this->sync([$this->spotItem($this->uuid(), ['profileId' => $this->uuid()])]);

        self::assertFalse($body['ok']);
        self::assertStringContainsString('perfil desconhecido', $body['results'][0]['error']);
    }

    public function testDataWithoutProfileIsStillAccepted(): void
    {
        // Cliente anterior aos perfis: grava sem vínculo em vez de recusar.
        $body = $this->sync([$this->spotItem($this->uuid())]);

        self::assertTrue($body['ok']);
        self::assertNull($this->getJson('/v1/sync')['spots'][0]['profileId']);
    }

    public function testPhotoAvatarSurvivesRoundTrip(): void
    {
        // Foto da galeria vira data URL no cliente; aqui só precisa voltar igual.
        $dataUrl = 'data:image/jpeg;base64,'.base64_encode(str_repeat('foto', 500));
        $profileId = $this->uuid();

        $this->sync([$this->profileItem($profileId, ['avatar' => $dataUrl])]);

        self::assertSame($dataUrl, $this->getJson('/v1/sync')['profiles'][0]['avatar']);
    }

    public function testRenamingProfileFollowsLastWriteWins(): void
    {
        $profileId = $this->seedProfile();

        $this->sync([$this->profileItem($profileId, [
            'name' => 'Levi Pescador',
            'updatedAt' => '2026-09-20T10:00:00.000Z',
        ])]);
        // Envio antigo não pode desfazer o novo.
        $body = $this->sync([$this->profileItem($profileId, [
            'name' => 'Nome velho',
            'updatedAt' => '2026-09-02T10:00:00.000Z',
        ])]);

        self::assertSame('skipped', $body['results'][0]['status']);
        self::assertSame('Levi Pescador', $this->getJson('/v1/sync')['profiles'][0]['name']);
    }

    public function testDeletingProfileTakesItsDataAlong(): void
    {
        $profileId = $this->uuid();
        $spotId = $this->uuid();
        $tripId = $this->uuid();
        $catchId = $this->uuid();
        $this->sync([
            $this->profileItem($profileId),
            $this->spotItem($spotId, ['profileId' => $profileId]),
            $this->tripItem($tripId, ['profileId' => $profileId]),
            $this->catchItem($catchId, $tripId, ['profileId' => $profileId]),
        ]);

        $body = $this->sync([['entity' => 'profile', 'op' => 'delete', 'id' => $profileId, 'data' => null]]);
        self::assertSame('deleted', $body['results'][0]['status']);

        $pull = $this->getJson('/v1/sync');
        self::assertNotNull($pull['profiles'][0]['deletedAt']);
        self::assertNotNull($pull['spots'][0]['deletedAt']);
        self::assertNotNull($pull['trips'][0]['deletedAt']);
        self::assertNotNull($pull['catches'][0]['deletedAt']);
    }

    public function testDeletingUnknownProfileIsAccepted(): void
    {
        $body = $this->sync([['entity' => 'profile', 'op' => 'delete', 'id' => $this->uuid(), 'data' => null]]);

        self::assertTrue($body['ok']);
        self::assertSame('ignored', $body['results'][0]['status']);
    }

    public function testAnotherDeviceCannotTouchYourProfile(): void
    {
        $profileId = $this->seedProfile();

        $body = $this->sync([$this->profileItem($profileId, [
            'name' => 'Invasor',
            'updatedAt' => '2026-12-01T10:00:00.000Z',
        ])], $this->uuid());

        self::assertFalse($body['results'][0]['ok']);
        self::assertStringContainsString('outro aparelho', $body['results'][0]['error']);
        self::assertSame('Levi', $this->getJson('/v1/sync')['profiles'][0]['name']);
    }

    public function testTwoProfilesOnTheSameDeviceStaySeparate(): void
    {
        $levi = $this->uuid();
        $ana = $this->uuid();
        $tripLevi = $this->uuid();
        $tripAna = $this->uuid();

        $this->sync([
            $this->profileItem($levi, ['name' => 'Levi']),
            $this->profileItem($ana, ['name' => 'Ana', 'avatar' => 'preset:pescadora']),
            $this->tripItem($tripLevi, ['profileId' => $levi, 'title' => 'Represa']),
            $this->tripItem($tripAna, ['profileId' => $ana, 'title' => 'Praia', 'ambiente' => 'mar']),
        ]);

        $trips = array_column($this->getJson('/v1/sync')['trips'], null, 'title');
        self::assertSame($levi, $trips['Represa']['profileId']);
        self::assertSame($ana, $trips['Praia']['profileId']);
    }

    public function testProfileNeedsNameAndAvatar(): void
    {
        $body = $this->sync([[
            'entity' => 'profile',
            'op' => 'upsert',
            'id' => $this->uuid(),
            'data' => ['name' => '', 'avatar' => ''],
        ]]);

        self::assertFalse($body['results'][0]['ok']);
    }
}
