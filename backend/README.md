# Pesca — backend

API de sincronização em **Symfony 8.1 / PHP 8.4** com **Doctrine ORM** sobre **MySQL/MariaDB**. Serve o PWA que está na raiz do repositório.

Contrato dos endpoints: [`../docs/backend/API.md`](../docs/backend/API.md).

## Rodar

Pré-requisitos: PHP 8.4 com `pdo_mysql`, `intl`, `fileinfo`, `mbstring`; Composer; MySQL 8 ou MariaDB 10.4+ na porta 3306.

```bash
composer install

# Ajuste DATABASE_URL se seu MySQL não for root sem senha.
# Prefira .env.local (não versionado) a editar o .env.
php bin/console doctrine:database:create --if-not-exists
php bin/console doctrine:migrations:migrate --no-interaction

php -S 127.0.0.1:8000 -t public     # ou `symfony serve -d` se tiver o CLI
```

Confira em <http://localhost:8000/v1/health> — deve responder `ok: true` com a versão do banco.

Depois, no frontend (raiz do repositório), aponte `NEXT_PUBLIC_SYNC_ENDPOINT=http://localhost:8000` em `.env.local` e refaça o build: variáveis `NEXT_PUBLIC_*` são embutidas em tempo de compilação.

## Testes

```bash
php bin/console doctrine:database:create --env=test --if-not-exists
php bin/console doctrine:migrations:migrate --env=test --no-interaction
php bin/phpunit
```

Os testes são funcionais: sobem o kernel e batem nos endpoints por HTTP, como o app faz. Cobrem o fluxo de sincronização (lote fora de ordem, reenvio, conflito por `updatedAt`, exclusões em cascata), upload e leitura de foto, isolamento entre aparelhos e a agregação por espécie.

## Como está organizado

| Caminho | O que faz |
| --- | --- |
| `src/Entity/` | `Device`, `FishingSpot`, `FishingTrip`, `FishCatch` |
| `src/Dto/` | Payloads validados na borda (`#[MapRequestPayload]`, `#[MapQueryString]`) |
| `src/Sync/SyncProcessor.php` | Aplica o lote: ordem por dependência, last-write-wins, exclusão lógica |
| `src/Sync/SyncPresenter.php` | Monta o JSON de saída no formato que o cliente espera |
| `src/Service/PhotoStorage.php` | Guarda as fotos em `var/storage/photos`, valida tipo pelo conteúdo |
| `src/Controller/` | `/v1/sync`, `/v1/catches/{id}/photo`, `/v1/species/nearby`, `/v1/health` |
| `src/EventListener/` | Converte qualquer erro em `/v1` para JSON |

## Decisões que valem saber

- **Ids vêm do cliente.** O app gera UUID offline, então as chaves primárias são `CHAR(36)` com estratégia "assigned" — nada de auto-incremento.
- **A classe é `FishCatch`, a tabela é `catches`.** `catch` é palavra reservada do PHP e não pode nomear uma classe.
- **Exclusão é lógica.** `deleted_at` permite que `GET /v1/sync` conte a outros aparelhos que algo sumiu.
- **Um flush por lote.** Itens inválidos são barrados na validação, antes de tocar o EntityManager, então o flush só carrega gravações boas e nenhum erro derruba os vizinhos.
- **Foto vai em PUT com bytes crus.** O PHP só popula `$_FILES` em POST; um PUT multipart chegaria vazio. `POST` multipart continua aceito para outros clientes.
- **Sem autenticação.** O escopo é o aparelho (`X-Device-Id`). `devices.user_id` já está reservado para agrupar aparelhos numa conta.

## Configuração

| Variável | Padrão | Para quê |
| --- | --- | --- |
| `DATABASE_URL` | `mysql://root:@127.0.0.1:3306/pesca` | Conexão com o banco |
| `CORS_ALLOW_ORIGIN` | regex de `localhost`/`127.0.0.1` | De onde o navegador pode chamar |
| `PESCA_PHOTO_DIR` | `var/storage/photos` | Onde as fotos ficam |
| `PESCA_MAX_PHOTO_BYTES` | `8388608` | Limite por foto |
