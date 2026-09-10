<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Device;
use App\Entity\FishCatch;
use App\Entity\FishingTrip;
use App\Entity\Profile;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\DBAL\ArrayParameterType;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<FishCatch>
 */
class FishCatchRepository extends ServiceEntityRepository
{
    /** Aproximação usada só para pré-filtrar por bounding box antes da distância exata. */
    private const KM_PER_DEGREE_LAT = 111.32;

    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, FishCatch::class);
    }

    /**
     * @return FishCatch[]
     */
    public function changedSince(Device $device, ?\DateTimeImmutable $since, int $limit): array
    {
        $qb = $this->createQueryBuilder('c')
            ->andWhere('c.device = :device')
            ->setParameter('device', $device)
            ->orderBy('c.updatedAt', 'ASC')
            ->setMaxResults($limit);

        if (null !== $since) {
            $qb->andWhere('c.updatedAt > :since')->setParameter('since', $since);
        }

        return $qb->getQuery()->getResult();
    }

    /**
     * @return FishCatch[]
     */
    public function findByProfile(Profile $profile): array
    {
        return $this->createQueryBuilder('c')
            ->andWhere('c.profile = :profile')
            ->setParameter('profile', $profile)
            ->getQuery()
            ->getResult();
    }

    /**
     * @return FishCatch[]
     */
    public function findByTrip(FishingTrip $trip): array
    {
        return $this->createQueryBuilder('c')
            ->andWhere('c.trip = :trip')
            ->setParameter('trip', $trip)
            ->getQuery()
            ->getResult();
    }

    /**
     * Espécies capturadas num raio, agregadas de TODOS os aparelhos — é a
     * inteligência coletiva da seção 5.1 da especificação. Só sai contagem
     * agregada, nunca a identidade de quem pescou.
     *
     * O bounding box aproveita o índice (lat, lng); a distância exata usa
     * ST_Distance_Sphere, que existe no MariaDB 10.4+ e no MySQL 8.
     *
     * @return list<array<string, mixed>>
     */
    public function speciesNearby(float $lat, float $lng, float $radiusKm, int $limit): array
    {
        $radiusM = $radiusKm * 1000.0;
        $deltaLat = $radiusKm / self::KM_PER_DEGREE_LAT;
        // Perto dos polos cos() tende a zero; o piso evita uma faixa infinita.
        $deltaLng = $radiusKm / max(self::KM_PER_DEGREE_LAT * cos(deg2rad($lat)), 0.1);

        $params = [
            'lat' => $lat,
            'lng' => $lng,
            'radius' => $radiusM,
            'minLat' => $lat - $deltaLat,
            'maxLat' => $lat + $deltaLat,
        ];

        // Caixa que cruza o antimeridiano: cai só na distância exata.
        $box = 'c.lat BETWEEN :minLat AND :maxLat';
        if ($lng - $deltaLng >= -180 && $lng + $deltaLng <= 180) {
            $box .= ' AND c.lng BETWEEN :minLng AND :maxLng';
            $params['minLng'] = $lng - $deltaLng;
            $params['maxLng'] = $lng + $deltaLng;
        }

        $sql = <<<SQL
            SELECT
                c.species_id                                     AS speciesId,
                COUNT(*)                                         AS catches,
                COUNT(DISTINCT c.trip_id)                        AS trips,
                COUNT(DISTINCT c.device_id)                      AS devices,
                AVG(c.weight_kg)                                 AS avgWeightKg,
                MAX(c.weight_kg)                                 AS maxWeightKg,
                AVG(c.length_cm)                                 AS avgLengthCm,
                MIN(c.caught_at)                                 AS firstCaughtAt,
                MAX(c.caught_at)                                 AS lastCaughtAt,
                MIN(ST_Distance_Sphere(POINT(c.lng, c.lat), POINT(:lng, :lat))) AS nearestMeters
            FROM catches c
            WHERE c.deleted_at IS NULL
              AND c.lat IS NOT NULL AND c.lng IS NOT NULL
              AND {$box}
              AND ST_Distance_Sphere(POINT(c.lng, c.lat), POINT(:lng, :lat)) <= :radius
            GROUP BY c.species_id
            ORDER BY catches DESC, speciesId ASC
            LIMIT {$limit}
            SQL;

        /** @var list<array<string, mixed>> $rows */
        $rows = $this->getEntityManager()->getConnection()->executeQuery($sql, $params)->fetchAllAssociative();

        return $rows;
    }

    /**
     * Histograma de horários por espécie, para sugerir a melhor janela do dia.
     *
     * @param list<string> $speciesIds
     *
     * @return array<string, array<int, int>> speciesId => [hora => capturas]
     */
    public function hourHistogram(float $lat, float $lng, float $radiusKm, array $speciesIds): array
    {
        if ([] === $speciesIds) {
            return [];
        }

        $sql = <<<SQL
            SELECT c.species_id AS speciesId, HOUR(c.caught_at) AS hour, COUNT(*) AS catches
            FROM catches c
            WHERE c.deleted_at IS NULL
              AND c.lat IS NOT NULL AND c.lng IS NOT NULL
              AND c.species_id IN (:species)
              AND ST_Distance_Sphere(POINT(c.lng, c.lat), POINT(:lng, :lat)) <= :radius
            GROUP BY c.species_id, hour
            SQL;

        $rows = $this->getEntityManager()->getConnection()->executeQuery(
            $sql,
            ['lat' => $lat, 'lng' => $lng, 'radius' => $radiusKm * 1000.0, 'species' => $speciesIds],
            ['species' => ArrayParameterType::STRING],
        )->fetchAllAssociative();

        $out = [];
        foreach ($rows as $row) {
            $out[(string) $row['speciesId']][(int) $row['hour']] = (int) $row['catches'];
        }

        return $out;
    }
}
