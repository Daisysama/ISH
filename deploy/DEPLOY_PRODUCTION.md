# ISH v0.1-alpha — fromish.com production deployment

Target topology:

Internet -> HTTPS/Nginx on CVM -> Next.js 127.0.0.1:3000 -> Tencent Cloud PostgreSQL private IP 10.0.0.7:5432

## 1. DNS

Create DNS records:

- `@` A -> CVM public IPv4
- `www` CNAME -> `fromish.com` (optional but recommended)

Do not expose port 3000 in the CVM security group. Public inbound should remain 80/443; SSH 22 should remain restricted to trusted IPs.

## 2. Install server packages

Ubuntu 24.04:

```bash
sudo apt update
sudo apt install -y nginx git curl ca-certificates certbot python3-certbot-nginx
```

Install a system-wide Node.js LTS version compatible with this project (Node 22 recommended for this release), then verify:

```bash
node -v
npm -v
```

## 3. Create service account and deploy directory

```bash
sudo adduser --system --group --home /opt/ish ish
sudo mkdir -p /opt/ish
sudo chown -R ish:ish /opt/ish
```

Put the repository contents into `/opt/ish` (Git clone/pull is preferred for team traceability), then:

```bash
cd /opt/ish
sudo -u ish npm ci
```

## 4. Production environment

Create `/opt/ish/.env` and never commit it:

```env
DATABASE_URL="postgresql://ISH_APP_USER:URL_ENCODED_PASSWORD@10.0.0.7:5432/ish"
SESSION_SECRET="REPLACE_WITH_A_RANDOM_SECRET_AT_LEAST_32_CHARS"
```

Generate a session secret:

```bash
openssl rand -base64 48
```

Prefer a dedicated runtime database account; do not use the database superuser for normal web requests.

## 5. Initialize schema and build

For the first alpha deployment only, use an account with schema-creation privileges to initialize the empty database:

```bash
cd /opt/ish
sudo -u ish npx prisma generate
sudo -u ish npx prisma db push
sudo -u ish npm run build
```

After the schema exists, switch `DATABASE_URL` to a least-privilege runtime account with only the permissions the app requires.

Before the product starts accumulating important data, replace `prisma db push` with committed Prisma migrations (`prisma migrate`) so every schema change is reviewable and reproducible.

## 6. systemd

```bash
sudo cp /opt/ish/deploy/systemd/ish.service /etc/systemd/system/ish.service
sudo systemctl daemon-reload
sudo systemctl enable --now ish
sudo systemctl status ish --no-pager
```

Local health check:

```bash
curl -I http://127.0.0.1:3000/login
```

## 7. Nginx

```bash
sudo cp /opt/ish/deploy/nginx/fromish.com.conf /etc/nginx/sites-available/fromish.com
sudo ln -sfn /etc/nginx/sites-available/fromish.com /etc/nginx/sites-enabled/fromish.com
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

At this point `http://fromish.com` should reach the application.

## 8. HTTPS

Production auth cookies are Secure, so the public login/registration flow must use HTTPS.

```bash
sudo certbot --nginx -d fromish.com -d www.fromish.com
```

Choose redirect-to-HTTPS when Certbot asks. Then verify:

```bash
curl -I https://fromish.com/login
sudo certbot renew --dry-run
```

## 9. Release smoke test

From a normal browser/incognito window:

1. Open `https://fromish.com`.
2. Register a test user.
3. Confirm redirect to `/dashboard`.
4. Log out.
5. Log in again.
6. Confirm the user row exists in PostgreSQL.
7. Confirm port 3000 and PostgreSQL 5432 are not publicly reachable.

## 10. Updates

Preferred workflow:

```bash
cd /opt/ish
git pull --ff-only
sudo -u ish npm ci
sudo -u ish npx prisma generate
sudo -u ish npm run build
sudo systemctl restart ish
```

If a release contains a database migration, run the reviewed migration command before restarting the service.

Every substantive production change should have a Git commit and a development log entry explaining what changed, why, trade-offs, impact, and next steps.
