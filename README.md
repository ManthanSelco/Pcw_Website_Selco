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
| Bangalore | `/space/bangalore` | Upcoming events, then Past events, then Calendar, plus the "Events" menu and "Book the space" |
| Guwahati | `/space/guwahati` | Same layout for Guwahati |
| Recordings | `/recordings` | Past events (all cities) that have a recording link |

Nav on every page: **About Us · Recordings · PCW · Bangalore · Guwahati · Contact us** (the current page is underlined).

- **RSVP** on an upcoming event is saved in MongoDB (`rsvps`). The same email can't RSVP twice for one event.
- **Book the space** is saved in MongoDB (`bookings`).
- Past events show **Watch recording** when they have a recording link.

### Adding events (until the admin panel is built)
1. Open `server\seed\events-template.csv` in Excel and fill one row per event:
   `city` (bangalore / guwahati), `date` (YYYY-MM-DD or DD/MM/YYYY), `time`, `title`, `category`, `summary`, `venue`, `image` (photo link), `recordingUrl`, `rsvpOpen` (yes/no).
   Delete the example rows first. The template rows are only placeholders.
2. Save it as CSV, then run:
```powershell
npm run import-events -- D:\PCW\events.csv
```
Same city + date + title updates the event instead of adding it twice. Add `--replace` to clear all old events first.
Events dated today or later show under **Upcoming**. Older ones move to **Past** automatically.

### Download data as Excel (CSV)
```powershell
npm run export -- rsvps
```
```powershell
npm run export -- bookings
```
```powershell
npm run export -- newsletter
```
```powershell
npm run export -- events
```

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
cd ~/pcw-mern && sudo bash deploy/setup-ec2.sh pcw.16-192-105-187.sslip.io 4100
```
The script runs PCW as its own service (`pcw-mern`) with its own nginx file and HTTPS. If MongoDB is running on the server (for example CIP's Docker `mongo` on port 27017), the script uses it with a **separate database named `pcw`**. If your MongoDB needs a username and password, add the link as a 3rd argument:
```bash
sudo bash deploy/setup-ec2.sh pcw.16-192-105-187.sslip.io 4100 "mongodb://USER:PASS@127.0.0.1:27017/pcw?authSource=admin"
```
**Update later:** upload the new zip, unzip it, and run the same command again (your `server/.env` and `data/` are kept).

## Tests
```powershell
npm test
```
