<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Device;
use App\Entity\FishingSpot;
use App\Entity\Profile;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<FishingSpot>
 */
class FishingSpotRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, FishingSpot::class);
    }

    /**
     * Alterações desde `$since` (inclusive apagados, para o cliente removê-los).
     *
     * @return FishingSpot[]
     */
    public function changedSince(Device $device, ?\DateTimeImmutable $since, int $limit): array
    {
        $qb = $this->createQueryBuilder('s')
            ->andWhere('s.device = :device')
            ->setParameter('device', $device)
            ->orderBy('s.updatedAt', 'ASC')
            ->setMaxResults($limit);

        if (null !== $since) {
            $qb->andWhere('s.updatedAt > :since')->setParameter('since', $since);
        }

        return $qb->getQuery()->getResult();
    }

    /**
     * @return FishingSpot[]
     */
    public function findByProfile(Profile $profile): array
    {
        return $this->createQueryBuilder('s')
            ->andWhere('s.profile = :profile')
            ->setParameter('profile', $profile)
            ->getQuery()
            ->getResult();
    }
}
