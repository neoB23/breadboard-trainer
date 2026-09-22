import type { Catalog } from './en'

/**
 * Filipino.
 *
 * Typed as `Catalog`, so a key missing here is a build failure rather than a
 * blank label in front of a student. That is the whole reason the type exists.
 *
 * ---------------------------------------------------------------------------
 * TRANSLATION POLICY — technical vocabulary stays in English
 *
 * "Netlist", "breadboard", "resistor", "jumper", "node", "rail", "LED" and the
 * rest are left untranslated, and this is a considered choice rather than
 * laziness. Philippine electronics engineering is taught in English: the
 * textbooks, the datasheets, the board silkscreen and the licensure exam all use
 * these words. Inventing Tagalog equivalents would produce a UI whose vocabulary
 * matches nothing the student will meet again, which is worse than not
 * translating at all.
 *
 * What *is* translated is everything around them — instructions, buttons, error
 * messages, reassurance. That is the register real Philippine engineering
 * classrooms code-switch in, and it is what makes the interface easier rather
 * than merely different.
 * ---------------------------------------------------------------------------
 */
export const fil: Catalog = {
  /* ---- shell and chrome ------------------------------------------------- */
  'app.name': 'Breadboard',
  'app.nameSuffix': 'Trainer',
  'app.tagline': 'Buuin ang circuit. Kunin ang netlist. Tukuyin ang fault.',

  'nav.primary': 'Pangunahin',
  'nav.open': 'Buksan ang menu',
  'nav.close': 'Isara ang menu',
  'nav.dashboard': 'Dashboard',
  'nav.exercises': 'Mga ehersisyo',
  'nav.teach': 'Pagtuturo',
  'nav.sandbox': 'Malayang pagbuo',
  'nav.settings': 'Mga setting',

  'account.menu': 'Menu ng account',
  'account.profile': 'Profile',
  'account.settings': 'Mga setting',
  'account.signOut': 'Mag-sign out',

  'theme.toLight': 'Lumipat sa maliwanag na tema',
  'theme.toDark': 'Lumipat sa madilim na tema',

  'role.student': 'Estudyante',
  'role.instructor': 'Instructor',
  'role.admin': 'Admin',

  'common.back': 'Bumalik',
  'common.cancel': 'Kanselahin',
  'common.continue': 'Magpatuloy',
  'common.loading': 'Naglo-load',
  'common.optional': 'opsyonal',
  'common.retry': 'Subukan ulit',
  'common.save': 'I-save',
  'common.saved': 'Na-save',
  'common.saving': 'Sine-save',
  'common.show': 'Ipakita',
  'common.hide': 'Itago',

  /* ---- assistive-tech labels -------------------------------------------- */
  'a11y.breadcrumb': 'Breadcrumb',
  'a11y.close': 'Isara',
  'a11y.progress': 'Progreso',
  'a11y.dismiss': 'I-dismiss',

  /* ---- landing ---------------------------------------------------------- */
  'landing.headline.1': 'Buuin ang circuit.',
  'landing.headline.2a': 'Kunin ang',
  'landing.headline.2b': 'netlist',
  'landing.headline.2c': '.',
  'landing.headline.3': 'Tukuyin ang fault.',
  'landing.lead':
    'Nagwi-wire ang mga estudyante ng circuit sa isang 3D workspace. Binabasa ng trainer ang netlist na aktwal nilang naitayo, ihinahambing ito sa golden reference ng instructor, at pinapangalanan ang pagkakaiba — kulang na jumper, napalitang rail, o resistor na tumatawid sa gitnang channel.',
  'landing.cta.signIn': 'Mag-sign in',
  'landing.cta.register': 'Gumawa ng account',
  'landing.cta.howItWorks': 'Paano ito gumagana',
  'landing.comparison.eyebrow': 'Paghahambing',
  'landing.comparison.fault': '1 fault',
  'landing.comparison.match': 'tugma',
  'landing.comparison.absent': 'wala',
  'landing.comparison.diagnosisEyebrow': 'Diyagnosis',
  'landing.comparison.diagnosis':
    'Hindi umaabot sa ground ang cathode ng D1. Nasa kabilang panig ng gitnang channel ang jumper, kaya magkahiwalay na net ang row 14 at row 15.',
  'landing.how.eyebrow': 'Paano ito gumagana',
  'landing.how.title': 'Mula tie-point hanggang diyagnosis',
  'landing.how.description':
    'Apat na hakbang, walang black box. Masusuri ang bawat isa nang mag-isa — iyon ang dahilan kung bakit natututuhan ang feedback sa halip na basta grado lang.',
  'landing.step.build.title': 'Buuin',
  'landing.step.build.body':
    'Ilagay ang mga bahagi at ipatong ang mga jumper sa full-size na board sa 3D workspace. Walang ginagrado habang nagwi-wire ka — itinatala lang ng board kung ano ang ikinabit mo.',
  'landing.step.extract.title': 'Kunin',
  'landing.step.extract.body':
    'Isang node ang bawat contact sa isang strip. Nililibot ng trainer ang board, pinagsasama ang mga tie-point sa mga net, at isinusulat ang netlist ng aktwal na naitayo.',
  'landing.step.compare.title': 'Ihambing',
  'landing.step.compare.body':
    'Ihinahambing ang netlist na iyon sa golden reference ng instructor. Ang mga sobrang net, kulang na net at maling pagkakakabit ay kusang lumalabas sa pagkakaiba.',
  'landing.step.diagnose.title': 'Tukuyin',
  'landing.step.diagnose.body':
    'Tumatakbo ang solver sa naitayong circuit at pinapangalanan ang fault sa wika ng board: aling pin, aling row, aling rail — hindi isang iskor.',
  'landing.spec.eyebrow': 'Espesipikasyon',
  'landing.spec.workspace': 'Workspace',
  'landing.spec.workspaceDetail': 'ilagay, i-wire, suriin',
  'landing.spec.tiePoints': 'Tie-points',
  'landing.spec.tiePointsDetail': 'full-size na solderless board',
  'landing.spec.solver': 'Solver',
  'landing.spec.solverDetail': 'modified nodal analysis',
  'landing.spec.contrast': 'Target na contrast',
  'landing.spec.contrastDetail': 'WCAG 2.2, hindi kailanman kulay lamang',
  'landing.footer.note':
    'Ang workspace, ang diagnostics engine at ang Learn Mode ay darating sa mga susunod na yugto.',
  'landing.footer.badge': 'Part A · student shell',

  /* ---- 404 -------------------------------------------------------------- */
  'notFound.eyebrow': 'Error 404',
  'notFound.title': 'Walang pahina sa address na ito',
  'notFound.description':
    'Maaaring luma na ang link, o baka isa ito sa mga pahinang gagawin pa sa susunod na yugto.',
  'notFound.action': 'Bumalik sa simula',

  /* ---- 403 -------------------------------------------------------------- */
  'forbidden.eyebrow': 'Error 403',
  'forbidden.title': 'Para sa mga instructor ang bahaging ito',
  'forbidden.description':
    'Naka-sign in ka, pero pang-instructor ang pahinang ito. Walang problema sa account mo.',
  'forbidden.signedInAs': 'Naka-sign in bilang {name}',
  'forbidden.action': 'Bumalik sa iyong dashboard',
  'forbidden.switch': 'Mag-sign in bilang iba',

  /* ---- auth layout ------------------------------------------------------ */
  'auth.aside.title': 'Bumuo ng circuit. Hanapin ang fault. Unawain kung bakit.',
  'auth.aside.caption':
    'Isang node ang bawat contact sa isang strip. Binabasa ng trainer ang netlist na aktwal mong naitayo, ihinahambing ito sa reference ng instructor mo, at sinasabi kung ano ang pagkakaiba.',
  'auth.aside.point1': 'Malaya kang mag-wire — walang ginagrado hangga’t hindi ka humihingi ng check.',
  'auth.aside.point2': 'Pinapangalanan ng feedback ang pin, ang row at ang rail, hindi isang iskor.',
  'auth.aside.point3':
    'Nakikita ng instructor mo kung saan nahihirapan ang klase, hindi kung sino ang bumabagsak.',

  /* ---- sign in ---------------------------------------------------------- */
  'login.title': 'Mag-sign in',
  'login.subtitle': 'Ituloy kung saan ka huling tumigil, sa kahit anong makina sa lab.',
  'login.email': 'Email',
  'login.password': 'Password',
  'login.remember': 'Manatiling naka-sign in sa makinang ito',
  'login.rememberHint': 'Huwag itong buksan sa kompyuter na ginagamit ng marami.',
  'login.forgot': 'Nakalimutan ang password?',
  'login.submit': 'Mag-sign in',
  'login.submitting': 'Nagsa-sign in',
  'login.noAccount': 'Wala pang account?',
  'login.register': 'Gumawa ng isa',
  'login.unverified.title': 'Kumpirmahin muna ang email mo',
  'login.unverified.body':
    'Nagpadala kami ng link sa {email} noong ginawa ang account. Buksan iyon para matapos ang pag-sign up.',
  'login.unverified.resend': 'Ipadala ulit ang link',
  'login.unverified.resent': 'Naipadala. Tingnan ang {email} — maaaring tumagal ng isang minuto.',

  /* ---- register --------------------------------------------------------- */
  'register.title': 'Gumawa ng account',
  'register.subtitle': 'Sumasali ang mga estudyante gamit ang class code kapag nakumpirma na ang account.',
  'register.fullName': 'Buong pangalan',
  'register.fullNameHint': 'Katulad ng nakalagay sa class list.',
  'register.email': 'Email',
  'register.emailHint': 'Gamitin ang school address mo kung mayroon.',
  'register.password': 'Password',
  'register.passwordHint': 'Hindi bababa sa 8 karakter. Mas mahalaga ang haba kaysa sa simbolo.',
  'register.role': 'Ako ay',
  'register.role.student': 'Estudyante',
  'register.role.instructor': 'Instructor',
  'register.studentNumber': 'Student number',
  'register.studentNumberHint': 'Ang nasa registration form mo.',
  'register.section': 'Section',
  'register.inviteCode': 'Instructor invite code',
  'register.inviteCodeHint':
    'Ibinibigay ng inyong departamento. Hindi na maaaring i-upgrade ang account mamaya.',
  'register.submit': 'Gumawa ng account',
  'register.submitting': 'Ginagawa ang account mo',
  'register.haveAccount': 'Rehistrado ka na?',
  'register.signIn': 'Mag-sign in',

  /* ---- check your email ------------------------------------------------- */
  'checkEmail.title': 'Tingnan ang email mo',
  'checkEmail.body':
    'Nagpadala kami ng kumpirmasyong link sa {email}. Buksan ito at makakapag-sign in ka na — isang beses lang ito gumagana at mag-e-expire sa loob ng isang araw.',
  'checkEmail.nothing': 'Walang dumating?',
  'checkEmail.resend': 'Ipadala ulit',
  'checkEmail.resent': 'Naipadala ulit. Maghintay ng isang minuto.',
  'checkEmail.signIn': 'Pumunta sa sign in',

  /* ---- forgot password -------------------------------------------------- */
  'forgot.title': 'I-reset ang password mo',
  'forgot.subtitle':
    'Padadalhan ka namin ng link. Isang beses lang ito gumagana at mag-e-expire sa isang oras.',
  'forgot.email': 'Email',
  'forgot.submit': 'Padalhan ako ng link',
  'forgot.submitting': 'Ipinapadala',
  'forgot.sent.title': 'Tingnan ang email mo',
  'forgot.sent.body':
    'Kung rehistrado ang {email}, papunta na ang reset link. Isang beses lang ito gumagana at mag-e-expire sa isang oras.',
  'forgot.backToSignIn': 'Bumalik sa sign in',

  /* ---- reset password --------------------------------------------------- */
  'reset.title': 'Pumili ng bagong password',
  'reset.subtitle': 'Kapag na-save ito, masi-sign out ang lahat ng ibang browser.',
  'reset.password': 'Bagong password',
  'reset.passwordHint': 'Hindi bababa sa 8 karakter.',
  'reset.confirm': 'Ulitin ang bagong password',
  'reset.submit': 'I-save at mag-sign in',
  'reset.submitting': 'Sine-save',
  'reset.mismatch': 'Hindi magkatugma ang dalawang iyon.',
  'reset.done.title': 'Napalitan ang password',
  'reset.done.body': 'Mag-sign in gamit ang bago.',
  'reset.expired.title': 'Nag-expire na ang link na iyon',
  'reset.expired.body': 'Isang oras lang tumatagal ang reset link. Humingi ng bago at darating ito agad.',
  'reset.expired.action': 'Padalhan ako ng bagong link',
  'reset.invalid.title': 'Hindi wasto ang link na iyon',
  'reset.invalid.body':
    'Maaaring nagamit na ito, o baka pinutol ng email app mo ang address. Humingi ng bago.',
  'reset.missingToken.title': 'Kailangan ng link ang pahinang ito',
  'reset.missingToken.body': 'Buksan ang reset link mula sa email mo sa halip na i-type ang address na ito.',

  /* ---- verify email ----------------------------------------------------- */
  'verify.checking.title': 'Kinukumpirma ang email mo',
  'verify.checking.body': 'Sandali lang.',
  'verify.done.title': 'Nakumpirma ang email',
  'verify.done.body': 'Iyon na ang huling hakbang. Mag-sign in at pumili ng klase.',
  'verify.done.action': 'Mag-sign in',
  'verify.expired.title': 'Nag-expire na ang link na iyon',
  'verify.expired.body':
    'Isang araw lang tumatagal ang kumpirmasyong link. Ilagay ang email mo at padadalhan ka namin ng bago.',
  'verify.expired.email': 'Email',
  'verify.expired.action': 'Magpadala ng bagong link',
  'verify.expired.sent': 'Naipadala. Tingnan ang {email}.',
  'verify.used.title': 'Nagamit na ang link na iyon',
  'verify.used.body': 'Nakumpirma na ang email mo — mag-sign in na lang.',
  'verify.invalid.title': 'Hindi wasto ang link na iyon',
  'verify.invalid.body': 'Maaaring pinutol ito ng email app mo. Subukang buksan ulit, o humingi ng bago.',
  'verify.missingToken.title': 'Kailangan ng link ang pahinang ito',
  'verify.missingToken.body':
    'Buksan ang kumpirmasyong link mula sa email mo sa halip na i-type ang address na ito.',

  /* ---- route guards ----------------------------------------------------- */
  'guard.checking': 'Sinusuri ang session mo',
  'guard.signedOut': 'Natapos na ang session mo. Mag-sign in para magpatuloy.',

  /* ---- onboarding ------------------------------------------------------- */
  'onboarding.stepLabel': 'Hakbang {current} ng {total}',
  'onboarding.step.identity': 'Sino ka',
  'onboarding.step.class': 'Ang klase mo',
  'onboarding.step.how': 'Paano ito gumagana',

  'onboarding.identity.title': 'Kumpirmahin ang iyong detalye',
  'onboarding.identity.subtitle':
    'Ito ang nakikita ng instructor mo sa class list, kaya dapat tugma ito sa pagkakarehistro mo.',
  'onboarding.identity.fullName': 'Buong pangalan',
  'onboarding.identity.studentNumber': 'Student number',
  'onboarding.identity.section': 'Section',
  'onboarding.identity.sectionHint': 'Halimbawa ECE-3A. Mababago mo ito mamaya.',

  'onboarding.class.title': 'Sumali sa klase mo',
  'onboarding.class.subtitle':
    'May anim na karakter na code ang instructor mo. Nasa pisara ito, o sa course page ninyo.',
  'onboarding.class.code': 'Class code',
  'onboarding.class.codeHint': 'Anim na letra at numero. Hindi mahalaga kung malaki o maliit.',
  'onboarding.class.submit': 'Sumali sa klase',
  'onboarding.class.submitting': 'Sumasali',
  'onboarding.class.joined': 'Kasali ka na sa {name}.',
  'onboarding.class.skip': 'Wala pa akong code',
  'onboarding.class.skipHint': 'Makakasali ka mula sa Mga setting kapag binigay na ito ng instructor mo.',

  'onboarding.how.title': 'Paano ito gumagana',
  'onboarding.how.subtitle': 'Tatlong bagay na dapat mong malaman bago ang unang ehersisyo mo.',
  'onboarding.how.point1.title': 'Walang ginagrado habang nagwi-wire ka',
  'onboarding.how.point1.body':
    'Itinatala lang ng board kung ano ang ikinabit mo. Maaari mong tanggalin at ibalik ang jumper kahit ilang beses.',
  'onboarding.how.point2.title': 'Pinapangalanan ng feedback ang fault',
  'onboarding.how.point2.body':
    'Kapag nag-scan ka, ihinahambing ng trainer ang naitayo mo sa reference at sinasabi kung aling pin, aling row, aling rail — hindi isang iskor.',
  'onboarding.how.point3.title': 'Ayos lang humingi ng hint',
  'onboarding.how.point3.body':
    'Binibilang ang mga hint para makita ng instructor mo kung saan nahihirapan ang klase, hindi para parusahan ka.',
  'onboarding.how.finish': 'Simulan ang paggamit ng trainer',
  'onboarding.how.finishing': 'Inihahanda',

  /* ---- settings --------------------------------------------------------- */
  'settings.title': 'Mga setting',
  'settings.subtitle': 'Ang detalye mo, ang password mo, at kung paano lumilitaw at gumagalaw ang trainer.',

  'settings.profile.eyebrow': 'Profile',
  'settings.profile.title': 'Ang iyong detalye',
  'settings.profile.description': 'Ito ang nakikita ng instructor mo sa class list.',
  'settings.profile.fullName': 'Buong pangalan',
  'settings.profile.studentNumber': 'Student number',
  'settings.profile.section': 'Section',
  'settings.profile.email': 'Email',
  'settings.profile.emailHint': 'Makipag-ugnayan sa instructor mo para mapalitan ang address sa account mo.',
  'settings.profile.save': 'I-save ang detalye',
  'settings.profile.saved': 'Na-save na ang detalye mo.',

  'settings.password.eyebrow': 'Password',
  'settings.password.title': 'Palitan ang password mo',
  'settings.password.description':
    'Titigil ang pag-sign in sa ibang lugar. Mananatiling naka-sign in ang browser na ito.',
  'settings.password.current': 'Kasalukuyang password',
  'settings.password.next': 'Bagong password',
  'settings.password.confirm': 'Ulitin ang bagong password',
  'settings.password.save': 'Palitan ang password',
  'settings.password.saved': 'Napalitan na ang password mo.',

  'settings.language.eyebrow': 'Wika',
  'settings.language.title': 'Wika',
  'settings.language.description': 'Ginagamit sa lahat ng pahina, at susunod sa iyo sa ibang makina.',
  // Endonyms in both catalogues: see the note in en.ts.
  'settings.language.en': 'English',
  'settings.language.fil': 'Filipino',

  'settings.access.eyebrow': 'Accessibility',
  'settings.access.title': 'Itsura at galaw',
  'settings.access.description':
    'Naka-save sa account mo, kaya pareho ang itsura ng trainer sa bawat makinang pinag-si-sign in-an mo.',
  'settings.access.theme': 'Tema',
  'settings.access.theme.dark': 'Madilim',
  'settings.access.theme.light': 'Maliwanag',
  'settings.access.theme.system': 'Sistema',
  'settings.access.highContrast': 'Mas mataas na contrast',
  'settings.access.highContrastHint': 'Pinatitingkad ang mga hairline at pangalawang teksto.',
  'settings.access.reducedMotion': 'Bawasan ang galaw',
  'settings.access.reducedMotionHint': 'Ina-off ang mga transition at entrance animation sa buong app.',
  'settings.access.largerText': 'Mas malaking teksto',
  'settings.access.largerTextHint': 'Pinalalaki ang buong interface ng isang hakbang.',

  'settings.classes.eyebrow': 'Mga klase',
  'settings.classes.title': 'Ang mga klase mo',
  'settings.classes.description': 'Sumali sa iba gamit ang code mula sa instructor mo.',
  'settings.classes.empty': 'Wala ka pang klase',
  'settings.classes.emptyDescription': 'Hingin sa instructor mo ang anim na karakter na code.',
  'settings.classes.code': 'Class code',
  'settings.classes.join': 'Sumali',
  'settings.classes.joining': 'Sumasali',

  /* ---- dashboard --------------------------------------------------------- */
  'dashboard.greeting': 'Kumusta, {name}',
  'dashboard.today': 'Ngayon ay {date}',
  'dashboard.action.freeBuild': 'Malayang pagbuo',
  'dashboard.search.jump': 'Pumunta sa paghahanap',
  'dashboard.search.label': 'Hanapin ang mga ehersisyo mo',
  'dashboard.search.placeholder': 'Maghanap ng ehersisyo',
  'dashboard.search.empty': 'Walang ehersisyong tumutugma sa hinanap mo.',
  'dashboard.search.clear': 'I-clear ang paghahanap',
  'dashboard.progress.eyebrow': 'Progreso',
  'dashboard.you.completedOf': '{completed} sa {assigned} ehersisyo ang tapos na.',
  'dashboard.you.noneAssigned': 'Wala ka pang nakatalagang ehersisyo.',
  'dashboard.activity.eyebrow': 'Kasaysayan',
  'dashboard.activity.title': 'Kamakailang gawain',
  'dashboard.activity.empty':
    'Wala pang nabuksan. Lilitaw dito ang bawat ehersisyong sinubukan mo, pinakabago muna.',
  'dashboard.next.eyebrow': 'Susunod',
  'dashboard.next.resumeEyebrow': 'Ituloy kung saan ka tumigil',
  'dashboard.next.start': 'Simulan ang ehersisyo',
  'dashboard.next.resume': 'Ituloy',
  'dashboard.next.difficulty': 'Antas {level} ng 5',
  'dashboard.next.attempts': 'Mga pagsubok: {count}',
  'dashboard.status.inProgress': 'Ginagawa pa',
  'dashboard.status.notStarted': 'Hindi pa nasisimulan',
  'dashboard.status.completed': 'Tapos na',
  'dashboard.allDone.title': 'Tapos na ang lahat ng nakatalaga',
  'dashboard.allDone.description':
    'Kumpleto na ang lahat ng {count} mong ehersisyo. Magdadagdag pa ang instructor mo.',
  'dashboard.noExercises.title': 'Wala pang nakatalaga',
  'dashboard.noExercises.description':
    'Wala pang na-publish na ehersisyo ang instructor mo sa klaseng ito. Lalabas ito rito kapag mayroon na.',
  'dashboard.noClass.title': 'Sumali sa klase para makapagsimula',
  'dashboard.noClass.description':
    'May anim na karakter na code ang instructor mo. Kapag sumali ka, lalabas dito ang mga ehersisyong itinakda nila.',
  'dashboard.totals.assigned': 'Nakatalaga',
  'dashboard.totals.inProgress': 'Ginagawa pa',
  'dashboard.totals.completed': 'Tapos na',
  'dashboard.totals.progress': 'Kabuuang progreso',
  'dashboard.classes.eyebrow': 'Pagpapatala',
  'dashboard.classes.title': 'Ang mga klase mo',
  'dashboard.classes.manage': 'Pamahalaan',
  'dashboard.classes.join': 'Sumali sa klase',
  'dashboard.classes.empty': 'Wala ka pang klase',
  'dashboard.classes.emptyDescription':
    'Hingin sa instructor mo ang anim na karakter na code, tapos sumali mula sa Mga setting.',
  'dashboard.class.students': 'Mga estudyante',
  'dashboard.class.exercises': 'Mga ehersisyo',
  'dashboard.class.code': 'Code',
  'dashboard.class.progress': 'Tapos na ehersisyo',

  'dashboard.library.eyebrow': 'Ang gawain mo',
  'dashboard.library.title': 'Lahat ng ehersisyo mo',
  'dashboard.library.description': 'Lahat ng nakatalaga sa iyo, nauuna ang hindi pa tapos.',
  'dashboard.library.start': 'Simulan',
  'dashboard.library.review': 'Balikan',
  'dashboard.library.difficulty': 'Antas',
  'dashboard.library.parts': 'Mga parte',
  'dashboard.library.lastOpened': 'Huling binuksan {date}',

  /* ---- the exercise brief ------------------------------------------------ */
  'lab.crumb': 'Ehersisyo',
  'lab.board.alt':
    'Walang lamang breadboard: dalawang bangko ng limang-butas na kolum sa magkabilang gilid ng gitnang ' +
    'channel, may power rail sa itaas at ibaba.',
  'lab.loadingTitle': 'Binubuksan ang ehersisyo',
  'lab.back': 'Bumalik sa dashboard',
  'lab.preview.eyebrow': 'Ang workspace',
  'lab.preview.title': 'Sa iyo ang board',
  'lab.preview.description':
    'Pindutin ang Buuin at magiging workspace ang board na ito: kumuha ng parte mula sa tray, ikabit ' +
    'ang mga binti nito sa tunay na butas, at panoorin ang mga net na lumitaw sa readout habang ' +
    'kumakalat ang kuryente sa mga kinabit mo. Awtomatikong nase-save ang lahat.',
  'lab.parts.title': 'Ano ang kakailanganin mo',
  'lab.parts.empty': 'Wala pang nakalistang parte para sa ehersisyong ito.',
  'lab.status.title': 'Nasaan ka na',
  'lab.build': 'Buuin ang sirkit',
  'lab.buildAgain': 'Buuin itong muli',
  'lab.buildHint': 'Nase-save ang gawa mo habang gumagawa ka.',
  'lab.notFound.title': 'Wala sa listahan mo ang ehersisyong iyon',
  'lab.notFound.description':
    'Maaaring hindi na ito nakapublish, o pag-aari ito ng klaseng hindi mo kasapi. Nasa dashboard mo ' +
    'ang mga nakatalaga sa iyo.',
  'lab.failed.description': 'Hindi ma-load ang ehersisyo. Subukan ulit maya-maya.',

  /* ---- the workspace ------------------------------------------------------ */
  'workspace.tray.title': 'Tray ng mga parte',
  'workspace.tray.left': '{count} na lang',
  'workspace.hint.select':
    'I-click ang nakalagay na parte para piliin ito — Delete para tanggalin, Escape para ibaba ang tray.',
  'workspace.status.pick': 'Pumili ng parte mula sa tray, tapos mag-click ng butas sa board.',
  'workspace.status.firstLead': 'Mag-click ng butas para sa unang binti ng {part}.',
  'workspace.status.firstLeadLed': 'Mag-click ng butas para sa anode (+) na binti ng {part}.',
  'workspace.status.secondLead': 'Ngayon ang pangalawang binti ng {part}.',
  'workspace.status.secondLeadLed': 'Ngayon ang cathode (−) na binti — ang balikan.',
  'workspace.status.transistor':
    'I-click ang gitnang butas — ang base. Tatlong magkakasunod na kolum ang kukunin ng tatlong binti.',
  'workspace.status.occupied': 'May nakalagay na sa butas na iyan. Pumili ng bakante.',
  'workspace.status.transistorSpace':
    'Kailangan ng transistor ng tatlong bakanteng butas na magkakasunod, sa bank — hindi sa rail.',
  'workspace.saving': 'Sine-save…',
  'workspace.saved': 'Naka-save',
  'workspace.saveFailed': 'Hindi nakapag-autosave — susubukan ulit sa susunod mong pagbabago.',
  'workspace.toolbar.undo': 'I-undo',
  'workspace.toolbar.remove': 'Tanggalin',
  'workspace.toolbar.clear': 'Linisin ang board',
  'workspace.toolbar.saveExit': 'I-save at lumabas',
  'workspace.progress.parts': 'Mga nakalagay na parte',
  'workspace.leds.lit': 'Umiilaw ang {ref}',
  'workspace.leds.dark': 'Patay ang {ref}',
  'workspace.floating': 'Hindi pa naaabot ng kuryente: {count}.',
  'workspace.warning.railShort':
    'Direktang magkakabit ang +5V at ground rails. Tanggalin muna ang jumper na iyon bago ang lahat.',
  'workspace.warning.ledDirect':
    'Umaabot sa dalawang rail ang {refs} nang walang panglimita ng kuryente — maglagay ng resistor sa daanan nito.',
  'workspace.complete.title': 'Kumpleto ang sirkit',
  'workspace.complete.body':
    'Nakalagay ang lahat ng parte, naaabot ng kuryente ang lahat, at umiilaw ang LED. Ipasa kapag handa ka na.',
  'workspace.complete.toast': 'Tama ang bawat net at umiilaw ang LED.',
  'workspace.netlist.title': 'Mga nakuhang net',
  'workspace.netlist.empty': 'Maglagay ng parte at lilitaw dito ang mga net nito, live.',
  'workspace.submit': 'Ipasa',
  'workspace.submitDialog.title': 'Ipasa ang pagsubok na ito?',
  'workspace.submitDialog.complete':
    'Kumpleto ang sirkit. Maitatala itong tapos, at hindi na mababago ang board pagkatapos.',
  'workspace.submitDialog.incomplete':
    'Hindi pa kumpleto ang sirkit, kaya maitatala itong sinubukan, hindi tapos. Puwede ka ring magpatuloy sa paggawa.',
  'workspace.submitDialog.confirm': 'Ipasa',
  'workspace.submitDialog.cancel': 'Magpatuloy sa paggawa',
  'workspace.submitted': 'Naipasa. Mahusay!',
  'workspace.submittedIncomplete': 'Naipasa.',
  'workspace.exitSaved': 'Naka-save. Bukas pa rin ang pagsubok mo para ituloy.',
  'workspace.hole.upper': 'Itaas na bank, kolum {column}, hanay {row}',
  'workspace.hole.lower': 'Ibabang bank, kolum {column}, hanay {row}',
  'workspace.hole.railTop': '+5V rail, kolum {column}',
  'workspace.hole.railBottom': 'Ground rail, kolum {column}',
  'workspace.board.alt':
    'Interactive na breadboard. Pumili ng parte mula sa tray, tapos mag-click ng mga butas para ilagay ito.',

  /* ---- the test run -------------------------------------------------------- */
  'workspace.view.label': 'Anyo ng board',
  'workspace.view.flat': '2D',
  'workspace.view.dimensional': '3D',
  'workspace.test.run': 'Subukan ang sirkit',
  'workspace.test.rerun': 'Subukan ulit',
  'workspace.test.scanning': 'Sini-scan ang board…',
  'workspace.test.title': 'Resulta ng pagsubok',
  'workspace.test.pass': 'Pasado',
  'workspace.test.fail': 'Palpak',
  'workspace.test.perfect': 'Tama ang lahat.',
  'workspace.check.parts.ok': 'Nasa board na ang bawat parte.',
  'workspace.check.parts.fail': 'Nasa tray pa: {refs}.',
  'workspace.check.shorts.ok': 'Walang short sa pagitan ng mga rail.',
  'workspace.check.shorts.fail': 'Naka-short ang +5V at ground rails — tingnan ang mga jumper mo.',
  'workspace.check.connected.ok': 'Naaabot ng kuryente ang bawat parte.',
  'workspace.check.connected.fail': 'Hindi naaabot ng kuryente: {refs} — tingnan ang kolum {columns}.',
  'workspace.check.leds.ok': 'Umiilaw ang bawat LED.',
  'workspace.check.leds.fail': 'Patay: {refs} — suriin ang magkabilang panig sa kolum {columns}.',
  'workspace.check.protected.ok': 'May resistor sa daanan ng bawat LED.',
  'workspace.check.protected.fail': 'Walang panglimita ng kuryente ang {refs} — kolum {columns}.',
  'workspace.submitDialog.score': 'Huling pagsubok: {score}%.',

  /* ---- free build ---------------------------------------------------------- */
  'sandbox.title': 'Malayang pagbuo',
  'sandbox.subtitle':
    'Ang buong estante, walang takdang gawain at walang ipapasa. Bumuo ng kahit ano, subukan ito, at mananatili ito sa computer na ito.',

  /* ---- teaching: the exercise list -------------------------------------- */
  'teach.title': 'Pagtuturo',
  'teach.subtitle':
    'Ang mga ehersisyo mo, ang reference circuit na pinaghahambingan ng iskor, at kung paano ang bawat klase.',
  'teach.exercises.title': 'Ang mga ehersisyo mo',
  'teach.exercises.new': 'Bagong ehersisyo',
  'teach.exercises.empty.title': 'Wala pang ehersisyo',
  'teach.exercises.empty.description':
    'Gumawa ng isa, buuin ang reference circuit nito sa Learn Mode, saka i-publish sa isang klase. Awtomatikong iiskoran ang mga ipinasa laban sa sirkit mo.',
  'teach.exercises.failed': 'Hindi ma-load ang mga ehersisyo mo. Subukan ulit maya-maya.',
  'teach.exercises.status.captured': 'May reference na',
  'teach.exercises.status.notCaptured': 'Wala pang reference',
  'teach.exercises.status.published': 'Naka-publish',
  'teach.exercises.status.draft': 'Draft',
  'teach.exercises.library': 'Library — walang klase',
  'teach.exercises.attempts': 'Mga attempt: {count}',
  'teach.exercises.actions.edit': 'I-edit',
  'teach.exercises.actions.capture': 'Learn Mode',
  'teach.exercises.actions.scores': 'Mga iskor',

  /* ---- teaching: the exercise editor ------------------------------------ */
  'teach.editor.crumb': 'Ehersisyo',
  'teach.editor.newTitle': 'Bagong ehersisyo',
  'teach.editor.newSubtitle':
    'Pangalanan ito, sabihin kung ano ang dapat buuin ng estudyante, at punuin ang tray. Susunod ang reference circuit, sa Learn Mode.',
  'teach.editor.notFound': 'Hindi sa iyo ang ehersisyong iyon.',
  'teach.editor.failed': 'Hindi ma-load ang ehersisyong ito. Subukan ulit maya-maya.',
  'teach.editor.details': 'Mga detalye',
  'teach.editor.fields.title': 'Pamagat',
  'teach.editor.fields.objective': 'Layunin',
  'teach.editor.fields.objectiveHint': 'Isa o dalawang pangungusap na magagawa ng estudyante.',
  'teach.editor.fields.difficulty': 'Hirap',
  'teach.editor.fields.class': 'Klase',
  'teach.editor.fields.noClass': 'Walang klase — library lang',
  'teach.editor.bom.title': 'Tray',
  'teach.editor.bom.hint':
    'Ang mga parteng ibibigay sa estudyante. Dapat gamitin ng reference circuit ang bawat isa; ang mga jumper ay budget, hindi requirement.',
  'teach.editor.bom.empty': 'Wala pang laman ang tray. Idagdag ang mga parteng ibibigay sa estudyante.',
  'teach.editor.bom.add': 'Idagdag',
  'teach.editor.bom.label': 'Label',
  'teach.editor.bom.value': 'Value',
  'teach.editor.bom.quantity': 'Dami',
  'teach.editor.bom.remove': 'Tanggalin ang {type}',
  'teach.editor.bom.type.resistor': 'Resistor',
  'teach.editor.bom.type.led': 'LED',
  'teach.editor.bom.type.capacitor': 'Capacitor',
  'teach.editor.bom.type.diode': 'Diode',
  'teach.editor.bom.type.transistor': 'Transistor',
  'teach.editor.bom.type.jumper': 'Jumper wire',
  'teach.editor.create': 'Gumawa at buuin ang reference',
  'teach.editor.save': 'I-save ang mga pagbabago',
  'teach.editor.created': 'Nagawa ang ehersisyo. Buuin na ang reference circuit nito.',
  'teach.editor.saved': 'Na-save.',
  'teach.editor.invalid': 'Suriin ang mga field na may marka sa ibaba.',
  'teach.editor.bomChange.title': 'Baguhin ang tray?',
  'teach.editor.bomChange.body':
    'Binuo ang reference circuit mula sa kasalukuyang tray. Kapag binago ito, mabubura ang reference at ma-a-unpublish ang ehersisyo; kukunin mo itong muli sa Learn Mode.',
  'teach.editor.bomChange.confirm': 'Baguhin ang tray at burahin ang reference',
  'teach.editor.bomChange.cancel': 'Panatilihin ang tray',
  'teach.editor.referenceCleared': 'Nabago ang tray — nabura ang reference. Kunin itong muli sa Learn Mode.',
  'teach.editor.reference.title': 'Reference circuit',
  'teach.editor.reference.captured':
    'Nakuha na — {components} na parte. Iiskoran laban dito ang bawat ipinasa sa sandaling dumating.',
  'teach.editor.reference.missing':
    'Hindi pa nakukuha. Hindi maiiskoran ang mga estudyante hangga’t wala ito.',
  'teach.editor.reference.open': 'Buksan ang Learn Mode',
  'teach.editor.publish.title': 'Pag-publish',
  'teach.editor.publish.label': 'Naka-publish sa mga estudyante',
  'teach.editor.publish.needsReference': 'Kunin muna ang reference circuit sa Learn Mode bago i-publish.',
  'teach.editor.publish.on': 'Naka-publish. Masisimulan na ito ng mga estudyante sa klase.',
  'teach.editor.publish.off': 'Na-unpublish. Hindi na ito nakikita ng mga estudyante.',
  'teach.editor.scores': 'Tingnan ang mga iskor',

  /* ---- teaching: Learn Mode --------------------------------------------- */
  'teach.capture.crumb': 'Learn Mode',
  'teach.capture.subtitle':
    'Buuin ang sirkit gaya ng gagawin ng estudyanteng buo ang iskor. Iiskoran laban dito ang bawat ipinasa — saanman sa board ito buuin ng estudyante.',
  'teach.capture.failed': 'Hindi ma-load ang Learn Mode. Subukan ulit maya-maya.',
  'teach.capture.draftNote': 'Nananatili sa computer na ito ang board mo hanggang kunin mo ito.',
  'teach.capture.action': 'Kunin bilang reference',
  'teach.capture.replace': 'Palitan ang reference',
  'teach.capture.replaceDialog.title': 'Palitan ang reference?',
  'teach.capture.replaceDialog.body':
    'Mananatili ang mga naibigay nang iskor, na may markang iniskoran laban sa lumang reference. Ma-a-unpublish ang ehersisyo hanggang i-publish mo ulit.',
  'teach.capture.replaceDialog.confirm': 'Palitan',
  'teach.capture.replaceDialog.cancel': 'Panatilihin ang luma',
  'teach.capture.ready.title': 'Handa nang kunin',
  'teach.capture.ready.body':
    'Walang short, protektado ang bawat LED, walang nakalutang, at gamit ang bawat parte sa tray.',
  'teach.capture.issues.title': 'Hindi pa ito puwedeng maging reference',
  'teach.capture.issue.empty_board': 'Buuin muna ang sirkit — hindi sirkit ang mga jumper lang.',
  'teach.capture.issue.short_circuit':
    'Hindi ligtas: {labels}. Mawawalan ng puntos sa kaligtasan ang estudyanteng gagaya rito.',
  'teach.capture.issue.floating_lead': 'Walang nakakabit: {labels}.',
  'teach.capture.issue.unused_bom_component': 'Nasa tray pa: {labels}.',
  'teach.capture.done': 'Nakuha ang reference. I-publish kapag handa ka na.',
  'teach.capture.doneReplaced': 'Napalitan ang reference. Minarkahang luma ang mga naunang iskor: {count}.',
  'teach.capture.publish': 'I-publish',
  'teach.capture.published': 'Naka-publish',
  'teach.capture.toEditor': 'Bumalik sa ehersisyo',

  /* ---- teaching: scores ------------------------------------------------- */
  'teach.submissions.crumb': 'Mga iskor',
  'teach.submissions.subtitle': 'Bawat ipinasa, iniskoran laban sa reference circuit mo.',
  'teach.submissions.failed': 'Hindi ma-load ang mga iskor. Subukan ulit maya-maya.',
  'teach.submissions.empty.title': 'Wala pang ipinapasa',
  'teach.submissions.empty.description':
    'Lalabas dito ang mga iskor sa sandaling magpasa ang mga estudyante.',
  'teach.submissions.count': 'Mga ipinasa: {count}',
  'teach.submissions.average': 'Karaniwang iskor: {score}',
  'teach.submissions.col.student': 'Estudyante',
  'teach.submissions.col.submitted': 'Ipinasa',
  'teach.submissions.col.time': 'Oras',
  'teach.submissions.col.score': 'Iskor',
  'teach.submissions.minutes': '{minutes} min',
  'teach.submissions.notScored': 'Walang iskor',
  'teach.submissions.stale': 'Lumang reference',
  'teach.submissions.view': 'Tingnan',
  'teach.submissions.back': 'Bumalik sa mga iskor',

  /* ---- the animated board demo ------------------------------------------ */
  'board.alt':
    'Isang breadboard na may resistor, LED at dalawang jumper wire. Nasa maling panig ng gitnang channel ang ground jumper.',
  'board.placing.supplyJumper': 'Naglalagay ng jumper mula sa +5V rail',
  'board.placing.resistor': 'Isinasaksak ang 220 ohm na resistor',
  'board.placing.led': 'Isinasaksak ang LED patawid sa gitnang channel',
  'board.placing.groundJumper': 'Naglalagay ng jumper pabalik sa ground',
  'board.stage.ready': 'Nabuo ang circuit',
  'board.stage.building': 'Binubuo ang circuit',
  'board.stage.scanning': 'Binabasa ang board',
  'board.stage.reading': 'Kinukuha ang mga net',
  'board.stage.diagnosed': '1 net ang kulang',
  'board.replay': 'Ulitin',
  'board.still': 'Naka-off ang galaw',
  'board.match': 'tugma',
  'board.absent': 'wala',
  'board.diagnosisEyebrow': 'Diyagnosis',
  'board.diagnosis':
    'Hindi umaabot sa ground ang cathode ng D1. Nasa kabilang panig ng gitnang channel ang jumper, kaya dalawa ang naging node na dapat ay iisa.',
  'board.hint': 'I-hover ang isang net para tumingkad ito sa board.',

  /* ---- results (after hand-in) ------------------------------------------ */
  'results.crumb': 'Resulta',
  'results.loadingTitle': 'Binubuksan ang resulta mo',
  'results.title': 'Ang resulta mo',
  'results.scoreLabel': 'Iskor',
  'results.scoreOf': '{score} / 100',
  'results.submittedAt': 'Ipinasa {when}',
  'results.breakdown.title': 'Paano ito binigyan ng iskor',
  'results.breakdown.points': '{earned} / {possible}',
  'results.suggestions.title': 'Ano ang titingnan',
  'results.suggestions.lead': 'Magsimula sa una — kadalasan, nababago nito ang iba pa kapag naayos.',
  'results.suggestions.showFix': 'Ipakita ang ayos',
  'results.suggestions.hideFix': 'Itago ang ayos',
  'results.suggestions.fixLabel': 'Ang ayos',
  'results.source.model': 'Isinulat ng AI coach',
  'results.source.rules': 'Mga tala ng coach',
  'results.clean.title': 'Tugma ito sa sirkit ng gawain',
  'results.stale':
    'Binago ng instructor mo ang reference circuit mula nang ma-iskoran ito. Mananatili ang iskor; ang susunod mong pagbuo ay iiskoran laban sa bago.',
  'results.ungraded.title': 'Naipasa — walang iskor',
  'results.ungraded.description':
    'Walang reference circuit ang ehersisyong ito noong ipinasa mo, kaya walang mapaghahambingan ng iskor.',
  'results.open.title': 'Hindi pa naipapasa',
  'results.open.description': 'Bukas pa ang attempt na ito. Bumalik sa board para tapusin.',
  'results.open.action': 'Bumalik sa board',
  'results.actions.dashboard': 'Bumalik sa dashboard',
  'results.actions.retry': 'Buuin itong muli',
  'results.failed.description': 'Hindi ma-load ang resultang ito. Subukan ulit maya-maya.',
  'results.notFound.title': 'Hindi para sa iyo ang resultang iyon',
  'results.notFound.description': 'Sa ibang estudyante ito, o wala ito.',

  /* ---- grade lines ------------------------------------------------------- */
  'grade.line.circuit': 'Tugma sa sirkit ng gawain',
  'grade.line.parts': 'Tamang mga parte',
  'grade.line.polarity': 'Polarity',
  'grade.line.safety': 'Kaligtasan',
  'grade.circuit.full': 'Nasa lugar ang bawat koneksyon ng sirkit ng gawain.',
  'grade.circuit.partial': '{linked} sa {total} na koneksyon ang tugma sa sirkit ng gawain.',
  'grade.circuit.none': 'Wala pang koneksyon ng sirkit ng gawain ang nasa lugar.',
  'grade.parts.full': 'Ang bawat parte ay ang hinihingi ng gawain.',
  'grade.parts.missing': 'Mga parte ng gawain na wala sa board: {missing}.',
  'grade.parts.wrongValue': 'Mga parteng iba ang value sa hinihingi: {wrongValue}.',
  'grade.parts.none': 'Wala sa board ang alinmang parte ng gawain.',
  'grade.polarity.full': 'Tama ang harap ng bawat parteng may direksyon.',
  'grade.polarity.reversed': 'Mga parteng baligtad ang pagkakalagay: {reversed}.',
  'grade.polarity.notWired':
    'Binibilang ang direksyon kapag nakakabit na ang parte — {right} sa {total} pa lang.',
  'grade.polarity.noPolarParts': 'Walang parte sa sirkit na ito ang puwedeng mabaligtad.',
  'grade.polarity.empty': 'Walang masusuri sa board.',
  'grade.safety.full': 'Walang short, at may panglimita ng kuryente ang bawat LED.',
  'grade.safety.railShort': 'Naka-short ang +5V at ground rail.',
  'grade.safety.unprotected': 'Walang naglilimita ng kuryente sa {refs}.',
  'grade.safety.empty': 'Walang masusuri sa board.',

  /* ---- AI coach: findings, hint first ------------------------------------ */
  'coach.endpoint.vcc': 'ang +5V rail',
  'coach.endpoint.gnd': 'ang ground rail',
  'coach.endpoint.pin': '{ref}.{pin} (column {column})',
  'coach.rail_short.question':
    'Sundan ang daan mula sa +5V rail papuntang ground gamit lang ang wire. Ano ang pipigil sa kuryente?',
  'coach.rail_short.fix':
    'Tanggalin ang {refs} — direkta nitong ikinakabit ang +5V sa ground (columns {columns}).',
  'coach.led_unprotected.question': 'Ano ang naglilimita ng kuryente sa {refs}?',
  'coach.led_unprotected.fix':
    'Ilagay ang resistor sa daanan ng {refs}, sa pagitan ng rail at ng LED (columns {columns}).',
  'coach.missing_part.question': 'Tingnan ang tray — nasa board ba ang bawat parteng hinihingi ng gawain?',
  'coach.missing_part.fix': 'Ilagay ang {part}. Wala pa ito sa sirkit mo.',
  'coach.missing_link.question': 'Sundan ang {a}. Saan ito dapat sumunod na kumonekta?',
  'coach.missing_link.fix': 'Ikonekta ang {a} sa {b}.',
  'coach.extra_link.question': 'Magkakabit ang {a} at {b}. Dapat ba?',
  'coach.extra_link.fix': 'Paghiwalayin ang {a} at {b} — hindi sila magkakabit sa sirkit ng gawain.',
  'coach.polarity.question': 'Aling binti ng {refs} ang dapat nakaharap sa positibong panig?',
  'coach.polarity.fix': 'Baligtarin ang {refs} (columns {columns}).',
  'coach.wrong_value.question': 'Tingnan ang value ng {refs}. Iyon ba ang hinihingi ng gawain?',
  'coach.wrong_value.fix': 'Palitan ang {refs} ({actual}) ng parteng {expected}.',
  'coach.clean.praise': 'Tugma ang bawat koneksyon sa sirkit ng gawain. Mahusay ang pagkakabuo.',
  'coach.strength.circuit': 'Tugma ang sirkit sa gawain.',
  'coach.strength.parts': 'Tama ang mga parteng pinili mo.',
  'coach.strength.polarity': 'Tama ang harap ng bawat parteng may direksyon.',
  'coach.strength.safety': 'Ligtas i-power ang board.',

  /* ---- errors ----------------------------------------------------------- */
  'error.generic': 'Hindi ito gumana. Subukan ulit.',
  'error.network': 'Hindi maabot ang server. Suriin ang koneksyon mo at subukan ulit.',
  'error.required': 'Kailangan ang field na ito.',
}
