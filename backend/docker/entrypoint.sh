#!/bin/sh
# Boot do container: porta, banco, migrations, cache e Apache — nessa ordem.
set -e

# O Railway injeta PORT. O padrão deixa o container rodar solto, para testar
# a imagem localmente sem precisar passar variável.
: "${PORT:=8080}"
printf 'Listen %s\n' "$PORT" > /etc/apache2/ports.conf

# O serviço de banco pode demorar a aceitar conexão depois de um deploy, então
# vale esperar em vez de entrar em loop de restart.
tentativas=0
until php bin/console dbal:run-sql 'SELECT 1' >/dev/null 2>&1; do
  tentativas=$((tentativas + 1))
  if [ "$tentativas" -ge 30 ]; then
    echo "Banco não respondeu em ~60s. Confira DATABASE_URL." >&2
    exit 1
  fi
  echo "Aguardando o banco… ($tentativas/30)"
  sleep 2
done

# --allow-no-migration para que reiniciar o container sem migration nova não
# derrube o deploy.
php bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration

php bin/console cache:clear --no-warmup
php bin/console cache:warmup

# Com PESCA_PHOTO_DIR apontando para um volume, o ponto de montagem nasce do
# root e o Apache (www-data) não consegue escrever. O default do .env usa
# %kernel.project_dir%, que não é caminho absoluto — daí o case.
case "${PESCA_PHOTO_DIR:-}" in
  /*)
    mkdir -p "$PESCA_PHOTO_DIR"
    chown -R www-data:www-data "$PESCA_PHOTO_DIR"
    ;;
  *)
    echo "Aviso: PESCA_PHOTO_DIR não é um caminho absoluto — as fotos vão para o" >&2
    echo "disco efêmero do container e somem no próximo deploy." >&2
    ;;
esac

chown -R www-data:www-data var

exec apache2-foreground
