import * as command from '@pulumi/command';
import * as cloudflare from '@pulumi/cloudflare';
import * as pulumi from '@pulumi/pulumi';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const config = new pulumi.Config();
const stack = pulumi.getStack();

const host = config.require('host');
const user = config.require('user');
const sshPort = config.getNumber('sshPort') ?? 22;
const sshPrivateKeyPath = expandHome(config.require('sshPrivateKeyPath'));
const privateKey = pulumi.secret(fs.readFileSync(sshPrivateKeyPath, 'utf8'));

const bundlePath = path.resolve(config.require('bundlePath'));
const bundleSha = sha256File(bundlePath);
const commit = config.get('commit') ?? bundleSha.slice(0, 12);
const imageTag = bundleSha.slice(0, 12);

const remoteRoot = config.get('remoteRoot') ?? '/opt/ooolala';
const deployDir = `${remoteRoot}/${stack}`;
const appName = `ooolala-${stack}`;
const runtimeEnvironment = config.get('runtimeEnvironment') ?? stack;
const backendPort = config.getNumber('backendPort') ?? 4100;
const serverName = config.get('serverName') ?? '_';
const defaultServer = config.getBoolean('defaultServer') ?? serverName === '_';
const tlsEnabled = config.getBoolean('tlsEnabled') ?? false;
const tlsEmail = config.get('tlsEmail');
const publicUrl =
  config.get('publicUrl') ?? (serverName === '_' ? `http://${host}` : `http://${serverName}`);
const apiUrl = `${publicUrl.replace(/\/+$/, '')}/api`;
const cloudflareZoneId = config.get('cloudflareZoneId');
const dnsRecordName = config.get('dnsRecordName') ?? (serverName === '_' ? undefined : serverName);
const manageDns = config.getBoolean('manageDns') ?? Boolean(cloudflareZoneId && dnsRecordName);
const dnsProxied = config.getBoolean('dnsProxied') ?? false;
const dnsTtl = config.getNumber('dnsTtl') ?? 300;
const backupDir = `${remoteRoot}/backups/${stack}`;
const runtimeControls = {
  openSignup: configFlag('openSignup', true),
  maxUsers: config.getNumber('maxUsers') ?? 75,
  signupDailyLimit: config.getNumber('signupDailyLimit') ?? 10,
  signupHourlyLimit: config.getNumber('signupHourlyLimit') ?? 3,
  messageRateLimitCount: config.getNumber('messageRateLimitCount') ?? 30,
  messageRateLimitWindowSeconds: config.getNumber('messageRateLimitWindowSeconds') ?? 60,
  maxMessageBytes: config.getNumber('maxMessageBytes') ?? 2048,
  maxAttachments: config.getNumber('maxAttachments') ?? 5,
  maxAttachmentBytes: config.getNumber('maxAttachmentBytes') ?? 5 * 1_024 * 1_024,
  maxAttachmentsTotalBytes: config.getNumber('maxAttachmentsTotalBytes') ?? 15 * 1_024 * 1_024
};

if (tlsEnabled && (serverName === '_' || !tlsEmail)) {
  throw new Error('tlsEnabled requires a concrete serverName and tlsEmail');
}

if (manageDns && (!cloudflareZoneId || !dnsRecordName)) {
  throw new Error('manageDns requires cloudflareZoneId and dnsRecordName');
}

const postgresPassword = config.requireSecret('postgresPassword');
const secretKeyBase = config.requireSecret('secretKeyBase');
const welcomePassword = config.getSecret('welcomePassword');

const connection: command.types.input.remote.ConnectionArgs = {
  host,
  user,
  port: sshPort,
  privateKey
};

const remoteBundlePath = `${deployDir}/bundle-${bundleSha}.tar.gz`;
const composeYaml = composeFile(appName, runtimeEnvironment, imageTag, backendPort, runtimeControls, Boolean(welcomePassword));
const nginxBootstrapConf = nginxSite(serverName, deployDir, backendPort, defaultServer, false);
const nginxConf = nginxSite(serverName, deployDir, backendPort, defaultServer, tlsEnabled);

