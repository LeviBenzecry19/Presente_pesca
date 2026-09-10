<?php

declare(strict_types=1);

namespace App\Entity;

use App\Repository\DeviceRepository;
use App\Support\Dates;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Enquanto não há login, um "usuário" é um aparelho identificado pelo header
 * `X-Device-Id`. Quando a autenticação existir, basta ligar `userId` a uma
 * tabela de usuários e agrupar os aparelhos por ela.
 */
#[ORM\Entity(repositoryClass: DeviceRepository::class)]
#[ORM\Table(name: 'devices')]
class Device
{
    #[ORM\Id]
    #[ORM\Column(type: Types::GUID)]
    private string $id;

    #[ORM\Column(type: Types::GUID, nullable: true)]
    private ?string $userId = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $lastSeenAt;

    public function __construct(string $id)
    {
        $this->id = $id;
        $this->createdAt = Dates::now();
        $this->lastSeenAt = $this->createdAt;
    }

    public function getId(): string
    {
        return $this->id;
    }

    public function getUserId(): ?string
    {
        return $this->userId;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function getLastSeenAt(): \DateTimeImmutable
    {
        return $this->lastSeenAt;
    }

    public function touch(): void
    {
        $this->lastSeenAt = Dates::now();
    }
}
