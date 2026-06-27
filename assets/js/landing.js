/* ---------- Nav ---------- */
        const header = document.getElementById('header');
        window.addEventListener('scroll', () => header.classList.toggle('scrolled', window.scrollY > 20));
        const toggle = document.getElementById('menuToggle');
        const navLinks = document.getElementById('navLinks');
        toggle.addEventListener('click', () => navLinks.classList.toggle('open'));
        navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => navLinks.classList.remove('open')));

        /* ---------- Demo tabs ---------- */
        document.querySelectorAll('.demo-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.demo-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const pane = tab.dataset.pane;
                document.querySelectorAll('.demo-pane').forEach(p => p.style.display = p.dataset.pane === pane ? 'block' : 'none');
            });
        });

        /* ---------- Mode chips ---------- */
        let activeMode = 'Casual American';
        document.querySelectorAll('.mode-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('.mode-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                activeMode = chip.dataset.mode;
            });
        });

        /* =========================================================
           DEMO ENGINE — sample logic only.
           In production, replace each run* function with a call to
           the Claude API (Messages endpoint) and render the response.
        ========================================================= */

        const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
        const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

        // Known correction examples
        const CORRECTIONS = {
            'i am agree with you': { fix: 'I agree with you.', note: 'In English we say "I agree" — no "am" needed.' },
            'he don\'t like coffee': { fix: "He doesn't like coffee.", note: 'With he/she/it we use "doesn\'t", not "don\'t".' },
            'yesterday i go to school': { fix: 'Yesterday I went to school.', note: '"Yesterday" is past, so "go" becomes "went".' },
            'i want eat food': { fix: 'I want to eat food.', note: 'After "want" we add "to" before the verb.' },
            'she have two cat': { fix: 'She has two cats.', note: 'Use "has" with she, and make "cat" plural → "cats".' },
            'i no understand': { fix: "I don't understand.", note: 'To make a verb negative, use "don\'t" + verb.' }
        };

        function genericCorrect(t) {
            let f = t.trim().replace(/\s+/g, ' ');
            f = f.replace(/\bi\b/g, 'I');
            f = cap(f);
            if (!/[.!?]$/.test(f)) f += '.';
            return f;
        }

        /* Daily-check gate for the landing demo (limit B). */
        function demoGuard(box) {
            if (!window.Speakly || Speakly.canCheck()) {
                if (window.Speakly) Speakly.registerCheck();
                return true;
            }
            box.innerHTML = `
                <div class="rc-note">${dico('lock')} Bugungi bepul tekshiruvlar tugadi (mehmonlar uchun kuniga 5 ta).
                <b>Google bilan kiring</b> — cheksiz tekshiruv va 2000 belgi.</div>
                <div style="margin-top:10px"><button class="btn btn-primary" id="demoLogin">${dico('log-in')} Google bilan kirish</button></div>`;
            box.className = 'result show';
            drawIcons();
            const b = document.getElementById('demoLogin');
            if (b) b.onclick = () => Speakly.signInWithGoogle();
            return false;
        }

        function runCorrect() {
            const raw = document.getElementById('in-correct').value.trim();
            const box = document.getElementById('res-correct');
            if (!raw) { box.className = 'result'; return; }
            if (!demoGuard(box)) return;
            const key = raw.toLowerCase().replace(/[.!?]+$/, '');
            const hit = CORRECTIONS[key];
            const fixed = hit ? hit.fix : genericCorrect(raw);
            const note = hit ? hit.note : 'Looks almost perfect! We just polished the capitalization and punctuation.';
            const changed = fixed.toLowerCase().replace(/[.!?]/g, '') !== raw.toLowerCase().replace(/[.!?]/g, '');
            box.innerHTML = `
                <div class="result-card">
                    <div class="rc-line rc-x">${dico('x-circle')} <s>${esc(raw)}</s></div>
                    <div class="rc-line rc-v">${dico('check-circle-2')} ${esc(fixed)}</div>
                </div>
                <div class="rc-note">${dico('lightbulb')} <b>Simple explanation:</b> ${esc(note)}${changed ? '' : ''}</div>`;
            box.className = 'result show';
            drawIcons();
        }

        // Native rewrites
        const NATIVE = {
            'i want eat food': '"I wanna grab something to eat."',
            'i am very tired': '"I\'m totally wiped out."',
            'please give me help': '"Could you give me a hand?"',
            'i am agree with you': '"Yeah, I\'m totally with you on that."',
            'i am tired': '"I\'m exhausted."',
            'i am happy': '"I\'m super happy!"'
        };
        function runNative() {
            const raw = document.getElementById('in-native').value.trim();
            const box = document.getElementById('res-native');
            if (!raw) { box.className = 'result'; return; }
            if (!demoGuard(box)) return;
            const key = raw.toLowerCase().replace(/[.!?]+$/, '');
            const casual = NATIVE[key] || `"${cap(raw.replace(/\bi\b/g,'I'))}, honestly."`;
            box.innerHTML = `
                <div class="out-block"><div class="ob-tag" style="color:var(--violet)">${dico('sparkles')} Native & natural</div><p>${esc(casual)}</p></div>
                <div class="rc-note">${dico('lightbulb')} Native speakers shorten, relax and add rhythm — that's what makes it sound real.</div>`;
            box.className = 'result show';
            drawIcons();
        }

        // Modes
        const MODES = {
            'i am tired': {
                'Casual American': "I'm exhausted.",
                'British Polite': "I'm afraid I'm rather tired.",
                'Professional': "I'm feeling quite drained today.",
                'Gen Z': "I'm dead tired, no cap.",
                'Friendly Social': "Ugh, I'm so wiped out!",
                'Simple English': "I am very tired."
            },
            'i am happy': {
                'Casual American': "I'm so happy!",
                'British Polite': "I'm absolutely delighted.",
                'Professional': "I'm very pleased with this.",
                'Gen Z': "I'm vibing, this is so good.",
                'Friendly Social': "Aw, this makes me so happy!",
                'Simple English': "I am very happy."
            }
        };
        const MODE_WRAP = {
            'Casual American': t => `${cap(t)}, for real.`,
            'British Polite': t => `I'd say ${t.toLowerCase()}, if that's alright.`,
            'Professional': t => `${cap(t)}. I wanted to share that with you.`,
            'Gen Z': t => `Ngl, ${t.toLowerCase()} fr fr.`,
            'Friendly Social': t => `Hey! ${cap(t)} 😊`,
            'Simple English': t => `${cap(t)}.`
        };
        function runModes() {
            const raw = document.getElementById('in-modes').value.trim();
            const box = document.getElementById('res-modes');
            if (!raw) { box.className = 'result'; return; }
            if (!demoGuard(box)) return;
            const key = raw.toLowerCase().replace(/[.!?]+$/, '');
            const out = (MODES[key] && MODES[key][activeMode]) || MODE_WRAP[activeMode](raw.replace(/\bi\b/g,'I'));
            box.innerHTML = `
                <div class="out-block"><div class="ob-tag" style="color:var(--indigo-d)">${dico('drama')} ${esc(activeMode)}</div><p>"${esc(out)}"</p></div>
                <div class="rc-note">${dico('lightbulb')} Tip: tap another style above and transform again to compare how the tone changes.</div>`;
            box.className = 'result show';
            drawIcons();
        }

        /* Enter-to-run for each input */
        const bind = (id, fn) => document.getElementById(id).addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); fn(); }
        });
        bind('in-correct', runCorrect);
        bind('in-native', runNative);
        bind('in-modes', runModes);

        /* ---------- Lucide icons ---------- */
        const dico = (n) => `<i data-lucide="${n}"></i>`;
        const drawIcons = () => { if (window.lucide) lucide.createIcons(); };
        drawIcons();

        /* ---------- Auth + character limits (Speakly) ---------- */
        if (window.Speakly) {
            ['in-correct', 'in-native', 'in-modes'].forEach(id => {
                const el = document.getElementById(id);
                if (el) Speakly.bindLimit(el);          // char limit + counter (A)
            });

            const authBtn = document.getElementById('authBtn');
            if (authBtn) {
                Speakly.onChange(() => {
                    authBtn.innerHTML = Speakly.isLoggedIn()
                        ? `${dico('log-out')} ${esc(Speakly.displayName().split(' ')[0])}`
                        : `${dico('log-in')} Log in with Google`;
                    drawIcons();
                });
                authBtn.addEventListener('click', () => {
                    if (Speakly.isLoggedIn()) {
                        if (confirm('Chiqishni xohlaysizmi?')) Speakly.signOut();
                    } else {
                        Speakly.signInWithGoogle();
                    }
                });
            }
        }