const dnsRecord = manageDns
  ? new cloudflare.DnsRecord('app-dns-record', {
      zoneId: cloudflareZoneId!,
      name: dnsRecordName!,
      type: 'A',
      content: host,
      ttl: dnsTtl,
      proxied: dnsProxied,
      comment: `Ooolala ${stack} VM`
    })
  : undefined;

const bootstrap = new command.remote.Command('bootstrap-vm', {
  connection,
  addPreviousOutputInEnv: false,
  create: [
    'set -euo pipefail',
    `sudo install -d -m 0755 -o ${shell(user)} -g ${shell(user)} ${shell(deployDir)}`,
    'command -v docker >/dev/null',
    'docker compose version >/dev/null',
    'command -v nginx >/dev/null',
    'command -v curl >/dev/null'
  ].join('\n')
});

const bundle = new command.remote.CopyToRemote(
  'copy-bundle',
  {
    connection,
    source: new pulumi.asset.FileAsset(bundlePath),
    remotePath: remoteBundlePath
  },
  {dependsOn: bootstrap}
);

const compose = new command.remote.CopyToRemote(
  'copy-compose',
  {
    connection,
    source: new pulumi.asset.StringAsset(composeYaml),
    remotePath: `${deployDir}/compose.yaml`
  },
  {dependsOn: bootstrap}
);

const nginx = new command.remote.CopyToRemote(
  'copy-nginx',
  {
    connection,
    source: new pulumi.asset.StringAsset(nginxConf),
    remotePath: `${deployDir}/nginx.conf`
  },
  {dependsOn: bootstrap}
);

const nginxBootstrap = new command.remote.CopyToRemote(
  'copy-nginx-bootstrap',
  {
    connection,
    source: new pulumi.asset.StringAsset(nginxBootstrapConf),
    remotePath: `${deployDir}/nginx.bootstrap.conf`
  },
  {dependsOn: bootstrap}
);

const env = new command.remote.Command(
  'write-env',
  {
    connection,
    addPreviousOutputInEnv: false,
    create: writeEnvCommand(deployDir, runtimeEnvironment, commit, postgresPassword, secretKeyBase, welcomePassword),
    update: writeEnvCommand(deployDir, runtimeEnvironment, commit, postgresPassword, secretKeyBase, welcomePassword),
    triggers: [commit]
  },
  {dependsOn: bootstrap}
);

const deploy = new command.remote.Command(
  'deploy',
  {
    connection,
    addPreviousOutputInEnv: false,
    create: deployCommand(deployDir, backupDir, user, remoteBundlePath, appName, imageTag, backendPort, {
      tlsEnabled,
      tlsEmail,
      serverName
    }),
    update: deployCommand(deployDir, backupDir, user, remoteBundlePath, appName, imageTag, backendPort, {
      tlsEnabled,
      tlsEmail,
      serverName
    }),
    triggers: [bundleSha, sha256(composeYaml), sha256(nginxConf), sha256(nginxBootstrapConf), commit]
  },
  {dependsOn: dnsRecord ? [bundle, compose, nginx, nginxBootstrap, env, dnsRecord] : [bundle, compose, nginx, nginxBootstrap, env]}
);

const cleanup = new command.remote.Command(
  'cleanup-on-destroy',
  {
    connection,
    addPreviousOutputInEnv: false,
    create: 'true',
    delete: deleteCommand(deployDir, appName)
  },
  {dependsOn: deploy}
);

export const vmHost = host;
export const remotePath = deployDir;
export const runtimeEnv = runtimeEnvironment;
export const webUrl = publicUrl;
export const apiBaseUrl = apiUrl;
export const backendHealthUrl = `http://127.0.0.1:${backendPort}/health`;
export const dnsName = dnsRecord ? dnsRecord.name : dnsRecordName;
export const dnsTarget = dnsRecord ? dnsRecord.content : undefined;
export const bundleDigest = bundleSha;
export const deploymentEvidence = deploy.stdout;
export const destroyCleanup = cleanup.stdout;

