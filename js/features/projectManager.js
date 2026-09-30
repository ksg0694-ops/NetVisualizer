(function(root){
 'use strict';
 const M=root.ProjectModel,store=root.ProjectStore.create(()=>root.getProjectContext());
 const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
 let projects=[],tasks=[],owner='',generation=0,busy=false,loaded=false,tab='dashboard',selected='all',offset=0,ganttMode='all',month='',edit=null,returnFocus=null;
 const today=()=>root.AppUtils.toLocalDateString();
 const expanded=new Set();let completedOpen=false;
 const iconNames={career:'briefcase',study:'award',assets:'wallet',travel:'plane',personal:'book'};
 const iconBase=new URL('../../assets/project-icons/',document.currentScript.src).href;
 const icon=name=>`<img src="${iconBase}${name}.svg" alt="" width="24" height="24" aria-hidden="true">`;
 const empty=label=>`<p class="pm-empty">${label}</p>`;
 function notify(text,error=false){$('pm-message').textContent=text;$('pm-message').dataset.error=String(error);}
 function mount(container){
  container.innerHTML=`<div class="pm-toolbar"><div class="pm-filter"><label for="pm-project">프로젝트</label><select id="pm-project"><option value="all">전체</option></select></div><div class="pm-actions"><button id="pm-refresh">새로고침</button><button id="pm-add-project">+ 프로젝트</button><button id="pm-add-task" class="pm-primary">+ 항목</button></div></div>
   <p id="pm-message" role="status" aria-live="polite"></p><div class="pm-tabs" role="tablist" aria-label="Project 보기">${[['dashboard','Dashboard'],['gantt','Gantt'],['tasks','Tasks'],['calendar','Calendar']].map(([id,label])=>`<button role="tab" id="pm-tab-${id}" data-tab="${id}" aria-controls="pm-panel" aria-selected="${id===tab}">${label}</button>`).join('')}</div>
   <div id="pm-panel" role="tabpanel" aria-labelledby="pm-tab-dashboard"></div>
   <dialog id="pm-dialog" aria-labelledby="pm-dialog-title"><form id="pm-form"><div class="pm-dialog-heading"><h3 id="pm-dialog-title"></h3><button type="button" id="pm-close" aria-label="닫기">×</button></div><fieldset id="pm-fields"></fieldset><p id="pm-form-error" role="alert"></p><div id="pm-delete-confirm" hidden><p>이 항목을 삭제할까요? 휴지통에서 복원할 수 있습니다. 저장하지 않은 수정은 반영되지 않습니다.</p><button type="button" id="pm-delete-yes">삭제 확인</button><button type="button" id="pm-delete-no">돌아가기</button></div><div class="pm-actions"><button type="button" id="pm-delete" class="pm-danger" hidden>삭제</button><button type="button" id="pm-cancel">취소</button><button type="submit" class="pm-primary" id="pm-save">저장</button></div></form></dialog>`;
  $('pm-project').onchange=e=>{selected=e.target.value;offset=0;draw();};
  $('pm-add-project').onclick=()=>open('project');$('pm-add-task').onclick=()=>open('task');$('pm-refresh').onclick=load;
  container.querySelectorAll('[data-tab]').forEach(b=>{b.onclick=()=>{tab=b.dataset.tab;draw();};b.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const ids=['dashboard','gantt','tasks','calendar'];let i=ids.indexOf(tab);i=e.key==='Home'?0:e.key==='End'?3:(i+(e.key==='ArrowLeft'?-1:1)+4)%4;tab=ids[i];draw();$(`pm-tab-${tab}`).focus();};});
  $('pm-delete').onclick=()=>{if(edit?.base?.deleted)changeTrash(false);else {$('pm-delete-confirm').hidden=false;$('pm-delete-yes').focus();}};
  $('pm-delete-yes').onclick=()=>changeTrash(true);$('pm-delete-no').onclick=()=>{$('pm-delete-confirm').hidden=true;$('pm-delete').focus();};
  $('pm-close').onclick=close;$('pm-cancel').onclick=close;$('pm-form').onsubmit=save;
  $('pm-dialog').oncancel=e=>{e.preventDefault();close();};
 }
 function controls(){
  const disabled=busy||!!edit||!owner||!loaded;
  for(const id of ['pm-add-project','pm-add-task'])$(id).disabled=disabled||(id==='pm-add-task'&&!projects.some(p=>!p.archived));
  $('pm-refresh').disabled=busy||!!edit||!owner;
  $('pm-fields').disabled=busy||!!edit?.base?.deleted;for(const id of ['pm-delete','pm-delete-yes','pm-delete-no'])$(id).disabled=busy;$('pm-save').disabled=busy;$('pm-close').disabled=busy;$('pm-cancel').disabled=busy;
  $('pm-panel').querySelectorAll('[data-edit],[data-complete],[data-add-to]').forEach(b=>b.disabled=disabled);
 }
 function taskRow(t){const p=projects.find(p=>p.id===t.project_id);return `<button class="pm-task-row pm-color-${M.categoryKey(p?.category)}" data-edit="task" data-id="${esc(t.id)}"><span class="pm-task-name">${t.milestone?'◆ ':''}${esc(t.title)}<small>${esc(p?.name)} · ${M.itemTypes[t.item_type??'task']} · ${t.start_date} → ${t.end_date}</small></span><span class="pm-task-meta"><span class="pm-status pm-${t.status}">${M.statuses[t.status]}</span><span>${t.progress}%</span><span class="pm-priority-${t.priority}">${M.priorities[t.priority]}</span></span></button>`;}
 function taskList(list){return list.length?list.map(taskRow).join(''):empty('해당하는 할 일이 없습니다.');}
 function dashboard(data){
  const rows=data.projects.map(p=>({p,...M.journey(p,data.tasks)}));
  const row=({p,items,stages,current,complete})=>`<details class="pm-journey pm-color-${M.categoryKey(p.category)}" data-project-row="${esc(p.id)}"${expanded.has(p.id)?' open':''}>
   <summary><span class="pm-project-identity"><span class="pm-project-icon">${icon(iconNames[M.categoryKey(p.category)])}</span><span><span class="pm-category">${esc(p.category)}</span><strong>${esc(p.name)}</strong></span></span>
   <span class="pm-steps" aria-label="등록 항목 진행 흐름">${stages.map(t=>`<span class="pm-step pm-step-${t.status}" title="${esc(t.title)} · ${M.statuses[t.status]}"><span class="pm-step-dot">${t.status==='done'?icon('check'):''}</span><span class="pm-step-label">${esc(t.title)}</span><span class="pm-sr-only">${M.statuses[t.status]}</span></span>`).join('')||'<span class="pm-journey-muted">항목을 추가해 보세요</span>'}</span>
   <span class="pm-current"><small>${complete?'진행 상태':'진행 중인 항목'}</small><strong>${complete?'완료':current.length?esc(current.map(t=>t.title).join(' · ')):'진행 중인 항목 없음'}</strong></span><span class="pm-chevron">${icon('chevron-down')}</span></summary>
   <div class="pm-journey-body"><div class="pm-journey-heading"><h3>진행 항목</h3><button data-edit="project" data-id="${esc(p.id)}" aria-label="${esc(p.name)} 프로젝트 수정">프로젝트 수정</button></div>
    <div class="pm-checklist">${items.map(t=>`<div class="pm-check-row${t.status==='done'?' is-done':''}"><input type="checkbox" data-complete="${esc(t.id)}" aria-label="${esc(t.title)} 완료"${t.status==='done'?' checked':''}><button data-edit="task" data-id="${esc(t.id)}">${esc(t.title)}</button><span class="pm-status pm-${t.status}">${M.statuses[t.status]}</span></div>`).join('')||empty('등록된 항목이 없습니다.')}</div>
    <button class="pm-add-inline" data-add-to="${esc(p.id)}">+ 항목</button></div></details>`;
  const active=rows.filter(r=>!r.complete),done=rows.filter(r=>r.complete);
  return `<div class="pm-journey-list">${active.map(row).join('')||(!rows.length?empty('첫 프로젝트를 추가해 보세요.'):'')}</div>${done.length?`<details class="pm-completed"${completedOpen?' open':''}><summary>완료된 프로젝트</summary><div class="pm-journey-list">${done.map(row).join('')}</div></details>`:''}`;
 }
 function gantt(data){
  const range=M.ganttRange(data.tasks,today(),ganttMode,offset),{start,end,span,ticks}=range;
  const list=data.tasks.filter(t=>M.day(t.start_date)<=end&&M.day(t.end_date)>=start),now=M.day(today()),todayPos=(now-start+.5)/span*100;
  const axis=ticks.map(t=>`<span style="left:${t.position}%">${span>365?t.date.slice(0,7):t.date.slice(5).replace('-','/')}</span>`).join('');
  const groups=data.projects.map(p=>{const own=list.filter(t=>t.project_id===p.id);if(!own.length)return '';
   return `<div class="pm-gantt-group pm-color-${M.categoryKey(p.category)}"><div class="pm-group-title"><span class="pm-category">${esc(p.category)}</span><strong>${esc(p.name)}</strong><small>${own.length}개</small></div>${own.map(t=>{
    const left=(Math.max(start,M.day(t.start_date))-start)/span*100,width=(Math.min(end,M.day(t.end_date))-Math.max(start,M.day(t.start_date))+1)/span*100;
    return `<div class="pm-gantt-row"><button data-edit="task" data-id="${esc(t.id)}">${t.milestone?'◆ ':''}${esc(t.title)}<small>${t.start_date} → ${t.end_date} · ${M.statuses[t.status]} · ${t.progress}%</small></button><div class="pm-gantt-track">${now>=start&&now<=end?`<i class="pm-today-line" style="left:${todayPos}%" aria-hidden="true"></i>`:''}<button class="pm-bar${t.milestone?' pm-milestone':''}" style="left:${left}%;width:${width}%" data-edit="task" data-id="${esc(t.id)}" title="${esc(t.title)} · ${M.statuses[t.status]} ${t.progress}%" aria-label="${esc(t.title)} ${t.start_date}부터 ${t.end_date}까지 ${M.statuses[t.status]} ${t.progress}%"><span>${t.milestone?'◆':width>=5?`${t.progress}%`:''}</span></button></div></div>`;
   }).join('')}</div>`;
  }).join('');
  return `<div class="pm-gantt-toolbar"><div class="pm-range-modes" role="group" aria-label="Gantt 기간">${[['all','전체 기간'],['month','월간'],['week','주간']].map(([key,label])=>`<button data-range="${key}" aria-pressed="${ganttMode===key}">${label}</button>`).join('')}</div><div class="pm-period">${ganttMode!=='all'?'<button data-shift="-1" aria-label="이전 기간">‹</button>':''}<strong>${M.date(start)} ~ ${M.date(end)}</strong>${ganttMode!=='all'?'<button data-shift="1" aria-label="다음 기간">›</button><button data-current>오늘 기준</button>':''}</div></div><div class="pm-gantt-scroll"><div class="pm-gantt"><div class="pm-gantt-head"><span>프로젝트 · 항목</span><div>${axis}</div></div>${groups||empty('이 기간의 일정이 없습니다.')}</div></div><p class="pm-footnote">◆ 주요 일정 · 세로선: 오늘 · 막대를 누르면 수정</p>`;
 }
 function calendar(data){
  if(!month)month=today().slice(0,7);const first=M.day(`${month}-01`),weekday=new Date(first*86400000).getUTCDay(),start=first-(weekday+6)%7;
  return `<div class="pm-period"><button data-month="-1" aria-label="이전 달">‹</button><strong>${month.replace('-','년 ')}월</strong><button data-month="1" aria-label="다음 달">›</button><button data-month-current>이번 달</button></div><div class="pm-calendar-scroll"><div class="pm-calendar">${['월','화','수','목','금','토','일'].map(d=>`<div class="pm-day-name">${d}</div>`).join('')}${Array.from({length:42},(_,i)=>{const date=M.date(start+i),items=data.tasks.filter(t=>M.calendarIncludes(t,date));return `<section class="pm-day${date===today()?' pm-today':''}${!date.startsWith(month)?' pm-other-month':''}" aria-label="${date}"><strong>${Number(date.slice(8))}</strong>${items.map(t=>`<button class="pm-calendar-task pm-color-${M.categoryKey(projects.find(p=>p.id===t.project_id)?.category)}" data-edit="task" data-id="${esc(t.id)}" title="${esc(t.title)} · ${t.end_date} 마감">${t.milestone?'◆ ':''}${esc(t.title)}${date===t.end_date&&t.item_type!=='event'?' · 마감':''}</button>`).join('')}</section>`;}).join('')}</div></div><p class="pm-footnote">앱 내부 일정 · Google Calendar 연동 전</p>`;
 }
 function taskPage(data){
  const deletedProjects=projects.filter(p=>p.deleted),deletedIds=new Set(deletedProjects.map(p=>p.id));
  const visible=tasks.filter(t=>!deletedIds.has(t.project_id)&&(selected==='all'||t.project_id===selected));
  const archivedProjects=projects.filter(p=>!p.deleted&&p.archived),archived=visible.filter(t=>!t.deleted&&t.archived),trash=visible.filter(t=>t.deleted);
  const projectRows=(rows,isTrash)=>rows.map(p=>`<button class="pm-task-row" data-edit="project" data-id="${esc(p.id)}"><span>${esc(p.name)}${isTrash?`<small> · 소속 항목 ${tasks.filter(t=>t.project_id===p.id).length}개</small>`:''}</span><span>${isTrash?'프로젝트 복원':'복원 / 수정'}</span></button>`).join('');
  return `<section class="pm-card"><h3>할 일 ${data.tasks.length}</h3>${taskList(data.tasks)}</section><details class="pm-archive"><summary>보관함 · 프로젝트 ${archivedProjects.length} / 할 일 ${archived.length}</summary>${projectRows(archivedProjects,false)}${taskList(archived)}</details><details class="pm-archive"><summary>휴지통 · 프로젝트 ${deletedProjects.length} / 할 일 ${trash.length}</summary>${projectRows(deletedProjects,true)}${trash.length?taskList(trash):''}</details>`;
 }
 function draw(){
  const select=$('pm-project');if(selected!=='all'&&!projects.some(p=>p.id===selected&&!p.archived))selected='all';
  select.innerHTML='<option value="all">전체</option>'+projects.filter(p=>!p.archived).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');select.value=selected;
  document.querySelectorAll('#project-manager-view [data-tab]').forEach(b=>{b.setAttribute('aria-selected',String(b.dataset.tab===tab));b.tabIndex=b.dataset.tab===tab?0:-1;});
  $('pm-panel').setAttribute('aria-labelledby',`pm-tab-${tab}`);
  if(!owner||!loaded){$('pm-panel').innerHTML=empty(!owner?'로그인 후 프로젝트를 관리할 수 있습니다.':busy?'프로젝트를 불러오는 중입니다.':'목록을 불러오려면 새로고침을 눌러주세요.');controls();return;}
  const data=M.overview(projects,tasks,today(),selected);
  $('pm-panel').innerHTML=tab==='dashboard'?dashboard(data):tab==='gantt'?gantt(data):tab==='calendar'?calendar(data):taskPage(data);
  $('pm-panel').querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>open(b.dataset.edit,(b.dataset.edit==='project'?projects:tasks).find(r=>r.id===b.dataset.id)));
  $('pm-panel').querySelectorAll('[data-project-row]').forEach(d=>d.ontoggle=()=>{if(d.isConnected){if(d.open)expanded.add(d.dataset.projectRow);else expanded.delete(d.dataset.projectRow);}});
  const completed=$('pm-panel').querySelector('.pm-completed');if(completed)completed.ontoggle=()=>{if(completed.isConnected)completedOpen=completed.open;};
  $('pm-panel').querySelectorAll('[data-complete]').forEach(b=>b.onchange=()=>completeTask(b));
  $('pm-panel').querySelectorAll('[data-add-to]').forEach(b=>b.onclick=()=>open('task',null,b.dataset.addTo));
  $('pm-panel').querySelector('[data-show-tasks]')?.addEventListener('click',()=>{tab='tasks';draw();$('pm-tab-tasks').focus();});
  $('pm-panel').querySelectorAll('[data-range]').forEach(b=>b.onclick=()=>{ganttMode=b.dataset.range;offset=0;draw();});
  $('pm-panel').querySelectorAll('[data-shift]').forEach(b=>b.onclick=()=>{offset+=Number(b.dataset.shift);draw();});
  $('pm-panel').querySelector('[data-current]')?.addEventListener('click',()=>{offset=0;draw();});
  $('pm-panel').querySelectorAll('[data-month]').forEach(b=>b.onclick=()=>{const d=new Date(`${month}-01T00:00:00Z`);d.setUTCMonth(d.getUTCMonth()+Number(b.dataset.month));const next=d.toISOString().slice(0,7);if(next>='1900-01'&&next<='2200-12')month=next;draw();});
  $('pm-panel').querySelector('[data-month-current]')?.addEventListener('click',()=>{month=today().slice(0,7);draw();});controls();
 }
 function open(kind,row=null,projectId=null){
  if(busy||edit||!loaded||!owner)return;
  returnFocus=document.activeElement;edit={kind,base:row?{...row}:null,id:root.crypto.randomUUID()};
  const p=row?{...row,item_type:row.item_type??'task',calendar_mode:row.calendar_mode??'full'}:{item_type:'task',calendar_mode:'deadline',category:'개인',project_id:selected!=='all'?selected:projects.find(p=>!p.archived)?.id,start_date:today(),end_date:today(),status:'waiting',progress:0,priority:'normal'};
  if(projectId)p.project_id=projectId;
  const options=(values,value)=>values.map(([key,label])=>`<option value="${esc(key)}"${key===value?' selected':''}>${esc(label)}</option>`).join('');
  $('pm-dialog-title').textContent=`${kind==='project'?'프로젝트':'항목'} ${row?'수정':'추가'}`;
  $('pm-fields').innerHTML=kind==='project'?`<label>프로젝트 이름<input name="name" maxlength="100" required value="${esc(p.name)}"></label><label>분류<select name="category">${options(M.categories.map(c=>[c,c]),p.category)}</select></label>`:`<label>프로젝트<select name="project_id" required>${options(projects.filter(r=>!r.archived||r.id===p.project_id).map(r=>[r.id,`${r.name}${r.archived?' (보관됨)':''}`]),p.project_id)}</select></label><label>항목 이름<input name="title" maxlength="160" required value="${esc(p.title)}"></label><div class="pm-form-grid"><label>시작일<input type="date" name="start_date" min="1900-01-01" max="2200-12-31" required value="${p.start_date}"></label><label>종료일<input type="date" name="end_date" min="1900-01-01" max="2200-12-31" required value="${p.end_date}"></label><label>상태<select name="status">${options(Object.entries(M.statuses),p.status)}</select></label><label>진행률 %<input type="number" name="progress" min="0" max="100" step="1" required value="${p.progress}"></label><label>우선순위<select name="priority">${options(Object.entries(M.priorities),p.priority)}</select></label><label class="pm-check"><input type="checkbox" name="milestone"${p.milestone?' checked':''}> 마일스톤 (하루 일정)</label></div>`;
  $('pm-fields').insertAdjacentHTML('beforeend',`<label>메모<textarea name="note" maxlength="2000" rows="3">${esc(p.note)}</textarea></label>${row?`<label class="pm-check"><input type="checkbox" name="archived"${p.archived?' checked':''}> 보관${kind==='project'?' (소속 할 일도 기본 화면에서 숨김)':''}</label>`:''}`);
  if(kind==='task')$('pm-fields').insertAdjacentHTML('afterbegin',`<div class="pm-form-grid"><label>유형<select name="item_type">${options(Object.entries(M.itemTypes),p.item_type)}</select></label><label>캘린더 표시<select name="calendar_mode">${options(Object.entries(M.calendarModes),p.calendar_mode)}</select></label></div>`);
  const form=$('pm-form');if(kind==='task'){const fields=form.elements;const syncEvent=()=>{if(fields.item_type.value==='event'){fields.end_date.value=fields.start_date.value;fields.milestone.checked=true;}};fields.item_type.onchange=()=>{fields.calendar_mode.value=M.defaultCalendar(fields.item_type.value);fields.milestone.checked=fields.item_type.value==='event';syncEvent();};fields.start_date.onchange=syncEvent;form.elements.status.onchange=()=>{if(form.elements.status.value==='done')form.elements.progress.value=100;else if(form.elements.status.value==='waiting'||form.elements.progress.value==='100')form.elements.progress.value=0;};}
  $('pm-delete-confirm').hidden=true;$('pm-delete').hidden=!row;
  $('pm-delete-confirm').querySelector('p').textContent=kind==='project'?`프로젝트와 소속 항목 ${tasks.filter(t=>t.project_id===row?.id).length}개를 화면에서 삭제할까요? 프로젝트를 복원하면 소속 항목도 원래 상태로 돌아옵니다. 저장하지 않은 수정은 반영되지 않습니다.`:'이 항목을 삭제할까요? 휴지통에서 복원할 수 있습니다. 저장하지 않은 수정은 반영되지 않습니다.';$('pm-delete').textContent=row?.deleted?'복원':'삭제';$('pm-save').hidden=!!row?.deleted;
  $('pm-form-error').textContent='';controls();$('pm-dialog').showModal();if(row?.deleted)$('pm-delete').focus();else $('pm-fields').querySelector('input,select').focus();
 }
 function close(){if(busy)return;edit=null;$('pm-dialog').close();controls();if(returnFocus?.isConnected)returnFocus.focus();else $('pm-add-project').focus();}
 async function changeTrash(deleted){
  if(busy||!edit?.base)return;
  const token=generation,base=edit.base,kind=edit.kind;busy=true;controls();$('pm-form-error').textContent='';
  try{const result=await store.trash(base,deleted,kind);if(token!==generation)return;if(kind==='project')projects=projects.map(p=>p.id===result.id?result:p);else tasks=tasks.map(t=>t.id===result.id?result:t);busy=false;close();draw();notify(deleted?'삭제했습니다. Tasks의 휴지통에서 복원할 수 있습니다.':kind==='project'?'프로젝트를 복원했습니다. 소속 항목의 기존 보관·삭제 상태는 유지됩니다.':'복원했습니다. 프로젝트가 보관 중이면 보관 해제 후 표시됩니다.');}
  catch(error){if(token===generation)$('pm-form-error').textContent=error.message;}
  finally{if(token===generation){busy=false;controls();}}
 }
 async function save(event){
  event.preventDefault();if(busy||!edit||edit.base?.deleted)return;
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
 async function completeTask(control){
  const base=tasks.find(t=>t.id===control.dataset.complete),checked=control.checked;
  if(busy||edit||!base||!owner){if(base)control.checked=base.status==='done';return;}
  const token=generation;busy=true;controls();
  try{const result=await store.save('task',M.completionInput(base,checked),base);if(token!==generation)return;tasks=tasks.map(t=>t.id===result.id?result:t);if(checked)completedOpen=true;draw();notify(checked?'완료했습니다.':'진행 중으로 되돌렸습니다.');}
  catch(error){if(token===generation){control.checked=base.status==='done';notify(error.message,true);}}
  finally{if(token===generation){busy=false;controls();const next=Array.from($('pm-panel').querySelectorAll('[data-complete]')).find(b=>b.dataset.complete===base.id);next?.focus();}}
 }
 function reset(){generation++;$('pm-dialog')?.close();expanded.clear();completedOpen=false;projects=[];tasks=[];owner='';loaded=false;busy=false;edit=null;selected='all';tab='dashboard';offset=0;ganttMode='all';month='';returnFocus=null;$('project-manager-view')?.replaceChildren();}
 function render(){const container=$('project-manager-view');if(!container||container.classList.contains('hidden'))return;const next=root.getProjectContext()?.userId||'';if(next!==owner)reset();owner=next;if(!$('pm-form'))mount(container);if(edit)return;draw();if(!loaded&&owner)load();}
 root.ProjectManager=Object.freeze({render,refresh:load,reset});
})(globalThis);
