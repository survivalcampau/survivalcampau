# Survival skills app: waitlist page

A one-page waitlist site for a survival-skills learning app. Plain HTML, CSS and JavaScript with no build step, hosted free on GitHub Pages. Sign-ups go to a private Google Sheet through a small Google Apps Script.

| File | What it is |
| --- | --- |
| `index.html` | The page: all sections, inline SVG artwork, SEO and link-preview tags |
| `styles.css` | Colours, fonts and layout (colours and fonts live in `:root` at the top) |
| `script.js` | Fills in the name, validates and sends the form, the share button |
| `config.js` | **The settings to edit:** app name, contact email, site URL, Apps Script URL |
| `apps-script/Code.gs` | The Google Apps Script that writes sign-ups to the Sheet |
| `assets/` | Logo/favicon, background contour tile, link-preview image (`og-image.png`, made from `og-image.svg`) |

---

## Preview locally

```sh
cd ~/survival-waitlist
python3 -m http.server 8000
```

Open <http://localhost:8000>. Press Ctrl+C in that window to stop it.

Add `?demo-signup` to the address to try the whole sign-up flow without sending anything: <http://localhost:8000/?demo-signup>

---

## Rename the app

The app is currently called **SurvivalCamp**.

**Quick way:** from the project folder, run this with the new name in place of `NewName`:

```sh
grep -rlF --exclude-dir=.git --exclude=README.md 'SurvivalCamp' . | xargs perl -pi -e 's/\QSurvivalCamp\E/NewName/g'
```

