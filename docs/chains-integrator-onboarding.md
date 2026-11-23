# Onboarding an integrator to Chains FleetOps

For the Chains team. The public side is at https://chains-erp.com/logistics/docs; this is what *we* do when a
business asks to connect. Tested end to end on 2026-11-10 with a test key (13 of 14 API steps passed first time;
the failures it found are fixed or written down below).

- Console: https://progressusmavericks.co.ke
- API: https://api.progressusmavericks.co.ke/v1 (`Authorization: Bearer <key>`)
- Server: `chrisodhiambo@10.42.13.107`, `~/Desktop/fleetbase`, branch `production`

## 1. Collect from them
What the docs ask for on the Integrate page: company name and an operations contact, who should receive keys,
sample orders (pickup and drop-off address format, items), the ids they want echoed back (`internal_id`), their
webhook URL(s) and events, any IP allow-list, and their test and go-live dates.

## 2. Give them an organisation
One FleetOps organisation per integrator, so their orders, drivers and keys stay apart from everyone else's.
Create it (or have them sign up) in the console, and invite their operations users.

## 3. Prepare the sandbox for that organisation (once)
Test keys use the separate sandbox database. Two things must exist there or test orders fail:

1. **Their user and organisation.** Creating a test key from the console (step 4) copies these across for you.
2. **A default transport order config.** Nothing creates it in the sandbox. Without it every order fails with
   `Invalid order type or order_config provided.` Run this once, with their organisation's public id:

```bash
cd ~/Desktop/fleetbase
docker compose exec -T application php artisan tinker --execute='
config(["database.default" => "sandbox", "fleetbase.connection.db" => "sandbox"]);
$c = Fleetbase\Models\Company::on("sandbox")->where("public_id", "company_XXXXXXXXXX")->firstOrFail();
session(["company" => $c->uuid, "user" => $c->owner_uuid]);
$cfg = Fleetbase\FleetOps\Models\OrderConfig::default($c) ?? Fleetbase\FleetOps\Support\FleetOps::createTransportConfig($c);
echo $cfg->public_id, PHP_EOL;'
```

Run it after step 4 (the organisation has to be in the sandbox first). Live organisations already have this config.

