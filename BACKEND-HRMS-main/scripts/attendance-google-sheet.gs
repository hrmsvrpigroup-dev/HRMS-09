/**
 * Google Apps Script Web App for HRMS Daily Attendance Sync
 * Deploy as Web App: Execute as "Me", Who has access: "Anyone"
 * Paste the deployed /exec URL into BACKEND-HRMS-main/.env -> GOOGLE_SHEET_WEBHOOK_URL
 */
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents || '{}');
    if (payload.action === 'ping') {
      return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
    }

    var tabName = payload.tabName || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    var code = payload.employeeCode || '';
    var row = payload.row || [];
    if (!row.length) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Empty row' })).setMimeType(ContentService.MimeType.JSON);
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(tabName);
    var headers = ['Code', 'Employee Name', 'Shift Date', 'Clock In', 'Clock Out', 'Total Hours', 'Active Hours', 'Idle Time', 'Status', 'Continue', 'Actions'];

    if (!sheet) {
      sheet = ss.insertSheet(tabName, 0);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    }

    var lastRow = sheet.getLastRow();
    var existingRow = -1;
    if (lastRow > 1 && code) {
      var codes = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < codes.length; i++) {
        if (String(codes[i][0]).trim() === String(code).trim()) {
          existingRow = i + 2;
          break;
        }
      }
    }

    if (existingRow > 0) {
      sheet.getRange(existingRow, 1, 1, row.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }

    return ContentService.createTextOutput(JSON.stringify({ ok: true, tabName: tabName, code: code })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

