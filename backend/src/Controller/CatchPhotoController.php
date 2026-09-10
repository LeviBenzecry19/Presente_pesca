<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\FishCatch;
use App\Repository\FishCatchRepository;
use App\Service\DeviceProvider;
use App\Service\PhotoStorage;
use App\Sync\SyncPresenter;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Routing\Requirement\Requirement;

/**
 * Upload e leitura da foto de uma captura.
 *
 * O envio aceita duas formas porque o PHP só popula $_FILES em POST: um PUT com
 * multipart chegaria com corpo vazio. O cliente usa PUT com os bytes crus
 * (mais leve, sem overhead de multipart); POST multipart existe para curl,
 * formulários e outros clientes.
 */
final class CatchPhotoController extends AbstractController
{
    public function __construct(
        private readonly DeviceProvider $devices,
        private readonly FishCatchRepository $catches,
        private readonly PhotoStorage $photos,
        private readonly SyncPresenter $presenter,
        private readonly EntityManagerInterface $em,
    ) {
    }

    #[Route('/v1/catches/{id}/photo', name: 'catch_photo_put', methods: ['PUT', 'POST'], requirements: ['id' => Requirement::UUID])]
    public function upload(string $id, Request $request): JsonResponse
    {
        $device = $this->devices->fromRequest($request);
        $catch = $this->findOwnedCatch($id, $device->getId());

        $uploaded = $request->files->get('photo');
        if ($uploaded) {
            if (!$uploaded->isValid()) {
                throw new BadRequestHttpException('Upload inválido: '.$uploaded->getErrorMessage());
            }
            $binary = (string) file_get_contents($uploaded->getPathname());
        } else {
            $declared = (int) $request->headers->get('Content-Length', '0');
            if ($declared > $this->photos->maxBytes()) {
                throw new BadRequestHttpException(\sprintf('Foto acima do limite de %d bytes.', $this->photos->maxBytes()));
            }
            $binary = $request->getContent();
        }

        // Trocar de jpg para png deixaria o arquivo antigo órfão.
        $previous = $catch->getPhotoPath();
        $stored = $this->photos->store($catch->getId(), $binary);
        if (null !== $previous && $previous !== $stored['path']) {
            $this->photos->delete($previous);
        }

        $catch->setPhoto($stored['path'], $stored['mime'], $stored['bytes']);
        $catch->setPhotoExpected(true);
        $this->em->flush();

        return $this->json([
            'ok' => true,
            'id' => $catch->getId(),
            'url' => $this->presenter->photoUrl($catch->getId()),
            'mime' => $stored['mime'],
            'bytes' => $stored['bytes'],
        ]);
    }

    /**
     * Leitura pública pelo UUID da captura: um `<img src>` não consegue mandar
     * o header X-Device-Id. O id é aleatório e não é listado em lugar nenhum,
     * mas isso vira controle de acesso de verdade quando houver login.
     */
    #[Route('/v1/catches/{id}/photo', name: 'catch_photo_get', methods: ['GET'], requirements: ['id' => Requirement::UUID])]
    public function show(string $id): Response
    {
        $catch = $this->catches->find($id);
        if (null === $catch || $catch->isDeleted() || !$catch->hasPhoto()) {
            throw new NotFoundHttpException('Foto não encontrada.');
        }

        $path = $this->photos->absolutePath((string) $catch->getPhotoPath());
        if (!is_file($path)) {
            throw new NotFoundHttpException('Arquivo da foto não está mais no servidor.');
        }

        $response = new BinaryFileResponse($path);
        $response->headers->set('Content-Type', (string) $catch->getPhotoMime());
        $response->setPublic();
        $response->setMaxAge(86400);
        $response->setLastModified($catch->getUpdatedAt());
        $response->setEtag(substr(sha1($catch->getId().$catch->getUpdatedAt()->format('U')), 0, 20));

        return $response;
    }

    #[Route('/v1/catches/{id}/photo', name: 'catch_photo_delete', methods: ['DELETE'], requirements: ['id' => Requirement::UUID])]
    public function delete(string $id, Request $request): JsonResponse
    {
        $device = $this->devices->fromRequest($request);
        $catch = $this->findOwnedCatch($id, $device->getId());

        $this->photos->delete($catch->getPhotoPath());
        $catch->setPhoto(null, null, null);
        $catch->setPhotoExpected(false);
        $this->em->flush();

        return $this->json(['ok' => true, 'id' => $catch->getId()]);
    }

    private function findOwnedCatch(string $id, string $deviceId): FishCatch
    {
        $catch = $this->catches->find($id);
        if (null === $catch || $catch->isDeleted()) {
            // O cliente sobe a foto logo depois do upsert; se caiu aqui, a
            // captura ainda não sincronizou e vale retentar.
            throw new NotFoundHttpException('Captura não encontrada: sincronize-a antes de enviar a foto.');
        }
        if ($catch->getDevice()->getId() !== $deviceId) {
            throw new AccessDeniedHttpException('Esta captura pertence a outro aparelho.');
        }

        return $catch;
    }
}