type RuntimeControls = {
  openSignup: boolean;
  maxUsers: number;
  signupDailyLimit: number;
  signupHourlyLimit: number;
  messageRateLimitCount: number;
  messageRateLimitWindowSeconds: number;
  maxMessageBytes: number;
  maxAttachments: number;
  maxAttachmentBytes: number;
  maxAttachmentsTotalBytes: number;
};

function composeFile(name: string, envName: string, imageTag: string, port: number, controls: RuntimeControls, hasWelcomePassword: boolean) {
  const welcomePasswordEnv = hasWelcomePassword ? '      OOOLALA_WELCOME_PASSWORD: ${OOOLALA_WELCOME_PASSWORD}\n' : '';

  return `name: ${name}

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ooolala
      POSTGRES_USER: ooolala
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ooolala -d ooolala"]
      interval: 2s
      timeout: 5s
      retries: 30
    restart: unless-stopped
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - internal

  backend:
    image: ${name}-backend:${imageTag}
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      PORT: "4000"
      MIX_ENV: prod
      OOOLALA_BACKEND_HTTP: "1"
      OOOLALA_STORE: postgres
      OOOLALA_ENV: ${envName}
      OOOLALA_COMMIT: \${OOOLALA_COMMIT}
      OOOLALA_OPEN_SIGNUP: "${controls.openSignup ? '1' : '0'}"
      OOOLALA_MAX_USERS: "${controls.maxUsers}"
      OOOLALA_SIGNUP_DAILY_LIMIT: "${controls.signupDailyLimit}"
      OOOLALA_SIGNUP_HOURLY_LIMIT: "${controls.signupHourlyLimit}"
      OOOLALA_MESSAGE_RATE_LIMIT_COUNT: "${controls.messageRateLimitCount}"
      OOOLALA_MESSAGE_RATE_LIMIT_WINDOW_SECONDS: "${controls.messageRateLimitWindowSeconds}"
      OOOLALA_MAX_MESSAGE_BYTES: "${controls.maxMessageBytes}"
      OOOLALA_MAX_ATTACHMENTS: "${controls.maxAttachments}"
      OOOLALA_MAX_ATTACHMENT_BYTES: "${controls.maxAttachmentBytes}"
      OOOLALA_MAX_ATTACHMENTS_TOTAL_BYTES: "${controls.maxAttachmentsTotalBytes}"
${welcomePasswordEnv}      DATABASE_URL: postgres://ooolala:\${POSTGRES_PASSWORD}@postgres:5432/ooolala
      SECRET_KEY_BASE: \${SECRET_KEY_BASE}
    ports:
      - "127.0.0.1:${port}:4000"
    restart: unless-stopped
    networks:
      - internal

volumes:
  postgres-data:

networks:
  internal:
`;
}

