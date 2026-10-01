import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const source=p=>readFile(new URL('../../'+p,import.meta.url),'utf8');
const c=vm.createContext({});vm.runInContext(await source('js/features/projectModel.js'),c);vm.runInContext(await source('js/features/projectStore.js'),c);
const m=c.ProjectModel,id='10000000-0000-0000-0000-000000000001';
const task={project_id:id,title:'Task',start_date:'2026-09-28',end_date:'2026-09-30',status:'doing',progress:50,priority:'high',milestone:false};
test('dashboard journeys include every item type with actual scoped states and chronological order',()=>{
 const rows=[{...task,id:'later',item_type:'event',start_date:'2026-10-01',end_date:'2026-10-01',status:'waiting'},
 {...task,id:'study',item_type:'activity'}, {...task,id:'old',start_date:'2020-01-01',end_date:'2020-01-02',status:'waiting'},
 {...task,id:'deleted',deleted:true},{...task,id:'archived',archived:true},{...task,id:'other',project_id:'other'}];
 const j=m.journey({id},rows);assert.equal(j.items.length,3);assert.deepEqual(Array.from(j.stages,t=>t.id),['old','study','later']);assert.equal(j.current[0].id,'study');assert.equal(j.complete,false);
 assert.equal(j.items[0].status,'waiting','past date does not mean complete');
 assert.equal(m.journey({id},[]).complete,false);assert.equal(m.journey({id},[{...task,status:'done'}]).complete,true);
 assert.equal(m.journey({id},[task]).stages.length,1,'ordinary tasks always appear');
 for(const category of ['여행','자격증'])for(const item_type of ['task','activity','event'])assert.deepEqual(Array.from(m.journey({id,category},rows.map(t=>t.id==='study'?{...t,item_type}:t)).stages,t=>t.id),['old','study','later']);
 assert.equal(rows[0].id,'later','source array is not mutated');
});
test('detail notes remain multiline plain text and render escaped in dashboard',async()=>{
 const note='1. 기출 풀기\n2. <img src=x onerror=alert(1)> 복습';
 assert.equal(m.normalize('task',{...task,note}).note,note);
 assert.equal(m.normalize('task',m.completionInput({...task,note},true)).note,note);
 const ui=await source('js/features/projectManager.js');assert.ok(ui.includes('메모 · 세부 할 일'));assert.ok(ui.includes('class="pm-item-note">${esc(t.note)}'));
});
test('inline completion preserves metadata and reopens consistently',()=>{
 const base={...task,item_type:'activity',calendar_mode:'hidden',note:'keep',archived:false};
 const done=m.normalize('task',m.completionInput(base,true));assert.equal(done.status,'done');assert.equal(done.progress,100);assert.equal(done.note,'keep');assert.equal(done.calendar_mode,'hidden');assert.equal(done.start_date,base.start_date);
 const reopened=m.normalize('task',m.completionInput(done,false));assert.equal(reopened.status,'doing');assert.equal(reopened.progress,0);assert.equal(base.progress,50);
});
test('Gantt fits whole project duration and supports bounded month/week axes',()=>{
 const rows=[{...task,start_date:'2026-01-15',end_date:'2027-05-20'},task];
 const all=m.ganttRange(rows,'2026-09-29');assert.equal(m.date(all.start),'2026-01-15');assert.equal(m.date(all.end),'2027-05-20');assert.equal(all.ticks.length,8);
 const week=m.ganttRange(rows,'2026-09-29','week');assert.equal(m.date(week.start),'2026-09-28');assert.equal(week.span,7);
 assert.equal(m.date(m.ganttRange(rows,'2026-09-29','week',1).start),'2026-10-05');
 const month=m.ganttRange(rows,'2024-01-31','month',1);assert.equal(m.date(month.start),'2024-02-01');assert.equal(month.span,29);
 assert.equal(m.date(m.ganttRange(rows,'2026-12-29','month',1).start),'2027-01-01');
 assert.equal(m.ganttRange([],'2026-09-29').span,7);
 assert.equal(m.ganttRange([{...task,end_date:task.start_date}],'2026-09-29').span,1);
 assert.ok(m.ganttRange([{...task,start_date:'1900-01-01',end_date:'2200-12-31'}],'2026-09-29').ticks.length<=8);
 assert.equal(new Set(m.categories.map(m.categoryKey)).size,5);assert.equal(m.categoryKey('unknown'),'personal');
});
test('project/task validation preserves local dates and consistent progress',()=>{
 assert.equal(m.normalize('project',{name:' Test ',category:'개인'}).name,'Test');
 assert.throws(()=>m.normalize('project',{name:'x',category:'bad'}));
 assert.equal(m.normalize('task',{...task,status:'done'}).progress,100);
 assert.equal(m.normalize('task',{...task,status:'waiting'}).progress,0);
 for(const patch of [{start_date:'2026-02-30'},{end_date:'2026-09-27'},{progress:NaN},{progress:100},{progress:''},{milestone:true},{project_id:'bad'},{status:'bad'}])assert.throws(()=>m.normalize('task',{...task,...patch}));
 assert.equal(m.normalize('task',{...task,milestone:true,end_date:task.start_date}).milestone,true);
 assert.equal(m.date(m.day('2024-02-29')+1),'2024-03-01');
});
test('overview isolates projects, archives, completed work and week/deadline boundaries',()=>{
 const projects=[{id,name:'P'},{id:'other',archived:true},{id:'empty'}];
 const rows=[{...task,id:'a'},{...task,id:'b',status:'done',progress:100},{...task,id:'c',archived:true},{...task,id:'d',project_id:'other'},
 {...task,id:'late',start_date:'2026-09-01',end_date:'2026-09-27',progress:0},{...task,id:'future',start_date:'2026-10-06',end_date:'2026-10-06'}];
 const o=m.overview(projects,rows,'2026-09-29');assert.equal(o.weekStart,'2026-09-28');assert.equal(o.tasks.length,4);assert.equal(o.week.length,1);assert.equal(o.overdue.length,1);assert.equal(o.due.length,2);assert.equal(o.projects[0].progress,50);assert.equal(o.projects[1].progress,null);
 assert.equal(m.overview(projects,rows,'2026-10-04').weekStart,'2026-09-28');assert.equal(m.overview(projects,rows,'2026-09-29','empty').tasks.length,0);
});
test('item types separate calendar dates from activity progress and Gantt data',()=>{
 assert.equal(m.normalize('task',task).calendar_mode,'deadline');
 const activity=m.normalize('task',{...task,item_type:'activity'});
 assert.equal(activity.calendar_mode,'hidden');
 assert.equal(m.calendarIncludes(activity,'2026-09-29'),false);
 const deadline={...activity,calendar_mode:'deadline'};
 assert.equal(m.calendarIncludes(deadline,'2026-09-29'),false);
 assert.equal(m.calendarIncludes(deadline,'2026-09-30'),true);
 for(const date of ['2026-09-28','2026-09-29','2026-09-30'])assert.equal(m.calendarIncludes({...activity,calendar_mode:'full'},date),true);
 assert.equal(m.calendarIncludes({...activity,calendar_mode:'full'},'2026-10-01'),false);
 assert.equal(m.calendarIncludes({...deadline,archived:true},deadline.end_date),false);
 assert.equal(m.calendarIncludes(task,'2026-09-29'),true,'legacy retains full-period display');
 const event=m.normalize('task',{...task,item_type:'event',end_date:task.start_date});
 assert.equal(event.milestone,true);assert.equal(event.calendar_mode,'deadline');
 for(const patch of [{item_type:'event'},{item_type:'invalid'},{calendar_mode:'invalid'}])assert.throws(()=>m.normalize('task',{...task,...patch}));
 const summary=m.overview([{id}],[activity],'2026-09-29');
 assert.equal(summary.tasks.length,1);assert.equal(summary.week.length,1);assert.equal(summary.projects[0].progress,50);
});
test('store scopes updates, detects conflicts and rejects account switch',async()=>{
 let userId='a',response={data:[],error:null},filters=[];
 const query={eq(k,v){filters.push([k,v]);return this;},select(){return Promise.resolve(response);}};
 const client={from(table){assert.equal(table,'personal_project_tasks');return {update(){return query;},insert(){return query;}};}};
 const store=c.ProjectStore.create(()=>({client,userId}));
 await assert.rejects(()=>store.save('task',task,{id:'t',version:2}),/다른 기기/);assert.deepEqual(filters,[['user_id','a'],['id','t'],['version',2]]);
 response={data:null,error:{message:'offline'}};await assert.rejects(()=>store.save('task',task,null,id),/저장하지 못/);
 query.select=()=>{userId='b';return Promise.resolve({data:[{id:'t'}],error:null});};await assert.rejects(()=>store.save('task',task,null,id),/계정이 변경/);
 userId='';await assert.rejects(()=>store.list(),/로그인/);
});
test('trash uses owner/version guards, partial updates and excludes deleted records from displays',async()=>{
 let userId='a',payload,filters=[],response={data:[{...task,id:'t',deleted:true,archived:true,version:2}],error:null};
 const q={update(p){payload=p;return this;},eq(k,v){filters.push([k,v]);return this;},select(){return Promise.resolve(response);}};
 const store=c.ProjectStore.create(()=>({userId,client:{from(){return q;}}}));
 const deleted=await store.trash({id:'t',version:1},true);
 assert.deepEqual(JSON.parse(JSON.stringify(payload)),{deleted:true,archived:true});assert.deepEqual(filters,[['user_id','a'],['id','t'],['version',1]]);
 assert.equal(m.overview([{id}],[deleted],'2026-09-29').tasks.length,0);assert.equal(m.calendarIncludes(deleted,task.end_date),false);
 response={data:[],error:null};await assert.rejects(()=>store.trash(deleted,false),/다른 기기/);
 response={data:null,error:{message:'offline'}};await assert.rejects(()=>store.trash(deleted,false),/변경하지 못/);
 q.select=()=>{userId='b';return Promise.resolve({data:[task],error:null});};await assert.rejects(()=>store.trash(deleted,false),/계정이 변경/);
 userId='';await assert.rejects(()=>store.trash(deleted,false),/로그인/);
});
test('project schema enforces owner isolation, composite references, versions and recoverable archives',async()=>{
 const db=new PGlite(),a=id,b='20000000-0000-0000-0000-000000000002';
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${a}'),('${b}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated;`);
  await db.exec(await source('supabase/migrations/20260929090000_project_management.sql'));
  await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${a}',false)`);
  const p=(await db.query("insert into personal_projects(name,category) values('P','개인') returning id")).rows[0].id;
  const t=(await db.query("insert into personal_project_tasks(project_id,title,start_date,end_date) values($1,'T','2026-09-29','2026-09-30') returning id",[p])).rows[0].id;
  await db.exec('reset role');
  await db.exec(await source('supabase/migrations/20260929100000_project_calendar_types.sql'));
  await db.exec(await source('supabase/migrations/20260930090000_project_task_trash.sql'));
  await db.exec(await source('supabase/migrations/20260930100000_project_trash.sql'));
  await db.exec('set role authenticated');
  const migrated=(await db.query('select item_type,calendar_mode,version from personal_project_tasks where id=$1',[t])).rows[0];
  assert.deepEqual(migrated,{item_type:'task',calendar_mode:'full',version:1});
  await assert.rejects(()=>db.query('update personal_project_tasks set deleted=true where id=$1',[t]),/check constraint/);
  await db.query('update personal_project_tasks set deleted=true,archived=true where id=$1',[t]);
  assert.equal((await db.query('select deleted from personal_project_tasks where id=$1',[t])).rows[0].deleted,true);
  await db.query('update personal_project_tasks set deleted=false,archived=false where id=$1',[t]);
  await assert.rejects(()=>db.query("update personal_project_tasks set item_type='invalid' where id=$1",[t]),/check constraint/);
  await assert.rejects(()=>db.query("update personal_project_tasks set calendar_mode='invalid' where id=$1",[t]),/check constraint/);
  await assert.rejects(()=>db.query("update personal_project_tasks set item_type='event' where id=$1",[t]),/check constraint/);
  await db.query("update personal_project_tasks set item_type='activity',calendar_mode='hidden' where id=$1",[t]);
  await assert.rejects(()=>db.query("update personal_project_tasks set progress=50 where id=$1",[t]),/check constraint/);
  await assert.rejects(()=>db.query("update personal_project_tasks set end_date='2026-09-28' where id=$1",[t]),/check constraint/);
  await assert.rejects(()=>db.query("update personal_project_tasks set milestone=true where id=$1",[t]),/check constraint/);
  assert.equal((await db.query('update personal_projects set archived=true where id=$1 and version=1 returning version',[p])).rows[0].version,2);
  assert.equal((await db.query('update personal_projects set archived=false where id=$1 and version=1 returning id',[p])).rows.length,0);
  await db.query('update personal_projects set archived=false where id=$1 and version=2',[p]);
  const childBefore=(await db.query('select * from personal_project_tasks where id=$1',[t])).rows[0];
  await assert.rejects(()=>db.query('update personal_projects set deleted=true where id=$1',[p]),/check constraint/);
  await db.query('update personal_projects set deleted=true,archived=true where id=$1 and version=3',[p]);
  assert.equal((await db.query('select deleted from personal_projects where id=$1',[p])).rows[0].deleted,true);
  assert.equal((await db.query('update personal_projects set deleted=false,archived=false where id=$1 and version=3 returning id',[p])).rows.length,0);
  await db.query('update personal_projects set deleted=false,archived=false where id=$1 and version=4',[p]);
  assert.deepEqual((await db.query('select * from personal_project_tasks where id=$1',[t])).rows[0],childBefore);
  await db.exec(`select set_config('request.jwt.claim.sub','${b}',false)`);
  assert.equal((await db.query('select * from personal_projects')).rows.length,0);assert.equal((await db.query('select * from personal_project_tasks')).rows.length,0);
  await assert.rejects(()=>db.query("insert into personal_project_tasks(project_id,title,start_date,end_date) values($1,'foreign','2026-09-29','2026-09-30')",[p]),/foreign key/);
  await assert.rejects(()=>db.query("insert into personal_projects(user_id,name,category) values($1,'bad','개인')",[a]),/row-level security/);
  await assert.rejects(()=>db.query('delete from personal_projects'),/permission denied/);
  await db.exec('reset role;set role anon');await assert.rejects(()=>db.query('select * from personal_project_tasks'),/permission denied/);
 }finally{await db.close();}
});
test('project trash scopes parent writes and restores only originally active children',async()=>{
 const children=[{...task,id:'active'},{...task,id:'archived',archived:true},{...task,id:'deleted',archived:true,deleted:true}];
 assert.equal(m.overview([{id,deleted:true,archived:true}],children,'2026-09-30').tasks.length,0);
 assert.equal(m.overview([{id}],children,'2026-09-30').tasks.length,1);
 let table,filters=[],payload,response={data:[{id,deleted:true,archived:true,version:2}],error:null};
 const q={update(p){payload=p;return this;},eq(k,v){filters.push([k,v]);return this;},select(){return Promise.resolve(response);}};
 const store=c.ProjectStore.create(()=>({userId:'owner',client:{from(t){table=t;return q;}}}));
 await store.trash({id,version:1},true,'project');assert.equal(table,'personal_projects');assert.deepEqual(filters,[['user_id','owner'],['id',id],['version',1]]);
 assert.deepEqual(JSON.parse(JSON.stringify(payload)),{deleted:true,archived:true});
 response={data:[],error:null};await assert.rejects(()=>store.trash({id,version:1},false,'project'),/다른 기기/);
 await assert.rejects(()=>store.trash({id,version:1},false,'unknown'),/지원하지/);
});
test('Project navigation and private lifecycle stay independent of retired project mock',async()=>{
 const html=await source('index.html'),shell=await source('js/features/appShell.js'),core=await source('js/features/appCore.js'),ui=await source('js/features/projectManager.js');
 for(const s of ['data-target="project-manager-view"','data-mobile-nav-target="project-manager-view"','id="project-manager-view"','project-manager.css','projectModel.js','projectStore.js','projectManager.js'])assert.ok(html.includes(s),s);
 assert.ok(shell.includes("get('view') === 'project'"));assert.ok(core.includes('window.ProjectManager?.reset()'));
 assert.match(html, /data-nav-group="project"[^]*?프로젝트 도구[^]*?data-target="project-manager-view"/);
 assert.match(html, /data-mobile-nav-group="project"[^]*?프로젝트 도구[^]*?data-mobile-nav-target="project-manager-view"/);
 assert.equal((html.match(/data-target="project-manager-view"/g)||[]).length,1);
 assert.equal((html.match(/data-mobile-nav-target="project-manager-view"/g)||[]).length,1);
 assert.ok(shell.includes("'project-manager-view': { label: '프로젝트 도구'"));
 assert.ok(ui.includes('token!==generation'));assert.ok(ui.includes('esc(t.title)'));assert.ok(ui.includes('Google Calendar 연동 전'));assert.ok(ui.includes('showModal()'));
});
