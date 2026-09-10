<?php

declare(strict_types=1);

namespace App\Tests\Api;

use Doctrine\DBAL\Connection;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\Uid\Uuid;

/**
 * Base dos testes de HTTP: cliente pronto, banco limpo e helpers para montar
 * os payloads que o PWA envia de verdade.
 */
abstract class ApiTestCase extends WebTestCase
{
    protected KernelBrowser $client;
    protected string $deviceId;

    protected function setUp(): void
    {
        $this->client = static::createClient();
        $this->deviceId = (string) Uuid::v4();
        $this->resetDatabase();
    }

    protected function resetDatabase(): void
    {
        /** @var Connection $connection */
        $connection = static::getContainer()->get(Connection::class);
        $connection->executeStatement('SET FOREIGN_KEY_CHECKS = 0');
        foreach (['catches', 'fishing_trips', 'fishing_spots', 'profiles', 'devices'] as $table) {
            $connection->executeStatement(\sprintf('TRUNCATE TABLE %s', $table));
        }
        $connection->executeStatement('SET FOREIGN_KEY_CHECKS = 1');
    }

    /**
     * @param array<string, mixed> $body
     *
     * @return array<string, mixed>
     */
    protected function postJson(string $uri, array $body, ?string $deviceId = null): array
    {
        $this->client->request(
            'POST',
            $uri,
            server: [
                'CONTENT_TYPE' => 'application/json',
                'HTTP_X_DEVICE_ID' => $deviceId ?? $this->deviceId,
            ],
            content: json_encode($body, \JSON_THROW_ON_ERROR),
        );

        return $this->decode();
    }

    /**
     * @return array<string, mixed>
     */
    protected function getJson(string $uri, ?string $deviceId = null): array
    {
        $this->client->request('GET', $uri, server: [
            'HTTP_X_DEVICE_ID' => $deviceId ?? $this->deviceId,
        ]);

        return $this->decode();
    }

    /**
     * @return array<string, mixed>
     */
    protected function decode(): array
    {
        $content = (string) $this->client->getResponse()->getContent();
        self::assertJson($content, 'A resposta deveria ser JSON, veio: '.substr($content, 0, 300));

        /** @var array<string, mixed> $decoded */
        $decoded = json_decode($content, true, 512, \JSON_THROW_ON_ERROR);

        return $decoded;
    }

    /**
     * Envia um lote de itens como o cliente faria.
     *
     * @param list<array<string, mixed>> $items
     *
     * @return array<string, mixed>
     */
    protected function sync(array $items, ?string $deviceId = null): array
    {
        return $this->postJson('/v1/sync', [
            'deviceId' => $deviceId ?? $this->deviceId,
            'items' => $items,
        ], $deviceId);
    }

    /**
     * @param array<string, mixed> $overrides
     *
     * @return array{entity: string, op: string, id: string, data: array<string, mixed>}
     */
    protected function profileItem(string $id, array $overrides = []): array
    {
        return [
            'entity' => 'profile',
            'op' => 'upsert',
            'id' => $id,
            'data' => array_merge([
                'id' => $id,
                'name' => 'Levi',
                'avatar' => 'preset:pescador',
                'passwordHash' => 'aGFzaC1kZS1tZW50aXJhLXBhcmEtdGVzdGU=',
                'passwordSalt' => 'c2FsLWRlLXRlc3Rl',
                'createdAt' => '2026-09-01T10:00:00.000Z',
                'updatedAt' => '2026-09-01T10:00:00.000Z',
            ], $overrides),
        ];
    }

    /** Cria um perfil no servidor e devolve o id, para os testes que precisam de um. */
    protected function seedProfile(?string $deviceId = null): string
    {
        $id = $this->uuid();
        $body = $this->sync([$this->profileItem($id)], $deviceId);
        self::assertTrue($body['ok'], json_encode($body['results']));

        return $id;
    }

    /**
     * @param array<string, mixed> $overrides
     *
     * @return array{entity: string, op: string, id: string, data: array<string, mixed>}
     */
    protected function spotItem(string $id, array $overrides = []): array
    {
        return [
            'entity' => 'spot',
            'op' => 'upsert',
            'id' => $id,
            'data' => array_merge([
                'id' => $id,
                'name' => 'Barranco da curva',
                'ambiente' => 'agua_doce',
                'lat' => -15.78,
                'lng' => -47.93,
                'notes' => null,
                'createdAt' => '2026-09-01T10:00:00.000Z',
                'updatedAt' => '2026-09-01T10:00:00.000Z',
            ], $overrides),
        ];
    }

    /**
     * @param array<string, mixed> $overrides
     *
     * @return array{entity: string, op: string, id: string, data: array<string, mixed>}
     */
    protected function tripItem(string $id, array $overrides = []): array
    {
        return [
            'entity' => 'trip',
            'op' => 'upsert',
            'id' => $id,
            'data' => array_merge([
                'id' => $id,
                'plannedAt' => '2026-09-10T09:00:00.000Z',
                'lat' => -15.78,
                'lng' => -47.93,
                'ambiente' => 'agua_doce',
                'status' => 'planejada',
                'title' => 'Tucunaré na represa',
                'locationName' => 'Brasília, DF',
                'checklist' => [['id' => 'a', 'label' => 'Iscas', 'done' => false]],
                'createdAt' => '2026-09-01T10:00:00.000Z',
                'updatedAt' => '2026-09-01T10:00:00.000Z',
            ], $overrides),
        ];
    }

    /**
     * @param array<string, mixed> $overrides
     *
     * @return array{entity: string, op: string, id: string, data: array<string, mixed>}
     */
    protected function catchItem(string $id, string $tripId, array $overrides = []): array
    {
        return [
            'entity' => 'catch',
            'op' => 'upsert',
            'id' => $id,
            'data' => array_merge([
                'id' => $id,
                'tripId' => $tripId,
                'speciesId' => 'tucunare',
                'weightKg' => 2.4,
                'lengthCm' => 48.0,
                'lat' => -15.7805,
                'lng' => -47.9302,
                'caughtAt' => '2026-09-10T11:30:00.000Z',
                'bait' => 'Isca artificial',
                'hasPhoto' => false,
                'createdAt' => '2026-09-10T11:31:00.000Z',
                'updatedAt' => '2026-09-10T11:31:00.000Z',
            ], $overrides),
        ];
    }

    /**
     * @param list<array<string, mixed>> $results
     *
     * @return array<string, array<string, mixed>>
     */
    protected function byId(array $results): array
    {
        $out = [];
        foreach ($results as $result) {
            $out[(string) $result['id']] = $result;
        }

        return $out;
    }

    protected function uuid(): string
    {
        return (string) Uuid::v4();
    }
}
