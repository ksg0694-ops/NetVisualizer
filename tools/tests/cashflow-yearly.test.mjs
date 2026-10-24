import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const c = vm.createContext({});
for (const name of ['spendingAnalysis', 'cashflowLabModel']) {
    vm.runInContext(await readFile(new URL('../../js/features/' + name + '.js', import.meta.url), 'utf8'), c);
}
const M=c.CashflowLabModel, repay=t=>t.category==='상환';
const tx=(id,date,amount,type='지출')=>({id,date,amount,type,category:'식비'});
const payday=[
    {key:'2026-01',label:'1월 급여',startDate:'2025-12-24',endDate:'2026-01-22',closeStatus:'confirmed',
      transactions:[tx('a','2025-12-29',-10000),tx('b','2026-01-03',-1000)]},
    {key:'2026-02',label:'2월 급여',startDate:'2026-01-23',endDate:'2026-02-24',closeStatus:'unconfirmed',
      transactions:[tx('c','2026-01-25',-250000),tx('d','2026-02-02',1200000,'수입')]},
    {key:'2026-03',label:'3월 급여',startDate:'2026-02-25',endDate:'2026-03-24',closeStatus:'confirmed',
      transactions:[tx('e','2026-03-01',-5000)]}
];
const build=(periods,year,spendingView='all',isSpecial=()=>false,selectedKey='',today='2026-10-24')=>
  M.build(periods,selectedKey,today,repay,c.SpendingAnalysis.analyze,{year,spendingView,isSpecial});
test('calendar grouping reassigns each transaction by its date, not payday label',()=>{
    const before=JSON.stringify(payday),groups=M.toCalendarPeriods(payday);
    assert.equal(groups.find(p=>p.key==='2025-12').transactions.map(t=>t.id).join(','),'a');
    assert.equal(groups.find(p=>p.key==='2026-01').transactions.map(t=>t.id).join(','),'b,c');
    assert.equal(groups.find(p=>p.key==='2026-02').transactions[0].id,'d');
    assert.equal(groups.find(p=>p.key==='2026-01').closeStatus,'unconfirmed');
    assert.equal(groups.find(p=>p.key==='2026-01').basis,'calendar');
    assert.equal(groups.flatMap(p=>p.transactions).length,5);
    assert.equal(JSON.stringify(payday),before);
    assert.equal(M.years(payday,'2026-10-24').join(','),'2026,2025');
});
test('annual year selector preserves January payday vs calendar year differences',()=>{
    const calendar=M.toCalendarPeriods(payday);
    const y2025=build(calendar,2025);
    assert.equal(y2025.annual.spending,10000);
    assert.equal(y2025.monthly[11].spending,10000);
    assert.equal(y2025.monthly[0].spending,null);
    const y2026=build(calendar,2026);
    assert.equal(y2026.annual.spending,256000);
    assert.equal(y2026.monthly[0].spending,251000);
    assert.equal(y2026.annual.income,1200000);
    const payday2026=build(payday,2026);
    assert.equal(payday2026.annual.spending,266000);
    assert.equal(payday2026.monthly[0].spending,11000);
    assert.equal(payday2026.selected.key,'2026-03');
});
test('occasional tagged outlier stays in the real yearly total but not normal trend',()=>{
    const periods=M.toCalendarPeriods(payday),flag=t=>t.id==='c';
    const full=build(periods,2026,'all',flag);
    assert.equal(full.annual.spending,256000);
    assert.equal(full.annual.specialSpending,250000);
    assert.equal(full.annual.regularSpending,6000);
    assert.equal(full.monthly[0].spending,251000);
    assert.equal(full.monthly[0].regularSpending,1000);
    assert.equal(full.monthly[0].specialSpending,250000);
    const regular=build(periods,2026,'regular',flag,'2026-01');
    const special=build(periods,2026,'special',flag,'2026-01');
    assert.equal(regular.monthly[0].viewSpending,1000);
    assert.equal(special.monthly[0].viewSpending,250000);
    assert.equal(regular.monthly[0].dailyViewSpending,1000/31);
    assert.equal(regular.annual.spending,special.annual.spending);
    assert.equal(regular.curves.current[24],1000);
    assert.equal(special.curves.current[24],250000);
});
test('missing and future months remain unavailable and annual totals never invent 12 months of spend',()=>{
    const periods=M.toCalendarPeriods(payday);
    const selected=build(periods,2026,'all',()=>false,'2026-02','2026-02-09');
    assert.equal(selected.monthly[1].income,1200000);
    assert.equal(selected.monthly[2].spending,null);
    assert.equal(selected.monthly[11].spending,null);
    assert.equal(selected.annual.spending,251000);
    assert.equal(selected.annual.specialSpending,0);
    assert.equal(selected.availableCount,2);
});
test('yearly UI retains existing charts and adds controls without editing source ledger',async()=>{
    const view=await readFile(new URL('../../js/features/cashflowLab.js',import.meta.url),'utf8');
    const finance=await readFile(new URL('../../js/features/financeIntelligence.js',import.meta.url),'utf8');
    for(const id of ['cfl-year','cfl-basis','cfl-spending-view','cfl-regular-spending','cfl-special-spending','cfl-year-chart','cfl-period']){
        assert.ok(view.includes('id="'+id+'"'),id);
    }
    assert.match(view,/toCalendarPeriods\(sourcePeriods\)/);
    assert.match(view,/model\.annual\.specialSpending/);
    assert.match(finance,/period\.basis==='calendar'/);
    assert.match(finance,/getTags/);
});
