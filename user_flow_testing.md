# User Flow Testing

Manually verified user flows, organized by feature. Each flow lists the steps and the
expected result. Update this as new features ship.

---

## Care · Physical · Vitals logger

**Prerequisite:** the `care_logs` table exists in Supabase (migration `supabase/migrations/0003_care_logs.sql` run in the SQL editor).

### Flow 1 — Navigate to the Vitals logger
1. Sign in to an onboarded account.
2. Bottom tab bar → **Care**.
3. Tap **Physical care**.
4. Tap the **Vitals** card.
- ✅ Lands on the Vitals screen with a "Log a reading" button. Empty state ("No readings yet") when there are no logs.

### Flow 2 — Log a blood pressure reading
1. Tap **Log a reading** ("Blood pressure" selected by default).
2. Enter Systolic `120`, Diastolic `80` (pulse optional).
3. Confirm the **Date & time** field defaults to now; a future time can't be chosen.
4. Tap **Save reading**.
- ✅ Writes to the Supabase `care_logs` table, then mirrors to the local cache.
- ✅ Returns to the list; newest card shows `120/80 mmHg` with the title + date & time.

### Flow 3 — Log weight (with unit toggle + note)
1. Log a reading → **Weight** → enter `62`, toggle unit **kg ↔ lb** (default kg), add a note.
2. Save.
- ✅ Card shows `62 kg`; the note appears beneath it.

### Flow 4 — Log blood sugar (with unit + context)
1. Log a reading → **Blood sugar** → enter `5.4`, unit `mmol/L`, context **Fasting**.
2. Save.
- ✅ Card shows `5.4 mmol/L · Fasting`.

### Flow 5 — Validation
1. Log a reading → leave required value fields blank → **Save**.
- ✅ Inline "Enter a number" errors; nothing saves.
2. Enter `0` or letters in a value field.
- ✅ Still rejected (must be a positive number).

### Flow 6 — Date & time picker
1. In the add form, open **Date & time**.
- ✅ iOS shows a combined date + time spinner; Android asks for the date, then the time.
2. Pick an earlier date/time and save.
- ✅ The reading is timestamped with the chosen date & time; the list shows it (e.g. `14 Jun 2026 · 3:42 PM`).

### Flow 7 — Persistence
1. Log a reading, switch to the **Home** tab, return to **Care → Physical → Vitals**.
- ✅ Reading still present.
2. Fully close and reopen the app.
- ✅ Reading still present (loaded from the database; cache as fallback).
3. Confirm rows appear in Supabase **Table Editor → `care_logs`**.
- ✅ Database is the source of truth.

### Flow 8 — Delete a reading
1. Tap the trash icon on a card → confirm the dialog → **Delete**.
- ✅ Removed from the database and the list; stays gone after reload.

### Flow 9 — Offline / anti-hang
1. Enable Airplane mode, reopen the Vitals screen.
- ✅ List renders from cache with a "Showing saved readings — couldn't refresh" pill; no infinite spinner.
2. Try to save a reading while offline.
- ✅ Clear "Could not save" alert (no hang). *(No offline write queue yet — writes need a live connection.)*
3. Disable Airplane mode, reopen.
- ✅ List refreshes; pill gone.

---

## Care · Physical · Symptoms logger

**Prerequisite:** the `care_logs` table exists (migration `0003`). No new migration — symptoms reuse the same table with `log_type = 'symptom'`.

### Flow 1 — Navigate to the Symptoms logger
1. Care → **Physical care** → **Symptoms** card.
- ✅ Symptoms screen with a "Log a symptom" button; empty state ("No symptoms logged") when there are none.

### Flow 2 — Log a preset symptom with severity
1. Tap **Log a symptom** → pick a preset (e.g. Nausea) → choose a severity (Mild / Moderate / Severe).
2. Optionally set Date & time and a note → **Save symptom**.
- ✅ Writes to `care_logs` (`log_type = 'symptom'`), mirrors to cache.
- ✅ Card appears at top with the symptom name, a colored severity pill, and date & time.

### Flow 3 — "Other" free-text symptom
1. Log a symptom → pick **Other**.
- ✅ A "Describe the symptom" field appears.
2. Save with it blank.
- ✅ Inline "Please describe the symptom" error; nothing saves.
3. Enter custom text (e.g. "Dizziness") → Save.
- ✅ Logs that text as the symptom.

### Flow 4 — Severity colors
1. Log entries at Mild, Moderate, and Severe.
- ✅ Pill colors differ: Mild = green, Moderate = sage, Severe = red.

