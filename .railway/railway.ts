// Infraestrutura do projeto no Railway, em código.
//
// Um projeto, três recursos: o PWA (Next.js, na raiz do repositório), a API
// (Symfony, em backend/) e o MySQL. O que separa os dois serviços de código é
// o rootDirectory — os dois saem da mesma branch main, porque o contrato de
// sincronização vive metade em src/lib/db/schema.ts e metade em backend/src/Dto/.
//
//   railway config plan    # mostra o diff contra o ambiente
//   railway config apply   # aplica
//
// Substitui os railway.json (Config as Code), descontinuados pelo Railway.
import { defineRailway, github, mysql, preserve, project, service, volume } from "railway/iac";

const REPO = "LeviBenzecry19/Presente_pesca";

// Não existe região na América do Sul; US East é a mais próxima do Brasil.
const REGIAO = "us-east4-eqdc4a";

export default defineRailway(() => {
  // As migrations foram geradas para MySQL (LONGTEXT, TINYINT, utf8mb4) e não
  // rodam em Postgres.
  const banco = mysql("MySQL", { region: REGIAO });

  // Sem volume, as fotos das capturas somem a cada deploy: o disco do
  // container é efêmero.
  const fotos = volume("fotos", { region: REGIAO });

  const api = service("api", {
    source: github(REPO, { branch: "main", rootDirectory: "backend", checkSuites: false }),
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "Dockerfile",
      watchPatterns: ["/backend/**"],
    },
    deploy: {
      // Só responde 200 quando o banco também responde.
      healthcheckPath: "/v1/health",
      healthcheckTimeout: 120,
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 5,
    },
    replicas: { [REGIAO]: 1 },
    volumeMounts: { "/data": fotos },
    env: {
      APP_ENV: "prod",
      // Valor fica só no Railway: railway variables --set "APP_SECRET=..." --service api
      APP_SECRET: preserve(),
      // Sem serverVersion o Doctrine abre uma conexão extra só para descobrir a
      // versão; sem charset os nomes com acento chegam quebrados.
      DATABASE_URL: "${{MySQL.MYSQL_URL}}?serverVersion=8.0&charset=utf8mb4",
      // Regex (origin_regex: true), não URL literal. Ancorado, senão
      // dominio-do-pwa.invasor.com também passaria.
      CORS_ALLOW_ORIGIN: "^https://presentepesca-production\\.up\\.railway\\.app$",
      PESCA_PHOTO_DIR: "/data/photos",
      PESCA_MAX_PHOTO_BYTES: "8388608",
    },
  });

  const pwa = service("Presente_pesca", {
    source: github(REPO, { branch: "main", checkSuites: false }),
    build: {
      builder: "RAILPACK",
      // npm run build dispara o prebuild, que gera public/sw.js.
      buildCommand: "npm run build",
      watchPatterns: ["/**", "!/backend/**", "!/docs/**"],
    },
    deploy: {
      // next start escuta o $PORT que o Railway injeta.
      startCommand: "npm run start",
      healthcheckPath: "/",
      healthcheckTimeout: 120,
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 5,
    },
    replicas: { [REGIAO]: 1 },
    networking: { privateNetworkEndpoint: "presentepesca" },
    env: {
      // NEXT_PUBLIC_* é embutido no bundle em tempo de build: mudou a URL da
      // API, o PWA precisa de um redeploy.
      NEXT_PUBLIC_SYNC_ENDPOINT: "https://${{api.RAILWAY_PUBLIC_DOMAIN}}",
      // Contato exigido pela política de uso do Nominatim. Valor fica só no
      // Railway porque vai parar no bundle público.
      NEXT_PUBLIC_APP_CONTACT: preserve(),
    },
  });

  return project("wonderful-adaptation", {
    resources: [banco, fotos, api, pwa],
  });
});
