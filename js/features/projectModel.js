(function(root){
 'use strict';
 const categories=['커리어','자격증','자산','여행','개인'];
 const statuses={waiting:'대기',doing:'진행',done:'완료'}, priorities={high:'높음',normal:'보통',low:'낮음'};
 const day=s=>typeof s==='string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && s>='1900-01-01' && s<='2200-12-31' && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0,10)===s ? Date.parse(s)/86400000 : NaN;
 const date=n=>new Date(n*86400000).toISOString().slice(0,10);
 function text(s,max,label){s=String(s??'').trim();if(!s||s.length>max)throw Error(`${label}을 확인해 주세요 (최대 ${max}자).`);return s;}
 function normalize(kind,input){
  const note=String(input.note??'').trim();if(note.length>2000)throw Error('메모는 2,000자까지 입력할 수 있습니다.');
  const common={note,archived:input.archived===true};
  if(kind==='project'){
   if(!categories.includes(input.category))throw Error('프로젝트 분류를 선택해 주세요.');
   return {...common,name:text(input.name,100,'프로젝트 이름'),category:input.category};
  }
  if(kind!=='task')throw Error('지원하지 않는 항목입니다.');
  const {start_date,end_date,status,priority}=input;
  if(!Number.isFinite(day(start_date))||!Number.isFinite(day(end_date))||end_date<start_date)throw Error('시작일과 종료일을 확인해 주세요.');
  if(!Object.hasOwn(statuses,status)||!Object.hasOwn(priorities,priority))throw Error('상태와 우선순위를 확인해 주세요.');
  if(input.progress===''||input.progress==null||!Number.isInteger(Number(input.progress))||Number(input.progress)<0||Number(input.progress)>100)throw Error('진행률은 0~100 사이 정수입니다.');
  if(!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(input.project_id||''))throw Error('프로젝트를 선택해 주세요.');
  const progress=status==='done'?100:status==='waiting'?0:Number(input.progress);
  if(status==='doing'&&progress===100)throw Error('100%인 할 일은 완료 상태로 변경해 주세요.');
  if(input.milestone===true&&start_date!==end_date)throw Error('마일스톤의 시작일과 종료일은 같은 날짜로 지정해 주세요.');
  return {...common,project_id:input.project_id,title:text(input.title,160,'할 일 이름'),start_date,end_date,status,priority,progress,milestone:input.milestone===true};
 }
 function overview(projects,tasks,today,selected='all'){
  const list=projects.filter(p=>!p.archived&&(selected==='all'||p.id===selected)),ids=new Set(list.map(p=>p.id));
  const active=tasks.filter(t=>!t.archived&&ids.has(t.project_id)).sort((a,b)=>a.end_date.localeCompare(b.end_date)||a.title.localeCompare(b.title,'ko'));
  const now=day(today),weekday=new Date(now*86400000).getUTCDay(),monday=now-(weekday+6)%7;
  return {projects:list.map(p=>{const own=active.filter(t=>t.project_id===p.id);return {...p,total:own.length,done:own.filter(t=>t.status==='done').length,progress:own.length?Math.round(own.reduce((n,t)=>n+t.progress,0)/own.length):null};}),tasks:active,
   week:active.filter(t=>t.status!=='done'&&day(t.start_date)<=monday+6&&day(t.end_date)>=monday),
   due:active.filter(t=>t.status!=='done'&&day(t.end_date)>=now&&day(t.end_date)<=now+7),
   overdue:active.filter(t=>t.status!=='done'&&day(t.end_date)<now),weekStart:date(monday)};
 }
 root.ProjectModel=Object.freeze({categories,statuses,priorities,day,date,normalize,overview});
})(globalThis);
