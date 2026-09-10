# Imagem de produção do backend, usada pelo Railway.
#
# Apache + PHP no mesmo processo: a API é pequena e um container único é bem
# mais fácil de operar do que nginx + php-fpm conversando por socket.
FROM php:8.4-apache

# pdo_mysql para o Doctrine e opcache porque em produção o código não muda
# entre requisições. ctype, iconv e fileinfo (usado para checar o tipo real da
# foto) já vêm habilitados na imagem base.
#
# unzip não é luxo: a imagem base não traz nem o binário nem a extensão zip do
# PHP, e sem um dos dois o composer install falha ao extrair os pacotes dist.
RUN apt-get update \
 && apt-get install -y --no-install-recommends unzip \
 && rm -rf /var/lib/apt/lists/* \
 && docker-php-ext-install -j"$(nproc)" pdo_mysql opcache

# Composer sai da imagem oficial: nada de baixar instalador durante o build.
COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer

# Um único site, servido na porta que o Railway injetar. O ports.conf é escrito
# pelo entrypoint, quando $PORT finalmente existe.
#
# O apt-get acima reativa o mpm_event, que é o padrão do Debian, e o Apache não
# sobe com dois MPMs carregados: "More than one MPM loaded". O PHP como módulo
# do Apache exige o prefork. O rm é mais previsível que o a2dismod, que aborta
# a lista inteira quando um dos módulos não existe na imagem.
RUN rm -f /etc/apache2/mods-enabled/mpm_event.* /etc/apache2/mods-enabled/mpm_worker.* \
 && a2enmod mpm_prefork rewrite headers \
 && ls -1 /etc/apache2/mods-enabled/mpm_*.load \
 && test "$(ls -1 /etc/apache2/mods-enabled/mpm_*.load | wc -l)" -eq 1 \
 && rm -f /etc/apache2/sites-enabled/000-default.conf \
 && : > /etc/apache2/ports.conf
COPY docker/apache-symfony.conf /etc/apache2/sites-enabled/symfony.conf
COPY docker/php-prod.ini /usr/local/etc/php/conf.d/zz-pesca.ini

WORKDIR /var/www/app

ENV APP_ENV=prod \
    APP_DEBUG=0 \
    COMPOSER_ALLOW_SUPERUSER=1

# Dependências antes do código: a camada só é refeita quando o lock muda.
# --no-scripts porque os auto-scripts do Symfony rodariam cache:clear aqui,
# antes de existir DATABASE_URL; a limpeza acontece no boot.
COPY composer.json composer.lock symfony.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction

COPY . .

RUN composer dump-autoload --no-dev --classmap-authoritative \
 && mkdir -p var/cache var/log \
 && chown -R www-data:www-data var

COPY docker/entrypoint.sh /usr/local/bin/entrypoint
RUN chmod +x /usr/local/bin/entrypoint

ENTRYPOINT ["entrypoint"]
