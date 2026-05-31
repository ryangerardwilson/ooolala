# Ooolala Infra

The only active infrastructure path is the VM deploy in `infra/vm/`.

From the repo root:

```sh
scripts/prod/deploy-servers-and-upgrade-cli.sh
```

The VM path deploys:

- Docker Postgres
- Elixir backend release named `backend`
- React web static files
- nginx site and `/api` proxy
- Cloudflare DNS record
- hosted `install.sh`

Production domain:

```text
https://ooolala.ryangerardwilson.com
```

Local dev is handled by `scripts/dev/run-servers.sh`; it is not a hosted
Pulumi environment.
