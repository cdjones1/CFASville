/**
 * Stephenville Chick-fil-A — Team Forms backend.
 *
 * Paste this whole file into the Apps Script editor attached to a Google
 * Sheet (Extensions > Apps Script), set SHARED_SECRET below to something
 * only you know, then deploy it as a Web App (see SETUP.md). Each form
 * submission becomes one row on its own tab; the dashboard reads all of
 * it back out as JSON.
 */

// Change this to any random string of your choosing. Put the exact same
// string into SHARED_SECRET near the top of app.js.
const SHARED_SECRET = 'PICK-A-RANDOM-SECRET-AND-PASTE-IT-IN-APP-JS-TOO';

const SHEET_NAMES = {
  'time-punch': 'TimePunch',
  'uniform-order': 'UniformOrder',
  'mileage': 'Mileage',
};

const HEADERS = {
  'time-punch': ['Timestamp', 'Ticket', 'Employee', 'Shift Date', 'Issue', 'Correct Time', 'Reason', 'Manager'],
  'uniform-order': ['Timestamp', 'Ticket', 'Employee', 'Item', 'Size', 'Qty', 'Reason', 'Signature URL'],
  'mileage': ['Timestamp', 'Ticket', 'Employee', 'Trip Date', 'Purpose', 'From', 'To', 'Miles', 'Rate', 'Total'],
};

const SIGNATURE_FOLDER_NAME = 'Uniform Order Signatures';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.secret !== SHARED_SECRET) {
      return jsonOutput({ ok: false, error: 'Wrong secret' });
    }

    const formType = data.formType;
    const sheetName = SHEET_NAMES[formType];
    if (!sheetName) throw new Error('Unknown form type: ' + formType);

    const sheet = getOrCreateSheet(sheetName, HEADERS[formType]);
    const f = data.fields || {};
    const now = new Date();

    let row;
    if (formType === 'time-punch') {
      row = [now, f.ticketNo, f.empName, f.shiftDate, f.issueType, f.correctTime, f.reason, f.managerName];
    } else if (formType === 'uniform-order') {
      const signatureUrl = f.signature ? saveSignatureImage(f.signature, f.ticketNo) : '';
      row = [now, f.ticketNo, f.empName, f.item, f.size, f.qty, f.reason, signatureUrl];
    } else if (formType === 'mileage') {
      row = [now, f.ticketNo, f.empName, f.tripDate, f.purpose, f.fromLoc, f.toLoc, f.miles, f.rate, f.total];
    } else {
      throw new Error('Unhandled form type: ' + formType);
    }

    sheet.appendRow(row);
    return jsonOutput({ ok: true });
  } catch (err) {
    return jsonOutput({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  try {
    if (!e.parameter || e.parameter.secret !== SHARED_SECRET) {
      return jsonOutput({ ok: false, error: 'Wrong secret' });
    }

    const result = {};
    Object.keys(SHEET_NAMES).forEach((formType) => {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES[formType]);
      if (!sheet || sheet.getLastRow() < 2) {
        result[formType] = [];
        return;
      }
      const headers = HEADERS[formType];
      const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
      result[formType] = values.map((rowArr) => {
        const obj = {};
        headers.forEach((h, i) => {
          const v = rowArr[i];
          obj[h] = v instanceof Date ? v.toISOString() : v;
        });
        return obj;
      });
    });

    return jsonOutput({ ok: true, data: result });
  } catch (err) {
    return jsonOutput({ ok: false, error: String(err) });
  }
}

function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function saveSignatureImage(dataUrl, ticketNo) {
  try {
    const base64 = dataUrl.split(',')[1];
    const blob = Utilities.newBlob(Utilities.base64Decode(base64), 'image/png', (ticketNo || 'signature') + '.png');
    const folder = getOrCreateFolder(SIGNATURE_FOLDER_NAME);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch (err) {
    return 'Error saving signature: ' + String(err);
  }
}

function getOrCreateFolder(name) {
  const folders = DriveApp.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(name);
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
