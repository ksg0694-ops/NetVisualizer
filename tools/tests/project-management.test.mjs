import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const source=p=>readFile(new URL('../../'+p,import.meta.url),'utf8');
const c=vm.createContext({});vm.runInContext(await source('js/features/projectModel.js'),c);vm.runInContext(await source('js/features/projectStore.js'),c);
const m=c.ProjectModel,id='10000000-0000-0000-0000-000000000001';
const task={project_id:id,title:'Task',start_date:'2026-09-28',end_date:'2026-09-30',status:'doing',progress:50,priority:'high',milestone:false};
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
  await db.exec('set role authenticated');
  const migrated=(await db.query('select item_type,calendar_mode,version from personal_project_tasks where id=$1',[t])).rows[0];
  assert.deepEqual(migrated,{item_type:'task',calendar_mode:'full',version:1});
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
  await db.exec(`select set_config('request.jwt.claim.sub','${b}',false)`);
  assert.equal((await db.query('select * from personal_projects')).rows.length,0);assert.equal((await db.query('select * from personal_project_tasks')).rows.length,0);
  await assert.rejects(()=>db.query("insert into personal_project_tasks(project_id,title,start_date,end_date) values($1,'foreign','2026-09-29','2026-09-30')",[p]),/foreign key/);
  await assert.rejects(()=>db.query("insert into personal_projects(user_id,name,category) values($1,'bad','개인')",[a]),/row-level security/);
  await assert.rejects(()=>db.query('delete from personal_projects'),/permission denied/);
  await db.exec('reset role;set role anon');await assert.rejects(()=>db.query('select * from personal_project_tasks'),/permission denied/);
 }finally{await db.close();}
});
test('Project navigation and private lifecycle stay independent of retired project mock',async()=>{
 const html=await source('index.html'),shell=await source('js/features/appShell.js'),core=await source('js/features/appCore.js'),ui=await source('js/features/projectManager.js');
 for(const s of ['data-target="project-manager-view"','data-mobile-nav-target="project-manager-view"','id="project-manager-view"','project-manager.css','projectModel.js','projectStore.js','projectManager.js'])assert.ok(html.includes(s),s);
 assert.ok(shell.includes("get('view') === 'project'"));assert.ok(core.includes('window.ProjectManager?.reset()'));
 assert.ok(ui.includes('token!==generation'));assert.ok(ui.includes('esc(t.title)'));assert.ok(ui.includes('Google Calendar 연동 전'));assert.ok(ui.includes('showModal()'));
});
