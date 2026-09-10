# Arquitetura do MVP

Este documento registra as decisões técnicas da Fase 1. A especificação de produto está em [ESPECIFICACAO.md](./ESPECIFICACAO.md).

## Princípio: local-first

Todo dado do usuário nasce e vive no aparelho (IndexedDB via Dexie). O app é 100% funcional sem backend; a sincronização é uma camada opcional acionada quando `NEXT_PUBLIC_SYNC_ENDPOINT` está configurada. Isso atende ao requisito "offline não é opcional" e permite lançar antes de existir servidor.

Consequências:

- IDs são UUIDs gerados no cliente (`src/lib/utils/ids.ts`), para que registros criados offline não colidam ao sincronizar.
- Cada escrita (`src/lib/db/repo.ts`) grava o registro **e** uma entrada na `syncQueue`. A fila guarda só a referência (entidade + id + operação); o estado é lido na hora do envio, então N edições offline viram 1 envio.
- Fotos são comprimidas no cliente (~1600 px, JPEG 0,82) antes de ir para o IndexedDB, para caber na cota de armazenamento e trafegar bem em 3G.

## Camadas

```
src/app/*                 rotas (Server Components finos que renderizam uma Screen)
src/components/screens/*  telas (Client Components; leem o Dexie com useLiveQuery)
src/components/*          UI compartilhada (Button, Card, Field, mapa, clima…)
src/lib/db                schema + Dexie + repositório (única porta de escrita)
src/lib/weather           Open-Meteo, fase da lua, códigos WMO
src/lib/forecast          heurísticas de previsão de pesca
src/lib/geo               GPS, Nominatim, distância
src/lib/notifications     lembretes locais + periodic sync
src/lib/sync              fila e cliente do backend
src/lib/backup            exportar/importar JSON
src/data/especies.ts      base curada de espécies
src/sw/sw.js              service worker (copiado para public/sw.js no build)
```

## Rotas por query string, não por segmento dinâmico

`/pescaria?id=…` e `/captura?trip=…&id=…` em vez de `/pescaria/[id]`. Motivo: o HTML dessas rotas é idêntico para qualquer id, então o service worker consegue pré-cachear **uma** casca por tela e servir qualquer pescaria offline (a busca no cache ignora a query string). Com segmento dinâmico, uma pescaria nunca visitada online cairia na página offline.

## Service worker (`src/sw/sw.js`)

Escrito à mão (sem Workbox/Serwist) para não depender de plugin de bundler e manter as regras legíveis:

| Recurso | Estratégia |
| --- | --- |
| `/_next/static/*` | cache-first (arquivos com hash, imutáveis) |
| Navegações (HTML) | stale-while-revalidate, `ignoreSearch`, fallback `/offline` |
| Payloads RSC (`?_rsc=`) | só rede; ao falhar o Next faz navegação completa e cai na regra acima |
| Tiles OSM | cache-first, limite de 500 entradas |
| Open-Meteo / Nominatim | network-first com fallback ao último resultado |

No `install`, o SW busca cada rota da casca, extrai do HTML os chunks `/_next/static/...` referenciados e os cacheia. O `SW_VERSION` é carimbado por `scripts/stamp-sw.mjs` a cada build (`prebuild`), o que força a atualização do SW; o app mostra "Nova versão disponível" e só troca quando o usuário aceita (`SKIP_WAITING`).

Em desenvolvimento o SW não é registrado (e registros antigos são removidos) para não interferir no HMR.

## Clima e previsão de pesca

