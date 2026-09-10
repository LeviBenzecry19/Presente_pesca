<?php

declare(strict_types=1);

namespace App\Service;

use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\Filesystem\Filesystem;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\HttpKernel\Exception\UnsupportedMediaTypeHttpException;

/**
 * Guarda as fotos das capturas em disco, fora de public/: elas são servidas por
 * um controller, então dá para trocar por um bucket S3 depois sem mexer na URL.
 */
final class PhotoStorage
{
    /** Tipo declarado pelo cliente é ignorado: o que vale é o conteúdo real. */
    private const ALLOWED = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];

    public function __construct(
        #[Autowire('%app.photo_dir%')]
        private readonly string $dir,
        #[Autowire('%app.max_photo_bytes%')]
        private readonly int $maxBytes,
        private readonly Filesystem $filesystem,
    ) {
    }

    public function maxBytes(): int
    {
        return $this->maxBytes;
    }

    /**
     * @return array{path: string, mime: string, bytes: int}
     */
    public function store(string $catchId, string $binary): array
    {
        $bytes = \strlen($binary);
        if (0 === $bytes) {
            throw new BadRequestHttpException('Corpo vazio: envie os bytes da imagem.');
        }
        if ($bytes > $this->maxBytes) {
            throw new BadRequestHttpException(\sprintf('Foto acima do limite de %d bytes.', $this->maxBytes));
        }

        $mime = (new \finfo(\FILEINFO_MIME_TYPE))->buffer($binary);
        if (!\is_string($mime) || !isset(self::ALLOWED[$mime])) {
            throw new UnsupportedMediaTypeHttpException(\sprintf(
                'Formato não suportado (%s). Aceitos: %s.',
                \is_string($mime) && '' !== $mime ? $mime : 'desconhecido',
                implode(', ', array_keys(self::ALLOWED)),
            ));
        }

        $name = $catchId.'.'.self::ALLOWED[$mime];
        $this->filesystem->mkdir($this->dir);
        $this->filesystem->dumpFile($this->absolutePath($name), $binary);

        return ['path' => $name, 'mime' => $mime, 'bytes' => $bytes];
    }

    public function absolutePath(string $name): string
    {
        return rtrim($this->dir, '/\\').\DIRECTORY_SEPARATOR.$name;
    }

    public function exists(?string $name): bool
    {
        return null !== $name && is_file($this->absolutePath($name));
    }

    public function delete(?string $name): void
    {
        if (null !== $name) {
            $this->filesystem->remove($this->absolutePath($name));
        }
    }
}
