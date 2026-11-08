# Learning Master Ez

Turn long lectures or slides (PDF, PPTX) into a summary, then into flashcards for the whole lecture,
and get reminded to review. It can also make a live transcript of in-person or online meetings.

**Stack:** Create React App, TypeScript, React Router DOM, Ant Design (+ icons), Firebase (Auth,
Firestore, Cloud Messaging), Firebase Admin, Netlify Functions, Groq API, Web Speech API.

## How it works

1. **Extract (in the browser).** PDFs are read with `pdfjs-dist`; PPTX files are unzipped with `jszip` and
   the slide text and speaker notes are read from the XML. Only text leaves the browser.
2. **Summarize.** The text is split into ~6,500-character chunks. Each chunk becomes study notes, the notes
   are merged (in rounds, for very long lectures) into one structured summary.
3. **Flashcards.** The summary is split by section and every section gets its own flashcards, so the whole
   lecture is covered. Cards are de-duplicated and stored in Firestore.
4. **Review.** A small SM-2-style scheduler (Again / Hard / Good / Easy) decides when each card is due.
5. **Remind.** Push notifications (hourly Netlify scheduled function -> FCM) when cards are due, with quiet
   hours. If push is off, an in-app reminder appears while the app is open.
6. **Live transcript.** `SpeechRecognition` with auto-restart, timestamps, draft autosave, save/export, and
   a one-click "Make study set" that feeds the transcript into the summary/flashcard pipeline.

The browser orchestrates the AI calls (one small request per chunk) so each Netlify function call stays
short. Progress is written to Firestore, so the lecture page updates live.

```
netlify/functions/ai.ts            Verifies the Firebase ID token, calls Groq (notes, merge, flashcards)
netlify/functions/send-reminders.ts  Hourly scheduled function that sends FCM push reminders
src/lib/                           extract, chunk, pipeline, srs, db (Firestore), api, reminders
src/hooks/                         speech recognition, reminders, due count, settings
src/pages/                         Login, Dashboard, NewLecture, Lecture, Study, Transcribe, Settings
```

## Setup

### 1. Firebase

1. Create a project at <https://console.firebase.google.com>.
2. **Authentication** -> enable _Google_ and _Email/Password_. Add your Netlify domain (and `localhost`)
   under _Authorized domains_.
3. **Firestore** -> create a database, then deploy the rules and indexes:
   ```bash
   npm i -g firebase-tools
   firebase login
   firebase use <your-project-id>
   firebase deploy --only firestore
   ```
4. **Project settings -> Your apps** -> add a Web app and copy its config.
5. **Project settings -> Cloud Messaging -> Web Push certificates** -> generate a key pair (the VAPID key).
6. **Project settings -> Service accounts** -> _Generate new private key_. You need `project_id`,
   `client_email` and `private_key` from the JSON.

### 2. Groq

Create an API key at <https://console.groq.com>.

### 3. Environment variables

```bash
cp .env.example .env     # then fill it in
```

On Netlify add the same variables under _Site configuration -> Environment variables_. Keep the
`\n` escapes in `FIREBASE_PRIVATE_KEY` on one line.

### 4. Run locally

```bash
npm install
npm i -g netlify-cli
netlify dev              # app + functions on http://localhost:8888
```

Use `netlify dev` (not just `npm start`) so `/api/ai` reaches the function. To try the reminder job:
`netlify functions:invoke send-reminders`.

### 5. Deploy

Push to a Git repo and import it in Netlify. `netlify.toml` already sets the build command, the functions
folder, the SPA fallback and the service-worker headers. Push notifications need HTTPS (Netlify provides it).

## Good to know

- **Rate limits and speed.** Groq's free tier has tokens-per-minute limits; the client retries on 429 and
  transient errors. Netlify sync functions time out at 10 s by default (configurable on paid plans), which
  is why each AI call is small. If you hit limits or timeouts, set `GROQ_MODEL=llama-3.1-8b-instant`.
- **Scanned PDFs / image-only slides** have no text to extract; the app warns you. OCR is not included.
- **Speech recognition** is the browser's. Chrome, Edge and Safari support it, usually through an online
  service, so it needs internet. It only hears the microphone (for online meetings, play the call through
  speakers). The "on-device" switch uses Chrome's newer `processLocally` option and needs the language pack.
- **Offline studying** works for cards the device has already loaded (Firestore persistent cache);
  creating study sets and reminders need a connection.
- **Security.** Firestore rules limit every document to its owner, and the function rejects requests
  without a valid Firebase ID token. Consider adding a per-user usage cap before opening sign-ups publicly,
  since every request costs Groq tokens.
- **Anki.** Flashcards export as tab-separated text (enable "Allow HTML in fields" when importing).
