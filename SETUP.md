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
   e.g. `stephenville-cfa-9f2k1`. Anyone with this string can read or write
   submissions, so don't post it publicly.
4. Save the project (the disk icon, or Ctrl/Cmd+S).

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
3. Set `SHARED_SECRET` to the exact same string you put in `Code.gs`.
4. Save, and re-upload `app.js` to GitHub (or push the change).

That's it — form submissions now write straight to the Sheet, and
`submissions.html` reads from it live.

## If you ever change the script's code later

Editing `Code.gs` alone doesn't update the live Web App — you need to
**Deploy > Manage deployments > edit (pencil icon) > New version > Deploy**
for changes to take effect.

## What lands where

- Each form gets its own tab in the Sheet: `TimePunch`, `UniformOrder`,
  `Mileage` — created automatically the first time each form is submitted.
- Uniform order signatures are saved as PNG images in a Google Drive folder
  called **Uniform Order Signatures**, and the Sheet gets a link to each one.
- If a device is offline (or the site hasn't been connected yet), that
  submission is saved only in that browser's local storage, and shows up
  in the "Saved on this device only" section of the Submissions page.
