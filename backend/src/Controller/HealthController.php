<?php

declare(strict_types=1);

namespace App\Controller;

use App\Support\Dates;
use Doctrine\DBAL\Connection;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

final class HealthController extends AbstractController
{
    public function __construct(
        private readonly Connection $connection,
    ) {
    }

    /**
     * Verifica o que o app precisa para funcionar: processo de pé e banco vivo.
     */
    #[Route('/v1/health', name: 'health', methods: ['GET'])]
    public function health(): JsonResponse
    {
        $database = null;
        $error = null;
        try {
            $database = (string) $this->connection->fetchOne('SELECT VERSION()');
        } catch (\Throwable $e) {
            $error = $e->getMessage();
        }

        $ok = null !== $database;

        return $this->json([
            'ok' => $ok,
            'service' => 'pesca-backend',
            'time' => Dates::iso(Dates::now()),
            'php' => \PHP_VERSION,
            'symfony' => \Symfony\Component\HttpKernel\Kernel::VERSION,
            'database' => $database,
            'error' => $error,
        ], $ok ? Response::HTTP_OK : Response::HTTP_SERVICE_UNAVAILABLE);
    }

    /**
     * Índice legível para quem abrir http://localhost:8000 no navegador.
     */
    #[Route('/', name: 'api_index', methods: ['GET'])]
    public function index(): JsonResponse
    {
        return $this->json([
            'service' => 'pesca-backend',
            'docs' => '../docs/backend/API.md',
            'endpoints' => [
                'GET  /v1/health' => 'estado do serviço e do banco',
                'POST /v1/sync' => 'envia um lote de alterações (header X-Device-Id)',
                'GET  /v1/sync?since=ISO' => 'baixa alterações do aparelho',
                'PUT  /v1/catches/{id}/photo' => 'envia a foto (bytes crus) ou POST multipart',
                'GET  /v1/catches/{id}/photo' => 'baixa a foto',
                'DELETE /v1/catches/{id}/photo' => 'remove a foto',
                'GET  /v1/species/nearby?lat=&lng=&radiusKm=' => 'espécies capturadas na região',
            ],
        ]);
    }
}