It updates `config.js`, the page and the link-preview tags in one go. For later renames, put the name at the time in place of `SurvivalCamp` (in both spots). If the new name contains `@` or `$`, put a `\` before it.

**By hand:**
1. Change `SITE_NAME` in `config.js`. That updates every mention on the page.
2. Update the block marked `RENAME` at the top of `index.html` (title and Open Graph tags). Search engines and link previews read those directly and don't run JavaScript.

The preview image doesn't include the name, so it never needs redoing for a rename.

Change the contact email the same way:

```sh
grep -rlF --exclude-dir=.git --exclude=README.md 'hello@example.com' . | xargs perl -pi -e 's/hello\@example\.com/you\@yourdomain.com.au/g'
```

---

## Connect the Google Sheet

This takes about 10 minutes. The Sheet stays private to your Google account. The script URL ends up public (it's in `config.js`), which is normal for a form like this: it can add rows but can't read them.

1. **Create the Sheet.** Go to <https://sheets.new> and name it something like *Waitlist sign-ups*. Double-click the **Sheet1** tab at the bottom and rename it **`Waitlist`**.
   Leave row 1 empty: the script writes the headers itself. If you'd like friendlier headers later, rename them (e.g. `First name` instead of `first_name`), reorder the columns or add your own `notes` column. The script matches columns by header name.

2. **Add the script.** In the Sheet, click **Extensions → Apps Script**. Delete everything in `Code.gs`, paste in the full contents of `apps-script/Code.gs` from this folder, and click **Save** (the disk icon). Name the project *Waitlist* (top left).

3. **Test it from the editor.** In the function menu next to **Run**, choose **`testDoPost`**, then click **Run**.
   Google asks for permission the first time. Click **Review permissions**, pick your account, and you'll see *"Google hasn't verified this app"*. That's normal for your own scripts. Click **Advanced → Go to Waitlist (unsafe) → Allow**.
   The log should show `{"ok":true}`, and the `Waitlist` tab should now have a header row plus a row for `test@example.com`. Delete that test row and keep the headers.

4. **Deploy it as a web app.** Click **Deploy → New deployment**, then the gear icon next to *Select type* → **Web app**.
   - Description: `Waitlist v1`
   - Execute as: **Me**
   - Who has access: **Anyone** (not "Anyone with Google account", or sign-ups from the site will fail)

   Click **Deploy** and copy the **Web app URL**. It ends in `/exec`.

5. **Paste the URL into `config.js`:**

   ```js
   const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfy...your-id.../exec";
   ```

   Save, then commit and push (see *Publish* below).

**If you edit the script later:** go to **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**. The URL stays the same. (*New deployment* would create a new URL that you'd have to paste in again.)

What the script does with each sign-up:
- Adds a row with a timestamp, email, first name, skills, field-day answer, postcode, `utm_*` tags, referrer and seconds spent on the page.
- Ignores bots that fill the hidden spam-trap field, but still replies "ok" so they learn nothing.
- Rejects invalid emails, and anything submitted less than 3 seconds after the page loaded.
- Stores everything as plain text. Nothing can run as a formula, and postcodes like `0800` keep their leading zero.
- Writes one sign-up at a time, so two people joining at the same moment can't clash.

---

## Test it

1. Open your `/exec` URL in a browser. You should see `{"ok":true,"message":"Waitlist endpoint is running..."}`.
2. Open the site with test tags, e.g. <http://localhost:8000/?utm_source=test&utm_medium=email&utm_campaign=launch>, fill in the form with your own email, wait a few seconds and press **Join the waitlist**. A new row should appear within a couple of seconds, with the `utm_` columns filled in.
3. Try a broken email such as `sam@`. The form should show an error and send nothing.

**Troubleshooting**
- *"Sign-ups aren't switched on yet"*: `APPS_SCRIPT_URL` in `config.js` is still the placeholder.
- *"Sorry, we couldn't add you just then"*: check that access is set to **Anyone**, that the URL ends in `/exec` (not `/dev`), and that you deployed a **new version** after editing the script. In Apps Script, **Executions** (left sidebar) lists every sign-up attempt and any errors.
- *A column stays empty*: its header probably doesn't match. The script adds the standard header at the end of row 1 instead, so look there.

---

## Export the list

- **File → Download → Comma-separated values (.csv)** or **Microsoft Excel (.xlsx)**. Mailchimp, Kit, MailerLite and Brevo all import CSV.
- **Duplicates** (someone joined twice): select the `email` column, then **Data → Data cleanup → Remove duplicates**.
- **Removal requests:** delete the person's row here and remove them from your email tool.

Australia's Spam Act applies to the emails you send: say who you are, include a working unsubscribe link in every email, and act on unsubscribes within 5 working days.

---

## Publish on GitHub Pages

The site is set up for **<https://survivalcampau.github.io/>**: a public repo named `survivalcampau.github.io` in the `survivalcampau` GitHub organisation. With GitHub Desktop:

1. **File → Add Local Repository…**, choose this folder, then **Add Repository**.
2. Click **Publish repository**. Set the name to **`survivalcampau.github.io`** (exactly), **untick "Keep this code private"** (free GitHub Pages needs a public repo), and choose **Organization: survivalcampau**. Click **Publish Repository**.
   If the organisation isn't in the list: on github.com go to **Settings → Applications → Authorized OAuth Apps → GitHub Desktop**, click **Grant** next to `survivalcampau`, then restart GitHub Desktop.
3. On github.com, open the repo → **Settings → Pages**. Check that Source is **Deploy from a branch**, Branch **main**, folder **/ (root)**, and click **Save** if you changed anything.
4. After a minute or two the site is live at **<https://survivalcampau.github.io/>**

For later changes, commit in GitHub Desktop and click **Push origin**. The site updates within a minute or so.

If you move to another address or add a custom domain (e.g. a .com.au), update `SITE_URL` in `config.js` and the three URLs in the `RENAME` block of `index.html` (`canonical`, `og:url`, `og:image`).

To check the link preview, paste the live URL into the [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/), or message it to yourself.

---

## Before you launch

- [ ] Settle on the final name (renaming is one command, see above)
- [ ] Swap `hello@example.com` for your real contact email
- [ ] Connect the Google Sheet and send yourself a test sign-up from the live site
- [ ] If you add analytics (there's a commented spot in `<head>`), mention it in the footer privacy note

---

## Customising

- **Colours, fonts, spacing:** the `:root` block at the top of `styles.css`.
- **Skills:** the chips in the form and the badges in the skill tree, both in `index.html`. The script accepts any skill names, so nothing else needs changing.
- **Preview image:** edit `assets/og-image.svg`, then re-render the PNG with the local preview server running:

  ```sh
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --hide-scrollbars \
    --window-size=1200,630 --virtual-time-budget=8000 \
    --screenshot="$PWD/assets/og-image.png" http://localhost:8000/assets/og-image.svg
  ```

## How it's built

- **No frameworks or build step.** The page, CSS, JS and artwork come to roughly 100 KB before compression, plus two Google Fonts.
- **Why the form sends form-encoded data instead of JSON:** Apps Script can't answer the extra CORS check browsers make before a JSON request. A form-encoded POST counts as a "simple" request, so the browser skips that check, and Google's JSON reply can still be read.
- **Accessibility:** labelled fields, errors linked to their fields and read out by screen readers, visible focus outlines, AA colour contrast, keyboard-friendly chips, and the campfire animation switches off when the device asks for reduced motion.
