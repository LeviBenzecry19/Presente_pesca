# Deploy

Tudo no Railway, num projeto só (`wonderful-adaptation`), com **três recursos**:

| Recurso         | O que é              | Root Directory | Fonte da configuração                |
| --------------- | -------------------- | -------------- | ------------------------------------ |
| `Presente_pesca`| PWA (Next.js)        | `.` (raiz)     | [`.railway/railway.ts`](../.railway/railway.ts) |
| `api`           | API (Symfony + Apache) | `backend`    | idem                                 |
| `MySQL`         | banco                | —              | idem                                 |

Os dois serviços de código saem da **mesma branch `main`**; o que os separa é o
Root Directory. É de propósito: o contrato de sincronização vive metade em
`src/lib/db/schema.ts` e metade em `backend/src/Dto/`, e manter uma história só
permite mudar os dois lados no mesmo commit. Os *watch paths* evitam que um
commit no backend reconstrua o PWA e vice-versa.

Cada serviço tem o domínio dele — o Railway não roteia por caminho entre
serviços:

- PWA: <https://presentepesca-production.up.railway.app>
- API: <https://api-production-7d6ad.up.railway.app>

## A infraestrutura é código

`.railway/railway.ts` descreve o projeto inteiro: serviços, banco, volume,
variáveis, região, healthcheck e watch paths. Não configure nada pelo painel —
o arquivo é diffado contra o ambiente ao vivo e o painel perde na próxima
aplicação.

```bash
npm install                # o SDK "railway" é devDependency do projeto
npm install -g @railway/cli
railway login
railway link --project <id> --environment <id> --service <id>

railway config plan        # mostra o diff; não muda nada
railway config apply       # aplica (--yes para não perguntar)
```

`plan` limpo (`0 to add, 0 to change, 0 to destroy`) significa que o Railway
está igual ao arquivo. Mudanças destrutivas — remover recurso ou variável,
mover o banco de região — exigem `--confirm-destructive` além do `--yes`.

**No Windows**, `railway config plan` pode falhar com *"requires Railway CLI
5.42.1 or newer"* mesmo com a CLI nova: a checagem roda
`execFileSync(process.env._ || "railway")`, e o `railway.cmd` instalado pelo npm
não é executável direto. Contorne apontando `_` para o binário:

```powershell
$env:_ = "$env:APPDATA\npm\node_modules\@railway\cli\bin\railway.exe"
```

O `railway.json` (Config as Code) foi **descontinuado** pelo Railway e para de
funcionar em 2026-12-01 — por isso os dois que existiam aqui foram removidos.

## Segredos: fora do git

Duas variáveis ficam como `preserve()` no arquivo, ou seja, o valor vive só no
Railway:

```bash
# Um valor novo, nunca o de desenvolvimento.
railway variables --set "APP_SECRET=$(php -r 'echo bin2hex(random_bytes(16));')" --service api

# Contato exigido pela política de uso do Nominatim. Vai parar no bundle
# público do PWA, então prefira um endereço de projeto ao seu pessoal.
railway variables --set "NEXT_PUBLIC_APP_CONTACT=contato@exemplo.com" --service Presente_pesca
```

O resto das variáveis está versionado em `.railway/railway.ts`. Duas merecem
explicação:

- **`DATABASE_URL`** = `${{MySQL.MYSQL_URL}}?serverVersion=8.0&charset=utf8mb4`.
  Sem `serverVersion` o Doctrine abre uma conexão extra só para descobrir a
  versão; sem `charset=utf8mb4` os nomes com acento chegam quebrados.
- **`CORS_ALLOW_ORIGIN`** é **regex**, não URL literal (`origin_regex: true` em
  `config/packages/nelmio_cors.yaml`). Escape os pontos e ancore com `^…$`,
  senão `presentepesca-production.up.railway.app.invasor.com` também passa. O
  default versionado em `backend/.env` só aceita `localhost`.

E `NEXT_PUBLIC_SYNC_ENDPOINT` = `https://${{api.RAILWAY_PUBLIC_DOMAIN}}`: o
Railway resolve a referência, mas **`NEXT_PUBLIC_*` é embutido no bundle em
tempo de build**. Mudou a URL da API, o PWA precisa de um redeploy — editar a
variável sozinha não muda nada no app que já está no ar.

## Volume e região

