# Backup and restore

The live database and the product pictures are copied to the owner's laptop every night. Supabase's free plan has no backups of its own that we can download.

## What runs

- `scripts/backup.sh`, started by the systemd user timer `produgnad-backup.timer` at 23:30 every night (`Persistent=true`: if the laptop was off, it runs at the next start-up). On failure a desktop notification says "ProDugnad backup failed". Log: `journalctl --user -u produgnad-backup -n 50`. Run it by hand: `systemctl --user start produgnad-backup` (or `scripts/backup.sh`).
- The units are in `~/.config/systemd/user/` (`produgnad-backup.service`, `.timer`, `produgnad-backup-failed.service`); they are not in this repo.
- It writes `~/Backups/produgnad/<date>/`:
  - `schema.sql.gz`: the tables, functions and rules (the same as `supabase/migrations`, as a check)
  - `data.sql.gz`: every row of the app's tables (`public`)
  - `auth.sql.gz`: who can log in (`auth.users` and `auth.identities` only; sessions, tokens, codes and logs are left out on purpose)
- and `~/Backups/produgnad/pictures/<campaign>/<product>/…`: every product picture and thumbnail (only new ones are downloaded).
- 30 days of database copies are kept; pictures stay.
- The laptop's own nightly backup (restic, just after midnight) copies `~/Backups` to the home server, so there are two copies.
- The files hold parents' names, email addresses and phone numbers: they are readable by the laptop user only (`umask 077`). Never put them in the repo.
- The script checks the dumps look complete (the orders table and the users are there) before keeping them.

## Restore

Tested on 22 November 2026 into the local Docker database: every table came back with the same rows and the totals matched the live page.

1. A Supabase project with the app's tables: the existing one, or a new one (`npx supabase link --project-ref <new ref>`, then `npx supabase db push --remote --yes` to create the tables from `supabase/migrations`). The new project needs the same settings as the old: Auth email, the Edge Functions and their secrets (see `CLAUDE.md`).
2. Empty the tables you're restoring (a new project already is).
3. Load the logins first, then the data, with triggers and checks paused (the dump is data only):
   ```bash
   B=~/Backups/produgnad/2026-11-22          # the copy to restore
   DB='postgresql://postgres.<ref>:<password>@<host>:5432/postgres'   # Supabase: Connect → Session pooler
   ( echo 'SET session_replication_role = replica;'; zcat $B/auth.sql.gz ) | psql "$DB" -v ON_ERROR_STOP=1
   ( echo 'SET session_replication_role = replica;'; zcat $B/data.sql.gz ) | psql "$DB" -v ON_ERROR_STOP=1
   ```
4. Put the pictures back in the `product-images` bucket with the same paths, for example `npx supabase storage cp -r ~/Backups/produgnad/pictures ss:///product-images --experimental` (or upload them in the Supabase dashboard).
5. Check: log in as an admin, open the dugnad, compare the Oversikt numbers with the last ones you remember.

To look at a copy without restoring it: `zcat ~/Backups/produgnad/<date>/data.sql.gz | less`.
