# Administrator guide and site map

Sign in at https://vaceup.ng/login and open the Platform Control Panel. The guide appears once per sign-in session unless you save "Never show again at sign-in". Close it to save the preference. If saving fails, the guide stays open and explains the error. The preference belongs to your admin account, not only this browser.

Use "Guide & site map" to reopen it at any time. Uncheck the preference and close the guide to show it on future sign-ins. Escape closes the dialog; keyboard focus returns to the guide button. On narrow screens, choose a section from the admin-area selector.

## Recommended setup order

1. Create the actual tutor accounts and review administrator access.
2. Define categories, import/review draft courses, assign tutors and confirm prices.
3. Build modules and lessons, then publish the courses that are ready.
4. Schedule live sessions and assessments; check learner access and payments.
5. Use announcements and marketing deliberately, and review platform settings with the technical team.

## Sections

### 1. Overview

URL: https://vaceup.ng/dashboard

See the academy at a glance and choose your next task.

1. Review student, course and enrollment totals.
2. Use the quick actions to open the area that needs attention.

Hint: Start here each day, then check Applications for pending decisions.

### 2. Users

URL: https://vaceup.ng/dashboard?tab=users

Find learners and manage tutor or administrator accounts.

1. Search the user directory by name or email and filter by role.
2. Create a tutor or administrator account when staff need access.
3. Review the correct account before changing its role or active status.

Hint: Give administrator access only to people who manage the academy. Tutors use the instructor role.

### 3. Courses

URL: https://vaceup.ng/dashboard?tab=courses

Create courses and control what appears in the public catalog.

1. Define or rename Categories, then create a course with its category, tutor, level, description and price.
2. Keep it in draft while you prepare lessons in Content.
3. Review its details, then publish it. The homepage and public catalogue read published courses from this backend.

Hint: Set up categories and an active tutor first. Only published courses appear to visitors; import the previous homepage courses as drafts using the deployment guide.

### 4. Content

URL: https://vaceup.ng/dashboard?tab=content

Organize each course into modules and lessons.

1. Select the course you want to work on.
2. Add modules, then add lessons and their video links.
3. Check the lesson titles, order and links before publishing the course.

Hint: A course needs to exist before you can add its content.

### 5. Live Classes

URL: https://vaceup.ng/dashboard?tab=liveclasses

Schedule the sessions learners will attend.

1. Choose the course and enter the session title.
2. Set the start time, duration and meeting details.
3. Review the scheduled sessions and confirm the time with your tutor.

Hint: Confirm the displayed date and time before sharing the class with learners.

### 6. Assignments

URL: https://vaceup.ng/dashboard?tab=assignments

Create assessments and review learner submissions.

1. Use New Assignment or New Quiz in this section.
2. Choose the course, add instructions and set the deadline or pass requirements.
3. Review submissions and record grades with useful feedback.

Hint: The current quiz form creates the quiz; questions need to be added through the available question builder or Django admin.

### 7. Certificates

URL: https://vaceup.ng/dashboard?tab=certificates

Review awards and issue certificates to eligible learners.

1. Select the student and course and check their completion record.
2. Review the certificate preview, then issue it.
3. Use the certificate list to inspect existing awards or revoke an incorrect one.

Hint: Confirm the learner name and course before issuing. Revoking changes the validity of an existing award.

### 8. Enrollments

URL: https://vaceup.ng/dashboard?tab=enrollments

Review which learners have access to each course.

1. Search the enrollment list to find the learner and course.
2. Review their status and recorded progress.
3. If access needs changing, use the enrollment controls in Django admin or ask your technical team.

Hint: Payment records and enrollment access are separate. Check both when resolving an access query.

### 9. Payments

URL: https://vaceup.ng/dashboard?tab=payments

Review payment records when reconciling fees or helping a learner.

1. Find the learner payment and check its reference, amount and status.
2. Compare the record with Paystack when investigating a payment query.
3. Check Enrollments to confirm the learner has the correct course access.

Hint: A payment screenshot is not confirmation. Verify the provider record before granting paid access.

### 10. Applications

URL: https://vaceup.ng/dashboard?tab=applications

Review course applications and record admissions decisions.

1. Review each pending application and the course requested.
2. Check the applicant details before approving or rejecting.
3. Confirm the resulting status and follow up on any access questions.

Hint: Use a consistent admissions process; approval and payment are different decisions.

### 11. Announcements

URL: https://vaceup.ng/dashboard?tab=announcements

Prepare and publish academy updates.

1. Write a clear title and message.
2. Review the content and intended audience before publishing.
3. Check the published and draft list to avoid duplicate updates.

Hint: Include the action learners need to take and any relevant deadline.

### 12. Feature Flags

URL: https://vaceup.ng/dashboard?tab=flags

Manage the platform settings exposed in the control panel.

1. Read the setting name and current value.
2. Confirm the intended effect before editing.
3. Save the specific setting and check the affected feature.

Hint: Coordinate unfamiliar settings with your technical team before changing them.

### 13. Marketing

URL: https://vaceup.ng/dashboard?tab=marketing

Review campaigns and manage their available actions.

1. Inspect the campaign list and its current status.
2. Check the audience and message before using a send or schedule action.
3. Review the outcome before repeating an action.

Hint: Sending a campaign reaches real recipients. Confirm its audience and content first.

## Catalogue relationships

Category -> Course -> Module -> Lesson

Categories are managed inside Courses. A course has one category and one assigned tutor. Public visitors can see only published courses. The public homepage, catalogue and detail pages use backend records, not the historical static prices. If the API is unavailable, visitors see an error instead of fictional courses.

## Related pages and limits

- Public catalogue: https://vaceup.ng/courses
- A current course: https://vaceup.ng/course?slug=COURSE-SLUG (use its View course link rather than typing this placeholder).
- Registration: https://vaceup.ng/register
- Email activation/recovery: https://vaceup.ng/verify-email
- Applications: use the admin Applications destination; learner application form is https://vaceup.ng/apply.
- Django admin: the backend's /admin/ route, for authorised staff only. Confirm access with the technical team; it is a separate interface from the branded panel.

This guide describes available screens. It is not evidence that every pre-existing action behind those screens is production-verified. Payment confirmation, enrollment overrides, certificate eligibility and privileged role changes need particular care. Never share learner credentials or a verification token in a support conversation. For operations not exposed in the branded panel, use the authorised backend controls or ask the technical operator.
