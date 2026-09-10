<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Device;
use App\Entity\FishingSpot;
use App\Entity\FishingTrip;
use App\Entity\Profile;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<FishingTrip>
 */
class FishingTripRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, FishingTrip::class);
    }

    /**
     * @return FishingTrip[]
     */
    public function changedSince(Device $device, ?\DateTimeImmutable $since, int $limit): array
    {
        $qb = $this->createQueryBuilder('t')
            ->andWhere('t.device = :device')
            ->setParameter('device', $device)
            ->orderBy('t.updatedAt', 'ASC')
            ->setMaxResults($limit);

        if (null !== $since) {
            $qb->andWhere('t.updatedAt > :since')->setParameter('since', $since);
        }

        return $qb->getQuery()->getResult();
    }

    /**
     * @return FishingTrip[]
     */
    public function findByProfile(Profile $profile): array
    {
        return $this->createQueryBuilder('t')
            ->andWhere('t.profile = :profile')
            ->setParameter('profile', $profile)
            ->getQuery()
            ->getResult();
    }

    /**
     * @return FishingTrip[]
     */
    public function findBySpot(FishingSpot $spot): array
    {
        return $this->createQueryBuilder('t')
            ->andWhere('t.spot = :spot')
            ->setParameter('spot', $spot)
            ->getQuery()
            ->getResult();
    }
}
