<?php

declare(strict_types=1);

namespace App\Support;

/**
 * O cliente troca datas em ISO-8601 UTC ("2026-09-08T12:00:00.000Z") e o MySQL
 * guarda DATETIME sem fuso. Todo o backend normaliza para UTC na entrada e
 * volta a marcar "Z" na saída, para que nada dependa do fuso do servidor.
 */
final class Dates
{
    public const UTC = 'UTC';

    public static function now(): \DateTimeImmutable
    {
        return new \DateTimeImmutable('now', new \DateTimeZone(self::UTC));
    }

    /**
     * @throws \InvalidArgumentException quando a string não é uma data válida
     */
    public static function parseUtc(string $value): \DateTimeImmutable
    {
        $trimmed = trim($value);
        if ('' === $trimmed) {
            throw new \InvalidArgumentException('data vazia');
        }

        try {
            $date = new \DateTimeImmutable($trimmed);
        } catch (\Exception $e) {
            throw new \InvalidArgumentException(\sprintf('data inválida: "%s"', $value), 0, $e);
        }

        return $date->setTimezone(new \DateTimeZone(self::UTC));
    }

    public static function parseUtcOrNull(?string $value): ?\DateTimeImmutable
    {
        return null === $value || '' === trim($value) ? null : self::parseUtc($value);
    }

    /** Formato aceito pelo `new Date(...)` do JavaScript. */
    public static function iso(?\DateTimeInterface $date): ?string
    {
        if (null === $date) {
            return null;
        }

        return \DateTimeImmutable::createFromInterface($date)
            ->setTimezone(new \DateTimeZone(self::UTC))
            ->format('Y-m-d\TH:i:s.v\Z');
    }
}
