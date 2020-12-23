#!/bin/bash

# We need to install dependencies only for Docker
[[ ! -e /.dockerenv ]] && exit 0

set -xe

# Install git (the php image doesn't have it) which is required by composer
apt-get update -yqq
apt-get install -yqq git libmcrypt-dev libpq-dev libcurl4-gnutls-dev libicu-dev libvpx-dev libjpeg-dev libpng-dev libxpm-dev zlib1g-dev libfreetype6-dev libxml2-dev libexpat1-dev libbz2-dev libgmp3-dev libldap2-dev unixodbc-dev libsqlite3-dev libaspell-dev libsnmp-dev libpcre3-dev libtidy-dev
  # Install PHP extensions
docker-php-ext-install curl json intl gd xml zip bz2 opcache
  # Install & enable Xdebug for code coverage reports
pecl install xdebug
docker-php-ext-enable xdebug
  # Install and run Composer
curl -sS https://getcomposer.org/installer | php
php composer.phar install

# Install phpunit, the tool that we will use for testing
curl --location --output /usr/local/bin/phpunit "https://phar.phpunit.de/phpunit.phar"
chmod +x /usr/local/bin/phpunit

# Install mysql driver
# Here you can install any other extension that you need
# docker-php-ext-install pdo_mysql