## 4. Issue a test key
In the console, signed in to their organisation, with test (sandbox) data switched on: Developers, API keys, create
a key. A test key starts with `flb_test_`. Send it privately (not in a group chat or email thread you don't control).

## 5. Webhooks
- They can register their own endpoint with their key: `POST /v1/webhook-endpoints` (or `webhookEndpoints.create`
  in the SDK). **The response is the only time the signing secret is shown**; they must store it. If it is lost,
  `POST /v1/webhook-endpoints/{id}/rotate-secret` returns a new one.
- Or create it for them in the console and send them the secret.
- The URL must be **public HTTP(S)**. FleetOps rejects private and local addresses.
- Deliveries carry `X-Fleetbase-Signature: t=<unix>,v1=<hex>`; the SDK's `verifyWebhook` checks it (cross-checked
  against FleetOps' own signer).

## 6. Things they will trip over
- **Dispatch needs a driver.** `orders.dispatch` answers `No driver assigned to dispatch!` unless the order has a
  `driver`. Either they pass `driver: 'driver_...'` when creating the order, or our team dispatches from the console.
- Sending `dropoff` as an object creates the place for them; `location` is `[latitude, longitude]`.
- `orders.schedule(id, '2026-11-12', { time: '09:00', timezone: 'Africa/Nairobi' })`.
- Place search: `places.search('ngong')` (a string, not an object).

## 7. Sign-off and go live
When their test run works end to end (order created, dispatched, completed or cancelled, and webhooks verified):
1. Create a **live** key in the console with test data switched off (`flb_live_...`).
2. They register their live webhook endpoint (live endpoints have their own secret).
3. Watch the first live orders in the console and in the Telegram bot (`/fleet`, order events).

## 8. Revoke
Delete the key in the console. Deleted keys stop working immediately (the API answers 401).

## Storefront key (checked 2026-11-10 on the live API and in the Storefront console source)
1. Set up their store in the console: Storefront, then the store.
2. **Storefront, Settings, API: "Store key"** (click to reveal, click to copy). The key starts with `store_`. A network
   of stores has its own key starting with `network_`, under the network's settings.
3. Send it privately. They use it server-side only: `Authorization: Bearer store_...` against
   `https://api.progressusmavericks.co.ke/storefront/v1`. A wrong key answers 401
   `Oops! The Storefront key provided was not valid`.
4. If it leaks: same page, **Rotate key**. The old key stops working, so give them the new one.

Note: the only store today is "zeroman test store" (offline, no products).

## Driver app: Fleetbase Navigator (checked 2026-11-10 in the Navigator and FleetOps source)
Drivers install the official **Fleetbase Navigator** app (iOS / Android). Out of the box it points at Fleetbase's
cloud, so each phone has to be linked to our instance once:

1. In the console, as admin: **Admin, Navigator App, "Instance Linking URL"**. Copy it. The link expires after
   30 minutes, and only an admin can create one.
2. Open the link on the driver's phone with Navigator installed. The app takes our host and key, logs out, and
   shows "Instance link was successful!".
3. The driver signs in with the account you created for them in FleetOps (Drivers).
4. Driver onboarding, document uploads and what drivers may edit: **FleetOps, Settings, Navigator App**.

**Live updates on driver phones (fixed 2026-11-22).** The instance link sends the live-update settings, and
they are now the public address: `api.progressusmavericks.co.ke`, port `443`, secure (set on the application
service in `docker-compose.override.yml`; nginx proxies `/socketcluster/` to the socket container). The API's own
publisher stays inside Docker through `SOCKETCLUSTER_PUBLISHER_HOST/PORT/SECURE` (core-api
`config/broadcasting.connections.php`), so the console's live map is unaffected. Checked: a websocket handshake on
`wss://api.progressusmavericks.co.ke/socketcluster/` answers 101, and an internal publish succeeds.
Phones linked before this date should open a fresh instance link once to pick up the new address.

## Database access (changed 2026-11-22)
MySQL is bound to `127.0.0.1:3306` only. For admin tools, tunnel in:
`ssh -L 3306:127.0.0.1:3306 chrisodhiambo@10.42.13.107`.

## Fixed during the 2026-11-10 test (core-api `22e1956`, `chains-production`)
Order events fired from background jobs (dispatched, canceled, and others) had no organisation, so their webhooks
were never sent, on live or in the sandbox; and sandbox events were logged in the live database. Both are fixed.

## Clients already connected (written 2026-11-23, with the v0.8.2 upgrade)

"Connected" means their system calls our API with a key (`flb_live_` / `flb_test_`), receives our webhooks,
uses a store key, or has drivers on Navigator linked to our instance. Everything they hold (keys, store keys,
webhook secrets, Navigator links) lives in our database, so an upgrade keeps it all; nothing has to be reissued.

### Before an upgrade or other maintenance
1. **See who is live** (through the tunnel, counts only): live keys used in the last 7 days
   (`api_credentials.last_used_at`, `test_mode = 0`), open orders, webhook endpoints. On 2026-11-23: no orders in
   7 days, no live key used, one webhook endpoint.
2. **Tell each live client 48 hours ahead**: the window, about two minutes of downtime, what changes (below), and
   that calls failing with 502/503 in the window should be retried.
3. Pick a quiet hour with no orders in progress.
4. Back up and keep rollback ready: `~/fb-upgrade/cutover.sh` does the backup, tags the old images and writes
   `~/backups/ROLLBACK-v082.txt` before it changes anything.

### During the window
- The API is down while the containers restart (about two minutes).
- **Webhooks are tried 3 times** (5-second timeout, exponential back-off; core-api `config/webhook-server.php`).
  If their endpoint is down longer than that, the delivery is logged as failed and is not sent again.

### After (same day)
1. **Our checks**: `/health` answers 200; `/v1/orders` without a key answers 401; console sign-in; a test-key order
   created and cancelled in the sandbox, with its webhook received and its signature verified; the websocket
   handshake on `wss://api.progressusmavericks.co.ke/socketcluster/` answers 101.
2. **Tell clients it is done** and ask them to run their own smoke test with their test key: create an order,
   read it, cancel it, verify the webhook signature.
3. **Reconcile the window**: for any order they created or expected to change during it, `GET /v1/orders/{id}`
   and compare the status; check the failed deliveries for their endpoint in the console (Developers, Webhooks).
4. Drivers do nothing; Navigator links and accounts are unchanged.

### What v0.8.2 changes for them (fleetops 0.6.75 to 0.7.2, core-api 1.6 to 2.0.4; diffed 2026-11-23)
- **Nothing removed** from the `/v1` routes or responses. New fields: orders `adhoc_strategy`,
  `required_vehicle_type`, `dispatch_outcome` (ad-hoc orders) and, when loaded, `payment_status`, `driver_rating`,
  `adhoc_offer`; order configs `policies`, `custom_fields`; purchase rates `service_name`, `repriced`; service
  quotes `seating_capacity`, `pickup_eta`. Their code must ignore fields it does not know (most JSON clients do;
  a strict schema validator needs updating).
- **Stricter**: dispatching a cancelled order answers 409; an order type can now switch dispatch off or require
  custom fields (422). None of our six order types does either today (checked on a copy of live data).
  Accepting an ad-hoc order now checks the driver is online and the order not already taken (409).
- **Webhook signing unchanged**: `X-Fleetbase-Signature: t=<unix>,v1=<hex>`, the same Chains code.

### Every week
- Failed webhook deliveries per client (console, Developers, Webhooks); call them if an endpoint keeps failing.
- Keys: one key per connected system. Rotate when someone with access leaves or a key leaks (delete in the
  console: the old key answers 401 at once; issue a new one privately). Webhook secret:
  `POST /v1/webhook-endpoints/{id}/rotate-secret`. Store key: Storefront, Settings, API, Rotate key.

### If a client reports errors after an upgrade
1. `docker compose logs application --since 1h` and `api/storage/logs` inside the application container.
2. If it is ours and cannot be fixed quickly: follow `~/backups/ROLLBACK-v082.txt` (images and code first; the
   database restore only if the old code trips over the new tables, and it loses anything written since).
