(function(root){
 'use strict';
 const M=root.ProjectModel,store=root.ProjectStore.create(()=>root.getProjectContext());
 const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
 let projects=[],tasks=[],owner='',generation=0,busy=false,loaded=false,tab='dashboard',selected='all',offset=0,month='',edit=null,returnFocus=null;
 const today=()=>root.AppUtils.toLocalDateString();
 const empty=label=>`<p class="pm-empty">${label}</p>`;
 function notify(text,error=false){$('pm-message').textContent=text;$('pm-message').dataset.error=String(error);}
 function mount(container){
  container.innerHTML=`<div class="pm-toolbar"><div class="pm-filter"><label for="pm-project">프로젝트</label><select id="pm-project"><option value="all">전체</option></select></div><div class="pm-actions"><button id="pm-refresh">새로고침</button><button id="pm-add-project">+ 프로젝트</button><button id="pm-add-task" class="pm-primary">+ 할 일</button></div></div>
   <p id="pm-message" role="status" aria-live="polite"></p><div class="pm-tabs" role="tablist" aria-label="Project 보기">${[['dashboard','Dashboard'],['gantt','Gantt'],['tasks','Tasks'],['calendar','Calendar']].map(([id,label])=>`<button role="tab" id="pm-tab-${id}" data-tab="${id}" aria-controls="pm-panel" aria-selected="${id===tab}">${label}</button>`).join('')}</div>
   <div id="pm-panel" role="tabpanel" aria-labelledby="pm-tab-dashboard"></div>
   <dialog id="pm-dialog" aria-labelledby="pm-dialog-title"><form id="pm-form"><div class="pm-dialog-heading"><h3 id="pm-dialog-title"></h3><button type="button" id="pm-close" aria-label="닫기">×</button></div><fieldset id="pm-fields"></fieldset><p id="pm-form-error" role="alert"></p><div class="pm-actions"><button type="button" id="pm-cancel">취소</button><button type="submit" class="pm-primary" id="pm-save">저장</button></div></form></dialog>`;
  $('pm-project').onchange=e=>{selected=e.target.value;draw();};
  $('pm-add-project').onclick=()=>open('project');$('pm-add-task').onclick=()=>open('task');$('pm-refresh').onclick=load;
  container.querySelectorAll('[data-tab]').forEach(b=>{b.onclick=()=>{tab=b.dataset.tab;draw();};b.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const ids=['dashboard','gantt','tasks','calendar'];let i=ids.indexOf(tab);i=e.key==='Home'?0:e.key==='End'?3:(i+(e.key==='ArrowLeft'?-1:1)+4)%4;tab=ids[i];draw();$(`pm-tab-${tab}`).focus();};});
  $('pm-close').onclick=close;$('pm-cancel').onclick=close;$('pm-form').onsubmit=save;
  $('pm-dialog').oncancel=e=>{e.preventDefault();close();};
 }
 function controls(){
  const disabled=busy||!!edit||!owner||!loaded;
  for(const id of ['pm-add-project','pm-add-task'])$(id).disabled=disabled||(id==='pm-add-task'&&!projects.some(p=>!p.archived));
  $('pm-refresh').disabled=busy||!!edit||!owner;
  $('pm-fields').disabled=busy;$('pm-save').disabled=busy;$('pm-close').disabled=busy;$('pm-cancel').disabled=busy;
  $('pm-panel').querySelectorAll('[data-edit]').forEach(b=>b.disabled=disabled);
 }
 function taskRow(t){const p=projects.find(p=>p.id===t.project_id);return `<button class="pm-task-row" data-edit="task" data-id="${esc(t.id)}"><span class="pm-task-name">${t.milestone?'◆ ':''}${esc(t.title)}<small>${esc(p?.name)} · ${t.start_date} → ${t.end_date}</small></span><span class="pm-task-meta"><span class="pm-status pm-${t.status}">${M.statuses[t.status]}</span><span>${t.progress}%</span><span class="pm-priority-${t.priority}">${M.priorities[t.priority]}</span></span></button>`;}
 function taskList(list){return list.length?list.map(taskRow).join(''):empty('해당하는 할 일이 없습니다.');}
 function dashboard(data){return `<div class="pm-stats">${[['프로젝트',data.projects.length],['이번 주',data.week.length],['7일 내 마감',data.due.length],['기한 지남',data.overdue.length]].map(([label,value])=>`<div><span>${label}</span><strong>${value}</strong></div>`).join('')}</div>
  <div class="pm-project-grid">${data.projects.map(p=>`<article class="pm-project-card"><div class="pm-card-title"><span class="pm-category">${esc(p.category)}</span><button data-edit="project" data-id="${esc(p.id)}" aria-label="${esc(p.name)} 프로젝트 수정">수정</button></div><h3>${esc(p.name)}</h3><div class="pm-progress-line"><progress value="${p.progress??0}" max="100" aria-label="${esc(p.name)} 진행률"></progress><strong>${p.progress==null?'—':`${p.progress}%`}</strong></div><small>완료 ${p.done} / ${p.total}</small>${p.note?`<p class="pm-project-note">${esc(p.note)}</p>`:''}</article>`).join('')||empty('첫 프로젝트를 추가해 보세요.')}</div>
  <div class="pm-dashboard-grid"><section class="pm-card"><h3>이번 주 할 일</h3>${taskList(data.week)}</section><section class="pm-card"><h3>마감 임박 · 기한 지남</h3>${taskList([...data.overdue,...data.due])}</section></div>`;}
 function gantt(data){
  const start=M.day(data.weekStart)+offset*7,days=Array.from({length:14},(_,i)=>M.date(start+i));
  const list=data.tasks.filter(t=>M.day(t.start_date)<=start+13&&M.day(t.end_date)>=start);
  return `<div class="pm-period"><button data-shift="-1" aria-label="이전 주">‹</button><strong>${days[0]} ~ ${days[13]}</strong><button data-shift="1" aria-label="다음 주">›</button><button data-current>이번 주</button></div><div class="pm-gantt-scroll"><div class="pm-gantt"><div class="pm-gantt-head"><span>할 일 · 마감</span><div>${days.map(d=>`<span class="${d===today()?'pm-today':''}">${d.slice(5).replace('-','/')}</span>`).join('')}</div></div>${list.map(t=>{const left=Math.max(0,M.day(t.start_date)-start),right=Math.min(13,M.day(t.end_date)-start);return `<div class="pm-gantt-row"><button data-edit="task" data-id="${esc(t.id)}">${esc(t.title)}<small>${t.end_date} · ${M.statuses[t.status]}</small></button><div class="pm-gantt-track"><button class="pm-bar pm-${t.status}" style="grid-column:${left+1}/${right+2}" data-edit="task" data-id="${esc(t.id)}" aria-label="${esc(t.title)} ${t.start_date}부터 ${t.end_date}까지 ${t.progress}%"><span>${t.milestone?'◆':`${t.progress}%`}</span></button></div></div>`;}).join('')}</div></div>${list.length?'':empty('이 기간의 일정이 없습니다.')}<p class="pm-footnote">◆ 마일스톤 · 막대를 누르면 수정</p>`;
 }
 function calendar(data){
  if(!month)month=today().slice(0,7);const first=M.day(`${month}-01`),weekday=new Date(first*86400000).getUTCDay(),start=first-(weekday+6)%7;
  return `<div class="pm-period"><button data-month="-1" aria-label="이전 달">‹</button><strong>${month.replace('-','년 ')}월</strong><button data-month="1" aria-label="다음 달">›</button><button data-month-current>이번 달</button></div><div class="pm-calendar-scroll"><div class="pm-calendar">${['월','화','수','목','금','토','일'].map(d=>`<div class="pm-day-name">${d}</div>`).join('')}${Array.from({length:42},(_,i)=>{const date=M.date(start+i),items=data.tasks.filter(t=>t.start_date<=date&&t.end_date>=date);return `<section class="pm-day${date===today()?' pm-today':''}${!date.startsWith(month)?' pm-other-month':''}" aria-label="${date}"><strong>${Number(date.slice(8))}</strong>${items.map(t=>`<button class="pm-calendar-task pm-${t.status}" data-edit="task" data-id="${esc(t.id)}" title="${esc(t.title)} · ${t.end_date} 마감">${t.milestone?'◆ ':''}${esc(t.title)}${date===t.end_date?' · 마감':''}</button>`).join('')}</section>`;}).join('')}</div></div><p class="pm-footnote">앱 내부 일정 · Google Calendar 연동 전</p>`;
 }
 function taskPage(data){const archivedProjects=projects.filter(p=>p.archived),archived=tasks.filter(t=>t.archived&&(selected==='all'||t.project_id===selected));return `<section class="pm-card"><h3>할 일 ${data.tasks.length}</h3>${taskList(data.tasks)}</section><details class="pm-archive"><summary>보관함 · 프로젝트 ${archivedProjects.length} / 할 일 ${archived.length}</summary>${archivedProjects.map(p=>`<button class="pm-task-row" data-edit="project" data-id="${esc(p.id)}">${esc(p.name)}<span>복원 / 수정</span></button>`).join('')}${taskList(archived)}</details>`;}
 function draw(){
  const select=$('pm-project');if(selected!=='all'&&!projects.some(p=>p.id===selected&&!p.archived))selected='all';
  select.innerHTML='<option value="all">전체</option>'+projects.filter(p=>!p.archived).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');select.value=selected;
  document.querySelectorAll('#project-manager-view [data-tab]').forEach(b=>{b.setAttribute('aria-selected',String(b.dataset.tab===tab));b.tabIndex=b.dataset.tab===tab?0:-1;});
  $('pm-panel').setAttribute('aria-labelledby',`pm-tab-${tab}`);
  if(!owner||!loaded){$('pm-panel').innerHTML=empty(!owner?'로그인 후 프로젝트를 관리할 수 있습니다.':busy?'프로젝트를 불러오는 중입니다.':'목록을 불러오려면 새로고침을 눌러주세요.');controls();return;}
  const data=M.overview(projects,tasks,today(),selected);
  $('pm-panel').innerHTML=tab==='dashboard'?dashboard(data)+`<section class="pm-dashboard-gantt"><h3>주간 Gantt</h3>${gantt(data)}</section>`:tab==='gantt'?gantt(data):tab==='calendar'?calendar(data):taskPage(data);
  $('pm-panel').querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>open(b.dataset.edit,(b.dataset.edit==='project'?projects:tasks).find(r=>r.id===b.dataset.id)));
  $('pm-panel').querySelectorAll('[data-shift]').forEach(b=>b.onclick=()=>{offset+=Number(b.dataset.shift);draw();});
  $('pm-panel').querySelector('[data-current]')?.addEventListener('click',()=>{offset=0;draw();});
  $('pm-panel').querySelectorAll('[data-month]').forEach(b=>b.onclick=()=>{const d=new Date(`${month}-01T00:00:00Z`);d.setUTCMonth(d.getUTCMonth()+Number(b.dataset.month));const next=d.toISOString().slice(0,7);if(next>='1900-01'&&next<='2200-12')month=next;draw();});
  $('pm-panel').querySelector('[data-month-current]')?.addEventListener('click',()=>{month=today().slice(0,7);draw();});controls();
 }
 function open(kind,row=null){
  if(busy||edit||!loaded||!owner)return;
  returnFocus=document.activeElement;edit={kind,base:row?{...row}:null,id:root.crypto.randomUUID()};
  const p=row||{category:'개인',project_id:selected!=='all'?selected:projects.find(p=>!p.archived)?.id,start_date:today(),end_date:today(),status:'waiting',progress:0,priority:'normal'};
  const options=(values,value)=>values.map(([key,label])=>`<option value="${esc(key)}"${key===value?' selected':''}>${esc(label)}</option>`).join('');
  $('pm-dialog-title').textContent=`${kind==='project'?'프로젝트':'할 일'} ${row?'수정':'추가'}`;
  $('pm-fields').innerHTML=kind==='project'?`<label>프로젝트 이름<input name="name" maxlength="100" required value="${esc(p.name)}"></label><label>분류<select name="category">${options(M.categories.map(c=>[c,c]),p.category)}</select></label>`:`<label>프로젝트<select name="project_id" required>${options(projects.filter(r=>!r.archived||r.id===p.project_id).map(r=>[r.id,`${r.name}${r.archived?' (보관됨)':''}`]),p.project_id)}</select></label><label>할 일<input name="title" maxlength="160" required value="${esc(p.title)}"></label><div class="pm-form-grid"><label>시작일<input type="date" name="start_date" min="1900-01-01" max="2200-12-31" required value="${p.start_date}"></label><label>종료일<input type="date" name="end_date" min="1900-01-01" max="2200-12-31" required value="${p.end_date}"></label><label>상태<select name="status">${options(Object.entries(M.statuses),p.status)}</select></label><label>진행률 %<input type="number" name="progress" min="0" max="100" step="1" required value="${p.progress}"></label><label>우선순위<select name="priority">${options(Object.entries(M.priorities),p.priority)}</select></label><label class="pm-check"><input type="checkbox" name="milestone"${p.milestone?' checked':''}> 마일스톤 (하루 일정)</label></div>`;
  $('pm-fields').insertAdjacentHTML('beforeend',`<label>메모<textarea name="note" maxlength="2000" rows="3">${esc(p.note)}</textarea></label>${row?`<label class="pm-check"><input type="checkbox" name="archived"${p.archived?' checked':''}> 보관${kind==='project'?' (소속 할 일도 기본 화면에서 숨김)':''}</label>`:''}`);
  const form=$('pm-form');if(kind==='task'){form.elements.status.onchange=()=>{if(form.elements.status.value==='done')form.elements.progress.value=100;else if(form.elements.status.value==='waiting'||form.elements.progress.value==='100')form.elements.progress.value=0;};}
  $('pm-form-error').textContent='';controls();$('pm-dialog').showModal();$('pm-fields').querySelector('input,select').focus();
 }
 function close(){if(busy)return;edit=null;$('pm-dialog').close();controls();if(returnFocus?.isConnected)returnFocus.focus();else $('pm-add-project').focus();}
 async function save(event){
  event.preventDefault();if(busy||!edit)return;
  const input=Object.fromEntries(new FormData($('pm-form')));input.archived=input.archived==='on';input.milestone=input.milestone==='on';
  const token=generation,current=edit;busy=true;controls();$('pm-form-error').textContent='';
  try{const result=await store.save(current.kind,input,current.base,current.id);if(token!==generation)return;
   if(current.kind==='project')projects=[...projects.filter(p=>p.id!==result.id),result];else tasks=[...tasks.filter(t=>t.id!==result.id),result];
   busy=false;close();draw();notify('저장했습니다.');
  }catch(error){if(token===generation)$('pm-form-error').textContent=error.message;}
  finally{if(token===generation){busy=false;controls();}}
 }
 async function load(){
  if(busy||edit||!owner)return;const token=generation;busy=true;controls();notify('불러오는 중…');
  try{const data=await store.list();if(token!==generation)return;projects=data.projects;tasks=data.tasks;loaded=true;notify('');draw();}
  catch(error){if(token===generation)notify(error.message,true);}
  finally{if(token===generation){busy=false;controls();}}
 }
 function reset(){generation++;$('pm-dialog')?.close();projects=[];tasks=[];owner='';loaded=false;busy=false;edit=null;selected='all';tab='dashboard';offset=0;month='';returnFocus=null;$('project-manager-view')?.replaceChildren();}
 function render(){const container=$('project-manager-view');if(!container||container.classList.contains('hidden'))return;const next=root.getProjectContext()?.userId||'';if(next!==owner)reset();owner=next;if(!$('pm-form'))mount(container);if(edit)return;draw();if(!loaded&&owner)load();}
 root.ProjectManager=Object.freeze({render,refresh:load,reset});
})(globalThis);
