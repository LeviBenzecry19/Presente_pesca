<?php

declare(strict_types=1);

namespace App\EventListener;

use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Event\ExceptionEvent;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\KernelInterface;
use Symfony\Component\Validator\Exception\ValidationFailedException;

/**
 * O cliente é um PWA que só fala JSON. Sem isto, um 404 ou um 422 chegaria como
 * página HTML de erro do Symfony e o app não teria o que exibir.
 *
 * Só atua nas rotas /v1; o profiler e o resto do dev continuam intactos.
 */
#[AsEventListener(event: ExceptionEvent::class)]
final class ApiExceptionListener
{
    public function __construct(
        private readonly KernelInterface $kernel,
    ) {
    }

    public function __invoke(ExceptionEvent $event): void
    {
        if (!str_starts_with($event->getRequest()->getPathInfo(), '/v1')) {
            return;
        }

        $exception = $event->getThrowable();
        $status = $exception instanceof HttpExceptionInterface
            ? $exception->getStatusCode()
            : Response::HTTP_INTERNAL_SERVER_ERROR;

        $payload = [
            'ok' => false,
            'status' => $status,
            'error' => $this->message($exception, $status),
        ];

        // Detalhes por campo quando o corpo não passou na validação.
        $previous = $exception->getPrevious();
        if ($previous instanceof ValidationFailedException) {
            $details = [];
            foreach ($previous->getViolations() as $violation) {
                $details[] = [
                    'field' => $violation->getPropertyPath(),
                    'message' => (string) $violation->getMessage(),
                ];
            }
            $payload['details'] = $details;
        }

        if ($this->kernel->isDebug() && Response::HTTP_INTERNAL_SERVER_ERROR === $status) {
            $payload['exception'] = $exception::class;
            $payload['trace'] = $exception->getFile().':'.$exception->getLine();
        }

        $headers = $exception instanceof HttpExceptionInterface ? $exception->getHeaders() : [];
        $event->setResponse(new JsonResponse($payload, $status, $headers));
    }

    private function message(\Throwable $exception, int $status): string
    {
        if ($exception instanceof HttpExceptionInterface) {
            return '' !== $exception->getMessage() ? $exception->getMessage() : Response::$statusTexts[$status] ?? 'Erro';
        }

        // Fora de debug, nada de vazar detalhes internos.
        return $this->kernel->isDebug() ? $exception->getMessage() : 'Erro interno do servidor.';
    }
}
