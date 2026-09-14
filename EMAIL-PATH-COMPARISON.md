# Straep and VaceUp email paths

## What the supplied evidence shows

Straep's supplied configuration points Django at `localhost:25`, with TLS and SSL off and both SMTP credential fields empty. Its Redis URL is commented out. The supplied screenshot shows one delivered verification email, but does not show the running server's effective settings or implementation.

This is consistent with an authorized local SMTP relay: the application hands mail to a mail server on the same machine. That server can accept mail without an application-supplied username/password. Django supports SMTP without authentication when these fields are empty. This does not mean a remote mail server will accept unauthenticated email, or that every sender domain on the hosting plan is authorized.

The requirements list alone cannot establish the email execution path. Installing `django-redis` does not make email depend on Redis. Celery is not present in the supplied requirements list. There is no need to create a Celery or Upstash account to use a local SMTP relay.

Reference: https://docs.djangoproject.com/en/5.2/topics/email/

## A confirmed VaceUp compatibility restriction

`backend/apps/accounts/mail_delivery.py` currently rejects SMTP when both `EMAIL_USE_TLS` and `EMAIL_USE_SSL` are false, without an exception for localhost. It already permits both authentication fields to be empty for an authorized relay.

Therefore, copying Straep's SMTP settings into VaceUp will currently fail VaceUp's validation. This is an application restriction, not evidence that TrueHost's local mail server cannot send messages. Supporting this relay would require an explicit, strictly loopback-only option in VaceUp; it should not disable encryption checks for remote SMTP servers.

No SMTP settings, credentials or transport code were changed in the admin controls release. Do not copy Straep's sender identity or private keys into VaceUp.

## Why this is not yet a diagnosis of the latest reset failure

The earlier VaceUp diagnostic reported a successful SMTP connection using TLS. That tests connection/authentication only: its output explicitly says no email was sent. Separately, the empty `mail_queue_status` output means there were no account mail jobs in the database that command connected to at that moment.

VaceUp's current database delivery path is:

`Eligible account request -> database mail job -> process_mail_queue cron -> SMTP -> recipient mail service`

In database mode Redis is not part of that path. Changing SMTP cannot repair a missing job or an absent recurring cron. Password-reset requests intentionally do not enqueue for an unknown or inactive account; verification resend intentionally does not enqueue for an already-active account. The public response does not reveal account existence.

## The next useful check on VaceUp

1. Restart the VaceUp Python application in cPanel after uploading the release or editing its environment. This makes the web process reload settings; a terminal process alone does not prove what the web process is running.
2. Request a password reset once for a known active VaceUp account you control. Do not use verification resend to test an already-activated account.
3. In the VaceUp environment, run:

```bash
source /home/coqrpund/virtualenv/vaceup_api/3.12/bin/activate
cd /home/coqrpund/vaceup_api
python manage.py mail_queue_status
python manage.py process_mail_queue --limit 5
python manage.py mail_queue_status
```

The processing command attempts delivery for up to five eligible queued jobs, including other pending account emails. Run it only when ready to send those messages. Its output and the status command use safe failure codes; do not paste `.env` contents again.

- Still no queue rows: check that the request reaches this deployment/database and that the account is active. SMTP is not the first issue to investigate.
- Pending jobs that run successfully only when you issue the command: verify the recurring cPanel `process_mail_queue` cron is installed and points to this environment.
- Failed jobs: the safe error code determines whether the problem is configuration, authentication, connection or provider rejection.
- SMTP accepted but no inbox message: check spam and cPanel mail-delivery tracking. SMTP acceptance is not proof of inbox delivery.

If the local relay is preferred, confirm that this VaceUp application host accepts mail on loopback port 25 for the intended VaceUp sender. Then add and test the narrowly scoped local-relay option before changing VaceUp's environment. Do not change the unrelated custom-port setting or disable TLS globally.
