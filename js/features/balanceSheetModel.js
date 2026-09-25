(function (root) {
    'use strict';
    const GROUPS = [['operating','운영(생활)','fa-cart-shopping'],['safe','안전(현금)','fa-coins'],['investment','투자','fa-chart-simple'],['pension','연금(목표자산1)','fa-bullseye'],['housing','주거(목표자산2)','fa-house']];
    const numeric = v => v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);
    const monthIndex = key => Number(key.slice(0,4)) * 12 + Number(key.slice(5,7)) - 1;
    const keyAt = n => `${Math.floor(n/12)}-${String(n%12+1).padStart(2,'0')}`;
    function history(rows = [], today = '') {
        const byMonth = new Map();
        for (const r of rows) {
            const year = Number(r.year), month = Number(r.month), value = numeric(r.total_asset);
            if (!Number.isInteger(year) || year < 1900 || year > 2200 || !Number.isInteger(month) || month < 1 || month > 12 || value === null) continue;
            const key = `${year}-${String(month).padStart(2,'0')}`;
            if (today && key > today.slice(0,7)) continue;
            if (byMonth.has(key)) { byMonth.set(key, {month:key, netWorth:null, status:'duplicate'}); continue; }
            byMonth.set(key, {month:key, netWorth:value, status:'recorded', source:'assets'});
        }
        if (!byMonth.size) return [];
        const keys = [...byMonth.keys()].sort(), result=[];
        for (let i=monthIndex(keys[0]);i<=monthIndex(keys.at(-1));i++) result.push(byMonth.get(keyAt(i)) || {month:keyAt(i),netWorth:null,status:'missing'});
        return result;
    }
    function timeline(rows = [], {positions=[],asOf='',today=''}={}) {
        const month=String(asOf).slice(0,7);
        const validDate=/^\d{4}-\d{2}-\d{2}$/.test(asOf)&&Number.isFinite(Date.parse(asOf))&&new Date(asOf).toISOString().slice(0,10)===asOf;
        const exists=rows.some(r=>Number(r.year)===Number(month.slice(0,4))&&Number(r.month)===Number(month.slice(5,7)));
        if(!validDate||!positions.length||exists||(today&&asOf>today)||positions.some(p=>numeric(p.amount)===null))return history(rows,today);
        const netWorth=current(positions).netWorth;
        return history([...rows,{year:Number(month.slice(0,4)),month:Number(month.slice(5,7)),total_asset:netWorth}],today)
            .map(p=>p.month===month?{...p,status:'input',source:'input-snapshot',asOf}:p);
    }
    function reconcile(points, flows = []) {
        return points.map((p,i) => {
            const prev=points[i-1];
            const change = prev && prev.netWorth !== null && p.netWorth !== null && monthIndex(p.month)-monthIndex(prev.month)===1 ? p.netWorth-prev.netWorth : null;
            const matches=flows.filter(f=>f.month===p.month), f=matches.length===1 ? matches[0] : null;
            // Never infer market performance as a balancing residual or treat missing flows as zero.
            const complete = f?.reviewed === true && f?.basis === 'calendar' && f?.scope === 'investment+pension'
                && [f.opening_investment,f.closing_investment,f.net_contributions,f.net_saving,f.other_change].every(v=>numeric(v)!==null)
                && numeric(f.opening_net_worth)===prev?.netWorth && numeric(f.closing_net_worth)===p.netWorth
                && p.status==='recorded' && prev?.status==='recorded';
            const performance=complete ? Number(f.closing_investment)-Number(f.opening_investment)-Number(f.net_contributions) : null;
            const saving=complete ? Number(f.net_saving) : null, other=complete ? Number(f.other_change) : null;
            const difference=complete && change!==null ? change-performance-saving-other : null;
            return {...p,change,performance,saving,other,difference, attribution:complete ? (Math.abs(difference||0)<=1?'reconciled':'difference'):'unavailable'};
        });
    }
    function current(positions = [], {today='',getPrice=()=>null,getFx=()=>null}={}) {
        const groups=GROUPS.map(([key,label,icon])=>({key,label,icon,assets:0,debt:0,net:0,items:[]}));
        let stale=0, missing=0, priced=0;
        const age=date => /^\d{4}-\d{2}-\d{2}$/.test(String(date||'')) ? (Date.parse(today)-Date.parse(date))/86400000 : Infinity;
        for (const p of positions) {
            const g=groups.find(g=>g.key===p.group); if(!g || numeric(p.amount)===null) continue;
            const debt=Boolean(p.isDebt || Number(p.amount)<0), stored=Math.abs(Number(p.amount));
            let value=stored, status='stored', priceDate='', fxDate='';
            if(!debt && ['investment','pension'].includes(g.key) && Number(p.shares)>0) {
                const quote=p.ticker?getPrice(p.ticker):null, currency=String(p.currency||'KRW').toUpperCase();
                const fx=currency==='KRW'?{krwPerUnit:1,rateDate:today}:getFx(currency);
                const qAge=age(quote?.priceDate || quote?.price_date), fAge=age(fx?.rateDate || fx?.rate_date);
                if(quote && numeric(quote.price)>0 && String(quote.currency).toUpperCase()===currency && numeric(fx?.krwPerUnit ?? fx?.krw_per_unit)>0) {
                    if(qAge>=0 && qAge<=7 && fAge>=0 && fAge<=7) {
                        value=Math.round(Number(p.shares)*Number(quote.price)*Number(fx.krwPerUnit ?? fx.krw_per_unit)); status='market';priced++;
                        priceDate=quote.priceDate||quote.price_date;fxDate=fx.rateDate||fx.rate_date;
                    } else {stale++;status='stale';}
                } else {missing++;status='missing';}
            }
            g[debt?'debt':'assets']+=value;
            g.items.push({...p,value,isDebt:debt,status,priceDate,fxDate});g.net=g.assets-g.debt;
        }
        const assets=groups.reduce((s,g)=>s+g.assets,0),debt=groups.reduce((s,g)=>s+g.debt,0);
        return {groups,assets,debt,netWorth:assets-debt,stale,missing,priced};
    }
    root.BalanceSheetModel=Object.freeze({history,timeline,reconcile,current,GROUPS,numeric});
})(globalThis);