function nginxSite(
  serverName: string,
  deployDir: string,
  port: number,
  defaultServer: boolean,
  tlsEnabled: boolean
) {
  const defaultFlag = defaultServer ? ' default_server' : '';
  const apiProxyHeaders = `proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;`;
  const limitedApiLocations = [
    apiLocation('/api/signup', '/signup', port, 'ooolala_signup', 10, apiProxyHeaders),
    apiLocation('/api/login', '/login', port, 'ooolala_login', 20, apiProxyHeaders),
    apiLocation('/api/password', '/password', port, 'ooolala_password', 10, apiProxyHeaders),
    apiLocation('/api/dm', '/dm', port, 'ooolala_dm', 30, apiProxyHeaders)
  ].join('\n\n');
  const apiRateZones = `limit_req_zone $binary_remote_addr zone=ooolala_signup:10m rate=5r/m;
limit_req_zone $binary_remote_addr zone=ooolala_login:10m rate=30r/m;
limit_req_zone $binary_remote_addr zone=ooolala_password:10m rate=20r/m;
limit_req_zone $binary_remote_addr zone=ooolala_dm:10m rate=120r/m;`;
  const httpServer = `${apiRateZones}

server {
    listen 80${defaultFlag};
    listen [::]:80${defaultFlag};
    server_name ${serverName};

    root ${deployDir}/web;
    index index.html;
    client_max_body_size 24m;

    location /.well-known/acme-challenge/ {
        root ${deployDir}/web;
    }

    ${limitedApiLocations}

    location /api/ {
        proxy_pass http://127.0.0.1:${port}/;
        ${apiProxyHeaders}
    }

    location = /index.html {
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
        try_files /index.html =404;
    }

    location /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        try_files $uri =404;
    }

    location / {
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
        try_files $uri $uri/ /index.html;
    }
}
`;

  if (!tlsEnabled) return httpServer;

  return `${apiRateZones}

server {
    listen 80${defaultFlag};
    listen [::]:80${defaultFlag};
    server_name ${serverName};
    client_max_body_size 24m;

    location /.well-known/acme-challenge/ {
        root ${deployDir}/web;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${serverName};

    root ${deployDir}/web;
    index index.html;
    client_max_body_size 24m;

    ssl_certificate /etc/letsencrypt/live/${serverName}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${serverName}/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    ${limitedApiLocations}

    location /api/ {
        proxy_pass http://127.0.0.1:${port}/;
        ${apiProxyHeaders}
    }

    location = /index.html {
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
        try_files /index.html =404;
    }

    location /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        try_files $uri =404;
    }

    location / {
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
        try_files $uri $uri/ /index.html;
    }
}
`;
}

function apiLocation(pathName: string, upstreamPath: string, port: number, zone: string, burst: number, headers: string) {
  return `location = ${pathName} {
        limit_req zone=${zone} burst=${burst} nodelay;
        proxy_pass http://127.0.0.1:${port}${upstreamPath};
        ${headers}
    }`;
}

function writeEnvCommand(
  deployDir: string,
  envName: string,
  commit: string,
  postgresPassword: pulumi.Input<string>,
  secretKeyBase: pulumi.Input<string>,
  welcomePassword?: pulumi.Output<string>
) {
  const welcomePasswordLine = welcomePassword ? pulumi.interpolate`OOOLALA_WELCOME_PASSWORD=${welcomePassword}
` : pulumi.output('');

  return pulumi.interpolate`set -euo pipefail
umask 077
cat > ${shell(`${deployDir}/.env`)} <<EOF
OOOLALA_ENV=${envName}
OOOLALA_COMMIT=${commit}
POSTGRES_PASSWORD=${postgresPassword}
SECRET_KEY_BASE=${secretKeyBase}
${welcomePasswordLine}
EOF`;
}

