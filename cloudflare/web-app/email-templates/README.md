# Shooters Hill AFC authentication emails

These HTML files and `subjects.json` are the source copies for Supabase Auth email templates. They use the existing approved club badge, club colours, `https://shootershillafc.app/`, and the club secretary contact address. Supabase template variables remain intact; token generation, redirects and account permissions are controlled by Supabase and the app.

## Applying templates

In Supabase, open Authentication → Emails, choose a template, copy its subject from `subjects.json`, and paste the matching HTML into the source editor. Save, then reload and verify the saved subject and body. Repository deployment does not apply these settings automatically.

| File | Supabase template |
| --- | --- |
| confirm-signup.html | Confirm sign up |
| invite-user.html | Invite user |
| magic-link.html | Magic link or OTP |
| change-email.html | Change email address |
| reset-password.html | Reset password |
| reauthentication.html | Reauthentication |
| password-changed.html | Password changed |
| email-changed.html | Email address changed |
| phone-changed.html | Phone number changed |
| sign-in-method-linked.html | Sign-in method linked |
| sign-in-method-removed.html | Sign-in method removed |
| mfa-method-added.html | MFA method added |
| mfa-method-removed.html | MFA method removed |

## Live configuration on 13 October 2026

The first six account/action templates were saved in project `obntycksmkcnkprrcutg`, reloaded, and checked against these source bodies. Subjects were verified through the dashboard, with visual checks where browser text redaction applied. SMTP sender name was changed to **Shooters Hill AFC** and verified after reload.

The seven optional security notification templates are prepared here but were not applied: Supabase returned `ThrottlerException: Too Many Requests` during template validation. Their existing notification switches remain disabled.

The existing SMTP sender address is still `Hello@pitchkind.com`, using Cloudflare SMTP. Before replacing it, onboard the intended club domain for Cloudflare Email Sending, then update the sender address in Supabase and test delivery. No SMTP credentials were changed and no test emails or invitations were sent during this update.

The public badge URL was checked successfully. Supabase's preview iframe did not load the external badge; actual inbox rendering and delivery still require an email test.

