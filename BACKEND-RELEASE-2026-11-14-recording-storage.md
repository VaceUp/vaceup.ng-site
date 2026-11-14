# Recording storage repair

This source overlay follows the challenge/intake release. It preserves the hosted `.env`, database and uploaded files. The ZIP also includes the earlier challenge, intake, recording and email changes since frontend commit `8505b28`, so the backend additions remain together.

## What changed

- The frontend permits signed HTTPS uploads to both Cloudflare R2 and Amazon S3. Previously its Content Security Policy permitted R2 but blocked S3 uploads.
- An invalid nonempty storage endpoint disables object storage and produces a safe configuration error. It cannot silently produce AWS URLs. The application remains bootable, with the existing Cloudinary/local fallback for public images.
- R2 signing explicitly uses its `auto` region and path addressing. Blank endpoints retain Amazon S3 behavior and the configured AWS region.
- Recording publication distinguishes a missing upload from storage permission/connection failures. Failed verification never publishes a replay; signing failures return a safe service error.
- Storage diagnostics explain the active provider and redact signed URL queries and configured credentials from probe errors.

These changes do not establish that the hosted credentials, permissions or bucket CORS are correct. The separate hosted backend-wide HTTP 500 still needs its cPanel Python traceback; local startup succeeds.

## Install and check the hosted application

1. Back up the source and database. Extract the ZIP over the existing cPanel Python application root, where both `passenger_wsgi.py` and `config/wsgi.py` already exist. This is an overlay, not a standalone application. Keep `.env`, uploads and media files.
2. Activate the application's Python virtual environment using the exact command displayed by cPanel. In the backend application folder run:

   ```sh
   python -m pip install -r requirements.txt
   python -m pip check
   python manage.py check
   python manage.py migrate
   ```

   If a command fails, retain its traceback and resolve that first. Do not enable public debug output. Restart the Python application after installation. Confirm `https://api.vaceup.ng/healthz/` returns `200 OK`; a generic HTTP 500 here must be diagnosed before testing video publication.
3. Run:

   ```sh
   python manage.py storage_report
   ```

   This reports configuration presence and provider selection without printing keys. Variables set in cPanel override `.env`, including empty cPanel values; remove a duplicate empty cPanel variable if `.env` should supply it.
4. Once the report names the intended provider and bucket settings are complete, run:

   ```sh
   python manage.py storage_probe
   ```

   This writes, reads and deletes a tiny temporary probe object using the application's credentials. A failure identifies a configuration, endpoint, permission or connectivity problem before a real recording is uploaded. A successful probe does not prove the bucket permits browser uploads; apply the CORS rule below and test from the website.

## Keep the existing storage provider and credentials

Having R2 and S3 accounts does not select both automatically. Currently the application has one active private upload connection, shared by recordings and other private files. Do not mix an R2 access key with an AWS secret, endpoint or bucket, and do not replace working settings blindly. Changing providers does not migrate existing objects or replay references.

For an active R2 connection, the five variables must refer to the same R2 bucket/account:

```dotenv
AWS_ACCESS_KEY_ID=YOUR_R2_S3_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=YOUR_R2_S3_SECRET_ACCESS_KEY
AWS_STORAGE_BUCKET_NAME=YOUR_EXISTING_PRIVATE_R2_BUCKET
AWS_S3_REGION_NAME=auto
AWS_S3_ENDPOINT_URL=https://YOUR_ACTUAL_ACCOUNT_ID.r2.cloudflarestorage.com
```

For an active Amazon S3 connection, use the existing AWS credentials, bucket and its actual AWS region. Leave the endpoint blank so the SDK chooses that region's S3 API:

```dotenv
AWS_ACCESS_KEY_ID=YOUR_AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=YOUR_AWS_SECRET_ACCESS_KEY
AWS_STORAGE_BUCKET_NAME=YOUR_EXISTING_PRIVATE_S3_BUCKET
AWS_S3_REGION_NAME=YOUR_BUCKET_REGION
AWS_S3_ENDPOINT_URL=
```

These are alternatives, not two blocks to append together. Replace the existing assignments only after checking which provider is active. Never paste the example placeholders literally. Preserve unrelated database, email, payment, LiveKit, Cloudinary, public bucket and custom-domain settings.

R2 uses its S3-compatible object credentials, not a Cloudflare global API key. The endpoint is the HTTPS S3 API origin, with no bucket path or trailing comment. Private recordings remain private; keep signed access rather than making the bucket public.

## Browser upload permissions

In the active private bucket's CORS configuration, merge this rule with existing rules rather than deleting unrelated policies. The JSON array is accepted by the R2 dashboard and Amazon S3 console:

```json
[
  {
    "AllowedOrigins": ["https://vaceup.ng", "https://www.vaceup.ng"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

The browser sends the signed `Content-Type` during a recording upload; it does not send the user's application bearer token to storage. CORS permits the browser request but does not grant object access. The backend credentials must separately allow upload and read/HEAD for the private recording keys. The probe also needs delete permission for its temporary `_probe/` key.

See [Cloudflare R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/), [R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/) and [Amazon S3 CORS elements](https://docs.aws.amazon.com/AmazonS3/latest/userguide/ManageCorsUsing.html).

## Final live verification

After the health check, storage report/probe and bucket CORS pass, record a short class as its assigned tutor. Download a device copy, publish it, then open the replay as an enrolled student. Confirm an unrelated account cannot access it. Repeat for an assigned event host if event recording is in use. Keep the device copy until the replay plays successfully.

The browser regression fixture checks the real shipped CSP against R2 and both regional/path-style S3 URLs, reproduces the previous S3 block, confirms failed uploads do not call completion, and checks that application tokens stay off storage requests. Provider responses are mocked, so these tests do not replace the live check above.

## Local validation

- Focused backend storage, lesson-video and recording API tests: 73 passed.
- `node scripts/recording-storage-browser.mjs`: 7/7 checks passed in Chromium.
- Frontend typecheck and production static export passed, with existing lint warnings.
- `python scripts/check_no_emoji.py`: passed, 216 files scanned.
- `node scripts/accuracy_report.mjs`: 5/37 checks passed. The repository-wide design kit still lacks its root examples/token/template fixtures; this is not a passing global UI audit. This repair changes CSP and backend behavior, with no rendered layout changes.
