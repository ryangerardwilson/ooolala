# New VM Runbook

This repo is the source of truth for Ooolala VM deployment. A replacement VM
should be brought under repo control before traffic moves to it.

## What The Repo Owns

- VM target environment contract in `infra/vm/environments/prod.sh`
- bootstrap/check script in `scripts/infra/bootstrap-vm.sh`
- production deploy script in `scripts/prod/deploy-servers-and-upgrade-cli.sh`
- Pulumi VM resources in `infra/vm/`

## What Stays Outside The Repo

- Pulumi access token
- Cloudflare API token
- VM host/IP
- deploy username
- VM SSH private key path and key material
- Cloudflare zone ID
- Pulumi Cloud state
- the raw VM/server purchase

These are stress boundaries, not app logic. The repo names exactly what is
needed, and the deploy scripts fail fast when a secret is missing.

## New VM Procedure

1. Create an Ubuntu/Debian VM with inbound `22`, `80`, and `443` open.
2. Add your local deploy public key to the VM deploy user's
   `~/.ssh/authorized_keys`. The private key should stay under `~/.ssh`, for
   example:

   ```sh
   ~/.ssh/keys/ooolala-prod.pub
   ```

3. Export the target values from your local shell. In this workspace, put them
   in `~/.bashrc.d/14-ooolala-prod.sh`:

   ```sh
   export OOOLALA_VM_HOST=<vm-ip>
   export OOOLALA_VM_USER=<deploy-user>
   export OOOLALA_VM_SSH_KEY="$HOME/.ssh/keys/ooolala-prod"
   export OOOLALA_VM_SERVER_NAME=<domain>
   export OOOLALA_VM_PUBLIC_URL="https://<domain>"
   export OOOLALA_CLOUDFLARE_ZONE_ID=<zone-id>
   export OOOLALA_DNS_RECORD_NAME=<domain>
   export OOOLALA_TLS_EMAIL=<email>
   ```

4. Bootstrap the VM from the repo:

   ```sh
   scripts/infra/bootstrap-vm.sh prod
   scripts/infra/bootstrap-vm.sh prod --check
   ```

5. Deploy. The script asks for confirmation before applying:

   ```sh
   scripts/prod/deploy-servers-and-upgrade-cli.sh
   ```

6. Verify the public endpoints:

   ```sh
   curl https://ooolala.ryangerardwilson.com/
   curl https://ooolala.ryangerardwilson.com/api/health
   curl 'https://ooolala.ryangerardwilson.com/api/version?format=text'
   ```

## Key Rotation

Generate or obtain a replacement SSH private key locally, install its public key
on the VM, then update `OOOLALA_VM_SSH_KEY` in your local shell config.

Confirm connectivity:

```sh
scripts/infra/bootstrap-vm.sh prod --check
```
