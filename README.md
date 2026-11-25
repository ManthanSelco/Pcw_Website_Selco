# PCW: Platform for Collective Wisdom (MERN)

The same website as https://pcw-staging.webflow.io, now running on **MongoDB + Express + React + Node**.
The design, images, fonts and animations (GSAP, ScrollMagic, Lenis, Webflow interactions) are unchanged.

```
pcw-mern/
├─ client/                 React (Vite) website
│  ├─ index.html           <head>: Webflow CSS, fonts, GSAP/ScrollMagic libraries
│  ├─ src/App.jsx          page switch: Home, /space/bangalore, /space/guwahati, /recordings
│  ├─ src/pages/           HomePage, CityPage (events + calendar), RecordingsPage
│  ├─ src/components/      EventCard, Calendar, FormModal (RSVP / booking), nav+footer, braid
│  ├─ src/styles/pages.css styles for the new pages (same PCW colours)
│  ├─ src/sections/        one React component + one .html file per page section
│  │    Navbar, Loader, Hero, WhatIsPcw, PartnerScroll, Collective,
│  │    OurSpace, BrainBanner, Instagram, Footer
│  ├─ src/legacy/          the site's original custom scripts (animations, menu, loader)
│  ├─ src/features/        new React-side features (newsletter -> our API)
│  └─ public/              Webflow CSS/JS, images, fonts, hero/logo SVG snippets
├─ server/                 Express API + serves the built React site
│  ├─ src/app.js           /api/health, /api/newsletter, /api/events, /api/rsvp, /api/bookings, /cdn
│  ├─ seed/events-template.csv   Excel template to add events
│  ├─ src/lib/store.js     MongoDB (or a local test file when MONGODB_URI is empty)
│  └─ .env.example         PORT, MONGODB_URI
├─ deploy/setup-ec2.sh     one-command AWS EC2 setup
└─ 1-INSTALL.bat 2-RUN.bat 3-SHARE.bat
```

## Run on your laptop

You need **Node.js 20 or newer**. MongoDB is optional for testing: without it, data goes to `data/db.json`.

