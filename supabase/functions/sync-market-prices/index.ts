import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

type QuoteRequest = {
  tickers?: string[]
  dryRun?: boolean
}

type MarketQuote = {
  ticker: string
  providerSymbol: string
  price: number
  currency: string
  priceDate: string
}

type TickerRequest = {
  ticker: string
  providerSymbol: string
  currency?: string
}

type QuoteFetchResult = {
  quotes: MarketQuote[]
  errors: string[]
}

let kisTokenCache: { token: string; expiresAt: number } | null = null

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

function normalizeTickers(tickers: string[] = []) {
  return [...new Set(
    tickers
      .map((ticker) => String(ticker || '').trim().toUpperCase())
      .filter(Boolean)
  )]
}

function parseJsonEnv(name: string): Record<string, string> {
  const raw = Deno.env.get(name)
  if (!raw) return {}

  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}

    return Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [
        String(key).trim().toUpperCase(),
        String(value).trim().toUpperCase(),
      ])
    )
  } catch (_error) {
    return {}
  }
}

function inferCurrency(ticker: string, providerSymbol: string, fallback = '') {
  if (fallback) return fallback.toUpperCase()
  if (/^(\d{6}|\d{4}[A-Z]\d)(:XKRX|:XKOS|:XKON)?$/.test(providerSymbol)) return 'KRW'
  if (providerSymbol.endsWith(':XKRX') || providerSymbol.endsWith(':XKOS') || providerSymbol.endsWith(':XKON')) return 'KRW'
  if (ticker.includes('/')) return ticker.split('/').at(-1)?.toUpperCase() || 'USD'
  return 'USD'
}

function toTwelveDataSymbol(ticker: string, overrides: Record<string, string>) {
  if (overrides[ticker]) return overrides[ticker]
  if (ticker.includes(':') || ticker.includes('/')) return ticker
  if (/^\d{6}$/.test(ticker) || /^\d{4}[A-Z]\d$/.test(ticker)) return `${ticker}:XKRX`
  return ticker
}

function isKoreanExchangeSymbol(providerSymbol: string) {
  return providerSymbol.endsWith(':XKRX') || providerSymbol.endsWith(':XKOS') || providerSymbol.endsWith(':XKON')
}

function isDomesticKisTicker(ticker: string) {
  return /^\d{6}$/.test(ticker) || /^\d{4}[A-Z]\d$/.test(ticker)
}

function getKoreaDateString() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function makeTickerRequests(tickers: string[], currencyByTicker: Record<string, string>) {
  const overrides = parseJsonEnv('TWELVE_DATA_SYMBOL_OVERRIDES')
  return tickers.map((ticker) => {
    const providerSymbol = toTwelveDataSymbol(ticker, overrides)
    return {
      ticker,
      providerSymbol,
      currency: currencyByTicker[ticker] || '',
    }
  })
}

function parseQuoteDate(row: Record<string, unknown>) {
  const dateText = String(row.datetime || row.date || '').slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return dateText

  const timestamp = Number(row.timestamp)
  if (Number.isFinite(timestamp) && timestamp > 0) {
    return new Date(timestamp * 1000).toISOString().slice(0, 10)
  }

  return new Date().toISOString().slice(0, 10)
}

function parseTwelveQuotePayload(payload: unknown, requests: TickerRequest[]): QuoteFetchResult {
  const rows = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
  const isSingleResponse = requests.length === 1 && !rows[requests[0].providerSymbol] && !rows[requests[0].ticker]
  const quotes: MarketQuote[] = []
  const errors: string[] = []

  requests.forEach((request) => {
    const rawRow = isSingleResponse
      ? rows
      : (rows[request.providerSymbol] || rows[request.ticker])

    if (!rawRow || typeof rawRow !== 'object') {
      errors.push(`${request.ticker}: quote missing`)
      return
    }

    const row = rawRow as Record<string, unknown>
    if (row.status === 'error') {
      errors.push(`${request.ticker}: ${String(row.message || 'provider error')}`)
      return
    }

    const price = Number(row.close || row.price || row.previous_close)
    if (!Number.isFinite(price) || price < 0) {
      errors.push(`${request.ticker}: invalid price`)
      return
    }

    const currency = inferCurrency(
      request.ticker,
      request.providerSymbol,
      String(row.currency || request.currency || '')
    )

    quotes.push({
      ticker: request.ticker,
      providerSymbol: request.providerSymbol,
      price,
      currency,
      priceDate: parseQuoteDate(row),
    })
  })

  return { quotes, errors }
}

