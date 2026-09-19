# Messaging API contract

All paths below are under `/api/v1/`. Authenticated, active accounts only.
Account suspension is represented by `User.is_active=False`; suspended course
enrolments confer no permission. IDs in responses are numbers.

## Permission and safety

Students may contact course instructors through ACTIVE or COMPLETED enrolment,
and classmates when both have ACTIVE or COMPLETED enrolment in a shared course.
Instructors cannot contact unrelated instructors. Active admin support is
reachable by every active account. Self messaging is forbidden. Existing history
does not grant permission after enrolment or account access is revoked.
Blocks apply in both directions before admin role checks; no admin bypass of an
existing block. New blocks can target any non-admin, including instructors.
Contacts, summaries, threads, reads and unread counts respect current permission.
Reports remain available to message participants after blocking or course access
loss. Reports are stored for Django admin review; no moderation dashboard API.

## Endpoints

- `GET messages/`: paginated summaries, ordered by latest message ID descending.
  Summary: `{user_id, full_name, role, last_message, last_at, last_from_me, unread}`.
- `GET messages/contacts/?search=...`: paginated permitted contacts (including
  people with no history), ordered by full name then ID. Name search only.
  Contact: `{user_id, full_name, role}`. No email fields or email search.
- `POST messages/`: `{recipient, body, client_message_id}`. UUID required; body
  must be a nonempty string, at most 5000 characters after trimming. A new send
  returns 201; retry with the same sender, UUID, recipient and trimmed body
  returns the original message with 200. Reusing that UUID for another payload
  returns 409 (`error.code=message_id_conflict`). Persist the UUID with the draft
  across network retries. Authorization is checked again on every retry.
- `GET messages/thread/?with=<user_id>&page_size=50`: newest first by message ID.
  `before_id=<oldest_loaded_id>` loads older messages, also newest first.
  `after_id=<newest_loaded_id>` returns newer messages in ascending ID order;
  `after_id=0` starts a forward sync. Before and after are mutually exclusive.
  Nonzero cursor IDs must belong to this thread. Follow `next` while `has_more`
  before polling again. Merge by ID and display chronologically. GET never marks
  anything read. Response: `{count, next, previous, results, has_more,
  next_before_id, next_after_id}`. `previous` is null; unused/exhausted cursors
  are null. `count` counts the messages matching this request's ID boundary.
  Incremental polling includes new messages only; reload the latest page to
  refresh read receipts for previously loaded messages.
- `POST messages/read/`: `{with: <user_id>, through_id: <displayed_message_id>}`.
  The boundary must belong to this thread. Marks only incoming unread messages
  through that ID, preserving later messages and all other threads. Response:
  `{updated, unread}` (global permitted unread count). Repeats are harmless and
  preserve original read timestamps. Acknowledge only after displaying content.
- `GET messages/unread-count/`: `{unread}`.
- `POST messages/block/`: `{user_id}`. Idempotent; 200 `{user_id, blocked: true}`.
  May target a permitted contact or a previous conversation participant, even
  after access loss. Admin targets and self blocks return 403.
- `GET messages/blocks/`: paginated contacts blocked by the caller, for unblock UI.
- `POST messages/unblock/`: `{user_id}`. Idempotent; 200 `{user_id, blocked: false}`.
  Removes only the caller's block; the other person's block still applies.
- `POST messages/report/`: `{message_id, reason}` (nonblank, max 1000 characters).
  Participant only, otherwise 404. One report per reporter/message; first returns
  201, repeats return the original with 200, preserving the original reason.
  Response: `{id, message_id, reason, created_at}`.
- `GET notifications/`: paginated, newest ID first, GET has no side effects.
  Item: `{id, type, title, body, is_read, read_at, object_id, created_at}`.
- `POST notifications/<id>/read/`: recipient only, otherwise 404. Returns
  `{status: "marked as read"}`; repeated acknowledgments preserve `read_at`.
- `GET notifications/unread-count/`: `{unread}`.

Message: `{id, sender, sender_name, recipient, body, client_message_id,
is_read, read_at, created_at}`. Historical messages have null client_message_id.

Lists use `{count, next, previous, results}`, `page` (default 1) and `page_size`
(default 20, max 100); thread uses page_size (default 50, max 100) and ID cursors.
Malformed, duplicate, fractional, negative, zero (except after_id), oversized
numeric parameters return 400. Out of range list pages return 404.
Denied messaging returns 403; missing users return 404. Domain errors use
`{error: {code, detail}}`; field errors use DRF field maps. Throttling returns 429
with Retry-After. New sends are capped per sender at 30/minute and 300/hour using
the application database, across WSGI workers; request throttles additionally
limit repeated calls (cache throttles are per process without a shared cache).

Transport is HTTP polling on WSGI/cPanel. Existing messaging WebSocket routes
are disabled pending authenticated room authorization and deployment support.
There is no push delivery or presence guarantee. No external infrastructure added.

Integration note: new `messaging.messageblock` and `messaging.messagereport`
models use cascading user relationships. The separate user-deletion agent should
review these in its explicit cascade allowlist; this patch does not edit it.
