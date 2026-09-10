# Deploy

O repositório é um só, com duas metades que sobem em provedores diferentes:

| Branch  | Provedor | Root Directory | O que roda                       |
| ------- | -------- | -------------- | -------------------------------- |
| `front` | Vercel   | `.` (raiz)     | PWA Next.js                      |
| `back`  | Railway  | `backend`      | API Symfony + MySQL              |
| `main`  | —        | —              | integração; nada faz deploy dela |

As duas branches carregam o repositório inteiro; cada provedor constrói só a
pasta apontada em Root Directory. É de propósito: o contrato de sincronização
vive metade em `src/lib/db/schema.ts` e metade em `backend/src/Dto/`, e manter
tudo numa história só permite mudar os dois lados no mesmo commit.

Faça o Railway primeiro: a Vercel precisa da URL pública dele no build.

## 1. Railway — API e banco

**Banco.** Adicione um serviço **MySQL**, não Postgres. As migrations foram
geradas para MySQL e usam `LONGTEXT`, `TINYINT` e `DEFAULT CHARACTER SET
utf8mb4`; em Postgres elas falham na primeira linha.

**API.** Novo serviço a partir do repositório, branch `back`, Root Directory
`backend`. O [`railway.json`](../backend/railway.json) já manda usar o
Dockerfile e configura o healthcheck em `/v1/health`, que só responde 200
quando o banco também responde.

**Volume.** Sem isso as fotos das capturas somem a cada deploy — o disco do
container é efêmero. Monte um volume em `/data` no serviço da API.

**Variáveis:**

| Variável                | Valor                                                            |
| ----------------------- | ---------------------------------------------------------------- |
| `APP_ENV`               | `prod`                                                            |
| `APP_SECRET`            | um valor novo (veja abaixo) — não reaproveite o de desenvolvimento |
| `DATABASE_URL`          | `${{MySQL.MYSQL_URL}}?serverVersion=8.0&charset=utf8mb4`           |
| `CORS_ALLOW_ORIGIN`     | `^https://SEU-APP\.vercel\.app$`                                  |
| `PESCA_PHOTO_DIR`       | `/data/photos`                                                    |
| `PESCA_MAX_PHOTO_BYTES` | `8388608`                                                         |

`APP_SECRET` novo:

```bash
php -r "echo bin2hex(random_bytes(16)), PHP_EOL;"
```

Sobre `DATABASE_URL`: o nome exato da variável do serviço MySQL aparece na aba
Variables do Railway — costuma ser `MYSQL_URL` (rede interna). Ajuste
`serverVersion` para a versão que o painel mostrar. O sufixo importa: sem
`serverVersion` o Doctrine abre uma conexão extra só para descobrir a versão, e
sem `charset=utf8mb4` os nomes com acento chegam quebrados.

Sobre `CORS_ALLOW_ORIGIN`: é **regex**, não URL literal (`origin_regex: true` em
`config/packages/nelmio_cors.yaml`). Escape os pontos e ancore com `^…$`, senão
`meuapp.vercel.app.invasor.com` também passa. O default versionado em
`backend/.env` só aceita `localhost` — sem sobrescrever aqui, o navegador
bloqueia todas as chamadas do PWA.

## 2. Vercel — PWA

Importe o repositório, Production Branch `front`, Root Directory na raiz. O
resto é detectado sozinho: `npm run build` dispara o `prebuild`, que gera
`public/sw.js`. **Não existe `vercel.json` de propósito** — os cabeçalhos de
segurança e o `Cache-Control` do service worker já estão em
[`next.config.ts`](../next.config.ts), e a Vercel respeita o `headers()` do
Next.

| Variável                    | Valor                              |
| --------------------------- | ---------------------------------- |
| `NEXT_PUBLIC_SYNC_ENDPOINT` | URL pública da API no Railway      |
| `NEXT_PUBLIC_APP_CONTACT`   | e-mail de contato para o Nominatim |

`NEXT_PUBLIC_*` é **embutido no bundle em tempo de build**. Mudar a URL da API
depois exige um redeploy; editar a variável sozinha não muda nada no app que já
está no ar.

O `NEXT_PUBLIC_APP_CONTACT` não é decorativo: a política de uso do Nominatim
exige um contato identificável, e sem ele a busca por endereço pode ser
bloqueada.

## 3. Fechar o ciclo

Com a URL da Vercel em mãos, volte ao Railway e ajuste `CORS_ALLOW_ORIGIN` para
o domínio real. Toda pré-visualização da Vercel tem domínio próprio; se quiser
que os previews também sincronizem, o regex precisa cobri-los.

## Conferindo

```bash
# Banco de pé e migrations aplicadas.
curl https://SUA-API.up.railway.app/v1/health

# CORS liberado para o domínio do PWA.
curl -I -H "Origin: https://SEU-APP.vercel.app" \
     https://SUA-API.up.railway.app/v1/health
```

O `/v1/health` devolve `ok: true` com a versão do MySQL quando está tudo certo,
e `503` com a mensagem do erro quando o banco não responde. Na segunda chamada,
procure `access-control-allow-origin` na resposta.

No app: Ajustes mostra a fila de sincronização pendente. Se ela zera depois de
registrar uma pescaria, os dois lados estão conversando.

## Como o container sobe

[`backend/Dockerfile`](../backend/Dockerfile) é Apache + PHP 8.4 num processo
só. O [`entrypoint.sh`](../backend/docker/entrypoint.sh) faz, nessa ordem:

1. escreve `ports.conf` com o `$PORT` que o Railway injeta;
2. espera o banco aceitar conexão (até ~60s) antes de seguir;
3. roda as migrations com `--allow-no-migration`, para que reiniciar sem
   migration nova não derrube o deploy;
4. limpa e aquece o cache do Symfony;
5. cria o diretório das fotos e passa a posse para `www-data` — o ponto de
   montagem do volume nasce do root e o Apache não escreveria nele;
6. entrega o processo para o `apache2-foreground`.

As migrations rodarem no boot é simples e suficiente para uma réplica só
(`numReplicas: 1` no `railway.json`). Se um dia precisar escalar, duas réplicas
subindo juntas tentariam migrar ao mesmo tempo — aí vale mover esse passo para
um comando de release manual.

## Fora do escopo

Autenticação, VAPID/Web Push, storage S3 e CDN de imagens continuam fora, como
descrito em `docs/ARQUITETURA.md`. As fotos são servidas pelo próprio PHP, o que
é aceitável no volume atual e é o primeiro gargalo a olhar se crescer.
