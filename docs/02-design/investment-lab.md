# Investment Lab — Design and contracts

Source: current user's CFO investment group, buildCurrentPortfolioValuation. Exclude debt. Area = positive KRW valuation; preserve zero holdings in list. Aggregate by normalized ticker + market + currency within strategy; missing ticker stays position-specific. Top-three concentration aggregates same instrument across strategies. Account filter applies before every calculation.

Color = cost-weighted price return only when ALL constituent positions have comparable cost and dated price/FX within seven calendar days. Seven days is an age warning, not a trading-calendar SLA. Missing/future/old dates retain valuation with warnings but get neutral color. Current FX converts both cost and value; explicitly exclude historical FX effect/dividends/fees/realized P&L. Partial comparable P&L is labeled and accompanied by amount-weighted coverage. No 0% substitute for missing return.

Use existing app CSS/JS integration; charts share a pure view model. Treemap uses deterministic binary weighted partition and zero padding for exact outer-area proportions; border is inside each tile. Strategy filter zoom, account selector, always-available list, buttons with accessible full names and detail panel. Tiny tiles do not inflate area; list handles exact selection. Blue positive/orange negative fixed ±20% intensity, neutral missing, signed text and fixed legend.

Keep legacy editor; detail offers an explicit old investment detail/edit handoff instead of duplicating mutation logic. Synthetic fixtures only in local outputs. No source/account IDs in URLs or public snapshots.
