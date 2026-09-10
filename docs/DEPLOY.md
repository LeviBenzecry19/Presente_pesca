# Deploy

Tudo no Railway, num projeto só, com **três serviços**:

| Serviço | Root Directory | Watch Paths      | Config                                     |
| ------- | -------------- | ---------------- | ------------------------------------------ |
| MySQL   | —              | —                | serviço pronto do Railway                  |
| API     | `backend`      | `backend/**`     | [`backend/railway.json`](../backend/railway.json) |
| PWA     | `.` (raiz)     | veja abaixo      | [`railway.json`](../railway.json)          |

Os dois serviços de código saem da **mesma branch `main`**; o que os separa é o
Root Directory. É de propósito: o contrato de sincronização vive metade em
`src/lib/db/schema.ts` e metade em `backend/src/Dto/`, e manter uma história só
permite mudar os dois lados no mesmo commit.

Cada serviço tem um domínio próprio (o Railway não faz roteamento por caminho
entre serviços), então o desenho final é `app.seudominio.com` para o PWA e
`api.seudominio.com` para a API.

**Ordem importa:** MySQL → API → domínio da API → PWA → CORS. A URL da API é
embutida no bundle do PWA em tempo de build; subir o PWA antes de saber a URL
significa refazer o deploy depois.

## 1. MySQL

Adicione um serviço **MySQL**, não Postgres. As migrations foram geradas para
MySQL e usam `LONGTEXT`, `TINYINT` e `DEFAULT CHARACTER SET utf8mb4`; em
Postgres elas falham na primeira linha. O volume de dados já vem junto com o
serviço.

## 2. API (Symfony)

Serviço a partir do repositório, branch `main`, **Root Directory `backend`** — é
esse campo que faz o Railway achar o [`railway.json`](../backend/railway.json)
de lá, que manda usar o Dockerfile e configura o healthcheck em `/v1/health`
(só responde 200 quando o banco também responde).

**Volume.** Monte um volume em `/data`. Sem isso as fotos das capturas somem a
cada deploy — o disco do container é efêmero.

**Variáveis:**

| Variável                | Valor                                                              |
| ----------------------- | ------------------------------------------------------------------ |
| `APP_ENV`               | `prod`                                                             |
| `APP_SECRET`            | um valor novo (veja abaixo) — não reaproveite o de desenvolvimento |
| `DATABASE_URL`          | `${{MySQL.MYSQL_URL}}?serverVersion=8.0&charset=utf8mb4`            |
| `CORS_ALLOW_ORIGIN`     | por enquanto `^https://.*\.up\.railway\.app$`; vira o domínio real no passo 4 |
| `PESCA_PHOTO_DIR`       | `/data/photos`                                                     |
| `PESCA_MAX_PHOTO_BYTES` | `8388608`                                                          |

`APP_SECRET` novo:

```bash
php -r "echo bin2hex(random_bytes(16)), PHP_EOL;"
```

Sobre `DATABASE_URL`: o nome exato da variável do serviço MySQL aparece na aba
Variables do Railway — costuma ser `MYSQL_URL` (rede interna, sem passar pela
internet). Ajuste `serverVersion` para a versão que o painel mostrar. O sufixo
importa: sem `serverVersion` o Doctrine abre uma conexão extra só para descobrir
a versão, e sem `charset=utf8mb4` os nomes com acento chegam quebrados.

Sobre `CORS_ALLOW_ORIGIN`: é **regex**, não URL literal (`origin_regex: true` em
`config/packages/nelmio_cors.yaml`). Escape os pontos e ancore com `^…$`, senão
`meuapp.com.invasor.com` também passa. O default versionado em `backend/.env` só
aceita `localhost` — sem sobrescrever aqui, o navegador bloqueia todas as
chamadas do PWA.

Quando o serviço subir, gere o domínio público (Settings → Networking →
Generate Domain) e anote a URL: ela é a entrada do próximo passo.

