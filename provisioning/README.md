# CARUNO provisioning

Configures a Dolibarr 24.0.2 instance as the CARUNO ERP engine, from a shop profile.

| File | Role |
|---|---|
| `shop-profile.dev.json` | Profile of the HANOUT VW development instance (fictitious identity, no secrets) |
| `10-configure.sh` | Applies a profile to a running instance |
| `lib/configure.php` | Engine, run inside the Dolibarr container; uses only Dolibarr's PHP API |
| `20-import-products.sh` | Creates or updates parts from a CSV made by `scripts/catalogue-pdf` (ref, label, description, `brand`, `oem_ref`); prices and stock untouched |
| `lib/import_products.php` | Import engine, same rules as `configure.php` (PHP API only, idempotent) |
| `tests/product-search.sh` | Counter searches through the API as a seller: by OEM, reference, label |

## Usage

```bash
scripts/backup-instance.sh pre-config        # verified backup first
provisioning/10-configure.sh                 # default profile: shop-profile.dev.json
provisioning/10-configure.sh my-shop.json    # another profile
```

Every item prints `CREATED`, `CHANGED`, `UNCHANGED` or `ERROR`, then a summary. A second run must print only `UNCHANGED`. Exit code is non-zero if any item failed.

## What it configures

Modules (enable/disable), company identity, language, profid display on documents, login API (`API_ENABLE_LOGIN_API`, used by the CARUNO front to sign each user in), pricing mode and price-level labels, margin basis, default barcode type, negative-stock rule, warehouses, bank and cash accounts, product and customer categories (stable `caruno:` codes in `ref_ext`), product extra fields.

## Per-user sign-in (CARUNO front)

The front calls Dolibarr directly, as the signed-in user:

1. `POST /api/index.php/login` with `{"login", "password", "reset": 0}` returns the user's token (`DOLAPIKEY`). The token never expires.
2. Every call sends the `DOLAPIKEY` header; Dolibarr applies the rights of the user's group.
3. Logout calls `/login` again with `"reset": 1`, which replaces the token and invalidates the old one on every device.

Requirements: `API_ENABLE_LOGIN_API=1` (this script) and the `user:self:creer` right, given to every group by `15-roles.sh` (`self_rights`). A non-admin user still cannot make itself administrator. Check with `provisioning/tests/login-api.sh [login] [secret key]`.

## Stock decrease mode (chosen by each shop)

`stock.decrease_on` in the shop profile sets exactly one customer-side rule and turns the others off:

| Value | Dolibarr constant | Stock leaves when | Sale flow in the front |
|---|---|---|---|
| `bill` | `STOCK_CALCULATE_ON_BILL` | the invoice is validated (warehouse given at validation) | counter: invoice → validate → payment ; wholesale: quote → order → invoice |
| `shipment` | `STOCK_CALCULATE_ON_SHIPMENT` | the shipment is validated | every sale: order → shipment → invoice (the counter screen chains them) |

Non-admin users cannot read constants through the API (`setup/conf` is admin-only), so the front gets this value from its per-instance configuration, generated from the same shop profile. Switching modes on a live shop is safe for stock already moved, but documents in progress (validated invoice not yet shipped, or the reverse) must be finished first.

Purchase prices: the products API returns `cost_price` and `pmp` to every user who can read products. The front hides them for roles that should not see them; this is a display choice, not a protection.

## What it deliberately does not do

- Supplier-side stock rules (`STOCK_CALCULATE_ON_SUPPLIER_*`, `STOCK_CALCULATE_ON_RECEPTION*`): decision pending.
- Users, groups, API keys, demo data.
- Any direct SQL write.
