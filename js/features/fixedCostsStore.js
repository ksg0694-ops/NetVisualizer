(function (root) {
    'use strict';
    const columns = 'id,user_id,name,category,kind,monthly_amount,pay_day,payment_method,note,is_active,version';
    function normalize(input) {
        const value = { name: String(input.name || '').trim(), category: String(input.category || '').trim(), kind: input.kind,
            monthly_amount: Number(input.monthly_amount), pay_day: input.pay_day === '' || input.pay_day == null ? null : Number(input.pay_day),
            payment_method: String(input.payment_method || '').trim(), note: String(input.note || '').trim(), is_active: input.is_active === true };
        if (!value.name || value.name.length > 80 || !value.category || value.category.length > 40) throw Error('항목명과 분류를 확인해 주세요.');
        if (!['fixed', 'essential'].includes(value.kind)) throw Error('비용 구분을 선택해 주세요.');
        if (input.monthly_amount === '' || input.monthly_amount == null || !Number.isSafeInteger(value.monthly_amount) || value.monthly_amount < 0 || value.monthly_amount > 1000000000) throw Error('월 예정 금액은 0~10억원의 정수로 입력해 주세요.');
        if (value.pay_day !== null && (!Number.isInteger(value.pay_day) || value.pay_day < 1 || value.pay_day > 31)) throw Error('결제일은 1~31일로 입력해 주세요.');
        if (value.payment_method.length > 80 || value.note.length > 500) throw Error('결제수단은 80자, 메모는 500자까지 입력할 수 있습니다.');
        return value;
    }
    function create(getContext) {
        function context() { const c = getContext(); if (!c?.userId || !c.client) throw Error('로그인 후 이용해 주세요.'); return c; }
        function same(userId) { if (getContext()?.userId !== userId) throw Error('계정이 변경되었습니다. 다시 열어 주세요.'); }
        return {
            async list() {
                const { client, userId } = context(), rows = [];
                for (let offset = 0; ; offset += 500) {
                    const { data, error } = await client.from('fixed_costs').select(columns).eq('user_id', userId).order('id').range(offset, offset + 499);
                    same(userId); if (error) throw Error('고정비를 불러오지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.');
                    rows.push(...data); if (data.length < 500) return rows;
                }
            },
            async save(input, base, draftId) {
                const { client, userId } = context(), payload = normalize(input);
                let query;
                if (base) query = client.from('fixed_costs').update(payload).eq('user_id', userId).eq('id', base.id).eq('version', base.version);
                else query = client.from('fixed_costs').insert({ ...payload, id: draftId, user_id: userId });
                const { data, error } = await query.select(columns);
                same(userId);
                if (error) throw Error('저장하지 못했습니다. 입력은 유지됩니다. 연결 상태를 확인하거나 새로고침 후 확인해 주세요.');
                if (data?.length !== 1) throw Error('다른 기기에서 변경된 항목입니다. 입력을 확인한 뒤 취소 → 새로고침하여 다시 수정해 주세요.');
                return data[0];
            }
        };
    }
    root.FixedCostsStore = Object.freeze({ normalize, create });
})(globalThis);