## 3. PWA (Next.js)

Outro serviço, mesmo repositório, mesma branch, **Root Directory na raiz**. O
[`railway.json`](../railway.json) da raiz define `npm run build` (que dispara o
`prebuild` e gera `public/sw.js`) e `npm run start`; o `next start` escuta o
`$PORT` que o Railway injeta, sem precisar de flag. O `.nvmrc` fixa o Node 22 —
sem ele o builder escolhe a versão do dia.

**Watch Paths.** Sem isso, todo commit reconstrói os dois serviços. No PWA:

```
/**
!/backend/**
!/docs/**
```

**Variáveis:**

| Variável                    | Valor                                    |
| --------------------------- | ---------------------------------------- |
| `NEXT_PUBLIC_SYNC_ENDPOINT` | URL pública da API, sem barra no fim      |
| `NEXT_PUBLIC_APP_CONTACT`   | e-mail de contato para o Nominatim        |

`NEXT_PUBLIC_*` é **embutido no bundle em tempo de build**. Mudar a URL da API
depois exige um redeploy; editar a variável sozinha não muda nada no app que já
está no ar. Dá para escrever `https://${{API.RAILWAY_PUBLIC_DOMAIN}}` (trocando
`API` pelo nome do serviço) e deixar o Railway resolver, mas assim que houver
domínio próprio prefira a URL literal — a variável de referência continua
apontando para o `*.up.railway.app`.

O `NEXT_PUBLIC_APP_CONTACT` não é decorativo: a política de uso do Nominatim
exige um contato identificável, e sem ele a busca por endereço pode ser
bloqueada.

## 4. Domínio próprio

Em cada serviço: Settings → Networking → Custom Domain. O Railway devolve um
alvo CNAME e emite o certificado sozinho depois que o DNS propaga.

| Registro         | Tipo  | Aponta para                    |
| ---------------- | ----- | ------------------------------ |
| `app`            | CNAME | alvo mostrado no serviço do PWA |
| `api`            | CNAME | alvo mostrado no serviço da API |

Detalhes que costumam travar:

- **Domínio raiz** (`seudominio.com`, sem subdomínio) só funciona se o seu DNS
  suportar ALIAS/ANAME ou CNAME flattening — Cloudflare e Registro.br não se
  comportam igual aqui. Subdomínio é sempre o caminho mais curto.
- **Cloudflare com proxy ligado** (nuvem laranja): deixe o SSL/TLS em *Full
  (strict)*. Em *Flexible* dá loop de redirecionamento. Se o certificado do
  Railway não sair, ponha em DNS only até validar e ligue o proxy depois.
- Domínio próprio exige plano pago; no trial só existe o `*.up.railway.app`.

Com os domínios de pé, feche o ciclo:

1. `CORS_ALLOW_ORIGIN` na API → `^https://app\.seudominio\.com$`
2. `NEXT_PUBLIC_SYNC_ENDPOINT` no PWA → `https://api.seudominio.com`
3. **Redeploy do PWA** — sem isso o bundle publicado continua chamando a URL
   antiga.

Se quiser que as pré-visualizações também sincronizem, o regex do CORS precisa
cobrir os domínios de preview: `^https://(app\.seudominio\.com|.*\.up\.railway\.app)$`.

## Conferindo

```bash
# Banco de pé e migrations aplicadas.
curl https://api.seudominio.com/v1/health

# CORS liberado para o domínio do PWA.
curl -I -H "Origin: https://app.seudominio.com" \
     https://api.seudominio.com/v1/health
```

O `/v1/health` devolve `ok: true` com a versão do MySQL quando está tudo certo,
e `503` com a mensagem do erro quando o banco não responde. Na segunda chamada,
procure `access-control-allow-origin` na resposta.

No app: Ajustes mostra a fila de sincronização pendente. Se ela zera depois de
registrar uma pescaria, os dois lados estão conversando.

## Como o container da API sobe

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
