# API de sincronização

Contrato implementado pelo backend Symfony em [`backend/`](../../backend/) e consumido por [`src/lib/sync/client.ts`](../../src/lib/sync/client.ts).

Base: `NEXT_PUBLIC_SYNC_ENDPOINT` (local: `http://localhost:8000`), sem barra final.

## Identificação

Enquanto não há login, cada aparelho se identifica pelo header **`X-Device-Id`**, um UUID gerado e guardado no próprio aparelho. O registro é criado na primeira chamada.

Regras que valem em toda a API:

- Um aparelho só lê e escreve os próprios spots, pescarias e capturas. Tentar alterar um registro de outro aparelho devolve erro no item (`ok: false`) ou `403`.
- Datas trafegam em ISO-8601 UTC (`2026-09-08T12:00:00.000Z`) e são gravadas em UTC.
- Erros em `/v1/*` sempre voltam em JSON: `{ "ok": false, "status": 422, "error": "...", "details": [...] }`.
- CORS liberado para `localhost`/`127.0.0.1` em qualquer porta (`CORS_ALLOW_ORIGIN` no `.env` do backend).

## `POST /v1/sync`

Envia um lote de alterações. O cliente manda no máximo 25 itens por vez; o servidor aceita até 200.

```jsonc
{
  "deviceId": "3f7c…",          // precisa bater com o header X-Device-Id
  "items": [
    { "entity": "spot",  "op": "upsert", "id": "uuid", "data": { /* FishingSpot */ } },
    { "entity": "trip",  "op": "upsert", "id": "uuid", "data": { /* FishingTrip com weather */ } },
    { "entity": "catch", "op": "upsert", "id": "uuid", "data": { /* Catch sem photo, com hasPhoto */ } },
    { "entity": "catch", "op": "delete", "id": "uuid", "data": null }
  ]
}
```

Resposta `200` — um resultado por item, **na mesma ordem em que foram enviados**:

```jsonc
{
  "ok": false,                       // false se algum item falhou
  "deviceId": "3f7c…",
  "serverTime": "2026-09-08T16:32:52.164Z",
  "results": [
    { "id": "uuid", "ok": true,  "status": "applied" },
    { "id": "uuid", "ok": true,  "status": "skipped" },   // versão do servidor é igual ou mais nova
    { "id": "uuid", "ok": true,  "status": "deleted" },
    { "id": "uuid", "ok": true,  "status": "ignored" },   // delete de algo que não existe
    { "id": "uuid", "ok": false, "error": "pescaria desconhecida: …" }
  ]
}
```

O cliente remove da fila os itens com `ok: true` e mantém os demais para retentar.

Comportamento garantido:

- **Idempotente por `id`**: reenviar o mesmo item não duplica nada.
- **Last-write-wins por `data.updatedAt`**: um envio mais antigo que o estado do servidor vira `skipped`.
- **Ordem interna segura**: o servidor reordena o lote (spots → pescarias → capturas nos upserts, o inverso nos deletes), então o cliente pode enviar em qualquer ordem.
- **Falha isolada**: um item inválido não derruba os outros do lote.
- **Exclusão lógica**: `delete` grava `deletedAt`, o que permite propagar a remoção para outros aparelhos.
- Apagar uma pescaria apaga as capturas dela; apagar um spot só desfaz o vínculo das pescarias, que continuam existindo com as próprias coordenadas.
- Uma captura cuja pescaria o servidor ainda não conhece falha com `pescaria desconhecida` — é retentável, e o cliente reenvia depois.
- Um `spotId` desconhecido não bloqueia a pescaria: ela é gravada sem o vínculo.

Os formatos de `data` são os tipos de [`src/lib/db/schema.ts`](../../src/lib/db/schema.ts). Campos extras (como `syncedAt`) são ignorados. Números inteiros são aceitos onde o tipo é decimal, porque `JSON.stringify(3.0)` produz `3`.

## `PUT /v1/catches/{id}/photo`

Envia a foto **como bytes crus no corpo**, com `Content-Type: image/jpeg` (ou png/webp).

