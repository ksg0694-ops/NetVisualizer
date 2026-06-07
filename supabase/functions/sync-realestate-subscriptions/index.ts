import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

type SyncRequest = {
  dryRun?: boolean
  keywords?: string[]
  perPage?: number
}

type ApplyhomeRow = Record<string, unknown>

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const defaultKeywords = ['고양창릉', '고양 창릉', '창릉']

const blockCoords: Record<string, { latitude: number; longitude: number; color: string; priorityOrder: number }> = {
  S2: { latitude: 37.6292, longitude: 126.8727, color: '#4F46E5', priorityOrder: 1 },
  S3: { latitude: 37.6250, longitude: 126.8668, color: '#10B981', priorityOrder: 2 },
  S4: { latitude: 37.6208, longitude: 126.8612, color: '#2563EB', priorityOrder: 3 },
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function getSupabaseAdminKey() {
  const secretKeys = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys)
      if (parsed?.default) return parsed.default
    } catch (_error) {
      // Fall back to the legacy service role key below.
    }
  }

  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
}

function readText(row: ApplyhomeRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value).trim()
    }
  }
  return ''
}

function toNumber(value: unknown) {
  const cleaned = String(value ?? '').replace(/[^0-9.-]/g, '')
  const number = Number(cleaned)
  return Number.isFinite(number) ? number : null
}

