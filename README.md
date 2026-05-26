# Video Embed Studio

Local MVP for uploading videos, hosting them from your machine, and generating iframe embed code for static HTML websites.

## Run Locally

```bash
npm install
npm run dev
```

- Dashboard: `http://localhost:5173/`
- Backend API: `http://localhost:3000/`

## Local Storage

By default, the app stores everything on your computer:

- Videos: `uploads/`
- Metadata and password hashes: `data/videos.sqlite`

To use different local folders, copy `.env.example` to `.env` and change:

```bash
ADMIN_USERNAME=vocadmin2
ADMIN_PASSWORD=change-this-password
DATABASE_PATH=data/videos.sqlite
UPLOAD_DIR=uploads
```

Keep the Node server running while embedded videos are being viewed.
