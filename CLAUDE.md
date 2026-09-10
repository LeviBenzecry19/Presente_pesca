@AGENTS.md

# Pesca App — notas para o agente

Monorepo com duas partes:

- **raiz** — PWA local-first (Next.js 16 App Router, React 19, Tailwind v4, Dexie, Leaflet).
- **`backend/`** — API de sincronização (Symfony 8.1, PHP 8.4, Doctrine, MySQL/MariaDB). Tem o próprio `AGENTS.md`, que vale ao mexer lá dentro.

Idioma da UI, dos comentários e da documentação: **pt-BR**.

Leia antes de mexer em algo grande: `docs/ARQUITETURA.md` (decisões), `docs/ESPECIFICACAO.md` (produto) e `docs/backend/API.md` (contrato entre as duas partes).

## Regras do projeto

- **Toda escrita no banco passa por `src/lib/db/repo.ts`** — é ela que alimenta a fila de sync. Não chame `getDb().x.put()` direto nas telas.
- **Nunca importe Dexie em Server Components.** Telas são Client Components em `src/components/screens/`; as páginas em `src/app/` só as embrulham em `<Suspense>`.
- **Entidades por query string** (`/pescaria?id=`, `/captura?trip=&id=`), não por `[id]` — o service worker depende disso para servir qualquer pescaria offline.
- **Rotas novas** precisam entrar em `SHELL_ROUTES` em `src/sw/sw.js`.
- Ao mudar o schema do Dexie, incremente `this.version(n)` em `src/lib/db/index.ts` e reflita em `docs/backend/schema.sql`.
- Não usar `next/font/google`: o build precisa funcionar sem rede.
- Lint segue as regras do React Compiler (`react-hooks/set-state-in-effect`, `purity`): estado inicial vem de props/inicializadores, leituras de browser via `useSyncExternalStore` (`src/lib/hooks/useClientValue.ts`).

## Comandos

```bash
npm run dev          # SW desativado em dev
npm run build        # prebuild gera public/sw.js (gitignored)
npm run lint && npm run typecheck
npm run icons        # regenera public/icons via sharp
```

## Contrato entre app e backend

`src/lib/db/schema.ts` e os DTOs em `backend/src/Dto/` descrevem a mesma coisa. **Mudou um, mude o outro** e atualize `docs/backend/API.md`; `backend/src/Sync/SyncPresenter.php` monta a saída com os nomes de campo do TypeScript de propósito.

Dois detalhes que já custaram bug:

- JSON não distingue `3` de `3.0`, então o backend desserializa com o formato `json` para aceitar inteiro onde o DTO pede float.
- A foto sobe em `PUT` com bytes crus. O PHP só popula `$_FILES` em POST — multipart no PUT chega vazio.

## Fora do escopo atual

Autenticação, Web Push com VAPID, storage S3, modelo preditivo.