async function fetchTwelveDataQuotes(tickers: string[], currencyByTicker: Record<string, string>): Promise<QuoteFetchResult> {
  const apiKey = Deno.env.get('TWELVE_DATA_API_KEY')
  if (!apiKey) {
    throw new Response('TWELVE_DATA_API_KEY is not configured', { status: 501 })
  }

  const requests = makeTickerRequests(tickers, currencyByTicker)
  const blockedRequests = requests.filter((request) => isKoreanExchangeSymbol(request.providerSymbol))
  const allowedRequests = requests.filter((request) => !isKoreanExchangeSymbol(request.providerSymbol))
  const blockedErrors = blockedRequests.map((request) =>
    `${request.ticker}: ${request.providerSymbol} blocked by free-only mode`
  )

  if (allowedRequests.length === 0) {
    return { quotes: [], errors: blockedErrors }
  }

  const url = new URL('https://api.twelvedata.com/quote')
  url.searchParams.set('symbol', allowedRequests.map((request) => request.providerSymbol).join(','))
  url.searchParams.set('apikey', apiKey)
  url.searchParams.set('dp', '6')

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Twelve Data failed: ${response.status} ${response.statusText}`)
  }

  const parsed = parseTwelveQuotePayload(await response.json(), allowedRequests)
  return { quotes: parsed.quotes, errors: [...parsed.errors, ...blockedErrors] }
}

function getKisCredentials() {
  const appKey = Deno.env.get('KIS_APP_KEY') || ''
  const appSecret = Deno.env.get('KIS_APP_SECRET') || ''
  if (!appKey || !appSecret) {
    throw new Response('KIS_APP_KEY and KIS_APP_SECRET are not configured', { status: 501 })
  }

  return {
    appKey,
    appSecret,
    baseUrl: Deno.env.get('KIS_BASE_URL') || 'https://openapi.koreainvestment.com:9443',
  }
}

async function getKisAccessToken() {
  if (kisTokenCache && kisTokenCache.expiresAt > Date.now() + 60_000) {
    return kisTokenCache.token
  }

  const { appKey, appSecret, baseUrl } = getKisCredentials()
  const response = await fetch(`${baseUrl}/oauth2/tokenP`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      appkey: appKey,
      appsecret: appSecret,
    }),
  })
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>
  const accessToken = String(payload.access_token || '')

  if (!response.ok || !accessToken) {
    throw new Error(String(payload.error_description || payload.msg1 || payload.message || `KIS token failed: ${response.status}`))
  }

  const expiresIn = Number(payload.expires_in || 60 * 60 * 24)
  kisTokenCache = {
    token: accessToken,
    expiresAt: Date.now() + Math.max(60, expiresIn - 300) * 1000,
  }

  return accessToken
}

function parseKisQuotePayload(payload: Record<string, unknown>, ticker: string): MarketQuote {
  if (payload.rt_cd && payload.rt_cd !== '0') {
    throw new Error(`${ticker}: ${String(payload.msg1 || 'KIS provider error')}`)
  }

  const output = (payload.output || {}) as Record<string, unknown>
  const rawPrice = String(output.stck_prpr || '').replace(/[^0-9.-]/g, '')
  const price = Number(rawPrice)
  if (!Number.isFinite(price) || price < 0) {
    throw new Error(`${ticker}: invalid KIS price`)
  }

  return {
    ticker,
    providerSymbol: ticker,
    price,
    currency: 'KRW',
    priceDate: getKoreaDateString(),
  }
}

async function fetchKisDomesticQuotes(tickers: string[]): Promise<QuoteFetchResult> {
  const domesticTickers = tickers.filter(isDomesticKisTicker)
  const errors = tickers
    .filter((ticker) => !isDomesticKisTicker(ticker))
    .map((ticker) => `${ticker}: KIS free provider supports Korean domestic short-code tickers only`)

  if (domesticTickers.length === 0) {
    return { quotes: [], errors }
  }

  const { appKey, appSecret, baseUrl } = getKisCredentials()
  const token = await getKisAccessToken()
  const quotes: MarketQuote[] = []

  for (const ticker of domesticTickers) {
    try {
      const url = new URL(`${baseUrl}/uapi/domestic-stock/v1/quotations/inquire-price`)
      url.searchParams.set('FID_COND_MRKT_DIV_CODE', 'J')
      url.searchParams.set('FID_INPUT_ISCD', ticker)

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          authorization: `Bearer ${token}`,
          appkey: appKey,
          appsecret: appSecret,
          tr_id: 'FHKST01010100',
          custtype: 'P',
          'Content-Type': 'application/json; charset=utf-8',
        },
      })
      const payload = await response.json().catch(() => ({})) as Record<string, unknown>
      if (!response.ok) {
        throw new Error(String(payload.msg1 || payload.message || `KIS quote failed: ${response.status}`))
      }
      quotes.push(parseKisQuotePayload(payload, ticker))
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
  }

  return { quotes, errors }
}

async function fetchProviderQuotes(tickers: string[], currencyByTicker: Record<string, string>): Promise<QuoteFetchResult> {
  const provider = String(Deno.env.get('MARKET_PRICE_PROVIDER') || 'disabled').trim().toLowerCase()
  if (provider === 'disabled' || provider === 'manual') {
    return { quotes: [], errors: ['External market data provider is disabled in free-only mode'] }
  }
  if (provider === 'kis') return fetchKisDomesticQuotes(tickers)
  if (provider === 'twelvedata') return fetchTwelveDataQuotes(tickers, currencyByTicker)
  throw new Response(`Unsupported free-only market price provider: ${provider}`, { status: 400 })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'POST only' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = getSupabaseAdminKey()
  if (!supabaseUrl || !supabaseKey) {
    return jsonResponse({ error: 'Supabase admin credentials are not configured' }, 500)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const body = (await req.json().catch(() => ({}))) as QuoteRequest
  let tickers = normalizeTickers(body.tickers)
  const currencyByTicker: Record<string, string> = {}

  if (tickers.length === 0) {
    const { data, error } = await supabase
      .from('portfolios')
      .select('ticker,currency')
      .not('ticker', 'is', null)

    if (error) return jsonResponse({ error: error.message }, 500)
    ;(data || []).forEach((row) => {
      const ticker = String(row.ticker || '').trim().toUpperCase()
      if (!ticker) return
      currencyByTicker[ticker] = String(row.currency || '').trim().toUpperCase()
    })
    tickers = normalizeTickers((data || []).map((row) => row.ticker))
  }

  if (tickers.length === 0) {
    return jsonResponse({ synced: 0, message: 'No tickers to sync' })
  }

  try {
    const today = getKoreaDateString()
    const { data: cachedRows, error: cacheError } = await supabase
      .from('portfolio_market_prices')
      .select('ticker,price,currency,price_date,source,updated_at')
      .in('ticker', tickers)

    if (cacheError) throw cacheError

    const cachedQuotes = (cachedRows || [])
      .filter((row) => row.source === 'api' && row.price_date === today)
      .map((row) => ({
        ticker: String(row.ticker || '').trim().toUpperCase(),
        providerSymbol: String(row.ticker || '').trim().toUpperCase(),
        price: Number(row.price),
        currency: String(row.currency || 'USD').trim().toUpperCase(),
        priceDate: String(row.price_date || today),
      }))
      .filter((row) => row.ticker && Number.isFinite(row.price))

    const cachedTickers = new Set(cachedQuotes.map((quote) => quote.ticker))
    const missingTickers = tickers.filter((ticker) => !cachedTickers.has(ticker))

    if (missingTickers.length === 0) {
      return jsonResponse({
        synced: 0,
        cached: cachedQuotes.length,
        tickers: cachedQuotes.map((quote) => quote.ticker),
        errors: [],
      })
    }

    const { quotes, errors } = await fetchProviderQuotes(missingTickers, currencyByTicker)
    if (quotes.length === 0) {
      return jsonResponse({ synced: 0, cached: cachedQuotes.length, errors }, cachedQuotes.length > 0 ? 200 : 502)
    }

    const now = new Date().toISOString()
    const latestRows = quotes.map((quote) => ({
      ticker: quote.ticker,
      price: quote.price,
      currency: quote.currency,
      price_date: quote.priceDate,
      source: 'api',
      updated_at: now,
    }))
    const historyRows = quotes.map((quote) => ({
      ticker: quote.ticker,
      price: quote.price,
      currency: quote.currency,
      price_date: quote.priceDate,
      source: 'api',
    }))

    if (body.dryRun) {
      return jsonResponse({ synced: 0, cached: cachedQuotes.length, dryRun: true, quotes: latestRows, errors })
    }

    const { error: latestError } = await supabase
      .from('portfolio_market_prices')
      .upsert(latestRows, { onConflict: 'ticker' })
    if (latestError) throw latestError

    const { error: historyError } = await supabase
      .from('portfolio_price_history')
      .upsert(historyRows, { onConflict: 'ticker,price_date,source' })
    if (historyError) throw historyError

    return jsonResponse({
      synced: quotes.length,
      cached: cachedQuotes.length,
      tickers: quotes.map((quote) => quote.ticker),
      providerSymbols: Object.fromEntries(quotes.map((quote) => [quote.ticker, quote.providerSymbol])),
      errors,
    })
  } catch (error) {
    if (error instanceof Response) {
      return jsonResponse({ error: await error.text() }, error.status)
    }

    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
})
