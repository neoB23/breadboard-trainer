/**
 * English — and, more than that, the **shape** of every catalogue.
 *
 * This object is the single source of truth for what a message key is. `fil.ts`
 * is typed as `Catalog`, which is derived from `keyof typeof en`, so a key that
 * exists here and not there is a compile error rather than a string that
 * silently falls back to English at runtime. That is the difference between an
 * i18n layer and an i18n stub: the DoD box is "no hardcoded English left", and a
 * fallback makes that box impossible to check.
 *
 * ---------------------------------------------------------------------------
 * CONVENTIONS
 *
 * Keys are `screen.element` or `screen.section.element`, dot-separated, and
 * grouped under a banner per screen. They are sorted within a group. A key names
 * *where the string appears*, not what it says, so rewording the copy never
 * means touching a call site.
 *
 * Placeholders are `{name}`. There is no plural machinery: Filipino pluralises
 * by particle rather than by suffix, so a count-aware API modelled on English
 * would be wrong for half the catalogue. Where a count matters the sentence is
 * written to work for any count.
 *
 * `/styleguide` is deliberately not in here. It is a development tool that ships
 * to no student, and translating it would double the catalogue for nobody.
 * ---------------------------------------------------------------------------
 */
export const en = {
  /* ---- shell and chrome ------------------------------------------------- */
  'app.name': 'Breadboard',
  'app.nameSuffix': 'Trainer',
  'app.tagline': 'Build the circuit. Extract the netlist. Diagnose the fault.',

  'nav.primary': 'Primary',
  'nav.open': 'Open navigation',
  'nav.close': 'Close navigation',
  'nav.dashboard': 'Dashboard',
  'nav.exercises': 'Exercises',
  'nav.teach': 'Teach',
  'nav.sandbox': 'Free build',
  'nav.settings': 'Settings',

  'account.menu': 'Account menu',
  'account.profile': 'Profile',
  'account.settings': 'Settings',
  'account.signOut': 'Sign out',

  'theme.toLight': 'Switch to light theme',
  'theme.toDark': 'Switch to dark theme',

  // The role, as a student and their lecturer would say it. Shown on the
  // dashboard rail and in the account menu; never used for an authorisation
  // decision, which is the API's job.
  'role.student': 'Student',
  'role.instructor': 'Instructor',
  'role.admin': 'Admin',

  'common.back': 'Back',
  'common.cancel': 'Cancel',
  'common.continue': 'Continue',
  'common.loading': 'Loading',
  'common.optional': 'optional',
  'common.retry': 'Try again',
  'common.save': 'Save',
  'common.saved': 'Saved',
  'common.saving': 'Saving',
  'common.show': 'Show',
  'common.hide': 'Hide',

  /* ---- assistive-tech labels -------------------------------------------- */
  //
  // Never seen, always read. A screen-reader user on a Filipino interface must
  // not hit four English words in the chrome, so these go through the catalogue
  // like everything else.
  'a11y.breadcrumb': 'Breadcrumb',
  'a11y.close': 'Close',
  'a11y.progress': 'Progress',
  'a11y.dismiss': 'Dismiss',

  /* ---- landing ---------------------------------------------------------- */
  'landing.headline.1': 'Build the circuit.',
  'landing.headline.2a': 'Extract the',
  'landing.headline.2b': 'netlist',
  'landing.headline.2c': '.',
  'landing.headline.3': 'Diagnose the fault.',
  'landing.lead':
    'Students wire a circuit in a 3D workspace. The trainer reads back the netlist they actually built, sets it against the instructor’s golden reference, and names the difference — a missing jumper, a swapped rail, a resistor bridging the centre channel.',
  'landing.cta.signIn': 'Sign in',
  'landing.cta.register': 'Create an account',
  'landing.cta.howItWorks': 'How it works',
  'landing.comparison.eyebrow': 'Comparison',
  'landing.comparison.fault': '1 fault',
  'landing.comparison.match': 'match',
  'landing.comparison.absent': 'absent',
  'landing.comparison.diagnosisEyebrow': 'Diagnosis',
  'landing.comparison.diagnosis':
    'D1 cathode never reaches ground. The jumper sits on the far side of the centre channel, so row 14 and row 15 are two nets rather than one.',
  'landing.how.eyebrow': 'How it works',
  'landing.how.title': 'From tie-point to diagnosis',
  'landing.how.description':
    'Four stages, no black box. Each one is inspectable on its own, which is what makes the feedback teachable rather than a grade.',
  'landing.step.build.title': 'Build',
  'landing.step.build.body':
    'Place parts and run jumpers on a full-size board in the 3D workspace. Nothing is graded while you wire — the board only records what you connect.',
  'landing.step.extract.title': 'Extract',
  'landing.step.extract.body':
    'Every contact in a strip is one node. The trainer walks the board, merges tie-points into nets, and writes out the netlist of what was actually built.',
  'landing.step.compare.title': 'Compare',
  'landing.step.compare.body':
    'That netlist is set against the instructor’s golden reference. Extra nets, absent nets and mis-tied pins each fall out of the difference on their own.',
  'landing.step.diagnose.title': 'Diagnose',
  'landing.step.diagnose.body':
    'The solver runs over the built circuit and names the fault in the language of the board: which pin, which row, which rail — not a score.',
  'landing.spec.eyebrow': 'Specification',
  'landing.spec.workspace': 'Workspace',
  'landing.spec.workspaceDetail': 'place, wire, inspect',
  'landing.spec.tiePoints': 'Tie-points',
  'landing.spec.tiePointsDetail': 'full-size solderless board',
  'landing.spec.solver': 'Solver',
  'landing.spec.solverDetail': 'modified nodal analysis',
  'landing.spec.contrast': 'Contrast target',
  'landing.spec.contrastDetail': 'WCAG 2.2, never colour alone',
  'landing.footer.note':
    'The workspace, the diagnostics engine and Learn Mode land in the phases after this one.',
  'landing.footer.badge': 'Part A · student shell',

  /* ---- 404 -------------------------------------------------------------- */
  'notFound.eyebrow': 'Error 404',
  'notFound.title': 'No route at this address',
  'notFound.description':
    'The link may be out of date, or the screen may be one of the phases still to be built.',
  'notFound.action': 'Back to the start',

  /* ---- 403 -------------------------------------------------------------- */
  'forbidden.eyebrow': 'Error 403',
  'forbidden.title': 'That area is for instructors',
  'forbidden.description':
    'You are signed in, but this screen belongs to the teaching side of the trainer. Nothing is wrong with your account.',
  'forbidden.signedInAs': 'Signed in as {name}',
  'forbidden.action': 'Back to your dashboard',
  'forbidden.switch': 'Sign in as someone else',

  /* ---- auth layout ------------------------------------------------------ */
  'auth.aside.title': 'Build circuits. Find the fault. Understand why.',
  'auth.aside.caption':
    'Every contact in a strip is one node. The trainer reads back the netlist you actually built, compares it with your instructor’s reference, and tells you what is different.',
  'auth.aside.point1': 'Wire freely — nothing is graded until you ask for a check.',
  'auth.aside.point2': 'Feedback names the pin, the row and the rail, not a score.',
  'auth.aside.point3': 'Your instructor sees where the class is stuck, not who is failing.',

  /* ---- sign in ---------------------------------------------------------- */
  'login.title': 'Sign in',
  'login.subtitle': 'Pick up where you left off, on any machine in the lab.',
  'login.email': 'Email',
  'login.password': 'Password',
  'login.remember': 'Keep me signed in on this machine',
  'login.rememberHint': 'Leave this off on a shared lab computer.',
  'login.forgot': 'Forgot your password?',
  'login.submit': 'Sign in',
  'login.submitting': 'Signing in',
  'login.noAccount': 'No account yet?',
  'login.register': 'Create one',
  'login.unverified.title': 'Confirm your email first',
  'login.unverified.body':
    'We sent a link to {email} when the account was created. Open it to finish signing up.',
  'login.unverified.resend': 'Send the link again',
  'login.unverified.resent': 'Sent. Check {email} — it may take a minute to arrive.',

  /* ---- register --------------------------------------------------------- */
  'register.title': 'Create an account',
  'register.subtitle': 'Students join with a class code once the account is confirmed.',
  'register.fullName': 'Full name',
  'register.fullNameHint': 'As it appears on your class list.',
  'register.email': 'Email',
  'register.emailHint': 'Use your school address if you have one.',
  'register.password': 'Password',
  'register.passwordHint': 'At least 8 characters. Length beats punctuation.',
  'register.role': 'I am a',
  'register.role.student': 'Student',
  'register.role.instructor': 'Instructor',
  'register.studentNumber': 'Student number',
  'register.studentNumberHint': 'The one on your registration form.',
  'register.section': 'Section',
  'register.inviteCode': 'Instructor invite code',
  'register.inviteCodeHint': 'Issued by your department. Accounts cannot be upgraded later.',
  'register.submit': 'Create account',
  'register.submitting': 'Creating your account',
  'register.haveAccount': 'Already registered?',
  'register.signIn': 'Sign in',

  /* ---- check your email ------------------------------------------------- */
  'checkEmail.title': 'Check your email',
  'checkEmail.body':
    'We sent a confirmation link to {email}. Open it and you can sign in — the link works once and expires in a day.',
  'checkEmail.nothing': 'Nothing arrived?',
  'checkEmail.resend': 'Send it again',
  'checkEmail.resent': 'Sent again. Give it a minute.',
  'checkEmail.signIn': 'Go to sign in',

  /* ---- forgot password -------------------------------------------------- */
  'forgot.title': 'Reset your password',
  'forgot.subtitle': 'We will email you a link. It works once and expires in an hour.',
  'forgot.email': 'Email',
  'forgot.submit': 'Email me a link',
  'forgot.submitting': 'Sending',
  'forgot.sent.title': 'Check your email',
  'forgot.sent.body':
    'If {email} is registered, a reset link is on its way. It works once and expires in an hour.',
  'forgot.backToSignIn': 'Back to sign in',

  /* ---- reset password --------------------------------------------------- */
  'reset.title': 'Choose a new password',
  'reset.subtitle': 'Once this is saved, every other signed-in browser is signed out.',
  'reset.password': 'New password',
  'reset.passwordHint': 'At least 8 characters.',
  'reset.confirm': 'Confirm new password',
  'reset.submit': 'Save and sign in',
  'reset.submitting': 'Saving',
  'reset.mismatch': 'Those two do not match.',
  'reset.done.title': 'Password changed',
  'reset.done.body': 'Sign in with the new one.',
  'reset.expired.title': 'That link has expired',
  'reset.expired.body': 'Reset links last an hour. Ask for a new one and it will arrive in a moment.',
  'reset.expired.action': 'Send me a new link',
  'reset.invalid.title': 'That link is not valid',
  'reset.invalid.body':
    'It may have already been used, or the address may have been cut short by your email client. Ask for a new one.',
  'reset.missingToken.title': 'This page needs a link',
  'reset.missingToken.body': 'Open the reset link from your email rather than typing this address in.',

  /* ---- verify email ----------------------------------------------------- */
  'verify.checking.title': 'Confirming your email',
  'verify.checking.body': 'One moment.',
  'verify.done.title': 'Email confirmed',
  'verify.done.body': 'That is the last step. Sign in and pick a class.',
  'verify.done.action': 'Sign in',
  'verify.expired.title': 'That link has expired',
  'verify.expired.body': 'Confirmation links last a day. Enter your email and we will send a fresh one.',
  'verify.expired.email': 'Email',
  'verify.expired.action': 'Send a new link',
  'verify.expired.sent': 'Sent. Check {email}.',
  'verify.used.title': 'That link has already been used',
  'verify.used.body': 'Your email is confirmed — there is nothing left to do but sign in.',
  'verify.invalid.title': 'That link is not valid',
  'verify.invalid.body':
    'It may have been cut short by your email client. Try opening it again, or ask for a new one.',
  'verify.missingToken.title': 'This page needs a link',
  'verify.missingToken.body':
    'Open the confirmation link from your email rather than typing this address in.',

  /* ---- route guards ----------------------------------------------------- */
  'guard.checking': 'Checking your session',
  'guard.signedOut': 'Your session has ended. Sign in to carry on.',

  /* ---- onboarding ------------------------------------------------------- */
  'onboarding.stepLabel': 'Step {current} of {total}',
  'onboarding.step.identity': 'Who you are',
  'onboarding.step.class': 'Your class',
  'onboarding.step.how': 'How this works',

  'onboarding.identity.title': 'Confirm your details',
  'onboarding.identity.subtitle':
    'Your instructor sees this on the class list, so it should match how you are registered.',
  'onboarding.identity.fullName': 'Full name',
  'onboarding.identity.studentNumber': 'Student number',
  'onboarding.identity.section': 'Section',
  'onboarding.identity.sectionHint': 'For example ECE-3A. You can change this later.',

  'onboarding.class.title': 'Join your class',
  'onboarding.class.subtitle':
    'Your instructor has a six-character code. It is on the board, or in your course page.',
  'onboarding.class.code': 'Class code',
  'onboarding.class.codeHint': 'Six letters and numbers. Case does not matter.',
  'onboarding.class.submit': 'Join class',
  'onboarding.class.submitting': 'Joining',
  'onboarding.class.joined': 'You are in {name}.',
  'onboarding.class.skip': 'I do not have a code yet',
  'onboarding.class.skipHint': 'You can join from Settings whenever your instructor gives you one.',

  'onboarding.how.title': 'How this works',
  'onboarding.how.subtitle': 'Three things worth knowing before your first exercise.',
  'onboarding.how.point1.title': 'Nothing is graded while you wire',
  'onboarding.how.point1.body':
    'The board records what you connect. You can pull a jumper out and put it back as often as you like.',
  'onboarding.how.point2.title': 'The feedback names the fault',
  'onboarding.how.point2.body':
    'When you scan, the trainer compares what you built with the reference and tells you which pin, which row, which rail — not a score.',
  'onboarding.how.point3.title': 'Asking for a hint is fine',
  'onboarding.how.point3.body':
    'Hints are counted so your instructor can see where a class is stuck, not to penalise you.',
  'onboarding.how.finish': 'Start using the trainer',
  'onboarding.how.finishing': 'Setting up',

  /* ---- settings --------------------------------------------------------- */
  'settings.title': 'Settings',
  'settings.subtitle': 'Your details, your password, and how the trainer looks and moves.',

  'settings.profile.eyebrow': 'Profile',
  'settings.profile.title': 'Your details',
  'settings.profile.description': 'What your instructor sees on the class list.',
  'settings.profile.fullName': 'Full name',
  'settings.profile.studentNumber': 'Student number',
  'settings.profile.section': 'Section',
  'settings.profile.email': 'Email',
  'settings.profile.emailHint': 'Contact your instructor to change the address on your account.',
  'settings.profile.save': 'Save details',
  'settings.profile.saved': 'Your details are saved.',

  'settings.password.eyebrow': 'Password',
  'settings.password.title': 'Change your password',
  'settings.password.description': 'Signing in elsewhere will stop working. This browser stays signed in.',
  'settings.password.current': 'Current password',
  'settings.password.next': 'New password',
  'settings.password.confirm': 'Confirm new password',
  'settings.password.save': 'Change password',
  'settings.password.saved': 'Your password is changed.',

  'settings.language.eyebrow': 'Language',
  'settings.language.title': 'Language',
  'settings.language.description': 'Applies everywhere, and follows you to another machine.',
  /**
   * Endonyms — each language named in its own language, identical in every
   * catalogue. Translating these is the one place where translating is wrong:
   * a student who has landed in a language they cannot read needs to recognise
   * the name of the one they can.
   */
  'settings.language.en': 'English',
  'settings.language.fil': 'Filipino',

  'settings.access.eyebrow': 'Accessibility',
  'settings.access.title': 'Display and motion',
  'settings.access.description':
    'Saved to your account, so the trainer looks the same on every machine you sign in to.',
  'settings.access.theme': 'Theme',
  'settings.access.theme.dark': 'Dark',
  'settings.access.theme.light': 'Light',
  'settings.access.theme.system': 'System',
  'settings.access.highContrast': 'Higher contrast',
  'settings.access.highContrastHint': 'Firms up hairlines and secondary text.',
  'settings.access.reducedMotion': 'Reduce motion',
  'settings.access.reducedMotionHint': 'Turns off transitions and entrance animations everywhere.',
  'settings.access.largerText': 'Larger text',
  'settings.access.largerTextHint': 'Scales the whole interface up by one step.',

  'settings.classes.eyebrow': 'Classes',
  'settings.classes.title': 'Your classes',
  'settings.classes.description': 'Join another with a code from your instructor.',
  'settings.classes.empty': 'You are not in a class yet',
  'settings.classes.emptyDescription': 'Ask your instructor for the six-character code.',
  'settings.classes.code': 'Class code',
  'settings.classes.join': 'Join',
  'settings.classes.joining': 'Joining',

  /* ---- dashboard --------------------------------------------------------- */
  'dashboard.greeting': 'Hello, {name}',
  'dashboard.today': 'Today is {date}',
  'dashboard.action.freeBuild': 'Free build',
  'dashboard.search.jump': 'Jump to search',
  'dashboard.search.label': 'Search your exercises',
  'dashboard.search.placeholder': 'Search exercises',
  'dashboard.search.empty': 'No exercise matches that search.',
  'dashboard.search.clear': 'Clear search',
  'dashboard.progress.eyebrow': 'Progress',
  'dashboard.you.completedOf': '{completed} of {assigned} exercises finished.',
  'dashboard.you.noneAssigned': 'Nothing is assigned to you yet.',
  'dashboard.activity.eyebrow': 'History',
  'dashboard.activity.title': 'Recent activity',
  'dashboard.activity.empty': 'Nothing opened yet. Every exercise you attempt shows up here, newest first.',
  'dashboard.next.eyebrow': 'Up next',
  'dashboard.next.resumeEyebrow': 'Pick up where you left off',
  'dashboard.next.start': 'Start this exercise',
  'dashboard.next.resume': 'Resume',
  'dashboard.next.difficulty': 'Difficulty {level} of 5',
  'dashboard.next.attempts': 'Attempts so far: {count}',
  'dashboard.status.inProgress': 'In progress',
  'dashboard.status.notStarted': 'Not started',
  'dashboard.status.completed': 'Completed',
  'dashboard.allDone.title': 'Everything assigned is done',
  'dashboard.allDone.description':
    'All {count} of your exercises are complete. Your instructor will assign more.',
  'dashboard.noExercises.title': 'Nothing assigned yet',
  'dashboard.noExercises.description':
    'Your instructor has not published an exercise to this class yet. It will appear here when they do.',
  'dashboard.noClass.title': 'Join a class to get started',
  'dashboard.noClass.description':
    'Your instructor has a six-character code. Once you join, the exercises they have set appear here.',
  'dashboard.totals.assigned': 'Assigned',
  'dashboard.totals.inProgress': 'In progress',
  'dashboard.totals.completed': 'Completed',
  'dashboard.totals.progress': 'Overall progress',
  'dashboard.classes.eyebrow': 'Enrolment',
  'dashboard.classes.title': 'Your classes',
  'dashboard.classes.manage': 'Manage',
  'dashboard.classes.join': 'Join a class',
  'dashboard.classes.empty': 'You are not in a class yet',
  'dashboard.classes.emptyDescription':
    'Ask your instructor for the six-character code, then join from Settings.',
  'dashboard.class.students': 'Students',
  'dashboard.class.exercises': 'Exercises',
  'dashboard.class.code': 'Code',
  'dashboard.class.progress': 'Exercises done',

  'dashboard.library.eyebrow': 'Your work',
  'dashboard.library.title': 'All your exercises',
  'dashboard.library.description': 'Everything assigned to you, with whatever is unfinished first.',
  'dashboard.library.start': 'Start',
  'dashboard.library.review': 'Review',
  'dashboard.library.difficulty': 'Difficulty',
  'dashboard.library.parts': 'Parts',
  'dashboard.library.lastOpened': 'Last opened {date}',

  /* ---- the exercise brief ------------------------------------------------ */
  'lab.crumb': 'Exercise',
  'lab.board.alt':
    'An empty breadboard: two banks of five-hole columns either side of the centre channel, with a ' +
    'power rail above and below.',
  'lab.loadingTitle': 'Opening the exercise',
  'lab.back': 'Back to dashboard',
  'lab.preview.eyebrow': 'The workspace',
  'lab.preview.title': 'The board is yours',
  'lab.preview.description':
    'Press Build and this board becomes the workspace: take parts from the tray, seat their legs in ' +
    'real holes, and watch the nets appear in the readout as power spreads across what you wire. ' +
    'Everything saves as you go.',
  'lab.parts.title': 'What you will need',
  'lab.parts.empty': 'No parts have been listed for this exercise yet.',
  'lab.status.title': 'Where you are',
  'lab.build': 'Build the circuit',
  'lab.buildAgain': 'Build it again',
  'lab.buildHint': 'Your work saves as it goes.',
  'lab.notFound.title': 'That exercise is not on your list',
  'lab.notFound.description':
    'It may have been unpublished, or it belongs to a class you are not in. Your dashboard has the ' +
    'ones assigned to you.',
  'lab.failed.description': 'The exercise could not be loaded. Try again in a moment.',

  /* ---- the workspace ------------------------------------------------------ */
  'workspace.tray.title': 'Parts tray',
  'workspace.tray.left': '{count} left',
  'workspace.hint.select': 'Click a placed part to select it — Delete removes it, Escape puts the tray down.',
  'workspace.status.pick': 'Choose a part from the tray, then click a hole on the board.',
  'workspace.status.firstLead': 'Click a hole for the first leg of {part}.',
  'workspace.status.firstLeadLed': 'Click a hole for the anode (+) leg of {part}.',
  'workspace.status.secondLead': 'Now the second leg of {part}.',
  'workspace.status.secondLeadLed': 'Now the cathode (−) leg — the return side.',
  'workspace.status.transistor':
    'Click the middle hole — the base. The three legs take three columns in a row.',
  'workspace.status.occupied': 'That hole is taken. Pick a free one.',
  'workspace.status.transistorSpace':
    'A transistor needs three free holes in a row, in a bank — not on a rail.',
  'workspace.saving': 'Saving…',
  'workspace.saved': 'Saved',
  'workspace.saveFailed': 'Autosave failed — it retries on your next change.',
  'workspace.toolbar.undo': 'Undo',
  'workspace.toolbar.remove': 'Remove',
  'workspace.toolbar.clear': 'Clear board',
  'workspace.toolbar.saveExit': 'Save & exit',
  'workspace.progress.parts': 'Parts placed',
  'workspace.leds.lit': '{ref} lights',
  'workspace.leds.dark': '{ref} is dark',
  'workspace.floating': 'Not reached by power yet: {count}.',
  'workspace.warning.railShort':
    'The +5V and ground rails are wired straight together. Remove that jumper before anything else.',
  'workspace.warning.ledDirect':
    '{refs} reaches both rails with nothing to limit its current — put a resistor in its path.',
  'workspace.complete.title': 'Circuit complete',
  'workspace.complete.body':
    'Every part is placed, power reaches everything, and the LED lights. Hand it in when you are ready.',
  'workspace.complete.toast': 'Every net checks out and the LED lights.',
  'workspace.netlist.title': 'Extracted nets',
  'workspace.netlist.empty': 'Place a part and its nets appear here, live.',
  'workspace.submit': 'Hand in',
  'workspace.submitDialog.title': 'Hand in this attempt?',
  'workspace.submitDialog.complete':
    'The circuit is complete. It will be recorded as done, and the board cannot be changed afterwards.',
  'workspace.submitDialog.incomplete':
    'The circuit is not complete yet, so it will be recorded as attempted rather than done. You can keep building instead.',
  'workspace.submitDialog.confirm': 'Hand in',
  'workspace.submitDialog.cancel': 'Keep building',
  'workspace.submitted': 'Handed in. Nice work.',
  'workspace.submittedIncomplete': 'Handed in.',
  'workspace.exitSaved': 'Saved. Your attempt stays open to resume.',
  'workspace.hole.upper': 'Upper bank, column {column}, row {row}',
  'workspace.hole.lower': 'Lower bank, column {column}, row {row}',
  'workspace.hole.railTop': '+5V rail, column {column}',
  'workspace.hole.railBottom': 'Ground rail, column {column}',
  'workspace.board.alt': 'Interactive breadboard. Choose a part from the tray, then click holes to place it.',

  /* ---- the test run -------------------------------------------------------- */
  'workspace.view.label': 'Board view',
  'workspace.view.flat': '2D',
  'workspace.view.dimensional': '3D',
  'workspace.test.run': 'Test the circuit',
  'workspace.test.rerun': 'Test again',
  'workspace.test.scanning': 'Scanning the board…',
  'workspace.test.title': 'Test results',
  'workspace.test.pass': 'Pass',
  'workspace.test.fail': 'Fail',
  'workspace.test.perfect': 'Everything checks out.',
  'workspace.check.parts.ok': 'Every part is on the board.',
  'workspace.check.parts.fail': 'Still in the tray: {refs}.',
  'workspace.check.shorts.ok': 'No short between the rails.',
  'workspace.check.shorts.fail': 'The +5V and ground rails are shorted — look at your jumpers.',
  'workspace.check.connected.ok': 'Power reaches every part.',
  'workspace.check.connected.fail': 'Not reached by power: {refs} — look at columns {columns}.',
  'workspace.check.leds.ok': 'Every LED lights.',
  'workspace.check.leds.fail': 'Dark: {refs} — check both sides at columns {columns}.',
  'workspace.check.protected.ok': 'Every LED has a resistor in its path.',
  'workspace.check.protected.fail': '{refs} has nothing limiting its current — columns {columns}.',
  'workspace.submitDialog.score': 'Latest test: {score}%.',

  /* ---- free build ---------------------------------------------------------- */
  'sandbox.title': 'Free build',
  'sandbox.subtitle':
    'The whole shelf, no assignment and nothing to hand in. Build anything, test it, and it stays on this computer.',

  /* ---- instructor placeholder ------------------------------------------- */
  'teach.title': 'Teaching',
  'teach.subtitle': 'Your classes, your exercises, and where a section is getting stuck.',
  'teach.pending.eyebrow': 'Phase 6',
  'teach.pending.title': 'The instructor shell lands next',
  'teach.pending.description':
    'The API behind it is already in place and refuses a student session. The screens are the next phase of the build.',

  /* ---- the animated board demo ------------------------------------------ */
  'board.alt':
    'A breadboard with a resistor, an LED and two jumper wires. The ground jumper is on the wrong side of the centre channel.',
  'board.placing.supplyJumper': 'Running a jumper from the +5V rail',
  'board.placing.resistor': 'Seating the 220 ohm resistor',
  'board.placing.led': 'Seating the LED across the centre channel',
  'board.placing.groundJumper': 'Running a jumper back to ground',
  'board.stage.ready': 'Circuit built',
  'board.stage.building': 'Building the circuit',
  'board.stage.scanning': 'Reading the board',
  'board.stage.reading': 'Extracting nets',
  'board.stage.diagnosed': '1 net missing',
  'board.replay': 'Run it again',
  'board.still': 'Motion is off',
  'board.match': 'match',
  'board.absent': 'absent',
  'board.diagnosisEyebrow': 'Diagnosis',
  'board.diagnosis':
    'D1 cathode never reaches ground. The jumper sits on the far side of the centre channel, so what was drawn as one node is two.',
  'board.hint': 'Hover a net to light it on the board.',

  /* ---- results (after hand-in) ------------------------------------------ */
  'results.crumb': 'Result',
  'results.loadingTitle': 'Opening your result',
  'results.title': 'Your result',
  'results.scoreLabel': 'Score',
  'results.scoreOf': '{score} / 100',
  'results.submittedAt': 'Handed in {when}',
  'results.breakdown.title': 'How it was scored',
  'results.breakdown.points': '{earned} / {possible}',
  'results.suggestions.title': 'What to look at',
  'results.suggestions.lead': 'Start with the first one — fixing it often changes the rest.',
  'results.suggestions.showFix': 'Show the fix',
  'results.suggestions.hideFix': 'Hide the fix',
  'results.suggestions.fixLabel': 'The fix',
  'results.source.model': 'Worded by the AI coach',
  'results.source.rules': 'Coach notes',
  'results.clean.title': 'It matches the task circuit',
  'results.stale':
    'Your instructor has changed the reference circuit since this was scored. The score stands; building it again will be scored against the new one.',
  'results.ungraded.title': 'Handed in — not scored',
  'results.ungraded.description':
    'This exercise had no reference circuit when you handed it in, so there is nothing to score it against.',
  'results.open.title': 'Not handed in yet',
  'results.open.description': 'This attempt is still open. Go back to the board to finish it.',
  'results.open.action': 'Back to the board',
  'results.actions.dashboard': 'Back to dashboard',
  'results.actions.retry': 'Build it again',
  'results.failed.description': 'Could not load this result. Try again in a moment.',
  'results.notFound.title': 'That result is not yours to see',
  'results.notFound.description': 'It belongs to another student, or it does not exist.',

  /* ---- grade lines ------------------------------------------------------- */
  'grade.line.circuit': 'Matches the task circuit',
  'grade.line.parts': 'Right parts',
  'grade.line.polarity': 'Polarity',
  'grade.line.safety': 'Safety',
  'grade.circuit.full': 'Every connection in the task circuit is in place.',
  'grade.circuit.partial': '{linked} of {total} connections match the task circuit.',
  'grade.circuit.none': 'None of the task circuit’s connections are in place yet.',
  'grade.parts.full': 'Every part is the one the task asks for.',
  'grade.parts.missing': 'Parts from the task not on the board: {missing}.',
  'grade.parts.wrongValue': 'Parts with a different value from the task: {wrongValue}.',
  'grade.parts.none': 'None of the task’s parts are on the board.',
  'grade.polarity.full': 'Every part that has a direction faces the right way.',
  'grade.polarity.reversed': 'Parts turned the wrong way round: {reversed}.',
  'grade.polarity.notWired': 'Direction counts once a part is wired in — {right} of {total} so far.',
  'grade.polarity.noPolarParts': 'Nothing in this circuit can go in backwards.',
  'grade.polarity.empty': 'Nothing on the board to check.',
  'grade.safety.full': 'No shorts, and every LED has something limiting its current.',
  'grade.safety.railShort': 'The +5V and ground rails are shorted together.',
  'grade.safety.unprotected': 'Nothing limits the current through {refs}.',
  'grade.safety.empty': 'Nothing on the board to check.',

  /* ---- AI coach: findings, hint first ------------------------------------ */
  'coach.endpoint.vcc': 'the +5V rail',
  'coach.endpoint.gnd': 'the ground rail',
  'coach.endpoint.pin': '{ref}.{pin} (column {column})',
  'coach.rail_short.question':
    'Trace a path from the +5V rail to ground using only wire. What is there to stop the current?',
  'coach.rail_short.fix': 'Remove {refs} — it joins +5V straight to ground (columns {columns}).',
  'coach.led_unprotected.question': 'What limits the current through {refs}?',
  'coach.led_unprotected.fix':
    'Put the resistor in the path of {refs}, between the rail and the LED (columns {columns}).',
  'coach.missing_part.question': 'Look at the tray — is every part the task asks for on the board?',
  'coach.missing_part.fix': 'Place the {part}. It is still missing from your circuit.',
  'coach.missing_link.question': 'Follow {a}. Where should it connect next?',
  'coach.missing_link.fix': 'Connect {a} to {b}.',
  'coach.extra_link.question': '{a} and {b} are joined. Should they be?',
  'coach.extra_link.fix': 'Separate {a} from {b} — the task circuit does not join them.',
  'coach.polarity.question': 'Which leg of {refs} has to face the positive side?',
  'coach.polarity.fix': 'Turn {refs} around (columns {columns}).',
  'coach.wrong_value.question': 'Check the value on {refs}. Is it the one the task asks for?',
  'coach.wrong_value.fix': 'Swap {refs} ({actual}) for the {expected} part.',
  'coach.clean.praise': 'Every connection matches the task circuit. Well built.',
  'coach.strength.circuit': 'The circuit matches the task.',
  'coach.strength.parts': 'You picked the right parts.',
  'coach.strength.polarity': 'Every part that has a direction faces the right way.',
  'coach.strength.safety': 'The board is safe to power.',

  /* ---- errors ----------------------------------------------------------- */
  'error.generic': 'That did not work. Try again.',
  'error.network': 'Could not reach the server. Check your connection and try again.',
  'error.required': 'This field is required.',
} as const

export type MessageKey = keyof typeof en

/**
 * The contract every other catalogue is held to. A missing key fails the build;
 * an extra key fails the build. Neither can reach a student as a blank label.
 */
export type Catalog = { readonly [K in MessageKey]: string }
