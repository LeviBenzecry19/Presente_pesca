<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Device;
use App\Entity\Profile;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Profile>
 */
class ProfileRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Profile::class);
    }

    /**
     * @return Profile[]
     */
    public function changedSince(Device $device, ?\DateTimeImmutable $since, int $limit): array
    {
        $qb = $this->createQueryBuilder('p')
            ->andWhere('p.device = :device')
            ->setParameter('device', $device)
            ->orderBy('p.updatedAt', 'ASC')
            ->setMaxResults($limit);

        if (null !== $since) {
            $qb->andWhere('p.updatedAt > :since')->setParameter('since', $since);
        }

        return $qb->getQuery()->getResult();
    }
}
