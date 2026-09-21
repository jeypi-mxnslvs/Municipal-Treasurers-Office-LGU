#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_container="phase6-pilot-source-$$"
restore_container="phase6-pilot-restore-$$"
postgres_image="supabase/postgres:15.8.1.060"
pilot_password="phase6-disposable-only"
drill_tmp="$(mktemp -d)"

cleanup() {
  docker rm -f "$source_container" "$restore_container" >/dev/null 2>&1 || true
  rm -rf "$drill_tmp"
}
trap cleanup EXIT

wait_for_postgres() {
  local container="$1"
  local stable=0
  for _ in $(seq 1 60); do
    if docker exec "$container" pg_isready -U postgres -d postgres >/dev/null 2>&1; then
      stable=$((stable + 1))
      if [[ "$stable" -ge 10 ]]; then return 0; fi
    else
      stable=0
    fi
    sleep 1
  done
  echo "PostgreSQL did not become ready: $container" >&2
  return 1
}

start_database() {
  local container="$1"
  docker run -d --name "$container" \
    -e POSTGRES_PASSWORD="$pilot_password" \
    -e PGOPTIONS="-c client_min_messages=warning" \
    "$postgres_image" >/dev/null
  wait_for_postgres "$container"
  docker cp "$repo_dir/supabase/migrations" "$container:/tmp/migrations" >/dev/null
  docker exec -e PGPASSWORD="$pilot_password" "$container" psql -X -v ON_ERROR_STOP=1 -q -U postgres -d postgres -c \
    "CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY, last_sign_in_at timestamptz); CREATE TABLE IF NOT EXISTS auth.sessions (id uuid PRIMARY KEY, user_id uuid NOT NULL, created_at timestamptz NOT NULL); CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS \$\$ SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) \$\$;" >/dev/null
  docker exec -e PGPASSWORD="$pilot_password" "$container" \
    psql -X -v ON_ERROR_STOP=1 -q -U postgres -d postgres \
    -f "/tmp/migrations/20260911_initial_schema.sql" >/dev/null
  for migration in "$repo_dir"/supabase/migrations/*.sql; do
    if [[ "$(basename "$migration")" == "20260911_initial_schema.sql" ]]; then continue; fi
    docker exec -e PGPASSWORD="$pilot_password" "$container" \
      psql -X -v ON_ERROR_STOP=1 -q -U postgres -d postgres \
      -f "/tmp/migrations/$(basename "$migration")" >/dev/null
  done
}

property_fingerprint() {
  local container="$1"
  docker exec -e PGPASSWORD="$pilot_password" "$container" psql -X -Atq -U postgres -d postgres -c \
    "SELECT count(*) || ':' || md5(string_agg(td_number || '|' || owner_name || '|' || barangay || '|' || assessed_value::text, E'\\n' ORDER BY td_number)) FROM public.properties;"
}

echo "PHASE 6 PILOT BACKUP/RESTORE DRILL"
echo "Date (UTC): $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "Image: $postgres_image"
echo "Dataset SHA-256: $(sha256sum "$repo_dir/docs/evidence/phase6/pilot_masterlist.csv" | awk '{print $1}')"

start_database "$source_container"
docker cp "$repo_dir/docs/evidence/phase6/pilot_masterlist.csv" "$source_container:/tmp/pilot_masterlist.csv" >/dev/null
docker exec -i -e PGPASSWORD="$pilot_password" "$source_container" psql -X -v ON_ERROR_STOP=1 -q -U postgres -d postgres <<'SQL'
TRUNCATE TABLE public.properties RESTART IDENTITY CASCADE;
CREATE TEMP TABLE pilot_import (
  td_number text, previous_td_number text, pin text, owner_name text, address text,
  barangay text, property_class text, lot_area_sqm text, market_value text,
  assessed_value text, last_paid_year text, delinquency_start_year text, parcel_origin_year text
);
\copy pilot_import FROM '/tmp/pilot_masterlist.csv' WITH (FORMAT csv, HEADER true)
INSERT INTO public.properties (
  td_number, previous_td_number, pin, owner_name, address, barangay, property_class,
  lot_area_sqm, market_value, assessed_value, last_paid_year, last_paid_quarter,
  delinquency_start_year, parcel_origin_year, is_shell_record, encoder_label, entry_type
)
SELECT td_number, previous_td_number, pin, owner_name, address, barangay, property_class,
  lot_area_sqm::numeric, market_value::numeric, assessed_value::numeric,
  last_paid_year::int, 4, delinquency_start_year::int, parcel_origin_year::int,
  false, 'Phase 6 Pilot Assessor', 'CSV_IMPORT'
FROM pilot_import;
INSERT INTO auth.users (id, last_sign_in_at) VALUES
  ('11111111-1111-1111-1111-111111111111', now()),
  ('22222222-2222-2222-2222-222222222222', now()),
  ('33333333-3333-3333-3333-333333333333', now())
ON CONFLICT (id) DO UPDATE SET last_sign_in_at = EXCLUDED.last_sign_in_at;
INSERT INTO auth.sessions (id, user_id, created_at) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', now()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', now()),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', now())
ON CONFLICT (id) DO UPDATE SET created_at = EXCLUDED.created_at;
SQL

source_fingerprint="$(property_fingerprint "$source_container")"
test "${source_fingerprint%%:*}" = "33"
echo "Import: PASS ($source_fingerprint)"

jwt_claims='{"sub":"11111111-1111-1111-1111-111111111111","session_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","app_metadata":{"role":"Assessor"}}'
docker exec -e PGPASSWORD="$pilot_password" "$source_container" psql -X -v ON_ERROR_STOP=1 -q -U postgres -d postgres -c \
  "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true); SELECT set_config('request.jwt.claims', '$jwt_claims', true); SELECT public.batch_upsert_properties(jsonb_build_array(jsonb_build_object('td_number','17-23033-00033','previous_td_number','','pin','024-33-033-01-033','owner_name','Pilot Owner 33','address','Pilot Address 33','barangay','Zamora (Poblacion)','property_class','Dwell House','lot_area_sqm',133,'market_value',433000,'assessed_value',83300,'last_paid_year',2024,'last_paid_quarter',4,'delinquency_start_year',2025,'parcel_origin_year',2020,'is_shell_record',false,'encoder_label','Concurrent Pilot Assessor','entry_type','CSV_IMPORT'))); COMMIT;" >/dev/null &
import_pid=$!
docker exec -e PGPASSWORD="$pilot_password" "$source_container" psql -X -v ON_ERROR_STOP=1 -q -U postgres -d postgres -c \
  "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true); SELECT set_config('request.jwt.claims', '$jwt_claims', true); SELECT public.verify_delinquency_period(1,'17-23001-00001','2025',2025,'2025','VERIFIED_SETTLED_EXTERNALLY','EXTERNAL_SETTLEMENT_EVIDENCE','OFFICIAL-EXT-2025-0001','Concurrent Phase 6 pilot','PILOT-DESK','OFFICIAL_RECEIPT'); COMMIT;" >/dev/null &
verification_pid=$!
wait "$import_pid"
wait "$verification_pid"
test "$(property_fingerprint "$source_container")" != ""
echo "Concurrent import and assessor verification: PASS"

admin_can_purge="$(docker exec -e PGPASSWORD="$pilot_password" "$source_container" psql -X -Atq -U postgres -d postgres -c \
  "SET ROLE authenticated; SELECT has_function_privilege(current_user, 'public.purge_sample_masterlist(bigint[],text,text,text,text,text)', 'EXECUTE');")"
test "$admin_can_purge" = "f"
echo "Admin negative maintenance permission: PASS"

if docker exec -e PGPASSWORD="$pilot_password" "$source_container" psql -X -v ON_ERROR_STOP=1 -q -U postgres -d postgres -c \
  "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true); SELECT set_config('request.jwt.claims', '{\"sub\":\"22222222-2222-2222-2222-222222222222\",\"session_id\":\"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb\",\"app_metadata\":{\"role\":\"Assessor\"}}', true); SELECT public.archive_property(1,'Unauthorized pilot attempt','Pilot Assessor','Assessor'); COMMIT;" >/dev/null 2>&1; then
  echo "Assessor negative permission: FAIL" >&2
  exit 1
fi
echo "Assessor negative permission: PASS"

if docker exec -e PGPASSWORD="$pilot_password" "$source_container" psql -X -v ON_ERROR_STOP=1 -q -U postgres -d postgres -c \
  "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true); SELECT set_config('request.jwt.claims', '{\"sub\":\"33333333-3333-3333-3333-333333333333\",\"session_id\":\"cccccccc-cccc-cccc-cccc-cccccccccccc\",\"app_metadata\":{\"role\":\"SystemMaintenance\"}}', true); SELECT public.verify_delinquency_period(2,'17-23002-00002','2025',2025,'2025','VERIFIED_OUTSTANDING','DELINQUENCY','PILOT-ROLL','Unauthorized maintenance attempt','MIS-DESK','ASSESSMENT_ROLL_AUDIT'); COMMIT;" >/dev/null 2>&1; then
  echo "Maintenance negative permission: FAIL" >&2
  exit 1
fi
echo "Maintenance negative permission: PASS"

docker exec -e PGPASSWORD="$pilot_password" "$source_container" pg_dump -U postgres -d postgres \
  --format=custom --data-only --schema=public --file=/tmp/phase6-pilot.dump
docker cp "$source_container:/tmp/phase6-pilot.dump" "$drill_tmp/phase6-pilot.dump" >/dev/null
backup_hash="$(sha256sum "$drill_tmp/phase6-pilot.dump" | awk '{print $1}')"
echo "Backup SHA-256: $backup_hash"

start_database "$restore_container"
docker exec -i -e PGPASSWORD="$pilot_password" "$restore_container" psql -X -v ON_ERROR_STOP=1 -q -U postgres -d postgres <<'SQL'
DO $$
DECLARE item record;
BEGIN
  FOR item IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('TRUNCATE TABLE public.%I RESTART IDENTITY CASCADE', item.tablename);
    EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER USER', item.tablename);
  END LOOP;
END $$;
SQL
docker cp "$drill_tmp/phase6-pilot.dump" "$restore_container:/tmp/phase6-pilot.dump" >/dev/null
docker exec -e PGPASSWORD="$pilot_password" "$restore_container" pg_restore -U postgres -d postgres \
  --data-only --exit-on-error /tmp/phase6-pilot.dump
docker exec -e PGPASSWORD="$pilot_password" "$restore_container" psql -X -v ON_ERROR_STOP=1 -q -U postgres -d postgres -c \
  "DO \$\$ DECLARE item record; BEGIN FOR item IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER USER', item.tablename); END LOOP; END \$\$;"

restored_fingerprint="$(property_fingerprint "$restore_container")"
test "$restored_fingerprint" = "$(property_fingerprint "$source_container")"
if anon_count="$(docker exec -e PGPASSWORD="$pilot_password" "$restore_container" psql -X -Atq -U postgres -d postgres -c "SET ROLE anon; SELECT count(*) FROM public.properties;" 2>/dev/null)"; then
  test "$anon_count" = "0"
else
  anon_count="DENIED"
fi
echo "Restore: PASS ($restored_fingerprint)"
echo "Anonymous RLS read denial: PASS ($anon_count)"
echo "DRILL RESULT: PASS"
