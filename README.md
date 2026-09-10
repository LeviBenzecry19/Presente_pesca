# Pesca App

PWA para pescadores amadores: planejamento com clima e previsão de pesca, sessão de pesca ativa e registro de capturas com foto e GPS — tudo funcionando offline.

O repositório tem duas partes: o PWA (Next.js, na raiz) e a API de sincronização ([`backend/`](backend/), Symfony + MySQL). O app funciona sozinho; o backend é opcional e guarda os dados fora do aparelho.

- Produto: [docs/ESPECIFICACAO.md](docs/ESPECIFICACAO.md)
- Decisões técnicas: [docs/ARQUITETURA.md](docs/ARQUITETURA.md)
- API: [docs/backend/API.md](docs/backend/API.md) · [backend/README.md](backend/README.md)

## Rodar tudo localmente

Backend (precisa de MySQL 8 ou MariaDB 10.4+ na porta 3306):

```bash
cd backend
composer install
php bin/console doctrine:database:create --if-not-exists
php bin/console doctrine:migrations:migrate --no-interaction
php -S 127.0.0.1:8000 -t public
```

Frontend, em outro terminal:

```bash
npm install
echo "NEXT_PUBLIC_SYNC_ENDPOINT=http://localhost:8000" > .env.local
npm run build && npm start      # http://localhost:3000, PWA completo
```

Para desenvolver: `npm run dev` (service worker desativado) ou `npm run dev:https`, que é o que permite GPS, câmera e instalação ao abrir pelo celular na rede local.

Outros scripts: `npm run lint`, `npm run typecheck`, `npm run icons` (regenera os ícones em `public/icons`).

## Configuração

Copie `.env.example` para `.env.local`. Nenhuma variável é obrigatória:

| Variável | Efeito |
| --- | --- |
| `NEXT_PUBLIC_SYNC_ENDPOINT` | URL do backend. Vazio = app 100% local, com a fila de sync acumulando. |
| `NEXT_PUBLIC_APP_CONTACT` | E-mail enviado ao Nominatim (busca de lugares), conforme a política de uso do OSM. |

`NEXT_PUBLIC_*` é embutido no bundle em tempo de build: depois de mudar, refaça `npm run build`.

## Deploy

Tudo no Railway, num projeto só com três serviços: MySQL, API (Root Directory `backend`) e PWA (raiz). Passo a passo, variáveis, domínio próprio e as armadilhas de CORS e de volume em [`docs/DEPLOY.md`](docs/DEPLOY.md).

## O que já funciona (Fase 1)

- **Planejar**: data/hora, local por GPS, busca (Nominatim) ou toque no mapa (Leaflet + OSM), spots salvos, clima horário (Open-Meteo), fase da lua, previsão de pesca por heurísticas, lembrete.
- **Spots**: CRUD de locais favoritos, ordenação por distância, "Pescar agora aqui".
- **Sessão ativa**: iniciar/encerrar com GPS, "Pescar agora" sem planejamento, checklist.
- **Capturas**: foto (câmera, comprimida), espécie (base curada filtrada por ambiente + "outra"), peso, tamanho, GPS automático com ajuste no mapa, isca, observações; edição e exclusão.
- **Histórico**: pescarias concluídas e estatísticas (horas, capturas, maior peixe, espécies), agrupadas por mês, com busca, filtro por ano e uma aba só de fotos.
- **Offline**: IndexedDB (Dexie), service worker com pré-cache das telas, fila de sincronização com Background Sync, backup/restauração em JSON.
- **PWA**: manifest, ícones, instalação, atualização com aviso.
- **Backend** (Symfony 8 + Doctrine + MySQL): sincronização em lote idempotente com resolução de conflito por `updatedAt`, upload de fotos, download incremental e agregação de espécies por região com consulta geoespacial.

## Limitações conhecidas

- Sem autenticação: o backend isola os dados por aparelho (`X-Device-Id`), então um segundo celular ainda não enxerga o histórico do primeiro. A coluna `devices.user_id` já está reservada para isso.
- A leitura de fotos (`GET /v1/catches/{id}/photo`) é pública pelo UUID, porque `<img src>` não envia headers. Vira controle de acesso real quando houver login.
- Lembretes em segundo plano só no Chrome/Android com o app instalado (Periodic Background Sync). Web Push real ainda depende de VAPID no servidor.
- A previsão de pesca é heurística (documentada em `src/lib/forecast/heuristics.ts`).
- Períodos de defeso na base de espécies são orientativos; a portaria local prevalece.
