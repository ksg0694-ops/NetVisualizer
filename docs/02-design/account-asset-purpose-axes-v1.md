# Account, Asset, Purpose Axes v1

## Decision

A portfolio holding carries three independent axes:

- `accountId`: where the value is held.
- `assetClass`: what economic asset is owned.
- `purposeKey`: why the money is held.

An account is a container entity, not an additional asset. Its `balance` is derived from linked positions.

## Domain Rules

1. `PersonalCfoAccount` represents a bank, brokerage, savings, or pension wrapper.
2. `PersonalCfoAsset` represents a financial position and may reference an account.
3. Directly held assets such as a housing deposit may omit `accountId`.
4. `calculateTotalAssets` sums positions only when positions exist.
5. Legacy account-only snapshots fall back to account balances for read compatibility.
6. Liabilities remain separate from accounts and positions.
7. Zero-value holdings do not appear in the CFO network.

## Legacy Mapping

The Supabase `asset_type = account` value remains a compatibility input. The adapter resolves it with product text and `instrument_type`:

| Source meaning | `assetClass` |
| --- | --- |
| Cash, checking, deposit balance | `cash` |
| Savings, youth savings, housing subscription | `deposit` |
| Note, RP, bond | `fixedIncome` |

No Supabase migration is required for v1.

## Graph Contract

The balance sheet graph uses `Account -> Position -> Net Worth`.

- `HOLDS`: account to linked position.
- `CONTRIBUTES_TO`: position to net worth.
- `EXPOSED_TO`: liability to net worth.
- Account subtotals must not create `CONTRIBUTES_TO` edges while positions exist.

Purpose remains available on each node through `bucketKey` for color and tooltip metadata.
