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

## Storefront
For a hosted shop, set up their store in the console's Storefront and give them that store's Storefront key for
server-side use only. (The store setup was not part of the 2026-11-10 test.)

## Fixed during the 2026-11-10 test (core-api `22e1956`, `chains-production`)
Order events fired from background jobs (dispatched, canceled, and others) had no organisation, so their webhooks
were never sent, on live or in the sandbox; and sandbox events were logged in the live database. Both are fixed.