### Flow 5 — Persistence
1. Switch tabs / reopen the app.
- ✅ Entries persist (loaded from the database; cache as fallback).
2. Confirm rows in Supabase **Table Editor → `care_logs`** with `log_type = 'symptom'`.

### Flow 6 — Delete a symptom
1. Tap the trash icon → confirm dialog → **Delete**.
- ✅ Removed from the database and the list; stays gone after reload.

### Flow 7 — Offline / anti-hang
1. Airplane mode → reopen the Symptoms screen.
- ✅ List renders from cache with a "Showing saved entries — couldn't refresh" pill; no spinner hang.
2. Try to save while offline.
- ✅ Clear "Could not save" alert (no hang).
3. Disable Airplane mode, reopen.
- ✅ List refreshes; pill gone.

---

## Care · Physical · Actionables

**Prerequisite:** the `care_logs` table exists (migration `0003`). No new migration — actionables reuse the same table with `log_type = 'actionable'` (item definitions and completion checks are two `data.kind`s).

Each actionable has a **name**, optional **what to do**, a **schedule**, and a (placeholder) **linked-to**. A schedule is either **Repeating** (a cadence + optional active window) or **One-off** (a fixed count + optional deadline). The list is **empty by default** — there are no preset items.

### Flow 1 — Navigate / empty state
1. Care → **Physical care** → **Actionables** card.
- ✅ "No actionables yet" empty state + an "Add an actionable" button. No preset items.

### Flow 2 — Repeating (no dates)
1. Add → Name "Prenatal vitamins", What to do "One tablet with breakfast", Schedule **Repeating**, How often **Daily**, leave dates empty → **Add actionable**.
- ✅ Card shows the name + instruction, a `Daily` pill, and one empty completion circle.
2. Tap the circle.
- ✅ Fills to a checkmark, tile turns sage, a `🔥 1-day streak` pill appears, the "ON TRACK" bar advances. Tap again → reverts.

### Flow 3 — Twice daily
1. Add a **Repeating** item, How often **Twice daily**.
- ✅ Two circles. One filled = `1/2`, not yet "done" (tile muted, no streak). Both filled → complete + streak. Tapping a filled circle steps back to one.

