(function(root){
 'use strict';
 const tables={project:'personal_projects',task:'personal_project_tasks'};
 const columns={project:'id,user_id,name,category,note,archived,version,created_at,updated_at',task:'id,user_id,project_id,title,start_date,end_date,status,progress,priority,milestone,note,archived,version,created_at,updated_at'};
 function create(getContext){
  function context(){const c=getContext();if(!c?.userId||!c.client)throw Error('로그인 후 이용해 주세요.');return c;}
  function same(id){if(getContext()?.userId!==id)throw Error('계정이 변경되었습니다. 다시 열어 주세요.');}
  async function read(kind,c){const rows=[];for(let offset=0;;offset+=500){const {data,error}=await c.client.from(tables[kind]).select(columns[kind]).eq('user_id',c.userId).order('id').range(offset,offset+499);same(c.userId);if(error)throw Error('프로젝트를 불러오지 못했습니다. 연결 상태를 확인해 주세요.');rows.push(...data);if(data.length<500)return rows;}}
  return {
   async list(){const c=context();const [projects,tasks]=await Promise.all([read('project',c),read('task',c)]);same(c.userId);return {projects,tasks};},
   async save(kind,input,base,draftId){
    const c=context(),payload=root.ProjectModel.normalize(kind,input);let query;
    if(base)query=c.client.from(tables[kind]).update(payload).eq('user_id',c.userId).eq('id',base.id).eq('version',base.version);
    else query=c.client.from(tables[kind]).insert({...payload,id:draftId,user_id:c.userId});
    const {data,error}=await query.select(columns[kind]);same(c.userId);
    if(error)throw Error('저장하지 못했습니다. 입력은 유지됩니다. 연결과 프로젝트를 확인해 주세요.');
    if(data?.length!==1)throw Error('다른 기기에서 변경되었습니다. 입력을 확인한 뒤 취소 → 새로고침하여 다시 수정해 주세요.');
    return data[0];
   }
  };
 }
 root.ProjectStore=Object.freeze({create});
})(globalThis);
