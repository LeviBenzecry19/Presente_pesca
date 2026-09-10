<?php

declare(strict_types=1);

namespace App\Tests\Api;

/**
 * O cliente envia a foto com PUT e os bytes crus (PHP não popula $_FILES em
 * PUT), então é assim que o teste exercita o endpoint.
 */
final class CatchPhotoTest extends ApiTestCase
{
    /** PNG 1x1 válido — o suficiente para o finfo reconhecer o tipo. */
    private const PNG_1X1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    private function png(): string
    {
        return (string) base64_decode(self::PNG_1X1, true);
    }

    private function seedCatch(): string
    {
        $tripId = $this->uuid();
        $catchId = $this->uuid();
        $this->sync([
            $this->tripItem($tripId),
            $this->catchItem($catchId, $tripId, ['hasPhoto' => true]),
        ]);

        return $catchId;
    }

    private function putPhoto(string $catchId, string $binary, string $contentType = 'image/png', ?string $deviceId = null): void
    {
        $this->client->request(
            'PUT',
            \sprintf('/v1/catches/%s/photo', $catchId),
            server: [
                'CONTENT_TYPE' => $contentType,
                'HTTP_X_DEVICE_ID' => $deviceId ?? $this->deviceId,
            ],
            content: $binary,
        );
    }

    public function testUploadThenDownload(): void
    {
        $catchId = $this->seedCatch();

        $this->putPhoto($catchId, $this->png());

        self::assertResponseIsSuccessful();
        $body = $this->decode();
        self::assertTrue($body['ok']);
        self::assertSame('image/png', $body['mime']);
        self::assertSame(\strlen($this->png()), $body['bytes']);
        self::assertStringContainsString('/v1/catches/'.$catchId.'/photo', $body['url']);

        // A sincronização passa a anunciar a foto.
        $catch = $this->getJson('/v1/sync')['catches'][0];
        self::assertTrue($catch['hasPhoto']);
        self::assertNotNull($catch['photoUrl']);

        $this->client->request('GET', \sprintf('/v1/catches/%s/photo', $catchId));
        self::assertResponseIsSuccessful();
        self::assertResponseHeaderSame('Content-Type', 'image/png');

        $response = $this->client->getResponse();
        ob_start();
        $response->sendContent();
        self::assertSame($this->png(), ob_get_clean());
    }

    public function testUploadAcceptsMultipartPostToo(): void
    {
        $catchId = $this->seedCatch();
        $tmp = tempnam(sys_get_temp_dir(), 'pesca').'.png';
        file_put_contents($tmp, $this->png());

        $this->client->request(
            'POST',
            \sprintf('/v1/catches/%s/photo', $catchId),
            files: ['photo' => new \Symfony\Component\HttpFoundation\File\UploadedFile($tmp, 'foto.png', 'image/png', null, true)],
            server: ['HTTP_X_DEVICE_ID' => $this->deviceId],
        );

        self::assertResponseIsSuccessful();
        self::assertSame('image/png', $this->decode()['mime']);
        @unlink($tmp);
    }

    public function testNonImageIsRejected(): void
    {
        $catchId = $this->seedCatch();

        $this->putPhoto($catchId, 'isto aqui nao e uma imagem', 'image/png');

        self::assertResponseStatusCodeSame(415);
        self::assertFalse($this->decode()['ok']);
    }

    public function testEmptyBodyIsRejected(): void
    {
        $catchId = $this->seedCatch();

        $this->putPhoto($catchId, '');

        self::assertResponseStatusCodeSame(400);
    }

    public function testUploadToUnknownCatchIsNotFound(): void
    {
        $this->putPhoto($this->uuid(), $this->png());

        self::assertResponseStatusCodeSame(404);
    }

    public function testAnotherDeviceCannotUpload(): void
    {
        $catchId = $this->seedCatch();

        $this->putPhoto($catchId, $this->png(), 'image/png', $this->uuid());

        self::assertResponseStatusCodeSame(403);
    }

    public function testDeletePhoto(): void
    {
        $catchId = $this->seedCatch();
        $this->putPhoto($catchId, $this->png());

        $this->client->request('DELETE', \sprintf('/v1/catches/%s/photo', $catchId), server: [
            'HTTP_X_DEVICE_ID' => $this->deviceId,
        ]);

        self::assertResponseIsSuccessful();
        self::assertFalse($this->getJson('/v1/sync')['catches'][0]['hasPhoto']);

        $this->client->request('GET', \sprintf('/v1/catches/%s/photo', $catchId));
        self::assertResponseStatusCodeSame(404);
    }

    public function testDeletingTheCatchRemovesThePhoto(): void
    {
        $catchId = $this->seedCatch();
        $this->putPhoto($catchId, $this->png());

        $this->sync([['entity' => 'catch', 'op' => 'delete', 'id' => $catchId, 'data' => null]]);

        $this->client->request('GET', \sprintf('/v1/catches/%s/photo', $catchId));
        self::assertResponseStatusCodeSame(404);
    }
}
