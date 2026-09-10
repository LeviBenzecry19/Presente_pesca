<?php

declare(strict_types=1);

namespace App\Entity;

use App\Repository\ProfileRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Perfil de quem pesca. O app é presente de família: um aparelho tem vários
 * perfis, cada um com o próprio histórico.
 *
 * `passwordHash` é uma derivação PBKDF2 feita no cliente, nunca a senha em si.
 * Ela vem junto para que restaurar um backup preserve a proteção do perfil.
 */
#[ORM\Entity(repositoryClass: ProfileRepository::class)]
#[ORM\Table(name: 'profiles')]
#[ORM\Index(name: 'idx_profile_device_updated', columns: ['device_id', 'updated_at'])]
class Profile
{
    #[ORM\Id]
    #[ORM\Column(type: Types::GUID)]
    private string $id;

    #[ORM\ManyToOne(targetEntity: Device::class)]
    #[ORM\JoinColumn(name: 'device_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private Device $device;

    #[ORM\Column(length: 60)]
    private string $name;

    /** "preset:<id>" ou uma data URL da foto escolhida — por isso TEXT. */
    #[ORM\Column(type: Types::TEXT)]
    private string $avatar;

    #[ORM\Column(length: 128)]
    private string $passwordHash = '';

    #[ORM\Column(length: 64)]
    private string $passwordSalt = '';

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $updatedAt;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $deletedAt = null;

    public function __construct(string $id, Device $device)
    {
        $this->id = $id;
        $this->device = $device;
    }

    public function getId(): string
    {
        return $this->id;
    }

    public function getDevice(): Device
    {
        return $this->device;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getAvatar(): string
    {
        return $this->avatar;
    }

    public function setAvatar(string $avatar): void
    {
        $this->avatar = $avatar;
    }

    public function getPasswordHash(): string
    {
        return $this->passwordHash;
    }

    public function getPasswordSalt(): string
    {
        return $this->passwordSalt;
    }

    public function setPassword(string $hash, string $salt): void
    {
        $this->passwordHash = $hash;
        $this->passwordSalt = $salt;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function setCreatedAt(\DateTimeImmutable $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getUpdatedAt(): \DateTimeImmutable
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(\DateTimeImmutable $updatedAt): void
    {
        $this->updatedAt = $updatedAt;
    }

    public function getDeletedAt(): ?\DateTimeImmutable
    {
        return $this->deletedAt;
    }

    public function setDeletedAt(?\DateTimeImmutable $deletedAt): void
    {
        $this->deletedAt = $deletedAt;
    }

    public function isDeleted(): bool
    {
        return null !== $this->deletedAt;
    }
}