**Double-click:** `1-INSTALL.bat` (once), then `2-RUN.bat` (opens http://localhost:4000) or `3-SHARE.bat` (cloud link and Wi-Fi link).

**PowerShell (one command at a time):**
```powershell
cd D:\PCW\pcw-mern
```
```powershell
Copy-Item server\.env.example server\.env
```
```powershell
npm run setup
```
```powershell
npm run fetch-images
```
```powershell
npm start
```
Share it (cloud link, Wi-Fi link and QR codes):
```powershell
npm run share
```
Development with live reload (React on http://localhost:5173):
```powershell
npm run dev
```

**To use MongoDB:** in `server\.env` set `MONGODB_URI=mongodb://127.0.0.1:27017/pcw` (local MongoDB) or your MongoDB Atlas link, then restart.

## Pages
| Page | Link | What it shows |
|---|---|---|
| Home | `/` | Same as the Webflow site, with the new nav |
| Bangalore | `/space/bangalore` | Top pill: **Events ▾** (Upcoming / Past / Calendar), **The space**, **Book the space**. Then category filter, Upcoming events, Past events, Calendar, the space section, and **Book the space** last. Every "Book the space" button opens the Google booking form in a new tab |
| Guwahati | `/space/guwahati` | Same layout for Guwahati |
| (both cities) | `#the-space` | **"A Space to Connect in Person"**, the same design as the home page. Bangalore has its space photos. Guwahati shows "Photo coming soon" until photos are uploaded |
| Event page | `/event/<name>` | Photo, date/time/venue, RSVP, Add to calendar, Share/WhatsApp, description, speakers, **YouTube video playing on the page**, more events |
| Recordings | `/recordings/podcasts`, `/recordings/reports`, `/recordings/videos` | BIC-style "Watch / Listen / Read": tabs **Podcasts · Reports · Videos**, count, city/category filter, search, cards with cover photo. YouTube, Spotify, SoundCloud, Apple Podcasts, Google Drive and .mp3/.mp4 links **play on the website**; PDF and other links open in a new tab. Event videos show under Videos automatically |
| **Admin** | `/admin` | Login, then manage everything below |

Event cards follow the BIC (Bangalore International Centre) style: photo, category, title, one line, RSVP (or "RSVPs closed"), and date & time.

## Admin panel: http://localhost:4000/admin
The login ID and password come from **`server/.env`** (created automatically on the first start):
```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=Pcw@2026
```
To change the login, edit these two lines, save, and restart (`npm start`). The new ID/password work right away.

- **Dashboard**: counts of events, podcasts, reports, videos, RSVPs and newsletter, plus the latest RSVPs.
- **Events**: add, edit or delete events, with:
  - city, title, one line, category, date, start/end time, venue
  - **photo upload**, compressed automatically
  - **YouTube link**: paste any YouTube link and the video plays on the event page and the Recordings page
  - description, speakers, RSVP (Open / Closed / No RSVP), seats (RSVP closes when full), and Show on website on/off
- **Delete all sample events**: one button. The site starts with 11 **sample events** (marked "Sample") so the pages aren't empty. Delete them when your real events are in.
- **Recordings**: add, edit or delete **podcasts, reports and videos**: title, episode number, speakers/authors (one line), category, city, date, **link** (the form tells you if it will play on the site), **cover photo** (S3), about text, and Show on website on/off. 5 sample items are added at first; delete them in one click.
- **City spaces**: heading, intro and the 3 cards (title, text, **photo**) of the space section for each city. Upload the Guwahati photos here when they are ready. They go to S3, and replaced photos are deleted from S3.
- **RSVPs**: see who registered for each event, then search or download them as Excel (CSV).
- **Newsletter**: see the footer sign-ups and download them.
- **Settings**: the **"Book the space" Google Form link** (all booking buttons use it), and how to change the login.

Photos uploaded in the admin panel go to **AWS S3** when it is set up (see below), otherwise to `data/uploads`.

## Images in AWS S3
When `S3_BUCKET` is set in `server/.env`:
- **Upload**: the photo is compressed (WebP) and saved in the bucket under `project/images/pcw/`.
- **Delete**: the photo is removed from the bucket when you replace it, remove it, cancel the form after uploading, delete the event, or use "Delete all sample events".
- **The bucket can stay private.** The website shows images through the server (`/uploads/...`), so no public bucket or CORS setup is needed.

**1. Settings in `server/.env`:**
```
S3_BUCKET=your-bucket-name
S3_REGION=ap-south-1
S3_PREFIX=project/images/pcw
```
**2. Permission (pick one):**
- **On EC2 (recommended):** attach an IAM role to the server with the policy below. No keys are needed in `.env`.
- **On a laptop:** create an IAM user with the same policy and put its keys in `.env` (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`).

Policy (replace `your-bucket-name`):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::selco-application-media-bucket/project/images/pcw/*"
    }
  ]
}
```
**3. Restart the site.** The start-up message shows `Images: S3 bucket "your-bucket-name"`. If the bucket or permission is wrong, you'll see a **WARNING** line at start-up.

Already uploaded some photos before setting up S3? Move them with:
```powershell
npm run images-to-s3
```

### Adding many events at once (optional; the admin panel is easier)
Fill `server\seed\events-template.csv` in Excel (one row per event, delete the example rows), save it as CSV, then run:
```powershell
npm run import-events -- D:\PCW\events.csv
```

### Download data as Excel (CSV) from the command line
The admin panel has download buttons too.
```powershell
npm run export -- rsvps
```
Use `bookings`, `newsletter` or `events` in place of `rsvps`.

## What changed compared with Webflow
- **Newsletter (footer)** now saves emails to MongoDB (collection `newsletter`). It shows the same Webflow "Thank you" message, and duplicate emails are ignored.
  Download the list with `npm run export -- newsletter`.
- Contribute, Partner and Space buttons still open the **same Google Forms** as before.
- Contact, Privacy and Terms links still open the live Webflow pages.
- The "Made in Webflow" badge is hidden.

## Put it on AWS (EC2 Ubuntu, same server as CIP is fine)
Upload the zip from PowerShell:
```powershell
scp -i "D:\keys\your-key.pem" D:\PCW\pcw-mern.zip ubuntu@16.192.105.187:/home/ubuntu/
```
```powershell
ssh -i "D:\keys\your-key.pem" ubuntu@16.192.105.187
```
On the server:
```bash
cd ~ && sudo apt-get install -y unzip rsync && unzip -o pcw-mern.zip
```
```bash
cd ~/pcw-mern && sudo bash deploy/setup-ec2.sh pcw.3-108-88-152.sslip.io 4100
```
The script runs PCW as its own service (`pcw-mern`) with its own nginx file and HTTPS. If MongoDB is running on the server (for example CIP's Docker `mongo` on port 27017), the script uses it with a **separate database named `pcw`**. If your MongoDB needs a username and password, add the link as a 3rd argument:
```bash
sudo bash deploy/setup-ec2.sh pcw.3-108-88-152.sslip.io 4100 "mongodb://USER:PASS@127.0.0.1:27017/pcw?authSource=admin"
```
**Update later:** upload the new zip, unzip it, and run the same command again (your `server/.env` and `data/` are kept).

## Tests
```powershell
npm test
```

## Videos and reports

- **Event recording**: the event's *Video / recording link* takes any link: YouTube, Vimeo, Google Drive and `.mp4`
  play on the event page; other sites (Facebook, a news site...) show a "Watch the recording" button.
  The video also appears under Recordings > Videos.
- **Report upload** (Admin > Recordings > Report): PDF, Word (.doc/.docx) or PowerPoint (.ppt/.pptx), up to **50 MB**.
  Stored in S3 under `project/documents/pcw/` (or `data/uploads/files` without S3) and served at `/files/...`
  (PDF opens in the browser, Word/PowerPoint download with their original name). Bigger files: put them on
  Google Drive / OneDrive / Dropbox, share as "Anyone with the link", and paste the link instead.
  S3 needs `s3:DeleteObject` on `project/documents/pcw/*` too, so replaced/removed reports are deleted.

## Event registration

Each event has a **Registration** choice in Admin > Events:

| Choice | What visitors see |
|---|---|
| Our RSVP form | **RSVP** button, form on the website. Optional seat limit: shows "Housefull" when full. Same email can't register twice. See and download them in Admin > RSVPs |
| Form link (Google Form etc.) | **Register ↗** button that opens your form link in a new tab |
| Closed | "RSVPs closed" |
| No registration | No button (walk-in events) |

After the event date, registration closes by itself. Changing an event's title or date changes its link;
the old link keeps working (redirects to the new one).

## Going live checklist

1. `server/.env`: `SEED_SAMPLES=false`, a strong `ADMIN_PASSWORD`, `SITE_URL`, `MONGODB_URI`, `S3_BUCKET`
   (the EC2 deploy script sets the first three by itself and prints the admin password).
2. Run `npm test` in `server/` (all tests should pass).
3. After deploy: open the site, log in to `/admin`, add a real event, RSVP to it once, check Admin > RSVPs.
4. Google Search Console / Bing: see the next section.

## Server setup (EC2, fresh Ubuntu)

```bash
git clone https://github.com/ManthanSelco/Pcw_Website_Selco.git ~/pcw-src && cd ~/pcw-src
sudo bash deploy/install-mongodb.sh          # once per server; prints the MongoDB URI
sudo bash deploy/setup-ec2.sh pcw.3-108-88-152.sslip.io 4100 "<MongoDB URI>" selco-application-media-bucket
```
Update later: `cd ~/pcw-src && git pull && sudo bash deploy/setup-ec2.sh pcw.3-108-88-152.sslip.io 4100`
(keeps `.env`, data, MongoDB, HTTPS and your own domain).

Your own domain: the domain person adds an **A record** (`@` / `www` / `new` -> the server IP), then
`sudo bash deploy/add-domain.sh thepcw.ai www.thepcw.ai` (checks DNS first, adds HTTPS, makes it the main address).
Another website can live on the same server: its own folder, port, service and nginx file, and its own database in the same MongoDB.

## Google and AI search (SEO / AEO)

Every page is sent with its own title, description, canonical link, WhatsApp/LinkedIn/X share preview,
schema.org structured data (Organization, Event with date/time/venue/speakers, PodcastEpisode, VideoObject,
Report, Breadcrumbs, ContactPage) and its main text as plain HTML, so Google and AI assistants
(ChatGPT, Perplexity, Gemini, Claude) can read and quote it even without running JavaScript.

| File | What it is |
|---|---|
| `/sitemap.xml` | All pages + every real event (updates by itself) |
| `/robots.txt` | Lets Google, Bing and AI crawlers in; keeps `/admin` out |
| `/llms.txt` | Short summary of PCW, key facts, upcoming events and recordings for AI assistants |

Also built in:
- **FAQ page** (`/faq`, edit in **Admin > FAQ**) with Google FAQ data; the questions also go into `llms.txt` and the home page text for AI assistants.
- **One main address**: visits on `www.` or the sslip.io test address are sent (301) to `SITE_URL`, so Google sees one site.
- **IndexNow**: when you add or change events, recordings, city spaces or the FAQ, Bing (which also feeds ChatGPT search) and other engines are told within a minute. Only runs when `SITE_URL` is a real https address. Turn off with `INDEXNOW=false`.
- **Official profiles** (Admin > Settings): LinkedIn / YouTube / Instagram links, added to the Organization data so Google and AI tools connect them to PCW.

Sample events and sample recordings are kept out of Google (`noindex`, not in the sitemap).

After going live:
1. Set `SITE_URL=https://your-domain` in `server/.env` (the deploy script does this) and restart.
2. Add the site in **Google Search Console** and **Bing Webmaster Tools**, choose "HTML tag",
   paste the code in **Admin > Settings > Google and AI search**, save, then click Verify.
3. Submit `https://your-domain/sitemap.xml` in both.
