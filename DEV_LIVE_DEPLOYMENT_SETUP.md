# Dev and Live Deployment Setup Guide

## Overview

This document defines the deployment setup for:

- Live: `mcaportal.online`
- Development: `dev.mcaportal.online`

Current strategy:

- Live operations use the existing root deployment folders.
- Dev operations use a separate root folder: `dev`.
- Dev must be isolated from live to prevent test data or debug changes from affecting production users.

## Domain and Folder Architecture

### Actual Project Folders (This Repository)

Main folders used for deployment in this project:

- Backend source: `LavaLust/`
- Frontend source: `EduTrackUI/`
- Frontend build output: `EduTrackUI/dist/`
- Public static assets source: `EduTrackUI/public/`
- Release mirror folder: `mcadev-updates/`
   - `mcadev-updates/LavaLust/`
   - `mcadev-updates/EduTrackUI/`

Notes:

- Backend `.htaccess` in repo: `LavaLust/.htaccess`
- Frontend `.htaccess` in repo: `EduTrackUI/.htaccess`
- Frontend public manifest in repo: `EduTrackUI/public/manifest.json`

### Source-to-Hostinger Folder Mapping

Use this mapping when deploying from the current project folders.

Tagging convention used below:

- **Production (Main)** = `public_html/...`
- **Development (Dev)** = `public_html/dev/...`

### Production (Main) - `mcaportal.online`

- **Production/Main** `LavaLust/` -> `public_html/`
- **Production/Main** `EduTrackUI/dist/` -> `public_html/ui/`
- **Production/Main** `LavaLust/.htaccess` -> `public_html/.htaccess`
- **Production/Main** `EduTrackUI/.htaccess` -> `public_html/ui/.htaccess`

### Development (Dev Folder) - `dev.mcaportal.online`

- **Development/Dev** `LavaLust/` -> `public_html/dev/`
- **Development/Dev** `EduTrackUI/dist/` -> `public_html/dev/ui/`
- **Development/Dev** `LavaLust/.htaccess` -> `public_html/dev/.htaccess`
- **Development/Dev** `EduTrackUI/.htaccess` -> `public_html/dev/ui/.htaccess`

### Dev Work Safety Rule (Do Not Touch Production)

When actively working on Development (`dev.mcaportal.online`), apply this restriction:

- **DONT TOUCH (Production/Main):** `public_html/` and `public_html/ui/`
- Only update Development targets: `public_html/dev/` and `public_html/dev/ui/`
- Do not run production DB migrations while validating dev changes
- Do not overwrite production `.htaccess`, uploads, logs, or runtime files during dev work

Recommended team callout before each dev deployment:

- "DEV DEPLOYMENT MODE: DONT TOUCH PRODUCTION"

### If You Deploy From the Mirror Folder

- **Production/Main** `mcadev-updates/LavaLust/` -> `public_html/`
- **Development/Dev** `mcadev-updates/LavaLust/` -> `public_html/dev/`
- **Production/Main** `mcadev-updates/EduTrackUI/dist/` -> `public_html/ui/`
- **Development/Dev** `mcadev-updates/EduTrackUI/dist/` -> `public_html/dev/ui/`

### Live Environment (`mcaportal.online`)

Recommended live structure:

- Backend root: `public_html`
- Frontend build: `public_html/ui`

### Development Environment (`dev.mcaportal.online`)

Current planned structure:

- Dev root folder: `public_html/dev`
- Dev backend root: `public_html/dev`
- Dev frontend build: `public_html/dev/ui`

Important:

- `dev.mcaportal.online` should point its document root to `public_html/dev`.
- Dev and live should not share writable folders for uploads, cache, logs, or temporary files.

## Apache and `.htaccess` Strategy

## Should dev have its own `.htaccess`?

Yes. Dev should have its own `.htaccess`.

Why:

- Live and dev routing can diverge during testing.
- Separate rules reduce risk of breaking live.
- It is easier to debug environment-specific behavior.

### Required `.htaccess` locations

- Live backend: `public_html/.htaccess`
- Live frontend (if used): `public_html/ui/.htaccess`
- Dev backend: `public_html/dev/.htaccess`
- Dev frontend (if used): `public_html/dev/ui/.htaccess`

### Dev routing note

If dev domain root is already `public_html/dev`, references should usually target `/ui/...` on dev, not `/dev/ui/...`.

## Database Isolation (Mandatory)

Use separate databases and credentials:

- Live DB for `mcaportal.online`
- Dev DB for `dev.mcaportal.online`

Requirements:

- Do not reuse live DB credentials in dev.
- Grant least privileges to dev DB user.
- Validate app config so dev always connects only to dev DB.

## Environment Configuration

Maintain separate environment values for live and dev.

At minimum:

- `APP_ENV` (`production` vs `development`)
- `DB_HOST`
- `DB_NAME`
- `DB_USER`
- `DB_PASS`
- API base URL values for frontend builds

Recommended:

- Disable verbose errors in live.
- Enable debugging/logging only in dev.
- Tag UI in dev with a visible "DEV" marker/banner.

## Frontend Build Separation

Use separate builds and environment values:

- Live frontend build should call live API origin.
- Dev frontend build should call dev API origin.

Checklist:

- Build live frontend with live env vars.
- Build dev frontend with dev env vars.
- Deploy outputs to their matching `ui` folders.

## Uploads, Logs, and Runtime Data

Keep files isolated per environment:

- Live uploads and logs under live paths
- Dev uploads and logs under dev paths

Never point dev uploads to live upload directories.

## Background Jobs, Cron, and Workers

Use separate worker/cron definitions where applicable.

Rules:

- Live jobs should read/write only live DB and live files.
- Dev jobs should read/write only dev DB and dev files.
- Disable nonessential dev cron tasks if uncertain.

## Suggested Deployment Workflow

1. Develop and test in `dev.mcaportal.online`.
2. Run DB changes in dev first.
3. Validate critical flows:
   - Auth
   - Enrollment
   - Payments
   - Notifications
   - Uploads
4. Promote code to live after validation.
5. Apply equivalent DB changes to live.
6. Monitor logs after release.

## Git and Release Flow (Recommended)

- `main` branch for live releases
- `develop` branch for dev deployment

Promotion path:

1. Merge feature branches into `develop`
2. Deploy to `dev.mcaportal.online`
3. QA and fix issues
4. Merge `develop` into `main`
5. Deploy `main` to `mcaportal.online`

## Security and Safety for Dev

Recommended protections for `dev.mcaportal.online`:

- Add access protection (IP allowlist or basic auth)
- Add `noindex` behavior for crawlers
- Use test-only email/payment credentials when possible

## Quick Validation Checklist

Before using dev environment:

- [ ] `dev.mcaportal.online` document root is correct
- [ ] Dev `.htaccess` exists and routes correctly
- [ ] Dev frontend points to dev API
- [ ] Dev backend points to dev DB
- [ ] Dev uploads are isolated
- [ ] Dev logs and runtime data are isolated
- [ ] Dev cron/worker tasks are isolated

Before production release:

- [ ] All target features passed in dev
- [ ] Production backup completed
- [ ] Migration scripts verified
- [ ] Rollback plan prepared

## Rollback Plan (Basic)

If release fails:

1. Restore previous live code snapshot
2. Restore live DB backup (if schema/data changed)
3. Clear caches and restart services if needed
4. Validate core user flows immediately

## Notes for Current Project

Given your current setup, `public_html/dev` is a valid and practical dev root strategy. The key requirement is strict environment isolation in routing, DB credentials, uploads, and background jobs.
