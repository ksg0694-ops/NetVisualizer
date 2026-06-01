/**
 * 스마트 가계부 V2 - Supabase 주간 백업 스크립트
 * 
 * 이제 메인 DB가 Supabase로 이전되었습니다.
 * 이 스크립트는 Apps Script의 Time-Driven Trigger를 통해 매주 주기적으로
 * Supabase의 데이터를 Google Sheets로 백업해오는 역할을 합니다.
 */

const SHEET_TX = "수입지출 내역";      
const SHEET_ASSET = "자산추이내역";   
const SHEET_PORTFOLIO = "포트폴리오"; 

const SUPABASE_URL = 'https://djwqcewsochlesjcouoi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqd3FjZXdzb2NobGVzamNvdW9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMDQwMjYsImV4cCI6MjA5NTc4MDAyNn0.BaKElHEW0x0q82I38kSkpd4nQbGAJVnT-LNYwLlHZMk';

function doGet(e) {
  const result = {
    status: "migrated",
    message: "메인 데이터베이스가 Supabase로 성공적으로 마이그레이션 되었습니다. 이 URL은 더 이상 데이터를 서빙하지 않습니다."
  };
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function fetchAllFromSupabase(endpoint, headers) {
  let allData = [];
  let offset = 0;
  const limit = 1000;
  
  while (true) {
    const url = SUPABASE_URL + endpoint + (endpoint.includes('?') ? '&' : '?') + 'limit=' + limit + '&offset=' + offset;
    const res = UrlFetchApp.fetch(url, { headers: headers, muteHttpExceptions: true });
    const chunk = JSON.parse(res.getContentText());
    
    if (Array.isArray(chunk)) {
      allData = allData.concat(chunk);
      if (chunk.length < limit) {
        break; // 가져올 데이터가 더 이상 없으면 루프 종료
      }
      offset += limit;
    } else {
      console.error("Supabase API 에러:", chunk);
      break;
    }
  }
  return allData;
}

function doBackup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": "Bearer " + SUPABASE_KEY,
    "Content-Type": "application/json"
  };
  
  // 1. Transactions 백업 (Pagination 적용)
  try {
    const txData = fetchAllFromSupabase("/rest/v1/transactions?select=*&order=date.desc", headers);
    const txSheet = ss.getSheetByName(SHEET_TX);
    if (txSheet && Array.isArray(txData)) {
      txSheet.clearContents();
      const txFormat = [["날짜","시간","타입","대분류","소분류","내용","금액","화폐","결제수단","메모"]];
      txData.forEach(r => txFormat.push([r.date, r.time||'', r.type, r.category, r.subcategory, r.memo, String(r.amount), r.currency, r.method, '']));
      txSheet.getRange(1, 1, txFormat.length, txFormat[0].length).setValues(txFormat);
    }
  } catch (e) {
    console.error("Transactions 백업 실패:", e);
  }

  // 2. Portfolios 백업 (Pagination 적용)
  try {
    const pfData = fetchAllFromSupabase("/rest/v1/portfolios?select=*", headers);
    let pfSheet = ss.getSheetByName(SHEET_PORTFOLIO);
    if (pfSheet && Array.isArray(pfData)) {
      pfSheet.clearContents();
      const pfFormat = [["대분류 (Drop-down)","계좌/자산명 (Text)","통화/형태 (Text)","만기일 (Date/Text)","금액 (Number)", "주식수"]];
      pfData.forEach(r => pfFormat.push([r.group_name, r.name, r.currency, r.maturity||'', String(r.amount), r.shares ? String(r.shares) : '']));
      pfSheet.getRange(1, 1, pfFormat.length, pfFormat[0].length).setValues(pfFormat);
    }
  } catch (e) {
    console.error("Portfolios 백업 실패:", e);
  }

  // 3. Assets 백업 (Pagination 적용)
  try {
    const assetData = fetchAllFromSupabase("/rest/v1/assets?select=*&order=year.asc,month.asc", headers);
    const assetSheet = ss.getSheetByName(SHEET_ASSET);
    if (assetSheet && Array.isArray(assetData)) {
      assetSheet.clearContents();
      const assetFormat = [["Year","Month","총자산(순자산)","현금성자산","안전자산","투자자산","부채"]];
      assetData.forEach(r => assetFormat.push([String(r.year), `${String(r.month).padStart(2,'0')}월`, String(r.total_asset), String(r.cash), String(r.safe), String(r.invest), String(r.debt)]));
      assetSheet.getRange(1, 1, assetFormat.length, assetFormat[0].length).setValues(assetFormat);
    }
  } catch (e) {
    console.error("Assets 백업 실패:", e);
  }
}
