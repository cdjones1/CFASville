/* Stephenville Chick-fil-A — Team Forms
   Shared storage + helper logic. No backend: submissions live in this
   browser's localStorage only. */

const STORAGE_KEY = "cfa_stephenville_submissions_v1";

const FORM_LABELS = {
  "time-punch": "Time Punch Adjustment",
  "uniform-order": "Uniform Order",
  "mileage": "Mileage Reimbursement",
};

function readAllSubmissions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Could not read stored submissions:", e);
    return [];
  }
}

function writeAllSubmissions(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function saveSubmission(formType, fields) {
  const all = readAllSubmissions();
  const record = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random(),
    formType,
    ticketNo: fields.ticketNo,
    submittedAt: new Date().toISOString(),
    fields,
  };
  all.push(record);
  writeAllSubmissions(all);
  return record;
}

function getSubmissionsByType(formType) {
  return readAllSubmissions().filter((r) => r.formType === formType);
}

/* Ticket numbers look like real QSR order numbers: a form prefix + a
   short daily-ish sequence, so every submission reads like a slip
   torn off a rail. */
function generateTicketNo(prefix) {
  const n = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${n}`;
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/* ---------- CSV export ---------- */

function toCSV(rows, columns) {
  const esc = (v) => {
    const s = v === undefined || v === null ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = columns.map((c) => esc(c.label)).join(",");
  const body = rows
    .map((row) => columns.map((c) => esc(c.get(row))).join(","))
    .join("\n");
  return header + "\n" + body;
}

function downloadCSV(filename, csvText) {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ---------- Signature pad (canvas) ---------- */

function initSignaturePad(canvas) {
  const ctx = canvas.getContext("2d");
  let drawing = false;
  let hasStroke = false;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#241C18";
  }
  resize();
  window.addEventListener("resize", resize);

  function pos(e) {
    const rect = canvas.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
  }

  function start(e) {
    e.preventDefault();
    drawing = true;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }
  function move(e) {
    if (!drawing) return;
    e.preventDefault();
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    hasStroke = true;
  }
  function end() {
    drawing = false;
  }

  canvas.addEventListener("mousedown", start);
  canvas.addEventListener("mousemove", move);
  window.addEventListener("mouseup", end);
  canvas.addEventListener("touchstart", start, { passive: false });
  canvas.addEventListener("touchmove", move, { passive: false });
  canvas.addEventListener("touchend", end);

  return {
    isEmpty: () => !hasStroke,
    clear: () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasStroke = false;
    },
    toDataURL: () => canvas.toDataURL("image/png"),
  };
}

/* ---------- Simple required-field validation ---------- */

function validateRequired(fieldsWithEls) {
  let ok = true;
  fieldsWithEls.forEach(({ el, valid }) => {
    const wrap = el.closest(".field");
    if (!valid) {
      ok = false;
      if (wrap) wrap.classList.add("invalid");
    } else if (wrap) {
      wrap.classList.remove("invalid");
    }
  });
  return ok;
}
