#!/usr/bin/env bash
set -euo pipefail
[[ "${GITHUB_ACTIONS:-}" == true ]] || { echo 'Only disposable GitHub Actions fixtures are supported'; exit 1; }
[[ "${1:-}" =~ ^[a-f0-9]{40}$ ]] || { echo 'An exact candidate SHA is required'; exit 1; }
image="ppp-nest-staging:$1"
fixture_dir="$(mktemp -d)"
cleanup() {
  docker logs ppp-smoke-api > tmp/ppp-runtime-smoke.log 2>&1 || true
  docker rm -f ppp-smoke-api ppp-smoke-db ppp-smoke-reject >/dev/null 2>&1 || true
  docker network rm ppp-smoke-net >/dev/null 2>&1 || true
  rm -rf "$fixture_dir"
}
mkdir -p tmp
trap cleanup EXIT

# Generated certificates and credentials belong only to this disposable CI network.
openssl req -x509 -newkey rsa:2048 -nodes -keyout "$fixture_dir/ca.key" -out "$fixture_dir/ca.crt" -days 1 -subj /CN=PPP-CI-CA >/dev/null 2>&1
openssl req -newkey rsa:2048 -nodes -keyout "$fixture_dir/server.key" -out "$fixture_dir/server.csr" -subj /CN=ppp-smoke-db >/dev/null 2>&1
echo 'subjectAltName=DNS:ppp-smoke-db' > "$fixture_dir/server.ext"
openssl x509 -req -in "$fixture_dir/server.csr" -CA "$fixture_dir/ca.crt" -CAkey "$fixture_dir/ca.key" -CAcreateserial -out "$fixture_dir/server.crt" -days 1 -extfile "$fixture_dir/server.ext" >/dev/null 2>&1
chmod 755 "$fixture_dir"
chmod 644 "$fixture_dir/server.key" "$fixture_dir/server.crt" "$fixture_dir/ca.crt"
docker pull mariadb:11.8 >/dev/null
docker network create --internal ppp-smoke-net >/dev/null
docker run -d --name ppp-smoke-db --network ppp-smoke-net \
  -e MARIADB_ROOT_PASSWORD=ci-only-root -e MARIADB_DATABASE=ppp_runtime_smoke \
  -e MARIADB_USER=ppp_smoke -e MARIADB_PASSWORD=ci-only-password \
  -v "$fixture_dir:/certs:ro" mariadb:11.8 \
  --ssl-ca=/certs/ca.crt --ssl-cert=/certs/server.crt --ssl-key=/certs/server.key \
  --require-secure-transport=ON >/dev/null
for attempt in {1..60}; do
  if docker exec ppp-smoke-db mariadb -uroot -pci-only-root --batch --skip-column-names \
    -e "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='ppp_runtime_smoke'" 2>/dev/null | grep -Fxq ppp_runtime_smoke; then break; fi
  [[ "$attempt" != 60 ]] || { echo 'Disposable DB did not start'; exit 1; }
  sleep 1
done

common=(--network ppp-smoke-net \
  -v "$PWD/scripts/ppp-runtime-smoke.cjs:/app/runtime-smoke.cjs:ro" \
  -e PPP_STAGING=true -e DB_HOST=ppp-smoke-db -e DB_PORT=3306 \
  -e DB_USERNAME=ppp_smoke -e DB_PASSWORD=ci-only-password -e DB_DATABASE=ppp_runtime_smoke \
  -e DB_SSL_ENABLED=true -e "DB_SSL_CA=$(cat "$fixture_dir/ca.crt")" \
  -e STAGING_EXPECTED_DB_HOST=ppp-smoke-db -e STAGING_EXPECTED_DB_DATABASE=ppp_runtime_smoke \
  -e JWT_SECRET=ci-only-runtime-jwt -e GOOGLE_CLIENT_ID=ci-only-google-id \
  -e GOOGLE_CLIENT_SECRET=ci-only-google-secret -e RUN_MIGRATIONS=false \
  -e WHATSAPP_ENABLED=false -e WHATSAPP_AGENT_V1=false \
  -e WHATSAPP_STAGING_OUTBOUND_ALLOW=false -e WHATSAPP_APP_SECRET=ci-only-meta-secret)
docker run --rm "${common[@]}" "$image" node runtime-smoke.cjs seed
docker run --rm "${common[@]}" -e DB_SSL_CA= "$image" node runtime-smoke.cjs untrusted-tls

reject_startup() {
  docker run -d --name ppp-smoke-reject "${common[@]}" "$@" "$image" >/dev/null
  exit_code="$(timeout 45s docker wait ppp-smoke-reject)"
  [[ "$exit_code" != 0 ]] || { echo 'Invalid staging configuration was accepted'; exit 1; }
  docker logs ppp-smoke-reject > "$fixture_dir/rejected-startup.log" 2>&1
  grep -Fq 'Staging requires matching STAGING_EXPECTED_DB_HOST/DATABASE and verified DB TLS' "$fixture_dir/rejected-startup.log"
  docker rm ppp-smoke-reject >/dev/null
  echo 'PASS invalid staging startup rejected'
}
reject_startup -e STAGING_EXPECTED_DB_DATABASE=wrong-database
reject_startup -e DB_SSL_ENABLED=false

docker run -d --name ppp-smoke-api "${common[@]}" "$image" >/dev/null
docker exec ppp-smoke-api node runtime-smoke.cjs healthy
docker exec ppp-smoke-api node runtime-smoke.cjs http-guards
if docker logs ppp-smoke-api 2>&1 | grep -E 'Failed to ensure|Migrations failed'; then
  echo 'Runtime bootstrap schema checks failed'; exit 1
fi
started="$(docker inspect -f '{{.State.StartedAt}}' ppp-smoke-api)"
docker stop ppp-smoke-db >/dev/null
docker exec ppp-smoke-api node runtime-smoke.cjs degraded
docker start ppp-smoke-db >/dev/null
docker exec ppp-smoke-api node runtime-smoke.cjs healthy
[[ "$(docker inspect -f '{{.State.StartedAt}}' ppp-smoke-api)" == "$started" ]] || { echo 'API restarted during DB recovery'; exit 1; }
echo 'PASS DB recovery without API restart'
docker restart --timeout 15 ppp-smoke-api >/dev/null
docker exec ppp-smoke-api node runtime-smoke.cjs healthy
echo 'PASS candidate runtime restart'
