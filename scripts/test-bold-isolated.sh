#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Disposable database, localhost random port, fixed NON-PRODUCTION fixture password.
container="ppp-bold-test-${RANDOM}-$$"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
docker run -d --rm --name "$container" -e MARIADB_ROOT_PASSWORD=bold-isolated-test -e MARIADB_DATABASE=bold_isolated -p 127.0.0.1::3306 mariadb:10.11 >/dev/null
ready=false
for attempt in {1..60}; do
  if docker exec "$container" healthcheck.sh --connect --innodb_initialized >/dev/null 2>&1; then ready=true; break; fi
  sleep 1
done
if [ "$ready" != true ]; then echo 'Isolated MariaDB did not become ready'; exit 1; fi
docker exec -i "$container" mariadb -uroot -pbold-isolated-test bold_isolated < migrations/042_bold_receipts.sql
docker exec -i "$container" mariadb -uroot -pbold-isolated-test bold_isolated < migrations/043_bold_dynamic_qr.sql
docker exec "$container" mariadb -uroot -pbold-isolated-test bold_isolated -e 'CREATE TABLE ppp_orders (id INT PRIMARY KEY, orderType VARCHAR(20), orderStatus VARCHAR(30))'
BOLD_TEST_DB_PORT="$(docker port "$container" 3306 | sed 's/.*://')" npx jest --runInBand --testPathPattern=/src/bold/