### Flow 4 — Weekly / Monthly cadence
1. Add a **Weekly** item, check it once.
- ✅ `Weekly` pill; checking shows `1-week streak`. It stays satisfied for the rest of the calendar week (doesn't reset the next day).

### Flow 5 — Active window (start / end dates)
1. Add a **Repeating** item with **Add a start date** = tomorrow.
- ✅ Card shows a `Starts <date>` pill and **no** circle (not active yet).
2. Add another with start = end = **yesterday**.
- ✅ Card shows an `Ended` pill, no circle, and it's excluded from "ON TRACK".
3. In the form, add a date then tap **Clear**.
- ✅ Reverts to "Add a … date".
4. Set start = today, end = yesterday → **Add**.
- ✅ "Check the dates" alert; nothing saves.

### Flow 6 — One-off: one-time
1. Add → Schedule **One-off**, **Once**, no deadline.
- ✅ `One-time` pill, a single circle; checking completes it (no streak). Counts in "ON TRACK".

### Flow 7 — One-off: limited count + deadline
1. Add → **One-off**, **3 times**, deadline a few days out.
- ✅ `3× · by <date>` pill, three circles, and a `0/3 done` pill that updates as you tick. Complete when all three are checked.

### Flow 8 — Overdue
1. Add → **One-off**, **Twice**, deadline = yesterday; leave incomplete.
- ✅ Red `Overdue` pill; still completable. Overdue/active items sort above upcoming/ended.

### Flow 9 — As needed
1. Add a **Repeating** item, How often **As needed**.
- ✅ No circles — shows a "Log done" button instead; no streak; not counted in "ON TRACK". Tapping "Log done" records a completion.

### Flow 10 — Validation & linked-to placeholder
1. Add with a blank Name → **Add actionable**.
- ✅ Inline "Please name the actionable"; nothing saves.
2. Tap the **LINKED TO** "Connect to a prescription or appointment" row.
- ✅ "Coming soon" alert; nothing stored. *(Future: link to a doctor event / prescription.)*

### Flow 11 — Persistence
1. Switch tabs / reopen the app.
- ✅ Items and today's checks persist (loaded from the database; cache as fallback).
2. Confirm in Supabase **Table Editor → `care_logs`**: `log_type='actionable'` rows — `data.kind='actionable_item'` (with a `schedule` object) for items, `data.kind='actionable_check'` for completions.

### Flow 12 — Streak across periods (optional)
1. In the Table Editor, edit a check row's `logged_at`/`logged_date` to an earlier day/week/month and reopen.
- ✅ The streak pill grows in the item's own unit (e.g. `2-day streak`, `2-week streak`).

### Flow 13 — Remove
1. Tap the trash icon on an item → confirm → **Remove**.
- ✅ Disappears and stays gone after reload. *(Its past check rows are left orphaned in the DB — harmless; they stop rendering.)*

### Flow 14 — Offline / anti-hang
1. Airplane mode → reopen Actionables.
- ✅ List renders from cache with a "Showing saved list — couldn’t refresh" pill; no spinner hang.
2. Tap a circle while offline.
- ✅ "Could not update" alert and the toggle reverts (no hang). *(No offline write queue yet.)*
3. Disable Airplane mode, reopen.
- ✅ List refreshes; pill gone.

---

## Care · Physical · Test results & scans

**Prerequisite:** the `care_logs` table exists (migration `0003`) **and** the `care-files` Storage
bucket + policies exist (migration `0004_care_files_storage.sql` run in the SQL editor). Results reuse
`care_logs` with `log_type = 'test_result'`; files live in the private `care-files` bucket
(`<uid>/…`). A result is either a **Scan / report** (title + note + one or more files) or a **Lab
value** (name + value + unit + reference range, with an optional single file).

### Flow 1 — Navigate / empty state
1. Care → **Physical care** → **Test results & scans** card.
- ✅ "No results yet" empty state + an "Add a result" button.

### Flow 2 — Add a scan/report (photo)
1. Add a result → **Scan / report** selected → Title "20-week anomaly scan".
2. **Take photo** (grant camera) or **Choose photo** (grant photo access) → the image appears as a
   removable 72×72 thumbnail.
3. Set the **Date** (defaults to today; no future), optional note → **Save result**.
- ✅ Uploads the file to `care-files/<uid>/…`, writes the `care_logs` row, returns to the list.
- ✅ Card shows the title + date; the thumbnail renders (loaded via a signed URL). Tapping it opens
  the full image in the in-app browser.

### Flow 3 — Add a scan/report (PDF + multiple files)
1. Add → **Scan / report** → **Attach PDF** → pick a PDF; add a second photo too.
- ✅ Both appear as removable chips/thumbnails (up to 8). Tapping the ✕ removes one.
2. Save.
- ✅ Card shows a tappable PDF chip (filename) + the image thumbnail. Tapping the PDF chip opens it
  in the browser (brief spinner while the signed URL is fetched).

### Flow 4 — Add a lab value (with reference range)
1. Add → **Lab value** → Test name "Hemoglobin", Value `11.2`, Unit "g/dL", Ref low `11`, Ref high `15`.
2. Save (no file).
- ✅ Card shows `11.2 g/dL`, a green **In range** pill, and `Ref 11–15`.
3. Add another with Value `9.0`, same range.
- ✅ Red **Below range** pill. A value above Ref high → **Above range** (red).

### Flow 5 — Lab value with an optional file
1. Add → **Lab value**, fill the value, then attach one photo/PDF.
- ✅ "A lab value keeps one attachment — adding another replaces it." Picking a second file replaces
  the first. Saved card shows the single file.

### Flow 6 — Toggle behaviour & validation
1. In the add form, switch **Scan / report ↔ Lab value**.
- ✅ Fields swap; switching to Lab value trims attachments to one.
2. Save a **Scan / report** with a blank title → ✅ "Please give it a title". With a title but no
   file → ✅ "Attach at least one photo or PDF".
3. Save a **Lab value** with a blank name or non-numeric value → ✅ inline "Please name the test" /
   "Enter a number"; nothing saves.

### Flow 7 — Persistence
1. Switch tabs / reopen the app.
- ✅ Results persist (DB source of truth, cache fallback). Thumbnails re-fetch their signed URLs.
2. Confirm in Supabase: `care_logs` rows (`log_type='test_result'`, `data.kind` =
   `test_attachment` | `test_value`) and objects under **Storage → care-files → `<uid>/`**.

### Flow 8 — Delete
1. Tap the trash icon → confirm → **Delete**.
- ✅ Row removed from the list and DB; the attached file(s) are removed from Storage. Stays gone
  after reload.

### Flow 9 — Offline / anti-hang
1. Airplane mode → reopen the screen.
- ✅ List renders from cache with a "Showing saved results — couldn’t refresh" pill; image
  thumbnails show a placeholder icon (signed URLs can't load) — no spinner hang.
2. Try to save while offline.
- ✅ Clear "Could not save" alert (the upload fails fast — bounded); no hang. *(No offline write
  queue yet.)*
3. Disable Airplane mode, reopen.
- ✅ List refreshes; thumbnails load; pill gone.
