# Video Embed Hosting MVP Design

## Goal

Build a working MVP website where a creator can upload a video, host it from the app, customize an embeddable player, and copy iframe code for use on a static HTML website. Videos may be public or password protected.

## Scope

The MVP is a local full-stack app with backend upload and password support. It is intended to prove the hosting, embed, and password flow end to end before adding production object storage, payments, accounts, teams, analytics, or CDN delivery.

## Architecture

- Frontend: Vite and React.
- Backend: Node.js and Express.
- Video storage: local `uploads/` directory.
- Metadata storage: SQLite database.
- Password handling: bcrypt password hashes stored in SQLite.
- Embed delivery: an iframe URL at `/embed/:videoId`.

The backend owns all video metadata, upload handling, and password checks. The frontend provides the creator dashboard and generates iframe code. The embed route is a lightweight player view meant to fit inside third-party static websites.

## Creator Features

- Upload a video file.
- Enter or edit a title.
- Toggle password protection on or off.
- Set or clear the video password.
- Configure basic player options:
  - width
  - height
  - controls
  - muted
  - autoplay
- Copy iframe embed code.
- View a list of uploaded videos.

## Visitor Embed Flow

When a visitor loads the iframe, the embed page fetches public metadata for the video.

For public videos, the player appears immediately.

For protected videos, the embed page shows a password form. The password is posted to the backend for verification. If valid, the player receives a short-lived access token and can load the video. If invalid, the embed page shows an error and allows retry.

## API Shape

- `POST /api/videos`: upload a video and create metadata.
- `GET /api/videos`: list uploaded videos for the dashboard.
- `GET /api/videos/:id`: fetch dashboard details for one video.
- `PATCH /api/videos/:id`: update title, player options, or password settings.
- `GET /api/embed/:id`: fetch public embed metadata.
- `POST /api/embed/:id/verify`: verify a password and return a playback token.
- `GET /media/:id`: stream public video content or token-authorized protected video content.

## Data Model

Each video stores:

- `id`
- `title`
- `originalName`
- `storedName`
- `mimeType`
- `size`
- `passwordEnabled`
- `passwordHash`
- `playerOptions`
- `createdAt`
- `updatedAt`

## Error Handling

- Invalid upload types show a clear dashboard error.
- Oversized uploads are rejected with a clear message.
- Missing videos return a not found state in the dashboard and embed view.
- Incorrect passwords show an inline error in the embed player.
- Failed backend requests show recoverable UI errors without breaking the page shell.

## Testing And Verification

Manual MVP verification:

- Start backend and frontend.
- Upload a video.
- Confirm video appears in the dashboard.
- Copy iframe code and load it in a sample static page.
- Confirm public videos play without a password.
- Enable password protection.
- Confirm wrong passwords fail.
- Confirm correct passwords unlock playback.
- Confirm copied iframe dimensions and player options are reflected.

Automated checks should include lint/build verification if the generated project tooling provides them.
