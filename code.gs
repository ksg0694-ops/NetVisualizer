/**
 * 스마트 가계부 V2 - 백엔드 API (Phase 2: Write 엔진 장착)
 */

const SHEET_TX = "수입지출 내역";      
const SHEET_ASSET = "자산추이내역";   
const SHEET_PORTFOLIO = "포트폴리오"; 

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const result = {};

  try {
    result.tx = getSheetData(ss, SHEET_TX);
    result.asset = getSheetData(ss, SHEET_ASSET);
    result.portfolio = getSheetData(ss, SHEET_PORTFOLIO);
    result.status = "success";
  } catch (error) {
    result.status = "error";
    result.message = error.toString();
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// 💡 데이터 읽기(GET) 유틸리티 함수
function getSheetData(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const range = sheet.getDataRange();
  const values = range.getValues();
  return values;
}

// 💡 [신규] POST 요청(데이터 쓰기) 처리 엔진
function doPost(e) {
  // 1. LockService 적용: 동시 접속/입력 시 데이터 꼬임 방지 (최대 3초 대기)
  const lock = LockService.getScriptLock();
  lock.waitLock(3000); 

  const result = { status: "success" };

  try {
    const requestData = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Action 1: 새로운 수입/지출 내역 추가
    if (requestData.action === "addTransaction") {
      const sheet = ss.getSheetByName(SHEET_TX);
      if (!sheet) throw new Error("수입지출 내역 시트를 찾을 수 없습니다.");
      
      // 전달받은 1차원 배열 데이터를 시트의 맨 아래에 추가
      // 규격: ["날짜", "시간", "타입", "대분류", "소분류", "내용", "금액", "화폐", "결제수단", "메모"]
      sheet.appendRow(requestData.data);
      result.message = "거래 내역이 성공적으로 기록되었습니다.";
    } 
    // Action 2: 포트폴리오 덮어쓰기 (현재 상태 중심)
    else if (requestData.action === "updatePortfolio") {
      let sheet = ss.getSheetByName(SHEET_PORTFOLIO);
      if (!sheet) sheet = ss.insertSheet(SHEET_PORTFOLIO);

      sheet.clearContents();
      const newData = requestData.data;
      if (newData && newData.length > 0) {
        sheet.getRange(1, 1, newData.length, newData[0].length).setValues(newData);
      }
      result.message = "포트폴리오가 동기화되었습니다.";
    } 
    else {
      throw new Error("알 수 없는 Action 요청입니다.");
    }

  } catch (error) {
    result.status = "error";
    result.message = error.toString();
  } finally {
    // 2. 작업 완료 후 반드시 Lock 해제
    lock.releaseLock();
  }

  // 💡 CORS 이슈를 피하기 위해 JSON 규격으로 반환
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// 💡 [테스트용 함수] Apps Script 편집기 상단에서 '실행' 버튼을 눌러 시트에 잘 써지는지 확인하려면, 
// 상단 함수 선택창에서 'doPost'가 아닌 'testDoPost'를 선택하고 [▶ 실행]을 누르세요.
function testDoPost() {
  // 웹에서 날아오는 실제 데이터를 흉내낸 가짜 이벤트 객체(Mock)
  const mockEvent = {
    postData: {
      contents: JSON.stringify({
        action: "addTransaction",
        data: ["2026-05-28", "12:00", "수입", "테스트", "미분류", "정상작동 테스트", "10000", "KRW", "테스트통장", "테스트입니다"]
      })
    }
  };
  
  // doPost 함수 강제 호출 및 결과 로그 출력
  const result = doPost(mockEvent);
  Logger.log("테스트 성공 여부: " + result.getContent());
}