function deployCommand(
  deployDir: string,
  backupDir: string,
  ownerUser: string,
  bundlePath: string,
  appName: string,
  imageTag: string,
  backendPort: number,
  tls: {tlsEnabled: boolean; tlsEmail?: string; serverName: string}
) {
  const compose = `docker compose --env-file .env -f compose.yaml`;
  const publicVersionUrl = tls.tlsEnabled
    ? `https://${tls.serverName}/api/version?format=text`
    : 'http://127.0.0.1/api/version?format=text';
  const installNginx = [
    `sudo install -m 0644 nginx.conf /etc/nginx/sites-available/${shell(appName)}`,
    `sudo ln -sf /etc/nginx/sites-available/${shell(appName)} /etc/nginx/sites-enabled/${shell(appName)}`,
    'sudo nginx -t',
    'sudo systemctl reload nginx'
  ];
  const tlsSetup = tls.tlsEnabled
    ? [
        `sudo install -m 0644 nginx.bootstrap.conf /etc/nginx/sites-available/${shell(appName)}`,
        `sudo ln -sf /etc/nginx/sites-available/${shell(appName)} /etc/nginx/sites-enabled/${shell(appName)}`,
        'sudo nginx -t',
        'sudo systemctl reload nginx',
        'for i in $(seq 1 60); do',
        `  if getent ahostsv4 ${shell(tls.serverName)} | awk '{print $1}' | grep -qx ${shell(String(host))}; then break; fi`,
        '  sleep 2',
        'done',
        `getent ahostsv4 ${shell(tls.serverName)} | awk '{print $1}' | grep -qx ${shell(String(host))}`,
        `if [ ! -f /etc/letsencrypt/live/${shell(tls.serverName)}/fullchain.pem ]; then`,
        `  sudo certbot certonly --webroot -w ${shell(`${deployDir}/web`)} -d ${shell(tls.serverName)} --non-interactive --agree-tos --email ${shell(tls.tlsEmail!)} --keep-until-expiring`,
        'fi',
        ...installNginx
      ]
    : installNginx;

  return [
    'set -euo pipefail',
    `cd ${shell(deployDir)}`,
    'rm -rf web-release',
    'mkdir -p web-release',
    `tar -xzf ${shell(bundlePath)} -C web-release`,
    'rm -rf source web',
    'mv web-release/source source',
    'mv web-release/web web',
    'rm -rf web-release',
    `docker build -f source/docker/backend.Dockerfile -t ${shell(`${appName}-backend:${imageTag}`)} source`,
    `${compose} up -d postgres`,
    'for i in $(seq 1 60); do',
    `  if ${compose} exec -T postgres pg_isready -U ooolala -d ooolala >/dev/null 2>&1; then break; fi`,
    '  sleep 1',
    'done',
    `${compose} exec -T postgres pg_isready -U ooolala -d ooolala`,
    `sudo install -d -m 0750 -o ${shell(ownerUser)} -g ${shell(ownerUser)} ${shell(backupDir)}`,
    `backup_dir=${shell(backupDir)}`,
    'backup_file="$backup_dir/pre-migrate-$(date -u +%Y%m%dT%H%M%SZ).dump.gz"',
    `${compose} exec -T postgres pg_dump -U ooolala -d ooolala -Fc | gzip -9 > "$backup_file"`,
    `find ${shell(backupDir)} -name 'pre-migrate-*.dump.gz' -type f | sort | head -n -20 | xargs -r rm -f`,
    `${compose} run --rm backend /app/bin/backend eval 'Ooolala.Migrations.run_url(System.fetch_env!("DATABASE_URL"))'`,
    `${compose} up -d backend`,
    ...tlsSetup,
    'for i in $(seq 1 60); do',
    `  if curl -fsS http://127.0.0.1:${backendPort}/health >/dev/null 2>&1; then break; fi`,
    '  sleep 1',
    'done',
    `curl -fsS http://127.0.0.1:${backendPort}/health`,
    `curl -fsS 'http://127.0.0.1:${backendPort}/version?format=text'`,
    `curl -fsS ${shell(publicVersionUrl)}`
  ].join('\n');
}

function deleteCommand(deployDir: string, appName: string) {
  return [
    'set -euo pipefail',
    `if [ -d ${shell(deployDir)} ]; then`,
    `  cd ${shell(deployDir)}`,
    '  docker compose --env-file .env -f compose.yaml down --volumes --remove-orphans || true',
    'fi',
    `sudo rm -f /etc/nginx/sites-enabled/${shell(appName)} /etc/nginx/sites-available/${shell(appName)}`,
    'sudo nginx -t >/dev/null 2>&1 && sudo systemctl reload nginx || true',
    `sudo rm -rf ${shell(deployDir)}`
  ].join('\n');
}

function expandHome(value: string) {
  if (value === '~') return os.homedir();
  if (value.startsWith('~/')) return path.join(os.homedir(), value.slice(2));
  return value;
}

function sha256File(filePath: string) {
  return sha256(fs.readFileSync(filePath));
}

function sha256(value: string | Buffer) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function shell(value: string | number) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function configFlag(key: string, fallback: boolean) {
  const value = config.get(key);
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}
