<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\Device;
use App\Repository\DeviceRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\Uid\Uuid;

/**
 * Resolve o aparelho a partir do header `X-Device-Id`, criando o registro na
 * primeira vez. É o que substitui a autenticação enquanto não há login: cada
 * aparelho só enxerga os próprios dados.
 */
final class DeviceProvider
{
    public const HEADER = 'X-Device-Id';

    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly DeviceRepository $devices,
    ) {
    }

    public function fromRequest(Request $request, ?string $fallbackId = null): Device
    {
        $id = trim((string) $request->headers->get(self::HEADER, ''));
        if ('' === $id) {
            $id = trim((string) $fallbackId);
        }

        if ('' === $id || !Uuid::isValid($id)) {
            throw new BadRequestHttpException(\sprintf('Header %s ausente ou inválido: envie um UUID.', self::HEADER));
        }

        $device = $this->devices->find($id);
        if (null === $device) {
            $device = new Device($id);
            $this->em->persist($device);
        } else {
            $device->touch();
        }

        // O aparelho é alvo de chave estrangeira das demais tabelas, então
        // precisa existir antes de qualquer insert do lote.
        $this->em->flush();

        return $device;
    }
}
