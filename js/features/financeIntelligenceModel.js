(function (root) {
  'use strict';
  const clean = value => String(value ?? '').toLowerCase().replace(/\s+/g, '').trim();
  const txKey = tx => root.PersonalCfoDomain?.createTransactionKey?.(tx) || (tx?.id ? 'id:' + tx.id : '');
  function suggest(tx, rules = []) {
    const memo = clean(tx?.memo), method = clean(tx?.method);
    const applicable = rules.filter(rule => rule.enabled !== false
      && rule.match_type === tx?.type
      && memo.includes(clean(rule.match_text))
      && clean(rule.match_text).length >= 2
      && (!rule.match_method || method.includes(clean(rule.match_method))));
    if (!applicable.length) return { status: 'none' };
    const highest = Math.max(...applicable.map(rule => clean(rule.match_text).length + (rule.match_method ? 1000 : 0)));
    const winners = applicable.filter(rule => clean(rule.match_text).length + (rule.match_method ? 1000 : 0) === highest);
    const signatures = new Set(winners.map(rule => [rule.target_type, rule.target_category, rule.target_subcategory].join('|')));
    if (signatures.size !== 1) return { status: 'conflict', count: winners.length };
    const rule = winners[0];
    const classification = { type: rule.target_type, category: rule.target_category, subcategory: rule.target_subcategory };
    if (tx.type === classification.type && String(tx.category ?? tx.cat) === classification.category
       && String(tx.subcategory ?? tx.subcat) === classification.subcategory) return { status: 'already', rule, classification };
    return { status: 'suggested', rule, classification };
  }
  function dueDays(start, end, payDay) {
    const result = [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || !Number.isInteger(Number(payDay)) || payDay < 1 || payDay > 31) return result;
    let cursor = new Date(start.slice(0,7) + '-01T00:00:00Z');
    for (let i = 0; i < 15; i += 1) {
      const year = cursor.getUTCFullYear(), month = cursor.getUTCMonth();
      const last = new Date(Date.UTC(year, month+1, 0)).getUTCDate();
      const date = [year, String(month+1).padStart(2,'0'), String(Math.min(Number(payDay),last)).padStart(2,'0')].join('-');
      if (date > end) break;
      if (date >= start) result.push(date);
      cursor = new Date(Date.UTC(year,month+1,1));
    }
    return result;
  }
  const dayDistance = (a, b) => Math.abs((Date.parse(a+'T00:00:00Z')-Date.parse(b+'T00:00:00Z'))/86400000);
  function reconcileFixedCosts(fixedCosts = [], transactions = [], period = {}, today = '') {
    const used = new Set(), result = [];
    for (const row of fixedCosts.filter(item => item.is_active)) {
      const planned = Number(row.monthly_amount);
      if (!Number.isFinite(planned) || planned < 0) continue;
      const days = dueDays(period.startDate || '', period.endDate || '', Number(row.pay_day));
      if (!days.length) { result.push({row, status:'no-date', planned, dueDate:'', actual:null}); continue; }
      for (const dueDate of days) {
        const candidates = transactions.filter(tx => {
          if (tx.type !== '지출' || used.has(txKey(tx)) || !txKey(tx)) return false;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(tx.date || '') || dayDistance(tx.date,dueDate)>5) return false;
          if (!clean(row.name) || !clean(tx.memo).includes(clean(row.name))) return false;
          if (row.payment_method && !clean(tx.method).includes(clean(row.payment_method))) return false;
          return true;
        });
        if (candidates.length !== 1) {
          result.push({row, planned, dueDate, actual:null, status:candidates.length ? 'ambiguous' : dueDate < today ? 'unconfirmed' : 'scheduled'});
        } else {
          const tx = candidates[0], actual = Math.abs(Number(tx.amount));
          if (!Number.isFinite(actual)) {result.push({row, planned, dueDate, actual:null, status:'ambiguous'}); continue;}
          used.add(txKey(tx));
          result.push({row, planned, dueDate, actual, tx, status: Math.abs(actual-planned)>Math.max(1000, planned*0.02) ? 'changed':'matched'});
        }
      }
    }
    return result.sort((a,b)=>a.dueDate.localeCompare(b.dueDate) || String(a.row.name).localeCompare(String(b.row.name)));
  }
  function spendingSummary(transactions = [], tags = [], isRepayment = () => false) {
    const byKey = new Map(tags.map(row => [row.transaction_key,row.event_tag]));
    let total=0, special=0, excludedForeign=0;
    const events = new Map();
    for (const tx of transactions) {
      if (tx.type !== '지출' || isRepayment(tx)) continue;
      if (tx.currency && tx.currency !== 'KRW') {excludedForeign++; continue;}
      const amount = Math.abs(Number(tx.amount));
      if (!Number.isFinite(amount)) continue;
      total += amount;
      const tag = byKey.get(txKey(tx));
      if (tag) {special += amount; events.set(tag,(events.get(tag)||0)+amount);}
    }
    return {total,special,regular:total-special,events:[...events].map(([name,amount])=>({name,amount})).sort((a,b)=>b.amount-a.amount),excludedForeign};
  }
  function cardUsage(cards = [], transactions = [], isRepayment = () => false) {
    return cards.filter(c=>!c.deleted && c.card_status !== 'closed').map(card => {
      const alias = clean(card.name);
      const matches = alias.length >= 3 ? transactions.filter(tx => tx.type==='지출' && !isRepayment(tx) && clean(tx.method).includes(alias)) : [];
      const observed = matches.reduce((sum,tx)=>sum+Math.abs(Number(tx.amount)||0),0);
      return {card, observed, matched:matches.length, coverage:matches.length?'matched':'unknown', target:Number(card.target_amt)||0};
    });
  }
  root.FinanceIntelligenceModel = Object.freeze({clean,txKey,suggest,dueDays,reconcileFixedCosts,spendingSummary,cardUsage});
})(globalThis);
