// App code updates are separate from personal-data synchronization.
(function(root) {
    'use strict';
    const loaded=document.querySelector('meta[name="app-build"]')?.content || '';
    const valid=v=>typeof v==='string' && /^[a-f0-9]{16}$/.test(v);
    let registration=null, latest='', busy=false, applying=false, lastCheck=0, cacheMismatch=false;
    let status='배포 버전을 확인할 수 있습니다.';
    const el=id=>document.getElementById(id);
    const isDev=()=>Boolean(document.querySelector('script[src="/@vite/client"]'));
    function render() {
        const available=valid(latest)&&(latest!==loaded||cacheMismatch);
        if(el('sidebar-app-version'))el('sidebar-app-version').textContent=`build ${valid(loaded)?loaded.slice(0,8):'미확인'}`;
        if(el('app-version-detail'))el('app-version-detail').textContent=`현재 ${valid(loaded)?loaded:'확인 불가'} · 배포 ${latest||'미확인'}`;
        if(el('app-update-status'))el('app-update-status').textContent=status;
        if(el('app-update-dot'))el('app-update-dot').hidden=!available;
        const button=el('btn-app-update');
        if(button){button.disabled=busy;button.dataset.update=String(available);button.title=available?'새 버전 업데이트':'앱 버전 확인';button.setAttribute('aria-label',button.title);const label=button.querySelector('.app-update-label');if(label)label.textContent=available?'업데이트':'앱 확인';}
        if(el('settings-app-check'))el('settings-app-check').disabled=busy;
        if(el('settings-app-apply')){el('settings-app-apply').hidden=!available;el('settings-app-apply').disabled=busy;}
    }
    function tell(message, manual=false) {status=message;render();if(manual)root.showToast?.(message,'info',4000);}
    async function readPublished() {
        const url=new URL('./version.json',location.href);url.searchParams.set('check',Date.now());
        const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(8000)});
        if(!response.ok)throw new Error('배포 버전 확인 실패');
        const data=await response.json();if(!valid(data.revision))throw new Error('올바르지 않은 배포 정보');
        return data.revision;
    }
    function workerVersion(worker) {
        return new Promise(resolve=>{
            if(!worker){resolve('');return;}
            const channel=new MessageChannel();
            const finish=value=>{clearTimeout(timer);channel.port1.close();resolve(value);};
            const timer=setTimeout(()=>finish(''),2000);
            channel.port1.onmessage=event=>finish(valid(event.data?.revision)?event.data.revision:'');
            try{worker.postMessage({type:'GET_VERSION'},[channel.port2]);}catch{finish('');}
        });
    }
    async function check(manual=false) {
        if(busy)return false;
        if(isDev()){tell('개발 미리보기에서는 앱 업데이트를 적용하지 않습니다.',manual);return false;}
        busy=true;tell('앱 버전 확인 중…');
        try {
            latest=await readPublished();lastCheck=Date.now();
            const active=await workerVersion(registration?.active);
            cacheMismatch=Boolean((active&&active!==latest)||registration?.waiting);
            tell(latest===loaded&&!cacheMismatch?'최신 버전입니다.':'새 버전이 있습니다. 업데이트 버튼을 눌러 적용하세요.',manual);
            return true;
        } catch {tell('버전을 확인하지 못했습니다. 인터넷 연결 후 다시 시도해 주세요.',manual);return false;}
        finally {busy=false;render();}
    }
    async function waitUntilReady(reg) {
        if(reg.waiting)return reg.waiting;
        const active=await workerVersion(reg.active);
        if(active===latest)return reg.active;
        return new Promise((resolve,reject)=>{
            const end=Date.now()+15000;
            const timer=setInterval(()=>{
                if(reg.waiting){clearInterval(timer);resolve(reg.waiting);}
                else if(Date.now()>end){clearInterval(timer);reject(new Error('새 버전 준비가 지연됩니다. 잠시 후 다시 확인해 주세요.'));}
            },150);
        });
    }
    function reload() {
        // Explicit navigation bypasses an older cached HTML URL as well.
        const url=new URL(location.href);url.searchParams.set('app-build',latest);
        location.replace(url.href);
    }
    async function updateRegistration(reg) {
        let timer;
        try {
            await Promise.race([reg.update(),new Promise((_,reject)=>{
                timer=setTimeout(()=>reject(new Error('새 버전을 내려받지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.')),20000);
            })]);
        } finally {clearTimeout(timer);}
    }
    async function apply() {
        if(busy||!await check(false)||(latest===loaded&&!cacheMismatch))return;
        const editor=document.querySelector('dialog[open], .modal-overlay:not(.hidden):not(#settings-modal), [contenteditable="true"]:focus-within, textarea:focus');
        if(editor){tell('편집 내용을 저장하고 창을 닫은 뒤 업데이트해 주세요.',true);return;}
        if(!root.confirm('새 버전으로 업데이트하고 이 탭을 다시 엽니다. 저장하지 않은 입력은 사라질 수 있습니다. 계속할까요?'))return;
        busy=true;applying=true;tell('새 버전을 준비하고 있습니다…');
        try {
            if(!('serviceWorker' in navigator)){reload();return;}
            registration=registration||await navigator.serviceWorker.getRegistration(new URL('./',location.href).href);
            if(!registration){reload();return;}
            await updateRegistration(registration);
            const worker=await waitUntilReady(registration);
            if(await workerVersion(worker)!==latest)throw new Error('배포 중이거나 버전이 변경되었습니다. 잠시 후 다시 확인해 주세요.');
            if(worker===registration.active){reload();return;}
            await new Promise((resolve,reject)=>{
                const onChange=()=>{clearTimeout(timer);navigator.serviceWorker.removeEventListener('controllerchange',onChange);resolve();};
                const timer=setTimeout(()=>{navigator.serviceWorker.removeEventListener('controllerchange',onChange);reject(new Error('업데이트 적용이 지연됩니다. 다시 시도해 주세요.'));},15000);
                navigator.serviceWorker.addEventListener('controllerchange',onChange);
                worker.postMessage({type:'APPLY_UPDATE',revision:latest});
            });
            reload();
        } catch(error){tell(error.message||'업데이트하지 못했습니다. 다시 시도해 주세요.',true);}
        finally {applying=false;busy=false;render();}
    }
    function attach(reg) {registration=reg;void check(false);}
    document.addEventListener('DOMContentLoaded',()=>{
        el('btn-app-update')?.addEventListener('click',()=>valid(latest)&&(latest!==loaded||cacheMismatch)?apply():check(true));
        el('settings-app-check')?.addEventListener('click',()=>check(true));
        el('settings-app-apply')?.addEventListener('click',apply);
        render();void check(false);
    });
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&Date.now()-lastCheck>30*60*1000)void check(false);});
    root.addEventListener('online',()=>void check(false));
    navigator.serviceWorker?.addEventListener('controllerchange',()=>{if(!applying)void check(false);});
    root.AppUpdater=Object.freeze({attach,check,apply,render});
})(window);
