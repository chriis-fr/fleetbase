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

**Known problem, not fixed yet:** the link also sends the live-update (SocketCluster) settings, and on this server
those are unset, so phones get `socket` port `8000`, not secure — an address that only exists inside Docker. Drivers
can sign in and work orders, but live updates to the phone will not connect. The fix is to set
`SOCKETCLUSTER_HOST=api.progressusmavericks.co.ke`, `SOCKETCLUSTER_PORT=443`, `SOCKETCLUSTER_SECURE=true` for the
API, but the API's own broadcaster reads the same three settings, so test that the console's live map still updates
before keeping it.

## Fixed during the 2026-11-10 test (core-api `22e1956`, `chains-production`)
Order events fired from background jobs (dispatched, canceled, and others) had no organisation, so their webhooks
were never sent, on live or in the sandbox; and sandbox events were logged in the live database. Both are fixed.
