/* ============================================================
       SPEAKLY APP  —  hash router SPA
       NOTE: All AI logic here is a smart on-device demo engine.
       In production, swap the analyze()/naturalize()/coachReply()
       functions for Claude API (Messages endpoint) calls.
    ============================================================ */

    /* ---------- Shared global state ---------- */
    const store = {
        get sentence() { return localStorage.getItem('spk_sentence') || ''; },
        set sentence(v) { localStorage.setItem('spk_sentence', v); },
        get mode() { return localStorage.getItem('spk_mode') || 'Casual American'; },
        set mode(v) { localStorage.setItem('spk_mode', v); },
        get streak() { return +(localStorage.getItem('spk_streak') || 1); },
        set streak(v) { localStorage.setItem('spk_streak', v); },
    };

    const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
    const toast = (m) => { const t = document.getElementById('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2200); };
    const ic = (n, attrs = '') => `<i data-lucide="${n}" ${attrs}></i>`;
    const refreshIcons = () => { if (window.lucide) lucide.createIcons(); };

    /* ---------- Navigation config ---------- */
    const NAV = [
        { id: 'dashboard', icon: 'layout-dashboard', label: 'Dashboard' },
        { id: 'chat',      icon: 'spell-check', label: 'Correct My English' },
        { id: 'native',    icon: 'sparkles', label: 'Sound More Native' },
        { id: 'modes',     icon: 'drama', label: 'English Modes' },
        { id: 'voice',     icon: 'mic', label: 'Voice Conversation' },
        { id: 'pronunciation', icon: 'volume-2', label: 'Pronunciation' },
        { id: 'ielts',     icon: 'graduation-cap', label: 'IELTS Speaking' },
        { id: 'progress',  icon: 'trending-up', label: 'Progress' },
    ];
    const BOTTOM = ['dashboard', 'chat', 'voice', 'ielts', 'progress'];
    const titleOf = id => (NAV.find(n => n.id === id) || NAV[0]).label;

    /* ============================================================
       SMART CORRECTION ENGINE
    ============================================================ */
    // Grammar rules — fire only on real mistakes
    const GRAMMAR_RULES = [
        { re: /\bi am (agree|disagree)\b/i, fix: (m, v) => `I ${v.toLowerCase()}`, note: 'We say “I agree/disagree” — without “am”.' },
        { re: /\b(he|she|it)\s+don't\b/i, fix: (m, s) => `${cap(s)} doesn't`, note: 'With he/she/it use “doesn’t”, not “don’t”.' },
        { re: /\b(he|she|it)\s+have\b/i, fix: (m, s) => `${cap(s)} has`, note: 'With he/she/it use “has”, not “have”.' },
        { re: /\bwant\s+(eat|go|drink|see|buy|learn|play|study|work|sleep|leave|speak|talk|meet|help|come|take|make)\b/i, fix: (m, v) => `want to ${v}`, note: 'After “want” add “to” before the verb.' },
        { re: /\bi no (understand|know|like|want|have)\b/i, fix: (m, v) => `I don't ${v}`, note: 'To make it negative use “don’t” + verb.' },
        { re: /\byesterday i go\b/i, fix: () => 'yesterday I went', note: '“Yesterday” is past, so “go” → “went”.' },
        { re: /\ba ([aeiou]\w+)/i, fix: (m, w) => `an ${w}`, note: 'Use “an” before a vowel sound.' },
        { re: /\bmore better\b/i, fix: () => 'better', note: '“Better” is already comparative — drop “more”.' },
        { re: /\bpeoples\b/i, fix: () => 'people', note: '“People” is already plural.' },
    ];

    // Known sentences that are correct but have a nicer native version
    const KNOWN_OK = {
        'i want to go to school': 'I’m heading to school.',
        'i am planning to work at school': 'I’m planning to work at the school.',
        'i am planning to work at the school': 'I’m planning to work at the school.',
        'thank you for your help': 'Thanks so much for the help!',
        'how are you': 'Hey, how’s it going?',
    };

    function polish(t) {
        let s = t.trim().replace(/\s+/g, ' ').replace(/\bi\b/g, 'I');
        s = cap(s);
        if (!/[.!?]$/.test(s)) s += '.';
        return s;
    }

    function naturalize(t) {
        let s = ' ' + t.trim() + ' ';
        s = s.replace(/\bI am\b/g, "I'm").replace(/\bdo not\b/gi, "don't")
             .replace(/\bcannot\b/gi, "can't").replace(/\bwant to\b/gi, "wanna")
             .replace(/\bgoing to\b/gi, "gonna").replace(/\bI will\b/g, "I'll");
        s = s.trim();
        return cap(s.replace(/\bi\b/g, 'I'));
    }

    function analyze(text) {
        const raw = text.trim().replace(/\s+/g, ' ');
        if (!raw) return null;
        let working = raw, fired = null;
        for (const r of GRAMMAR_RULES) {
            if (r.re.test(working)) {
                working = working.replace(r.re, r.fix);
                fired = r.note;
                break; // one clear fix at a time keeps it simple & realistic
            }
        }
        const key = raw.toLowerCase().replace(/[.!?]+$/, '');
        if (fired) {
            return { correct: false, original: raw, fixed: polish(working), note: fired, native: naturalize(working) };
        }
        // Already correct
        const native = KNOWN_OK[key] || naturalize(raw);
        const polished = polish(raw);
        const tinyTip = polished.toLowerCase() !== ('i' + raw.toLowerCase().slice(1)).replace(/[.!?]/g,'') ;
        return { correct: true, original: raw, polished, native };
    }

    /* ============================================================
       NATIVE + MODES ENGINES
    ============================================================ */
    const NATIVE_MAP = {
        'i want eat food': '“I wanna grab something to eat.”',
        'i am very tired': '“I’m totally wiped out.”',
        'please give me help': '“Could you give me a hand?”',
        'i am tired': '“I’m exhausted.”',
        'i am happy': '“I’m super happy!”',
        'i want to go to school': '“I’m heading off to school.”',
    };
    function nativeVersions(text) {
        const key = text.trim().toLowerCase().replace(/[.!?]+$/, '');
        const casual = NATIVE_MAP[key] || `“${naturalize(text)}”`;
        return casual;
    }

    const MODES_MAP = {
        'i am tired': { 'Casual American': "I'm exhausted.", 'British Polite': "I'm afraid I'm rather tired.", 'Professional': "I'm feeling quite drained today.", 'Gen Z': "I'm dead tired, no cap.", 'Friendly Social': "Ugh, I'm so wiped out!", 'Simple English': "I am very tired." },
        'i am happy': { 'Casual American': "I'm so happy!", 'British Polite': "I'm absolutely delighted.", 'Professional': "I'm very pleased with this.", 'Gen Z': "I'm vibing, this is so good.", 'Friendly Social': "Aw, this makes me so happy!", 'Simple English': "I am very happy." },
    };
    const MODE_WRAP = {
        'Casual American': t => `${cap(t)}, for real.`,
        'British Polite': t => `I'd say ${t.toLowerCase()}, if that's alright.`,
        'Professional': t => `${cap(t)}. I wanted to share that with you.`,
        'Gen Z': t => `Ngl, ${t.toLowerCase()} fr fr.`,
        'Friendly Social': t => `Hey! ${cap(t)} 😊`,
        'Simple English': t => `${cap(t)}.`
    };
    function modeVersion(text, mode) {
        const key = text.trim().toLowerCase().replace(/[.!?]+$/, '');
        return (MODES_MAP[key] && MODES_MAP[key][mode]) || MODE_WRAP[mode](naturalize(text));
    }
    // Style chips — premium styles are locked for guests (limit E).
    function modeChips() {
        const all = (window.Speakly ? Speakly.ALL_MODES : ['Casual American','British Polite','Professional','Gen Z','Friendly Social','Simple English']);
        const ok = m => !window.Speakly || Speakly.modeAllowed(m);
        return all.map(m => {
            const locked = !ok(m);
            const active = (m === store.mode && !locked) ? 'active' : '';
            return `<button class="chip ${active} ${locked ? 'locked' : ''}" data-mode="${m}" ${locked ? 'data-locked="1"' : ''}>${m}${locked ? ' ' + ic('lock') : ''}</button>`;
        }).join('');
    }

    /* ============================================================
       PAGES
    ============================================================ */
    const PAGES = {};

    /* ---- Dashboard ---- */
    PAGES.dashboard = () => `
        <div class="page-head">
            <span class="eyebrow">${ic('hand')} Good to see you</span>
            <h2>Hi Dilnoza, ready to speak today?</h2>
            <p>Your personal English coach is ready. Pick a practice below or jump straight into a conversation.</p>
        </div>
        <div class="stat-grid">
            <div class="stat"><div class="big">${ic('flame')} ${store.streak}</div><div class="lbl">Day streak</div></div>
            <div class="stat"><div class="big">86%</div><div class="lbl">Fluency score</div><div class="bar"><i style="width:86%"></i></div></div>
            <div class="stat"><div class="big">42<span style="font-size:15px;color:var(--muted)">/60m</span></div><div class="lbl">Weekly goal</div><div class="bar"><i style="width:70%"></i></div></div>
            <div class="stat"><div class="big">7.0</div><div class="lbl">Est. IELTS band</div></div>
        </div>
        <div class="section-title">Quick practice</div>
        <div class="quick-grid">
            ${quickCard('chat','spell-check','ic-indigo','Correct My English','Fix mistakes & sound natural')}
            ${quickCard('native','sparkles','ic-violet','Sound More Native','Rewrite like a native speaker')}
            ${quickCard('modes','drama','ic-emerald','English Modes','Casual, British, Pro, Gen Z…')}
            ${quickCard('voice','mic','ic-rose','Voice Conversation','Talk live with your coach')}
            ${quickCard('pronunciation','volume-2','ic-sky','Pronunciation','Score & improve your sounds')}
            ${quickCard('ielts','graduation-cap','ic-amber','IELTS Speaking','Timed practice + band feedback')}
        </div>
        <div class="section-title">Recent activity</div>
        <div class="activity">
            <div class="act-row"><span class="ai ic-indigo">${ic('spell-check')}</span><div><b>Corrected 3 sentences</b><br><small>“I am agree with you” → “I agree with you”</small></div><span class="when">2h ago</span></div>
            <div class="act-row"><span class="ai ic-rose">${ic('mic')}</span><div><b>6 min voice practice</b><br><small>Topic: weekend plans · great fluency!</small></div><span class="when">Yesterday</span></div>
            <div class="act-row"><span class="ai ic-amber">${ic('graduation-cap')}</span><div><b>IELTS Part 2 practice</b><br><small>Estimated band 7.0 · keep it up</small></div><span class="when">2 days ago</span></div>
        </div>`;

    const quickCard = (id, ico, cls, title, desc) =>
        `<div class="quick" data-go="${id}"><span class="qi ${cls}">${ic(ico)}</span><h3>${title}</h3><p>${desc}</p><span class="go">Open →</span></div>`;

    /* ---- Correct ---- */
    PAGES.chat = () => `
        <div class="page-head">
            <span class="eyebrow">${ic('spell-check')} Smart correction</span>
            <h2>Correct My English</h2>
            <p>Type any sentence. If it’s already correct, I’ll tell you — and still offer a more natural version.</p>
        </div>
        <div class="card">
            <span class="label">Your sentence</span>
            <textarea class="field shared-input" id="sharedInput" placeholder="e.g. I am agree with you">${esc(store.sentence)}</textarea>
            <div class="row">
                <button class="btn btn-primary" data-act="correct">${ic('spell-check')} Check it</button>
                <span class="hint">Press Enter to check · try “He don’t like coffee”</span>
            </div>
            <div class="result" id="res"></div>
        </div>`;

    /* ---- Native ---- */
    PAGES.native = () => `
        <div class="page-head">
            <span class="eyebrow">${ic('sparkles')} Sound natural</span>
            <h2>Sound More Native</h2>
            <p>One tap rewrites your sentence the way real native speakers actually say it.</p>
        </div>
        <div class="card">
            <span class="label">Your sentence</span>
            <textarea class="field shared-input" id="sharedInput" placeholder="e.g. I want eat food">${esc(store.sentence)}</textarea>
            <div class="row">
                <button class="btn btn-primary" data-act="native">${ic('sparkles')} Make it native</button>
                <span class="hint">Carried over from your last sentence automatically</span>
            </div>
            <div class="result" id="res"></div>
        </div>`;

    /* ---- Modes ---- */
    PAGES.modes = () => `
        <div class="page-head">
            <span class="eyebrow">${ic('drama')} Switch your style</span>
            <h2>English Modes</h2>
            <p>Transform the same sentence into any speaking style for any situation.</p>
        </div>
        <div class="card">
            <span class="label">Your sentence</span>
            <textarea class="field shared-input" id="sharedInput" placeholder="e.g. I am tired">${esc(store.sentence)}</textarea>
            <span class="label" style="margin-top:16px">Choose a style</span>
            <div class="chips" id="modeChips">${modeChips()}</div>
            <div class="row">
                <button class="btn btn-primary" data-act="modes">${ic('drama')} Transform</button>
                <button class="btn btn-soft btn-sm" data-act="all-modes">${ic('layers')} Show all styles</button>
            </div>
            <div class="result" id="res"></div>
        </div>`;

    /* ---- Voice ---- */
    PAGES.voice = () => `
        <div class="page-head">
            <span class="eyebrow">${ic('mic')} Live practice</span>
            <h2>Voice Conversation</h2>
            <p>Tap the mic and talk to your coach. Speak naturally — I’ll reply and gently help you improve.</p>
        </div>
        <div class="card voice-stage">
            <button class="mic-btn" id="micBtn"><i data-lucide="mic"></i></button>
            <div class="wave" id="wave">${'<span></span>'.repeat(11)}</div>
            <div class="mic-status" id="micStatus">Tap the mic to start talking</div>
            <div class="convo" id="convo">
                <div class="msg ai"><div class="mtag">Coach</div>Hi! I'm your English coach. Let's just chat — how was your day today?</div>
            </div>
        </div>`;

    /* ---- Pronunciation ---- */
    PAGES.pronunciation = () => `
        <div class="page-head">
            <span class="eyebrow">${ic('volume-2')} Sound it out</span>
            <h2>Pronunciation Practice</h2>
            <p>Pick a word or phrase, listen, then say it. I’ll score you and highlight tricky sounds.</p>
        </div>
        <div class="card">
            <span class="label">Practice this</span>
            <input class="field" id="pronWord" value="comfortable">
            <div class="row">
                <button class="btn btn-soft" data-act="hear">${ic('volume-2')} Hear it</button>
                <button class="btn btn-primary" id="pronMic">${ic('mic')} Say it</button>
                <span class="hint" id="pronHint">Try: “entrepreneur”, “thoroughly”, “Wednesday”</span>
            </div>
            <div class="wave" id="pronWave" style="margin-top:18px">${'<span></span>'.repeat(11)}</div>
            <div class="result" id="res"></div>
        </div>`;

    /* ---- IELTS ---- */
    const IELTS_Q = [
        "Describe a place you like to visit. Why do you enjoy it?",
        "Talk about a skill you would like to learn in the future.",
        "Describe a person who has influenced you in your life.",
        "Do you think technology makes our lives easier? Why or why not?",
        "Describe a memorable trip or holiday you have taken.",
        "What kind of music do you enjoy, and how does it make you feel?",
    ];
    PAGES.ielts = () => {
        const q = IELTS_Q[Math.floor(Math.random() * IELTS_Q.length)];
        return `
        <div class="page-head">
            <span class="eyebrow">${ic('graduation-cap')} IELTS Speaking</span>
            <h2>IELTS Speaking Practice</h2>
            <p>You’ll get a question and time to speak. I’ll give an encouraging band estimate and tips — never harsh.</p>
        </div>
        <div class="card">
            <div class="q-card"><small>PART 2 · CUE CARD</small><p id="ieltsQ">${q}</p></div>
            <div class="row" style="justify-content:space-between">
                <div class="timer" id="timer">00:45</div>
                <div style="display:flex;gap:10px">
                    <button class="btn btn-soft btn-sm" data-act="new-q">${ic('refresh-cw')} New question</button>
                    <button class="btn btn-primary" id="ieltsMic">${ic('mic')} Start speaking</button>
                </div>
            </div>
            <div class="wave" id="ieltsWave" style="margin-top:16px">${'<span></span>'.repeat(11)}</div>
            <div class="result" id="res"></div>
        </div>`;
    };

    /* ---- Progress ---- */
    // Progress is for signed-in users only — guests see a locked teaser (limit G).
    const progressLocked = () => `
        <div class="page-head">
            <span class="eyebrow">${ic('trending-up')} Your growth</span>
            <h2>Progress</h2>
            <p>Real, visible improvement — that’s what keeps you going.</p>
        </div>
        <div class="card" style="text-align:center;padding:40px 24px">
            <div style="font-size:34px;margin-bottom:6px">${ic('lock')}</div>
            <h3 style="margin:0 0 8px">Progress faqat login qilganlar uchun</h3>
            <p style="color:var(--muted);max-width:440px;margin:0 auto 18px">
                Streak, mashq tarixi, fluency va IELTS baholaringiz hisobingizga saqlanadi.
                Google bilan kiring — o'sishingizni kuzatib boring.</p>
            <button class="btn btn-primary" id="loginCta">${ic('log-in')} Google bilan kirish</button>
        </div>`;

    PAGES.progress = () => {
        if (window.Speakly && Speakly.configured && !Speakly.isLoggedIn()) return progressLocked();
        return `
        <div class="page-head">
            <span class="eyebrow">${ic('trending-up')} Your growth</span>
            <h2>Progress</h2>
            <p>Real, visible improvement — that’s what keeps you going.</p>
        </div>
        <div class="stat-grid">
            <div class="stat"><div class="big">${ic('flame')} ${store.streak}</div><div class="lbl">Day streak</div></div>
            <div class="stat"><div class="big">86%</div><div class="lbl">Fluency</div><div class="bar"><i style="width:86%"></i></div></div>
            <div class="stat"><div class="big">240</div><div class="lbl">Words practiced</div></div>
            <div class="stat"><div class="big">7.0</div><div class="lbl">Est. IELTS band</div></div>
        </div>
        <div class="card" style="margin-bottom:18px">
            <span class="label">Speaking minutes this week</span>
            <div style="display:flex;align-items:flex-end;gap:10px;height:140px;margin-top:14px">
                ${[40,65,30,80,55,90,70].map((h,i)=>`<div style="flex:1;text-align:center">
                    <div style="height:${h}%;background:var(--grad);border-radius:8px"></div>
                    <small style="color:var(--muted);font-size:11px">${['M','T','W','T','F','S','S'][i]}</small>
                </div>`).join('')}
            </div>
        </div>
        <div class="section-title">Mistakes you’ve conquered</div>
        <div class="mistake"><span class="mx">I am agree</span> → <span class="mv">I agree</span><span class="freq">fixed 4×</span></div>
        <div class="mistake"><span class="mx">He don’t</span> → <span class="mv">He doesn’t</span><span class="freq">fixed 3×</span></div>
        <div class="mistake"><span class="mx">want eat</span> → <span class="mv">want to eat</span><span class="freq">fixed 2×</span></div>`;
    };

    /* ============================================================
       PAGE INITIALISERS (event wiring after render)
    ============================================================ */
    const INIT = {
        chat() { bindShared(); on('[data-act="correct"]', 'click', doCorrect); enterKey(doCorrect); },
        native() { bindShared(); on('[data-act="native"]', 'click', doNative); enterKey(doNative); },
        modes() {
            bindShared();
            document.querySelectorAll('#modeChips .chip').forEach(c => c.onclick = () => {
                if (c.dataset.locked) {
                    toast('Bu uslub login qilganlar uchun — Google bilan kiring');
                    if (window.Speakly) Speakly.signInWithGoogle();
                    return;
                }
                document.querySelectorAll('#modeChips .chip').forEach(x => x.classList.remove('active'));
                c.classList.add('active'); store.mode = c.dataset.mode;
            });
            on('[data-act="modes"]', 'click', doModes);
            on('[data-act="all-modes"]', 'click', doAllModes);
            enterKey(doModes);
        },
        dashboard() { document.querySelectorAll('[data-go]').forEach(q => q.onclick = () => location.hash = '#/' + q.dataset.go); },
        voice: initVoice,
        pronunciation: initPron,
        ielts: initIelts,
        progress() {
            const cta = document.getElementById('loginCta');
            if (cta && window.Speakly) cta.onclick = () => Speakly.signInWithGoogle();
        },
    };

    function bindShared() {
        const el = document.getElementById('sharedInput');
        if (!el) return;
        el.addEventListener('input', () => store.sentence = el.value);
        if (window.Speakly) Speakly.bindLimit(el);   // char limit + counter (A)
    }

    /* Daily-check gate (limit B). Returns true if the action may run. */
    function guardDailyCheck(box) {
        if (!window.Speakly || Speakly.canCheck()) return true;
        if (box) {
            box.innerHTML = `
                <div class="ok-banner" style="background:rgba(99,102,241,.1);color:var(--indigo-d)">
                    ${ic('lock')} Bugungi bepul tekshiruvlar tugadi (mehmonlar uchun kuniga 5 ta).
                </div>
                <div class="note">${ic('sparkles')} <b>Google bilan kiring</b> — cheksiz tekshiruv, 2000 belgi va tarixingiz saqlanadi.
                    <div class="crosslinks" style="margin-top:10px">
                        <button class="btn btn-primary btn-sm" id="loginCta">${ic('log-in')} Google bilan kirish</button>
                    </div>
                </div>`;
            box.className = 'result show';
            refreshIcons();
            const cta = document.getElementById('loginCta');
            if (cta) cta.onclick = () => Speakly.signInWithGoogle();
        }
        return false;
    }
    /* Generic "this is for signed-in users" gate with a Google login CTA. */
    function lockBox(box, msg, perk) {
        if (!box) return;
        box.innerHTML = `
            <div class="ok-banner" style="background:rgba(99,102,241,.1);color:var(--indigo-d)">${ic('lock')} ${msg}</div>
            <div class="note">${ic('sparkles')} <b>Google bilan kiring</b> — ${perk || 'cheksiz foydalanish, 2000 belgi va tarixingiz saqlanadi.'}
                <div class="crosslinks" style="margin-top:10px">
                    <button class="btn btn-primary btn-sm" id="loginCta">${ic('log-in')} Google bilan kirish</button>
                </div>
            </div>`;
        box.className = 'result show';
        refreshIcons();
        const cta = document.getElementById('loginCta');
        if (cta && window.Speakly) cta.onclick = () => Speakly.signInWithGoogle();
    }
    const on = (sel, ev, fn) => { const el = document.querySelector(sel); if (el) el.addEventListener(ev, fn); };
    function enterKey(fn) {
        const el = document.getElementById('sharedInput');
        if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); fn(); } });
    }

    function doCorrect() {
        const val = document.getElementById('sharedInput').value;
        store.sentence = val;
        const r = analyze(val);
        const box = document.getElementById('res');
        if (!r) { box.className = 'result'; return; }
        if (!guardDailyCheck(box)) return;
        if (window.Speakly) { Speakly.registerCheck(); Speakly.saveHistory('correct', r.original, r.fixed || r.native); }
        if (r.correct) {
            box.innerHTML = `
                <div class="ok-banner">${ic('check-circle-2')} Your sentence is already correct — nice work!</div>
                <div class="out-block"><div class="ob-tag" style="color:var(--violet)">More natural version</div><p>“${esc(r.native)}”</p></div>
                <div class="note">${ic('lightbulb')} It’s grammatically fine. The version above just sounds a bit more like a native speaker.</div>
                ${crosslinks()}`;
        } else {
            box.innerHTML = `
                <div class="res-card">
                    <div class="res-line line-x">${ic('x-circle')} <s>${esc(r.original)}</s></div>
                    <div class="res-line line-v">${ic('check-circle-2')} ${esc(r.fixed)}</div>
                </div>
                <div class="note">${ic('lightbulb')} <b>Why:</b> ${esc(r.note)}</div>
                <div class="out-block" style="margin-top:12px"><div class="ob-tag" style="color:var(--violet)">Even more natural</div><p>“${esc(r.native)}”</p></div>
                ${crosslinks()}`;
        }
        box.className = 'result show';
        refreshIcons();
    }
    const crosslinks = () => `<div class="crosslinks">
        <button class="btn btn-ghost btn-sm" data-link="native">${ic('sparkles')} Rewrite naturally</button>
        <button class="btn btn-ghost btn-sm" data-link="modes">${ic('drama')} Try in other styles</button>
        </div>`;

    function doNative() {
        const val = document.getElementById('sharedInput').value.trim();
        store.sentence = val;
        const box = document.getElementById('res');
        if (!val) { box.className = 'result'; return; }
        if (!guardDailyCheck(box)) return;
        if (window.Speakly) { Speakly.registerCheck(); Speakly.saveHistory('native', val, nativeVersions(val)); }
        box.innerHTML = `
            <div class="out-block"><div class="ob-tag" style="color:var(--violet)">${ic('sparkles')} Native & natural</div><p>${esc(nativeVersions(val))}</p></div>
            <div class="out-block"><div class="ob-tag" style="color:var(--indigo-d)">Casual contraction</div><p>“${esc(naturalize(val))}”</p></div>
            <div class="note">${ic('lightbulb')} Native speakers shorten words, use contractions and add rhythm — that’s what sounds real.</div>
            <div class="crosslinks"><button class="btn btn-ghost btn-sm" data-link="modes">${ic('drama')} Try other styles</button></div>`;
        box.className = 'result show';
        refreshIcons();
    }

    function doModes() {
        const val = document.getElementById('sharedInput').value.trim();
        store.sentence = val;
        const box = document.getElementById('res');
        if (!val) { box.className = 'result'; return; }
        if (window.Speakly && !Speakly.modeAllowed(store.mode)) {
            lockBox(box, `“${esc(store.mode)}” uslubi login qilganlar uchun.`, 'barcha 6 uslub, cheksiz foydalanish va tarix.');
            return;
        }
        if (!guardDailyCheck(box)) return;
        if (window.Speakly) { Speakly.registerCheck(); Speakly.saveHistory('modes', val, modeVersion(val, store.mode)); }
        box.innerHTML = `
            <div class="out-block"><div class="ob-tag" style="color:var(--indigo-d)">${ic('drama')} ${esc(store.mode)}</div><p>“${esc(modeVersion(val, store.mode))}”</p></div>
            <div class="note">${ic('lightbulb')} Pick another chip above and transform again to compare the tone.</div>`;
        box.className = 'result show';
        refreshIcons();
    }
    function doAllModes() {
        const val = document.getElementById('sharedInput').value.trim();
        store.sentence = val;
        const box = document.getElementById('res');
        if (!val) { box.className = 'result'; return; }
        if (!guardDailyCheck(box)) return;
        if (window.Speakly) { Speakly.registerCheck(); }
        const all = (window.Speakly ? Speakly.ALL_MODES : ['Casual American','British Polite','Professional','Gen Z','Friendly Social','Simple English']);
        const shown  = all.filter(m => !window.Speakly || Speakly.modeAllowed(m));
        const locked = all.filter(m => window.Speakly && !Speakly.modeAllowed(m));
        box.innerHTML = shown.map(m =>
            `<div class="out-block"><div class="ob-tag" style="color:var(--indigo-d)">${m}</div><p>“${esc(modeVersion(val, m))}”</p></div>`
        ).join('') + (locked.length ? `
            <div class="out-block" style="opacity:.85">
                <div class="ob-tag" style="color:var(--violet)">${ic('lock')} Yana ${locked.length} uslub: ${locked.join(', ')}</div>
                <p><button class="btn btn-primary btn-sm" id="loginCta">${ic('log-in')} Google bilan kirib oching</button></p>
            </div>` : '');
        box.className = 'result show';
        refreshIcons();
        const cta = document.getElementById('loginCta');
        if (cta && window.Speakly) cta.onclick = () => Speakly.signInWithGoogle();
    }

    // crosslink buttons (delegated)
    document.addEventListener('click', e => {
        const b = e.target.closest('[data-link]');
        if (b) location.hash = '#/' + b.dataset.link;
    });

    /* ---------- Voice / speech helpers ---------- */
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    function speak(text) {
        if (!('speechSynthesis' in window)) return;
        const u = new SpeechSynthesisUtterance(text.replace(/[💡✨🎭😊👋🔥]/g, ''));
        u.lang = 'en-US'; u.rate = .95; u.pitch = 1.05;
        speechSynthesis.cancel(); speechSynthesis.speak(u);
    }
    function coachReply(userText) {
        const t = userText.toLowerCase();
        if (/good|great|happy|fine|well|nice/.test(t)) return "That's wonderful to hear! What made it good? Try to tell me in two full sentences.";
        if (/bad|tired|sad|stress|hard|difficult/.test(t)) return "I'm sorry to hear that. It's totally okay. Can you tell me one thing that might make tomorrow better?";
        if (/work|job|study|school|class/.test(t)) return "Nice — that's great practice vocabulary. What's one thing you did there today?";
        if (/\?$/.test(userText)) return "Good question! I'd say it depends. Now, can you ask me that again using a full sentence?";
        const starters = ["Great speaking! ", "Nice and clear! ", "You're doing really well. ", "Lovely! "];
        const follow = ["Tell me a little more about that.", "Why do you think so?", "How did that make you feel?", "Can you say that again with one more detail?"];
        return starters[Math.floor(Math.random()*starters.length)] + follow[Math.floor(Math.random()*follow.length)];
    }
    function addMsg(convo, who, text, tag) {
        const d = document.createElement('div');
        d.className = 'msg ' + who;
        d.innerHTML = (tag ? `<div class="mtag">${tag}</div>` : '') + esc(text);
        convo.appendChild(d); convo.scrollTop = convo.scrollHeight;
    }

    function initVoice() {
        const btn = document.getElementById('micBtn');
        const wave = document.getElementById('wave');
        const status = document.getElementById('micStatus');
        const convo = document.getElementById('convo');
        if (!SR) { status.innerHTML = '🎤 Speech isn’t supported in this browser. Try Chrome/Edge. You can still read along!'; }
        const maxSecs = (window.Speakly ? Speakly.limits().voiceSecs : 45);  // time limit (C)
        let listening = false, recog = null, stopTimer = null;
        btn.onclick = () => {
            if (!SR) { addMsg(convo, 'ai', "Voice needs Chrome or Edge. But here's a question: what's your favourite food?", 'Coach'); speak("What's your favourite food?"); return; }
            if (listening) { recog && recog.stop(); return; }
            recog = new SR(); recog.lang = 'en-US'; recog.interimResults = false; recog.maxAlternatives = 1;
            recog.onstart = () => {
                listening = true; btn.classList.add('listening'); wave.classList.add('active');
                status.textContent = '🎧 Listening… speak now';
                clearTimeout(stopTimer);
                stopTimer = setTimeout(() => { recog && recog.stop(); }, maxSecs * 1000);  // auto-stop at the limit
            };
            recog.onerror = () => { status.textContent = 'Hmm, I didn’t catch that. Tap to try again.'; };
            recog.onend = () => {
                listening = false; btn.classList.remove('listening'); wave.classList.remove('active');
                clearTimeout(stopTimer);
                status.innerHTML = (window.Speakly && !Speakly.isLoggedIn())
                    ? `Mehmon vaqti ${maxSecs}s. <a href="#" id="voiceLogin">Google bilan kiring</a> — uzoqroq suhbat uchun.`
                    : 'Tap the mic to talk again';
                const vl = document.getElementById('voiceLogin');
                if (vl) vl.onclick = (e) => { e.preventDefault(); Speakly.signInWithGoogle(); };
            };
            recog.onresult = (e) => {
                const text = e.results[0][0].transcript;
                addMsg(convo, 'user', text);
                const reply = coachReply(text);
                if (window.Speakly) Speakly.saveHistory('voice', text, reply);
                setTimeout(() => { addMsg(convo, 'ai', reply, 'Coach'); speak(reply); }, 500);
            };
            recog.start();
        };
    }

    function similarity(a, b) {
        a = a.toLowerCase().replace(/[^a-z ]/g, ''); b = b.toLowerCase().replace(/[^a-z ]/g, '');
        if (!a || !b) return 0;
        const aw = a.split(/\s+/), bw = b.split(/\s+/);
        let hit = 0; aw.forEach(w => { if (bw.includes(w)) hit++; });
        return Math.round((hit / Math.max(aw.length, bw.length)) * 100);
    }
    const HARD_SOUNDS = ['th', 'r', 'w', 'v', 'tion', 'ough', 'wor', 'dne'];
    function initPron() {
        const input = document.getElementById('pronWord');
        const wave = document.getElementById('pronWave');
        const box = document.getElementById('res');
        if (window.Speakly) Speakly.bindLimit(input);   // char limit + counter (A)
        on('[data-act="hear"]', 'click', () => speak(input.value));
        document.getElementById('pronMic').onclick = () => {
            if (window.Speakly && !Speakly.featCanUse('pron')) {
                lockBox(box, 'Bugungi bepul talaffuz baholashlari tugadi (mehmonlar uchun kuniga 3 ta).', 'cheksiz talaffuz baholash va natijalaringizni saqlash.');
                return;
            }
            if (!SR) { toast('Voice needs Chrome or Edge'); return; }
            if (window.Speakly) Speakly.featRegister('pron');
            const recog = new SR(); recog.lang = 'en-US'; recog.interimResults = false;
            recog.onstart = () => wave.classList.add('active');
            recog.onend = () => wave.classList.remove('active');
            recog.onresult = (e) => {
                const said = e.results[0][0].transcript;
                let score = similarity(input.value, said);
                if (score < 40) score = 40 + Math.floor(Math.random() * 25); // encouraging floor
                const target = input.value.toLowerCase();
                const hard = HARD_SOUNDS.filter(s => target.includes(s));
                box.innerHTML = `
                    <div class="score-ring" style="--p:${score}%"><div class="inner"><div class="num">${score}</div><small style="color:var(--muted)">score</small></div></div>
                    <div style="text-align:center"><b style="color:var(--ink);font-family:'Plus Jakarta Sans'">You said:</b> “${esc(said)}”</div>
                    ${hard.length ? `<div style="text-align:center;margin-top:8px"><small style="color:var(--muted)">Watch these tricky sounds:</small><div class="sound-tags">${hard.map(h=>`<span class="sound-tag">${h}</span>`).join('')}</div></div>` : ''}
                    <div class="note" style="margin-top:14px;text-align:center">${score>80?ic('party-popper')+' Excellent! Very clear pronunciation.':score>60?ic('thumbs-up')+' Good job! A little more practice and it’s perfect.':ic('dumbbell')+' Keep going — say it slowly and exaggerate the sounds.'}</div>`;
                box.className = 'result show'; refreshIcons();
            };
            recog.start();
        };
    }

    function initIelts() {
        const box = document.getElementById('res');
        const timerEl = document.getElementById('timer');
        const wave = document.getElementById('ieltsWave');
        const maxSecs = (window.Speakly ? Speakly.limits().voiceSecs : 45);  // time limit (C)
        let timer = null, secs = maxSecs;
        timerEl.textContent = '00:' + String(maxSecs).padStart(2, '0');
        on('[data-act="new-q"]', 'click', () => { location.hash = '#/ielts'; render('ielts'); });
        document.getElementById('ieltsMic').onclick = function () {
            if (timer) return;
            if (window.Speakly && !Speakly.featCanUse('ielts')) {
                lockBox(box, 'Bugungi bepul IELTS mashqi tugadi (mehmonlar uchun kuniga 1 ta).', 'cheksiz IELTS mashqi, batafsil tahlil va natijalaringizni saqlash.');
                return;
            }
            if (window.Speakly) Speakly.featRegister('ielts');
            wave.classList.add('active'); this.innerHTML = ic('loader') + ' Recording…'; this.disabled = true; refreshIcons();
            let recog = SR ? new SR() : null; let transcript = '';
            if (recog) { recog.lang='en-US'; recog.continuous=true; recog.interimResults=true;
                recog.onresult = e => { transcript = Array.from(e.results).map(r=>r[0].transcript).join(' '); };
                try { recog.start(); } catch(e){} }
            secs = maxSecs;
            timer = setInterval(() => {
                secs--; timerEl.textContent = '00:' + String(secs).padStart(2, '0');
                if (secs <= 0) { clearInterval(timer); timer = null; wave.classList.remove('active');
                    if (recog) recog.stop();
                    const words = (transcript.trim().split(/\s+/).filter(Boolean)).length;
                    const band = words > 70 ? '7.5' : words > 40 ? '7.0' : words > 15 ? '6.5' : '6.0';
                    box.innerHTML = `
                        <div class="ok-banner">${ic('check-circle-2')} Nice work — you spoke for the full time!</div>
                        <div class="band-grid">
                            <div class="band-cell"><div class="bn">${band}</div><small>Est. band</small></div>
                            <div class="band-cell"><div class="bn">${words||'—'}</div><small>Words spoken</small></div>
                            <div class="band-cell"><div class="bn">Good</div><small>Fluency</small></div>
                        </div>
                        <div class="note" style="margin-top:14px">${ic('lightbulb')} <b>Tip:</b> Add one example and one reason to push toward a higher band. You’ve got this!</div>
                        ${(window.Speakly && !Speakly.isLoggedIn()) ? `<div class="note" style="margin-top:10px">${ic('lock')} Mehmon vaqti ${maxSecs}s. <b>Google bilan kiring</b> — uzoqroq gapirish va natijalaringizni saqlash uchun.</div>` : ''}`;
                    box.className = 'result show'; refreshIcons();
                    if (window.Speakly) Speakly.saveHistory('ielts', document.getElementById('ieltsQ').textContent, transcript);
                    document.getElementById('ieltsMic').innerHTML = ic('rotate-ccw') + ' Try again';
                    document.getElementById('ieltsMic').disabled = false; refreshIcons();
                }
            }, 1000);
        };
    }

    /* ============================================================
       THEME SYSTEM
    ============================================================ */
    const mq = matchMedia('(prefers-color-scheme: dark)');
    function applyTheme() {
        const t = localStorage.getItem('spk_theme') || 'system';
        const dark = t === 'dark' || (t === 'system' && mq.matches);
        document.documentElement.dataset.theme = dark ? 'dark' : 'light';
        document.querySelectorAll('#themeSwitch button').forEach(b =>
            b.classList.toggle('active', b.dataset.themeVal === t));
    }
    mq.addEventListener('change', applyTheme);
    document.getElementById('themeSwitch').addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        localStorage.setItem('spk_theme', b.dataset.themeVal); applyTheme();
        toast('Theme: ' + b.dataset.themeVal);
    });

    /* ============================================================
       ROUTER + NAV RENDERING
    ============================================================ */
    function buildNav() {
        document.getElementById('sideNav').innerHTML = NAV.map(n =>
            `<a class="nav-item" href="#/${n.id}" data-id="${n.id}"><span class="ni-ico">${ic(n.icon)}</span>${n.label}</a>`).join('');
        document.getElementById('bottomNav').innerHTML = BOTTOM.map(id => {
            const n = NAV.find(x => x.id === id);
            return `<a class="bn-item" href="#/${id}" data-id="${id}"><span class="bi">${ic(n.icon)}</span>${n.label.split(' ')[0]}</a>`;
        }).join('');
        refreshIcons();
    }
    function setActive(route) {
        document.querySelectorAll('.nav-item').forEach(a => a.classList.toggle('active', a.dataset.id === route));
        document.querySelectorAll('.bn-item').forEach(a => a.classList.toggle('active', a.dataset.id === route));
    }
    const SUBS = {
        dashboard: 'Welcome back', chat: 'Smart, friendly corrections', native: 'Sound real & natural',
        modes: 'One sentence, every style', voice: 'Talk live with your coach', pronunciation: 'Score & improve',
        ielts: 'Timed practice + band feedback', progress: 'Watch yourself improve'
    };
    function render(route) {
        if (!PAGES[route]) route = 'dashboard';
        const view = document.getElementById('view');
        view.style.animation = 'none'; view.offsetHeight; view.style.animation = '';
        view.innerHTML = PAGES[route]();
        document.getElementById('pageTitle').textContent = titleOf(route);
        document.getElementById('pageSub').textContent = SUBS[route] || '';
        document.getElementById('streakPill').innerHTML = ic('flame') + ' ' + store.streak + '-day streak';
        setActive(route);
        window.scrollTo(0, 0);
        refreshIcons();
        INIT[route] && INIT[route]();
    }
    function route() { render((location.hash.replace('#/', '') || 'dashboard')); }
    window.addEventListener('hashchange', route);

    /* ============================================================
       AUTH UI  (Google login / account)
    ============================================================ */
    function initAuthUI() {
        const btn = document.getElementById('accountBtn');
        const avatar = document.getElementById('avatar');
        const label = document.getElementById('accountLabel');
        if (!btn || !window.Speakly) return;

        Speakly.onChange(() => {
            if (Speakly.isLoggedIn()) {
                const name = Speakly.displayName();
                const img = Speakly.avatarUrl();
                avatar.innerHTML = img
                    ? `<img src="${esc(img)}" alt="" style="width:100%;height:100%;border-radius:inherit;object-fit:cover">`
                    : esc((name[0] || 'U').toUpperCase());
                label.textContent = name.split(' ')[0];
                btn.title = 'Log out — ' + name;
            } else {
                avatar.textContent = 'D';
                label.textContent = 'Log in';
                btn.title = 'Log in with Google';
            }
            // refresh the streak pill from profile streak if available

            // Re-render login-sensitive pages once the session is known / on login-logout.
            const cur = (location.hash.replace('#/', '') || 'dashboard');
            if (cur === 'progress' || cur === 'modes') render(cur);
        });

        btn.addEventListener('click', () => {
            if (Speakly.isLoggedIn()) {
                if (confirm(Speakly.displayName() + ' — chiqishni xohlaysizmi?')) Speakly.signOut();
            } else {
                Speakly.signInWithGoogle();
            }
        });
    }

    buildNav(); applyTheme(); initAuthUI();
    if (!location.hash) location.hash = '#/dashboard'; else route();