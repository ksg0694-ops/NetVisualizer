# Account, Asset, Purpose Axes v1 Report

## Result

The Personal CFO runtime now separates storage location, economic asset class, and financial purpose without changing the Supabase source schema.

The actual portfolio rendered as 8 accounts, 12 aggregated positions, and 1 liability. The youth savings account maps to a deposit position, zero-value loan-account cash is omitted, and direct holdings remain valid without a forced account.

## Verification

- Full `npm run check`: passed.
- Personal CFO runtime contract: passed.
- Total assets equal position contributions exactly once.
- Balance graph columns: `계좌`, `보유자산`, `순자산`.
- Runtime edges: 10 `HOLDS`, 12 `CONTRIBUTES_TO`, 1 `EXPOSED_TO`.
- Desktop node overlap: 0.
- Mobile horizontal overflow: none.
- Browser console errors: 0.
- Browser screenshot capture timed out twice; DOM layout and bounding-box checks were used as the visual fallback.