> Não use multipart no PUT: o PHP só monta `$_FILES` em requisições POST, então um PUT multipart chegaria com o corpo vazio. Para clientes que precisam de formulário, o mesmo endpoint aceita **`POST` multipart** com o campo `photo`.

O tipo é detectado pelo conteúdo, não pelo header. Aceitos: JPEG, PNG e WebP, até `PESCA_MAX_PHOTO_BYTES` (8 MB por padrão). A captura precisa ter sido sincronizada antes, senão a resposta é `404`.

```json
{ "ok": true, "id": "uuid", "url": "http://localhost:8000/v1/catches/uuid/photo", "mime": "image/jpeg", "bytes": 214503 }
```

## `GET /v1/catches/{id}/photo`

Devolve a imagem com cache e `ETag`. É a única rota sem `X-Device-Id`: um `<img src>` não consegue enviar headers. O UUID é aleatório e não aparece em listagem alguma, mas isso só vira controle de acesso de verdade quando houver login.

## `DELETE /v1/catches/{id}/photo`

Remove a imagem do servidor. Exige `X-Device-Id` do dono.

## `GET /v1/sync?since=<ISO>&limit=<n>`

Baixa as alterações do aparelho (útil para um segundo aparelho do mesmo usuário). Inclui registros apagados, com `deletedAt` preenchido, para que o cliente possa removê-los.

```jsonc
{
  "ok": true,
  "deviceId": "3f7c…",
  "since": "2026-09-01T00:00:00.000Z",
  "serverTime": "2026-09-08T16:40:00.000Z",
  "spots": [ /* … */ ],
  "trips": [ /* … com weather e checklist */ ],
  "catches": [ /* … com hasPhoto e photoUrl */ ]
}
```

Sem `since`, devolve tudo do aparelho. `limit` vai de 1 a 1000 (padrão 500) e vale por coleção.

## `GET /v1/species/nearby?lat=&lng=&radiusKm=&limit=`

Espécies capturadas em volta de um ponto, agregadas de **todos** os aparelhos — é a base da inteligência coletiva da seção 5.1 da especificação. A resposta é sempre agregada e nunca identifica quem registrou.

`radiusKm` vai de 0,1 a 500 (padrão 25); `limit` de 1 a 50 (padrão 15).

```jsonc
{
  "ok": true,
  "center": { "lat": -15.78, "lng": -48.2 },
  "radiusKm": 25,
  "totalCatches": 4,
  "species": [
    {
      "speciesId": "tucunare",
      "catches": 3, "trips": 1, "devices": 2,
      "avgWeightKg": 3.0, "maxWeightKg": 4.0, "avgLengthCm": 52.0,
      "nearestKm": 0.06,
      "firstCaughtAt": "2026-09-10T06:30:00.000Z",
      "lastCaughtAt": "2026-09-12T17:30:00.000Z",
      "bestHours": [ { "hour": 6, "catches": 2 }, { "hour": 17, "catches": 1 } ]
    }
  ]
}
```

`bestHours` só é preenchido a partir de 3 capturas da espécie na área: abaixo disso a amostra não diz nada.

A consulta usa `ST_Distance_Sphere` com um pré-filtro por bounding box sobre o índice `(lat, lng)`.

## `GET /v1/health`

```json
{ "ok": true, "service": "pesca-backend", "time": "…", "php": "8.4.23", "symfony": "8.1.6", "database": "10.4.32-MariaDB", "error": null }
```

Responde `503` quando o banco não responde. `GET /` lista os endpoints.

## Ainda não implementado

- **Autenticação de usuário.** Hoje o escopo é o aparelho; a tabela `devices` já tem `user_id` reservado para ligar vários aparelhos a uma conta.
- **Web Push com VAPID** (`POST /v1/push/subscribe`). O service worker do cliente já trata o evento `push` com payload `{ title, body, url }`; falta o servidor guardar as inscrições e disparar os lembretes.
- **Storage S3.** As fotos ficam em disco (`backend/var/storage/photos`), atrás de um controller — trocar por um bucket não muda a URL pública.
