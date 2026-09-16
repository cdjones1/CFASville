# Connecting the forms to a shared Google Sheet

This turns "submissions saved on whatever device filled out the form" into
"all submissions land in one Google Sheet, and the Submissions page shows
everything live." No paid hosting, no server to maintain.

## 1. Create the Sheet

1. Go to sheets.google.com and create a new blank spreadsheet.
2. Name it something like **CFA Stephenville Team Forms**.

## 2. Add the Apps Script

1. In the Sheet, go to **Extensions > Apps Script**.
2. Delete the placeholder code in `Code.gs`, and paste in the contents of
   `google-apps-script/Code.gs` from this project.
3. Near the top, change `SHARED_SECRET` to a random string only you know —
   e.g. `stephenville-cfa-9f2k1`. This is what the forms use to submit, so
   it lives in the public site code — treat it as a light deterrent, not
   real security.
4. Just below it, change `ADMIN_SECRET` to a **different** password —
   this is the one managers will type in to view the Submissions page.
   Unlike `SHARED_SECRET`, this one never gets written into the site's
   code, so it's genuinely harder to find or bypass.
5. Save the project (the disk icon, or Ctrl/Cmd+S).

## 3. Deploy it as a Web App

1. Click **Deploy > New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Set **Execute as**: Me. Set **Who has access**: Anyone.
4. Click **Deploy**.
5. The first time, Google will ask you to authorize the script — click
   through the "Google hasn't verified this app" warning (it's your own
   script), and allow the Sheets and Drive permissions it asks for. Drive
   access is only used to store uniform-order signature images.
6. Copy the **Web app URL** it gives you — it looks like
   `https://script.google.com/macros/s/AKfycb.../exec`.

## 4. Connect the site to it

1. Open `app.js` in the site files.
2. Set `SCRIPT_URL` to the Web app URL you copied.
3. Set `SHARED_SECRET` to the exact same string you put for `SHARED_SECRET`
   in `Code.gs`. (Do **not** put `ADMIN_SECRET` anywhere in `app.js` —
   that password only ever gets typed in by hand on the Submissions page.)
4. Save, and re-upload `app.js` to GitHub (or push the change).

That's it — form submissions now write straight to the Sheet. Visiting
`submissions.html` will now ask for the manager password (your
`ADMIN_SECRET`) before showing anything.

## If you ever change the script's code later

Editing `Code.gs` alone doesn't update the live Web App — you need to
**Deploy > Manage deployments > edit (pencil icon) > New version > Deploy**
for changes to take effect.

## What lands where

- Each form gets its own tab in the Sheet: `TimePunch`, `UniformOrder`,
  `Mileage`, `DoctorsNotes` — created automatically the first time each
  form is submitted.
- Uniform order signatures are saved as PNG images in a Google Drive folder
  called **Uniform Order Signatures**, and the Sheet gets a link to each one.
- If a device is offline (or the site hasn't been connected yet), that
  submission is saved only in that browser's local storage, and shows up
  in the "Saved on this device only" section of the Submissions page.

## Doctor's notes are handled more carefully

A doctor's note is medical documentation, so it's treated differently from
a signature:

- Files land in a separate Drive folder, **Doctor Notes (Restricted)**,
  created automatically the first time someone submits one.
- Unlike the signature folder, files here are **not** made link-shareable.
  They're private to the Google account that owns the Apps Script by
  default — clicking "View note" on the dashboard will show an access
  error for anyone else, including a manager, until you explicitly grant
  them access.
- To let a manager view them: open Google Drive, find the **Doctor Notes
  (Restricted)** folder, right-click it, choose **Share**, and add that
  manager's Google account by email with Viewer access. Only add people
  who genuinely need to see medical documentation — this isn't something
  to open up broadly.
- If you'd rather not use Drive sharing at all, you can instead just rely
  on the "Reason" and date fields in the sheet for record-keeping, and
  have the manager review the uploaded file in person on request.
