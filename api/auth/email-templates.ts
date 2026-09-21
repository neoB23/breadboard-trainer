import type { EmailMessage } from './email.ts'

/**
 * The two emails this system sends.
 *
 * Both are written the way the rest of the product speaks: a sentence saying
 * what happened, the link, and what to do if it was not you. No marketing, no
 * logo, no tracking pixel — an academic tool sending a student a link has no
 * business setting a cookie in their mailbox.
 *
 * The HTML is deliberately plain and inline-styled. Mail clients strip
 * stylesheets, ignore custom fonts and mangle flexbox, so the design language
 * cannot survive the trip; trying anyway produces something that looks broken
 * rather than restrained. A dark near-black email is also a common way to
 * trigger a spam filter, so these are light and boring on purpose.
 */

const PRODUCT = 'Breadboard Trainer'

export function verificationEmail(
  to: string,
  name: string,
  url: string,
  expiresInMinutes: number,
): EmailMessage {
  const greeting = firstName(name)
  const subject = `Confirm your email for ${PRODUCT}`

  const text = [
    `Hi ${greeting},`,
    '',
    `Someone — we hope you — created a ${PRODUCT} account with this address.`,
    'Open the link below to confirm it and finish signing up.',
    '',
    url,
    '',
    `The link works once and expires in ${describeMinutes(expiresInMinutes)}. If it has already`,
    'expired, ask for a new one from the sign-in screen.',
    '',
    'If you did not create this account you can ignore this message — nothing',
    'was set up and nobody can sign in without confirming this address.',
  ].join('\n')

  return {
    to,
    subject,
    text,
    html: wrap(
      subject,
      greeting,
      [
        `Someone — we hope you — created a ${PRODUCT} account with this address. Confirm it to finish signing up.`,
      ],
      'Confirm my email',
      url,
      [
        `The link works once and expires in ${describeMinutes(expiresInMinutes)}. If it has already expired, ask for a new one from the sign-in screen.`,
        'If you did not create this account you can ignore this message — nothing was set up, and nobody can sign in without confirming this address.',
      ],
    ),
  }
}

export function passwordResetEmail(
  to: string,
  name: string,
  url: string,
  expiresInMinutes: number,
): EmailMessage {
  const greeting = firstName(name)
  const subject = `Reset your ${PRODUCT} password`

  const text = [
    `Hi ${greeting},`,
    '',
    `Someone asked to reset the password on the ${PRODUCT} account for this`,
    'address. Open the link below to choose a new one.',
    '',
    url,
    '',
    `The link works once and expires in ${describeMinutes(expiresInMinutes)}.`,
    '',
    'If it was not you, no action is needed — your password has not changed and',
    'this link will expire on its own.',
  ].join('\n')

  return {
    to,
    subject,
    text,
    html: wrap(
      subject,
      greeting,
      [
        `Someone asked to reset the password on the ${PRODUCT} account for this address. Choose a new one below.`,
      ],
      'Choose a new password',
      url,
      [
        `The link works once and expires in ${describeMinutes(expiresInMinutes)}.`,
        'If it was not you, no action is needed — your password has not changed and this link will expire on its own.',
      ],
    ),
  }
}

/* -------------------------------------------------------------------------- */
/* Rendering                                                                  */
/* -------------------------------------------------------------------------- */

/** "Prof. Amelia Reyes" -> "Amelia". Falls back to the whole string. */
function firstName(fullName: string): string {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter((part) => !/^(prof\.?|dr\.?|engr\.?|mr\.?|ms\.?|mrs\.?)$/i.test(part))
  return parts[0] ?? fullName.trim() ?? 'there'
}

function describeMinutes(minutes: number): string {
  if (minutes >= 120) return `${Math.round(minutes / 60)} hours`
  if (minutes >= 60) return 'an hour'
  return `${minutes} minutes`
}

/**
 * Escapes before interpolation. A display name is user-supplied and lands inside
 * an HTML document that someone else's mail client will render — that is the
 * same injection surface as the app itself, minus a CSP.
 */
function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function wrap(
  subject: string,
  greeting: string,
  lead: string[],
  buttonLabel: string,
  url: string,
  footer: string[],
): string {
  const safeUrl = escapeHtml(url)
  const paragraph = (body: string, muted = false) =>
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${muted ? '#5a5a66' : '#18181b'}">${body}</p>`

  return [
    '<!doctype html>',
    '<html lang="en"><head><meta charset="utf-8">',
    `<meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title>`,
    '</head>',
    '<body style="margin:0;padding:24px;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px">',
    '<tr><td style="padding:32px">',
    `<p style="margin:0 0 24px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#71717a">${PRODUCT}</p>`,
    paragraph(`Hi ${escapeHtml(greeting)},`),
    ...lead.map((line) => paragraph(escapeHtml(line))),
    // A pill, since that is the one shape this system uses for an action —
    // it is the only piece of the design language that survives a mail client.
    `<p style="margin:24px 0"><a href="${safeUrl}" style="display:inline-block;padding:12px 24px;border-radius:9999px;background:#166534;color:#ffffff;font-size:15px;font-weight:500;text-decoration:none">${escapeHtml(buttonLabel)}</a></p>`,
    // Repeated as text: a fair number of clients refuse to make the button
    // clickable, and a link nobody can copy is a dead end.
    paragraph(
      `Or paste this into your browser:<br><a href="${safeUrl}" style="color:#166534;word-break:break-all">${safeUrl}</a>`,
      true,
    ),
    '<hr style="margin:24px 0;border:none;border-top:1px solid #e4e4e7">',
    ...footer.map((line) => paragraph(escapeHtml(line), true)),
    '</td></tr></table></body></html>',
  ].join('')
}