function parseDate(value: unknown) {
  const text = String(value ?? '').trim()
  if (!text) return null

  const compact = text.replace(/[^0-9]/g, '')
  if (compact.length >= 8) {
    return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`
  }
  return null
}

function parseMonth(value: unknown) {
  const date = parseDate(value)
  if (date) return `${date.slice(0, 7)}-01`

  const text = String(value ?? '').trim()
  const match = text.match(/(20\d{2})[^0-9]?(0?[1-9]|1[0-2])/)
  if (!match) return null
  return `${match[1]}-${match[2].padStart(2, '0')}-01`
}

function inferBlock(row: ApplyhomeRow) {
  const haystack = [
    readText(row, ['주택명', 'HOUSE_NM', 'houseNm']),
    readText(row, ['공급위치', 'HSSPLY_ADRES', 'hssplyAdres']),
  ].join(' ')

  const match = haystack.match(/\bS[-\s]?0?([234])\b/i)
  return match ? `S${match[1]}` : 'APT'
}

function normalizeApplyhomeRow(row: ApplyhomeRow) {
  const block = inferBlock(row)
  const coord = blockCoords[block]
  const siteName = readText(row, ['주택명', 'HOUSE_NM', 'houseNm']) || `${block} 청약 단지`
  const supplyCount = toNumber(readText(row, ['공급규모', 'TOT_SUPLY_HSHLDCO', 'totSuplyHshldco']))
  const location = readText(row, ['공급위치', 'HSSPLY_ADRES', 'hssplyAdres'])
  const housingType = readText(row, ['주택구분코드명', 'HOUSE_SECD_NM', 'houseSecdNm'])
  const saleType = readText(row, ['분양구분코드명', 'RENT_SECD_NM', 'rentSecdNm'])
  const sourceNoticeNo = readText(row, ['공고번호', 'PBLANC_NO', 'pblancNo'])
  const sourceHouseManageNo = readText(row, ['주택관리번호', 'HOUSE_MANAGE_NO', 'houseManageNo'])
  const noticeDate = parseDate(readText(row, ['모집공고일', 'RCRIT_PBLANC_DE', 'rcritPblancDe']))
  const mainStartDate = parseDate(readText(row, ['청약접수시작일', 'SUBSCRPT_RCEPT_BGNDE', 'subscrptRceptBgnde']))
  const specialStartDate = parseDate(readText(row, ['특별공급접수시작일', 'SPSPLY_RCEPT_BGNDE', 'spsplyRceptBgnde']))
  const generalStartDate = parseDate(readText(row, [
    '해당지역1순위접수시작일',
    '경기지역1순위접수시작일',
    '기타지역1순위접수시작일',
    'GNRL_RNK1_CRSPAREA_RCPTDE',
    'gnrlRnk1CrspareaRcptde',
  ]))

  return {
    block,
    site_name: siteName,
    region: location.includes('경기') ? '경기' : null,
    district: location.includes('고양') ? '고양시' : null,
    supply_count: supplyCount,
    housing_type: housingType || saleType || null,
    sale_type: saleType || null,
    priority: block === 'S2' ? '가장 중요' : '매우 중요',
    priority_order: coord?.priorityOrder || 99,
    budget_note: block === 'S2' ? '가장 중요' : '매우 중요',
    key_point: block === 'S2'
      ? '청약홈 API에서 수집된 고양창릉 본청약 후보'
      : '청약홈 API에서 수집된 고양창릉 주요 물량',
    target_budget: 800000000,
    expected_notice_month: parseMonth(mainStartDate || noticeDate) || '2026-06-01',
    main_subscription_date: mainStartDate,
    special_supply_start_date: specialStartDate,
    special_supply_end_date: parseDate(readText(row, ['특별공급접수종료일', 'SPSPLY_RCEPT_ENDDE', 'spsplyRceptEndde'])),
    general_supply_start_date: generalStartDate,
    general_supply_end_date: parseDate(readText(row, [
      '해당지역1순위접수종료일',
      '경기지역1순위접수종료일',
      '기타지역1순위접수종료일',
      'GNRL_RNK1_CRSPAREA_ENDDE',
      'gnrlRnk1CrspareaEndde',
    ])),
    winner_announcement_date: parseDate(readText(row, ['당첨자발표일', 'PRZWNER_PRESNATN_DE', 'przwnerPresnatnDe'])),
    contract_start_date: parseDate(readText(row, ['계약시작일', 'CNTRCT_CNCLS_BGNDE', 'cntrctCnclsBgnde'])),
    contract_end_date: parseDate(readText(row, ['계약종료일', 'CNTRCT_CNCLS_ENDDE', 'cntrctCnclsEndde'])),
    latitude: coord?.latitude || null,
    longitude: coord?.longitude || null,
    color: coord?.color || '#4F46E5',
    status: mainStartDate ? 'scheduled' : 'planned',
    source: 'applyhome_api',
    source_url: 'https://www.applyhome.co.kr',
    source_notice_no: sourceNoticeNo || null,
    source_house_manage_no: sourceHouseManageNo || null,
    synced_at: new Date().toISOString(),
  }
}

function rowMatchesKeywords(row: ApplyhomeRow, keywords: string[]) {
  const haystack = Object.values(row).map((value) => String(value ?? '')).join(' ')
  return keywords.some((keyword) => haystack.includes(keyword))
}

async function fetchApplyhomeRows(body: SyncRequest) {
  const serviceKey = Deno.env.get('ODCLOUD_SERVICE_KEY') || Deno.env.get('DATA_GO_KR_SERVICE_KEY')
  if (!serviceKey) {
    throw new Response('ODCLOUD_SERVICE_KEY or DATA_GO_KR_SERVICE_KEY is not configured', { status: 501 })
  }

  const baseUrl = Deno.env.get('APPLYHOME_API_BASE') || 'https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1'
  const url = new URL(`${baseUrl}/getAPTLttotPblancDetail`)
  url.searchParams.set('page', '1')
  url.searchParams.set('perPage', String(Math.min(Math.max(Number(body.perPage || 200), 1), 1000)))
  url.searchParams.set('serviceKey', serviceKey)

  const headers: Record<string, string> = {}
  const authKey = Deno.env.get('ODCLOUD_API_KEY')
  if (authKey) headers.Authorization = `Infuser ${authKey}`

  const response = await fetch(url, { headers })
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>

  if (!response.ok) {
    throw new Error(String(payload.message || payload.error || `Applyhome API failed: ${response.status}`))
  }

  const rows = Array.isArray(payload.data)
    ? payload.data
    : Array.isArray((payload.body as Record<string, unknown>)?.items)
      ? (payload.body as Record<string, unknown>).items
      : []

  return rows as ApplyhomeRow[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'POST only' }, 405)
  }

  const provider = String(Deno.env.get('REALESTATE_SUBSCRIPTION_PROVIDER') || 'disabled').trim().toLowerCase()
  if (provider === 'disabled' || provider === 'manual') {
    return jsonResponse({
      synced: 0,
      provider,
      message: 'Real estate subscription provider is disabled. No external API was called.',
    })
  }
  if (provider !== 'data-go-kr' && provider !== 'applyhome') {
    return jsonResponse({ error: `Unsupported provider: ${provider}` }, 400)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = getSupabaseAdminKey()
  if (!supabaseUrl || !supabaseKey) {
    return jsonResponse({ error: 'Supabase admin credentials are not configured' }, 500)
  }

  try {
    const body = (await req.json().catch(() => ({}))) as SyncRequest
    const requestedKeywords = Array.isArray(body.keywords) && body.keywords.length > 0
      ? body.keywords.map((keyword) => String(keyword).trim()).filter(Boolean)
      : defaultKeywords
    const keywords = requestedKeywords.length > 0 ? requestedKeywords : defaultKeywords

    const rawRows = await fetchApplyhomeRows(body)
    const rows = rawRows
      .filter((row) => rowMatchesKeywords(row, keywords))
      .map(normalizeApplyhomeRow)

    if (body.dryRun) {
      return jsonResponse({ synced: 0, dryRun: true, matched: rows.length, rows })
    }

    if (rows.length === 0) {
      return jsonResponse({ synced: 0, matched: 0, message: 'No matching Applyhome rows found' })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const { error } = await supabase
      .from('real_estate_subscription_sites')
      .upsert(rows, { onConflict: 'block,site_name' })

    if (error) throw error

    return jsonResponse({
      synced: rows.length,
      matched: rows.length,
      sites: rows.map((row) => row.site_name),
    })
  } catch (error) {
    if (error instanceof Response) {
      return jsonResponse({ error: await error.text() }, error.status)
    }
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
})