- **Open-Meteo** (`src/lib/weather/openMeteo.ts`): horário do dia escolhido, até 16 dias à frente. Datas com mais de 60 dias no passado usam a API de arquivo. A resposta é normalizada em `WeatherSnapshot` e gravada na pescaria — o histórico não depende de nova chamada.
- **Fase da lua** calculada localmente (mês sinódico a partir da lua nova de referência de 2000-01-06).
- **Heurísticas** (`src/lib/forecast/heuristics.ts`): nota 0–100 por hora combinando crepúsculos, lua, tendência de pressão (Δ em 3 h), vento, chuva/tempestade, temperatura e nebulosidade. Gera nota do dia, melhores janelas contíguas e destaques em texto. É deliberadamente simples e comentada para ser substituída por um modelo quando houver dados (Fase 4).

## Lembretes

Sem servidor de push no MVP, então:

1. Com o app aberto: `BackgroundTasks` verifica lembretes vencidos a cada minuto e ao voltar ao foco.
2. Em segundo plano (Chrome/Android instalado): o SW registra `periodicsync` e lê as pescarias direto do IndexedDB.
3. iOS: só com o app aberto. Web Push real exige backend com chaves VAPID — o SW já trata o evento `push` e o contrato está em [backend/API.md](./backend/API.md).

## Sincronização

`src/lib/sync/client.ts` envia lotes de até 25 itens para `POST {endpoint}/v1/sync` e fotos via `PUT /v1/catches/{id}/photo`. Roda ao voltar a conexão, ao voltar ao foco e por Background Sync (`sync-queue`). Itens que falham acumulam `attempts` e sofrem backoff probabilístico simples. Sem `NEXT_PUBLIC_SYNC_ENDPOINT`, a tela de Ajustes mostra quantas alterações aguardam.

A foto vai como **bytes crus no corpo do PUT**, não multipart: o PHP só monta `$_FILES` em POST, então um PUT multipart chegaria ao backend com o corpo vazio.

## Backend (`backend/`)

Symfony 8.1 + Doctrine ORM sobre MySQL/MariaDB. Detalhes em [backend/README.md](../backend/README.md) e no contrato em [backend/API.md](backend/API.md).

O que moldou o desenho:

- **As chaves primárias vêm do cliente.** Como os registros nascem offline, o servidor nunca atribui identidade: `CHAR(36)` com estratégia "assigned". É isso que torna o reenvio idempotente de graça.
- **Conflito por `updatedAt` (last-write-wins).** Um envio mais antigo que o estado do servidor volta como `skipped`, não como erro — o cliente limpa a fila e segue.
- **O servidor reordena o lote** (spots → pescarias → capturas nos upserts, o inverso nos deletes), então o cliente pode mandar em qualquer ordem sem violar chave estrangeira.
- **Um flush por lote.** A validação acontece antes de tocar o EntityManager, então o flush só carrega gravações válidas e um item ruim não derruba os vizinhos. Cada item volta com seu próprio `ok`.
- **Exclusão lógica.** `deleted_at` é o que permite a um segundo aparelho descobrir que algo foi apagado.
- **Sem PostGIS.** O banco disponível é MariaDB, então a proximidade usa `ST_Distance_Sphere` com pré-filtro por bounding box sobre o índice `(lat, lng)` — mesma precisão, sem depender da extensão.

O escopo de acesso é o aparelho (`X-Device-Id`), não o usuário: um aparelho só lê e escreve os próprios dados. `devices.user_id` está reservado para o dia em que houver login e vários aparelhos por conta.

## Testar no celular

Geolocalização, câmera e service worker exigem contexto seguro. Para testar na rede local use `npm run dev:https` (certificado local do Next) ou exponha via túnel HTTPS. Em produção, basta HTTPS.

## Fora do escopo desta fase

- Autenticação de usuário e sincronização entre aparelhos de uma mesma conta.
- Web Push com VAPID (o service worker já trata o evento `push`; falta o servidor guardar inscrições e disparar).
- Storage de fotos em bucket S3 — hoje ficam em disco, atrás de um controller, então a URL não muda quando trocar.
- Modelo preditivo (Fase 4). Os dados já são coletados com as features necessárias, e `GET /v1/species/nearby` é o primeiro passo estatístico.