As fotos das capturas ficam no volume `fotos`, montado em `/data` no serviço da
API (`PESCA_PHOTO_DIR=/data/photos`). Sem ele, cada deploy zeraria as fotos: o
disco do container é efêmero.

Tudo roda em **US East** (`us-east4-eqdc4a`) — não existe região na América do
Sul, e é a mais próxima do Brasil. Banco, API e volume na mesma região não é
detalhe: cada consulta atravessaria o Atlântico se o MySQL ficasse na Europa.
Mover o banco de região recria o volume, então é decisão de começo de projeto.

## Domínio próprio

Em cada serviço: `railway domain seudominio.com --service <serviço>` (ou
Settings → Networking no painel). O Railway devolve o alvo CNAME e emite o
certificado quando o DNS propaga.

| Registro | Tipo  | Aponta para                     |
| -------- | ----- | ------------------------------- |
| `app`    | CNAME | alvo mostrado no serviço do PWA |
| `api`    | CNAME | alvo mostrado no serviço da API |

Detalhes que costumam travar:

- **Domínio raiz** (`seudominio.com`) só funciona se o DNS suportar ALIAS/ANAME
  ou CNAME flattening. Subdomínio é sempre o caminho mais curto.
- **Cloudflare com proxy ligado**: SSL/TLS em *Full (strict)*. Em *Flexible* dá
  loop de redirecionamento; se o certificado não sair, deixe em DNS only até
  validar.
- Domínio próprio exige plano pago; no trial só existe o `*.up.railway.app`.

Depois de apontar o DNS, feche o ciclo em `.railway/railway.ts`:

1. `CORS_ALLOW_ORIGIN` → `^https://app\.seudominio\.com$`
2. `NEXT_PUBLIC_SYNC_ENDPOINT` → `https://api.seudominio.com`
3. `railway config apply` e **redeploy do PWA**.

## Conferindo

```bash
# Banco de pé e migrations aplicadas.
curl https://api-production-7d6ad.up.railway.app/v1/health

# CORS liberado para o domínio do PWA.
curl -I -H "Origin: https://presentepesca-production.up.railway.app" \
     https://api-production-7d6ad.up.railway.app/v1/health
```

O `/v1/health` devolve `ok: true` com a versão do MySQL quando está tudo certo,
e `503` com a mensagem do erro quando o banco não responde. Na segunda chamada,
procure `access-control-allow-origin` na resposta.

No app: Ajustes mostra a fila de sincronização pendente. Se ela zera depois de
registrar uma pescaria, os dois lados estão conversando.

Logs, quando algo falha:

```bash
railway logs --service api --build        # build da imagem
railway logs --service api --deployment   # container rodando
```

## Como o container da API sobe

[`backend/Dockerfile`](../backend/Dockerfile) é Apache + PHP 8.4 num processo
só. Duas armadilhas da imagem base já resolvidas ali: `php:8.4-apache` não traz
`unzip` nem a extensão zip (sem um dos dois o `composer install` não extrai os
pacotes) e não pode ficar com `mpm_prefork` e `mpm_event` carregados ao mesmo
tempo — o Apache morre no boot com *"More than one MPM loaded"*.

O [`entrypoint.sh`](../backend/docker/entrypoint.sh) faz, nessa ordem:

1. escreve `ports.conf` com o `$PORT` (fixado em 8080 nas variáveis);
2. espera o banco aceitar conexão (até ~60s) antes de seguir;
3. roda as migrations com `--allow-no-migration`, para que reiniciar sem
   migration nova não derrube o deploy;
4. limpa e aquece o cache do Symfony;
5. cria o diretório das fotos e passa a posse para `www-data` — o ponto de
   montagem do volume nasce do root e o Apache não escreveria nele;
6. entrega o processo para o `apache2-foreground`.

As migrations rodarem no boot é simples e suficiente para uma réplica só. Se um
dia precisar escalar, duas réplicas subindo juntas tentariam migrar ao mesmo
tempo — aí vale mover esse passo para um comando de release manual.

## Fora do escopo

Autenticação, VAPID/Web Push, storage S3 e CDN de imagens continuam fora, como
descrito em `docs/ARQUITETURA.md`. As fotos são servidas pelo próprio PHP, o que
é aceitável no volume atual e é o primeiro gargalo a olhar se crescer.
