<?php

declare(strict_types=1);

namespace App\Tests\Api;

final class HealthTest extends ApiTestCase
{
    public function testHealthReportsDatabase(): void
    {
        $body = $this->getJson('/v1/health');

        self::assertResponseIsSuccessful();
        self::assertTrue($body['ok']);
        self::assertNotNull($body['database'], 'health deveria conseguir falar com o banco');
        self::assertNull($body['error']);
    }

    public function testIndexListsEndpoints(): void
    {
        $body = $this->getJson('/');

        self::assertResponseIsSuccessful();
        self::assertArrayHasKey('POST /v1/sync', $body['endpoints']);
    }

    public function testUnknownApiRouteReturnsJsonNotHtml(): void
    {
        $this->client->request('GET', '/v1/nao-existe');

        self::assertResponseStatusCodeSame(404);
        $body = $this->decode();
        self::assertFalse($body['ok']);
        self::assertSame(404, $body['status']);
    }
}
