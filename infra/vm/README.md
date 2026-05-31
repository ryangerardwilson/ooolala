# Existing VM Deployment

This Pulumi project deploys Ooolala to an already-running SSH-accessible VM.
It does not create the server. It writes one isolated stack directory under
`/opt/ooolala/<stack>`, runs Postgres and the Elixir backend through Docker
Compose, creates the Cloudflare DNS record when configured, and configures
nginx to serve the static web app plus `/api`.

The public repo owns deploy mechanics, not live access:

- `infra/vm/environments/prod.sh` owns the required environment-variable
  contract.
- `scripts/infra/bootstrap-vm.sh` prepares or checks a fresh VM.
- `scripts/prod/deploy-servers-and-upgrade-cli.sh` builds and applies the
  Pulumi stack through `scripts/infra/deploy-vm.sh`.
- VM SSH private keys stay under `~/.ssh` and are referenced through
  `OOOLALA_VM_SSH_KEY`.

Live hostnames, VM IPs, deploy usernames, DNS zone IDs, API tokens, Pulumi
tokens, and private keys must stay outside the repo.

## Production Environment

Export the target values in your shell before using the production wrappers.
For this workspace, they live in `~/.bashrc.d/14-ooolala-prod.sh`.

Required:

```sh
export OOOLALA_VM_HOST=<vm-ip>
export OOOLALA_VM_USER=<deploy-user>
export OOOLALA_VM_SSH_KEY="$HOME/.ssh/keys/ooolala-prod"
export OOOLALA_VM_SERVER_NAME=<domain>
export OOOLALA_VM_PUBLIC_URL="https://<domain>"
export OOOLALA_CLOUDFLARE_ZONE_ID=<zone-id>
export OOOLALA_TLS_EMAIL=<email>
export CLOUDFLARE_API_TOKEN=<cloudflare-token>
export PULUMI_ACCESS_TOKEN=<pulumi-token>
```

Optional knobs have safe defaults in:

```text
infra/vm/environments/prod.sh
```

## Environment Commands

From the repo root:

```sh
scripts/prod/deploy-servers-and-upgrade-cli.sh
```

After a successful production deploy, the wrapper runs the freshly deployed
hosted installer so the local production CLI follows the live install endpoint.

For a new VM, follow `infra/vm/NEW_VM_RUNBOOK.md`:

```sh
scripts/infra/bootstrap-vm.sh prod
scripts/infra/bootstrap-vm.sh prod --check
scripts/prod/deploy-servers-and-upgrade-cli.sh
```

## Stack Setup

For normal use, prefer the environment commands above. Manual stack setup is
only needed when debugging Pulumi directly:

```sh
cd infra/vm
pulumi stack init prod
pulumi config set host "$OOOLALA_VM_HOST"
pulumi config set user "$OOOLALA_VM_USER"
pulumi config set sshPrivateKeyPath "$OOOLALA_VM_SSH_KEY"
pulumi config set runtimeEnvironment prod
pulumi config set serverName "$OOOLALA_VM_SERVER_NAME"
pulumi config set defaultServer false
pulumi config set publicUrl "$OOOLALA_VM_PUBLIC_URL"
pulumi config set backendPort 4100
pulumi config set remoteRoot /opt/ooolala
pulumi config set manageDns true
pulumi config set cloudflareZoneId "$OOOLALA_CLOUDFLARE_ZONE_ID"
pulumi config set dnsRecordName "$OOOLALA_DNS_RECORD_NAME"
pulumi config set dnsProxied false
pulumi config set dnsTtl 300
pulumi config set tlsEnabled true
pulumi config set tlsEmail "$OOOLALA_TLS_EMAIL"
pulumi config set maxAttachments 5
pulumi config set maxAttachmentBytes 5242880
pulumi config set maxAttachmentsTotalBytes 15728640
pulumi config set --secret postgresPassword "$(openssl rand -hex 24)"
pulumi config set --secret secretKeyBase "$(openssl rand -base64 48)"
```

The low-level wrapper remains available when a one-off stack name is needed:

```sh
scripts/infra/deploy-vm.sh prod
```

The wrapper sources `~/.bashrc.d/10-secrets.sh`, builds the static web app with
`VITE_OOOLALA_API_URL=/api`, creates a small deployment bundle, updates
stack config, and runs `pulumi up`.

The hosted `install.sh` emitted by the VM bundle installs production as
`ooolala`. The wrapper carries its default API URL, web URL, install URL,
environment, welcome user, and local state root. The web landing page receives
the public install command, CLI app name, and welcome user from the VM bundle.

The nginx site keeps the SPA shell fresh by serving `/` and `/index.html` with
`Cache-Control: no-store, no-cache, must-revalidate`. Hashed files under
`/assets/` are served as immutable one-year assets, so deploys can keep static
asset caching without leaving users on stale landing-page code.
The VM bundle build also injects the current commit as `VITE_OOOLALA_BUILD_ID`;
the web app writes that build id onto the document element so each shipped
commit changes the Vite asset hash even when the visible React code is stable.

Bob is reserved as the production welcome account during migration. Set
`OOOLALA_WELCOME_PASSWORD` in the deploy environment to store a real password
as a Pulumi secret; otherwise Bob is created as a known recipient with an
unknown generated password.
Message attachments are persisted in Postgres and included in normal database
backups. The default caps are intentionally small for the single-VM prototype:
5 files, 5 MiB each, and 15 MiB total per message.

## Runtime Shape

Remote files:

```text
/opt/ooolala/<stack>/
  .env
  bundle-<sha>.tar.gz
  compose.yaml
  nginx.conf
  source/
  web/
```

Remote services:

- Docker Compose project: `ooolala-<stack>`
- backend: `127.0.0.1:<backend-port>`
- web: nginx on the configured public URL
- API: nginx proxy at `<public-url>/api`
- DNS: optional Cloudflare A record to the configured VM host

## Verification

```sh
curl "$OOOLALA_VM_PUBLIC_URL/"
curl "$OOOLALA_VM_PUBLIC_URL/api/health"
curl "$OOOLALA_VM_PUBLIC_URL/api/version?format=text"
npm --workspace apps/frontend/terminal run build
node apps/frontend/terminal/dist/index.js version
```

`pulumi destroy` removes the stack directory, nginx site, backend container, and
Postgres volume for that VM stack. It also deletes the Cloudflare DNS record.
