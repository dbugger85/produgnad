#!/usr/bin/env bash
# Nightly backup of the LIVE ProDugnad database and product pictures to this computer.
#   scripts/backup.sh            (run by the systemd user timer produgnad-backup.timer, 23:30)
# Writes ~/Backups/produgnad/<date>/{schema,data,auth}.sql.gz; pictures go to ~/Backups/produgnad/pictures/
# (only new ones are downloaded). Keeps 30 days of database copies. The laptop's own nightly restic
# backup then copies ~/Backups to the home server. Restore steps: docs/backup.md
set -euo pipefail

PROJECT_URL="https://nnqpdzqzwzhogcbzriyn.supabase.co"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${PRODUGNAD_BACKUP_DIR:-$HOME/Backups/produgnad}"
KEEP_DAYS=30
DAY="$(date +%F)"
OUT="$DEST/$DAY"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
umask 077 # parents' names, emails and phone numbers: readable by this user only

mkdir -p "$OUT" "$DEST/pictures"
cd "$REPO"

npx supabase db dump --remote -f "$TMP/schema.sql"
npx supabase db dump --remote --data-only --use-copy --schema public -f "$TMP/data.sql"

# Logins: only auth.users and auth.identities (who can log in, by email). Sessions, tokens, codes and
# logs aren't needed to restore anything and shouldn't lie around. pg_dump can only leave tables out,
# so list the auth tables first and leave out all the others (new ones Supabase adds included).
npx supabase db dump --remote --data-only --use-copy --schema auth -f "$TMP/auth-all.sql"
SKIP=$(grep -o '^COPY "auth"\."[a-z_]*"' "$TMP/auth-all.sql" | sed 's/^COPY "auth"\."\(.*\)"/auth.\1/' |
  grep -vx -e auth.users -e auth.identities | paste -sd, -)
npx supabase db dump --remote --data-only --use-copy --schema auth -x "$SKIP" -f "$TMP/auth.sql"
rm "$TMP/auth-all.sql"

# A dump that stops early would still be a file: check both look complete before keeping them
grep -q 'CREATE TABLE IF NOT EXISTS "public"."orders"' "$TMP/schema.sql" || { echo "schema dump looks incomplete" >&2; exit 1; }
grep -q '^COPY "public"."orders"' "$TMP/data.sql" || { echo "data dump looks incomplete" >&2; exit 1; }
grep -q '^COPY "auth"."users"' "$TMP/auth.sql" || { echo "auth dump looks incomplete" >&2; exit 1; }
gzip -9 -c "$TMP/schema.sql" > "$OUT/schema.sql.gz"
gzip -9 -c "$TMP/data.sql" > "$OUT/data.sql.gz"
gzip -9 -c "$TMP/auth.sql" > "$OUT/auth.sql.gz"

# Product pictures (public bucket): the paths are in the product_images rows of the data dump
awk '/^COPY "public"."product_images"/{on=1; next} on && /^\\\.$/{on=0} on' "$TMP/data.sql" |
  awk -F'\t' '{print $3; print $4}' |
  while read -r path; do
    [ -n "$path" ] || continue
    file="$DEST/pictures/$path"
    [ -s "$file" ] && continue
    mkdir -p "$(dirname "$file")"
    curl -fsS --retry 3 -o "$file.part" "$PROJECT_URL/storage/v1/object/public/product-images/$path" && mv "$file.part" "$file"
  done

# Older database copies go (pictures stay: they're small and only added once)
find "$DEST" -mindepth 1 -maxdepth 1 -type d -name '20??-??-??' -mtime +"$KEEP_DAYS" -exec rm -rf {} +

orders=$(awk '/^COPY "public"."orders"/{on=1; next} on && /^\\\.$/{on=0} on' "$TMP/data.sql" | wc -l)
pictures=$(find "$DEST/pictures" -type f | wc -l)
echo "ProDugnad backup $DAY: $orders orders, $pictures picture files, $(du -sh "$OUT" | cut -f1) in $OUT"
