# Encrypted Notes

A responsive Markdown notes app built with React, Vite, Firebase Firestore, and the Web Crypto API. Notes are encrypted in the browser before they are sent to Firestore.

## Features

- Separate encrypted title and note body
- Username and master-password vaults
- Multiple independent vaults
- AES-GCM encryption with a PBKDF2-derived key
- Markdown writing and preview
- Automatic save
- Search and pinning
- Recycle Bin with restore
- Deleted notes retained for three years
- Responsive desktop and mobile layouts
- Reload-safe session for the current browser tab

## Security Model

The master password is never stored. It derives a non-extractable browser `CryptoKey`, and Firestore receives encrypted title/body values.

The Firebase web configuration is public by design. Firestore Security Rules still matter: open rules allow other people to overwrite or delete encrypted data even when they cannot read its contents.

If the master password is forgotten, encrypted notes cannot be recovered.

## Requirements

- Node.js 18 or newer
- A Firebase project with Cloud Firestore enabled

## Setup

1. Install dependencies:

```bash
npm install
```

2. Add your Firebase web configuration to `firebase.js`.

3. Start the development server:

```bash
npm run dev
```

4. Open the local URL printed by Vite, normally `http://localhost:5173`.

## Firebase Data

Each vault uses a SHA-256 hash of the normalized username as its document id:

```text
users/{userId}
users/{userId}/notes/{noteId}
```

Titles and note bodies are encrypted. Dates, pin state, deletion state, and retention timestamps remain metadata so the app can sort and clean up notes.

## Available Scripts

- `npm run dev` - start the Vite development server
- `npm run build` - create a production build
- `npm run preview` - preview the production build
- `npm start` - alias for the development server

## Important Notes

- Pressing **Lock** clears the local vault session.
- Reloading the same tab keeps the vault open.
- Closing the tab/browser requires the master password again.
- A deleted note moves to Recycle Bin and is eligible for cleanup after three years.
