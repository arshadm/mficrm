# Deploying with Kamal

AcquireDesk deploys with [Kamal 2](https://kamal-deploy.org), the same way as stepwise and the spinorml website. The files involved:

- `config/deploy.yml`: server, domain, plain settings and the data volume
- `.kamal/secrets`: reads secrets from Bitwarden (safe to commit; it holds no values)
- `Dockerfile`: the image build
- `bin/docker-entrypoint`: how the container starts
- `bin/kamal-pem`: rebuilds the Cloudflare origin certificate and key from Bitwarden fields

**What runs on the server** (one host, behind kamal-proxy, with Cloudflare in front and HTTPS on both legs):

| Container | What it is |
| --- | --- |
| `mficrm-web` | The Nuxt app on port 3000. On boot it runs migrations, seeds the admin user and starts the 08:00 reminder cron. |

**Data:** the SQLite database (`/data/db/crm.db`) and uploaded files (`/data/uploads`) live on the named Docker volume `mficrm_data`, mounted at `/data`. It survives deploys and rollbacks. Run exactly **one** container: SQLite allows a single writer, and a second container would also send every reminder email twice.

## One-time set-up

1. **Tools on your machine:**
   - Kamal 2: `gem install kamal`
   - Docker Desktop
   - the Bitwarden CLI: `bw`, signed in as `arshadm@artemissoft.com`
   - `KAMAL_REGISTRY_PASSWORD` exported in your shell, set to a Docker Hub access token for `artemissoft1`
2. **Settle the TODOs in `config/deploy.yml`:**
   - **Host:** it uses the spinorml/stepwise host, `46.62.237.88`, which already runs kamal-proxy. The server needs a `kamal` user that can SSH in with your key and is in the `docker` group.
   - **Domain:** `proxy.hosts` and `APP_URL`.
   - **SMTP:** `SMTP_HOST`, `SMTP_PORT` and `SMTP_FROM`.
3. **Cloudflare and HTTPS** (Full (strict)), as for stepwise (see its `docs/runbooks/deploy.md` for the detailed steps):
   - **DNS:** an A record for the domain pointing at the server, proxied (orange cloud).
   - **Origin certificate:** create one in _SSL/TLS → Origin Server_ for the domain. Store the certificate and key in the `mficrm-prod` Bitwarden item, in the fields `ORIGIN_CERTIFICATE_B64` and `ORIGIN_PRIVATE_KEY_B64`. Base64-encoding them first is the most reliable:
     ```bash
     base64 < origin.pem | tr -d '\n' | pbcopy   # ORIGIN_CERTIFICATE_B64
     base64 < origin.key | tr -d '\n' | pbcopy   # ORIGIN_PRIVATE_KEY_B64
     ```
     If the host already has a wildcard origin certificate covering this domain, reuse it.
   - **SSL/TLS mode:** _Full (strict)_. The host firewall should already allow ports 80 and 443 only from Cloudflare.
4. **Secrets:** create a Bitwarden item `mficrm-prod` with these fields:
   - `NUXT_SESSION_PASSWORD`: `openssl rand -hex 32`. Changing it logs everyone out.
   - `ADMIN_PASSWORD`: a strong password. It is only used to create the admin user on the first boot; change it in the app afterwards.
   - `SMTP_USER`, `SMTP_PASS`: the SMTP login for reminder emails.
   - `ORIGIN_CERTIFICATE_B64`, `ORIGIN_PRIVATE_KEY_B64`: from step 3.

   Check they resolve with `kamal secrets print`.
5. **First deploy:** run `kamal setup`. It installs Docker if needed, creates the `mficrm_data` volume, builds and pushes the image, and starts the app behind the shared kamal-proxy.
6. Check `https://<domain>/api/health` returns `{"status":"ok"}`, then log in as `admin`. The first boot also seeds three sample businesses; delete them in the app.

## Every release

```bash
kamal deploy
```

Each release is built from the current git commit. Kamal starts the new container, waits for `/api/health`, switches traffic and stops the old one. If the health check fails, the old container keeps serving. Both containers mount the same volume during the switch-over, which is fine for SQLite in WAL mode for those few seconds.

Migrations (`server/db/migrate.ts`) run on every boot. Keep them backwards compatible with the release still running, for example by adding a column before using it, because `kamal rollback` does not undo them.

## Day to day

| Command | What it does |
| --- | --- |
| `kamal logs` | Follow the app logs |
| `kamal shell` | A shell in the running container |
| `kamal sqlite` | A sqlite3 session on the production database |
| `kamal rollback <version>` | Go back to an earlier image (`kamal app versions` lists them) |
| `kamal app boot` | Restart the app, e.g. after changing a secret |

**Locked out?** After 5 failed logins for a username, or 20 from one IP, logins are refused for 15 minutes. The counters live in memory, so `kamal app boot` clears them immediately. They're keyed on Cloudflare's `cf-connecting-ip` header (`TRUSTED_IP_HEADER`), which is only trustworthy while the firewall admits nothing but Cloudflare on ports 80 and 443.

A changed secret or setting only reaches the container on the next `kamal deploy`, or after `kamal env push` followed by `kamal app boot`.

## Backups

There is no automatic backup yet. To take one by hand (`.backup` is safe while the app is running):

```bash
kamal app exec --reuse "sqlite3 /data/db/crm.db '.backup /data/backup.db'"
ssh kamal@46.62.237.88 'docker run --rm -v mficrm_data:/data -v $PWD:/out alpine sh -c "cp /data/backup.db /out/ && tar czf /out/uploads.tgz -C /data uploads"'
```
