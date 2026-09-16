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
// string into SHARED_SECRET near the top of app.js. Used by the forms
// when they submit — it's embedded in the public site code, so treat it
// as a light deterrent, not real security.
const SHARED_SECRET = 'PICK-A-RANDOM-SECRET-AND-PASTE-IT-IN-APP-JS-TOO';

// A SEPARATE password for viewing submissions. This one is NOT stored
// anywhere in the website's code — the manager types it in on the
// Submissions page each time, so it's real access control, not just an
// embedded string anyone could find by viewing source.
const ADMIN_SECRET = 'PICK-A-DIFFERENT-PASSWORD-FOR-MANAGERS-ONLY';

const SHEET_NAMES = {
  'time-punch': 'TimePunch',
  'uniform-order': 'UniformOrder',
  'mileage': 'Mileage',
  'doctor-note': 'DoctorsNotes',
};

const HEADERS = {
  'time-punch': ['Timestamp', 'Ticket', 'Employee', 'Shift Date', 'Issue', 'Correct Time', 'Reason', 'Manager'],
  'uniform-order': ['Timestamp', 'Ticket', 'Employee', 'Item', 'Size', 'Qty', 'Reason', 'Signature URL'],
  'mileage': ['Timestamp', 'Ticket', 'Employee', 'Trip Date', 'Purpose', 'From', 'To', 'Miles', 'Rate', 'Total'],
  'doctor-note': ['Timestamp', 'Ticket', 'Employee', 'Absence Start', 'Absence End', 'Reason', 'Notes', 'File URL'],
};

const SIGNATURE_FOLDER_NAME = 'Uniform Order Signatures';

// A separate, more restricted folder for medical documentation. Files
// here are shared only within your Google Workspace domain (not with
// "anyone with the link") when a domain is available — see SETUP.md for
// why this one gets tighter handling than the signature folder.
const DOCTOR_NOTE_FOLDER_NAME = 'Doctor Notes (Restricted)';

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
    } else if (formType === 'doctor-note') {
      const fileUrl = f.noteFile ? saveDoctorNoteFile(f.noteFile, f.ticketNo, f.noteFileName) : '';
      row = [now, f.ticketNo, f.empName, f.absenceFrom, f.absenceTo, f.reason, f.extraNotes, fileUrl];
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
    if (!e.parameter || e.parameter.secret !== ADMIN_SECRET) {
      return jsonOutput({ ok: false, error: 'Wrong password' });
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

// Doctor's notes are medical documentation, so these files are kept
// PRIVATE by default — only the Google account that owns this script can
// open them. Nothing here makes them link-shareable. See SETUP.md for
// how to grant specific managers access to the "Doctor Notes (Restricted)"
// Drive folder deliberately, rather than anyone-with-the-link.
function saveDoctorNoteFile(dataUrl, ticketNo, originalName) {
  try {
    const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
    if (!match) throw new Error('Unexpected file format');
    const mimeType = match[1];
    const base64 = match[2];
    const ext = extensionForMime(mimeType, originalName);
    const filename = (ticketNo || 'doctor-note') + ext;
    const blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, filename);
    const folder = getOrCreateFolder(DOCTOR_NOTE_FOLDER_NAME);
    const file = folder.createFile(blob);
    // Intentionally no setSharing() call — file stays private to this
    // Google account until a manager is explicitly granted access.
    return file.getUrl();
  } catch (err) {
    return 'Error saving file: ' + String(err);
  }
}

function extensionForMime(mimeType, originalName) {
  if (originalName && originalName.indexOf('.') !== -1) {
    return originalName.substring(originalName.lastIndexOf('.'));
  }
  if (mimeType === 'application/pdf') return '.pdf';
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/jpeg') return '.jpg';
  return '';
}

function getOrCreateFolder(name) {
  const folders = DriveApp.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(name);
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
