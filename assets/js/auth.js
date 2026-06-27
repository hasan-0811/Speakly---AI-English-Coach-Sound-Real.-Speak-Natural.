/* ============================================================
   SPEAKLY — Auth + Limits  (window.Speakly)
   ------------------------------------------------------------
   • Google-only sign in (Supabase OAuth)
   • Character limit:  guest 200  /  signed-in 2000   (limit A)
   • Daily checks:     guest 5/day / signed-in unlimited (limit B)
   • Voice/IELTS time: guest 30s  /  signed-in 45s     (limit C)
   • History saving:   only signed-in users (Supabase)   (limit D)

   Load order in the HTML (before app.js / landing.js):
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
     <script src="assets/js/config.js"></script>
     <script src="assets/js/auth.js"></script>
   ============================================================ */
(function () {
  /* ---------- tiers & limits ---------- */
  const LIMITS = {
    guest: { chars: 200,  dailyChecks: 5,        voiceSecs: 30, ieltsPerDay: 1,        pronPerDay: 3 },
    user:  { chars: 2000, dailyChecks: Infinity, voiceSecs: 45, ieltsPerDay: Infinity, pronPerDay: Infinity },
  };

  // English Modes: guests get the 2 basic styles; the rest unlock on sign-in (limit E).
  const ALL_MODES   = ['Casual American', 'British Polite', 'Professional', 'Gen Z', 'Friendly Social', 'Simple English'];
  const GUEST_MODES = ['Casual American', 'Simple English'];

  /* ---------- supabase client (gracefully optional) ---------- */
  const cfg = window.SPEAKLY_CONFIG || {};
  const configured =
    !!window.supabase &&
    !!cfg.SUPABASE_URL &&
    !cfg.SUPABASE_URL.includes('YOUR-PROJECT') &&
    !!cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_ANON_KEY.includes('PASTE-YOUR');

  const supa = configured
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
    : null;

  /* ---------- reactive state ---------- */
  const state = { user: null, ready: !configured };
  const listeners = [];
  const onChange = (fn) => { listeners.push(fn); if (state.ready) fn(state.user); };
  const emit = () => listeners.forEach(fn => fn(state.user));

  const isLoggedIn = () => !!state.user;
  const tier       = () => (state.user ? 'user' : 'guest');
  // Before Supabase keys are added, don't trap users behind guest limits.
  const limits     = () => (configured ? LIMITS[tier()] : LIMITS.user);

  /* ---------- daily check counter (limit B) ---------- */
  // Guests are throttled per day in localStorage. Signed-in users are unlimited.
  const dayKey = () => {
    const d = new Date();
    return `spk_checks_${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  };
  const checksUsedToday = () => +(localStorage.getItem(dayKey()) || 0);
  const checksRemaining = () => {
    const max = limits().dailyChecks;
    if (max === Infinity) return Infinity;
    return Math.max(0, max - checksUsedToday());
  };
  const canCheck = () => checksRemaining() > 0;
  const registerCheck = () => {
    if (isLoggedIn()) return;                // unlimited for users
    localStorage.setItem(dayKey(), checksUsedToday() + 1);
  };

  /* ---------- generic per-day feature counter (limits F: ielts / pron) ---------- */
  // Guests get a small daily allowance per feature; signed-in users are unlimited.
  const featKey = (name) => {
    const d = new Date();
    return `spk_${name}_${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  };
  const featUsed = (name) => +(localStorage.getItem(featKey(name)) || 0);
  function featRemaining(name) {
    const max = limits()[name + 'PerDay'];
    if (max === Infinity || max === undefined) return Infinity;
    return Math.max(0, max - featUsed(name));
  }
  const featCanUse = (name) => featRemaining(name) > 0;
  function featRegister(name) {
    if (isLoggedIn()) return;                // unlimited for users
    localStorage.setItem(featKey(name), featUsed(name) + 1);
  }

  /* ---------- English Modes access (limit E) ---------- */
  const allowedModes = () => (isLoggedIn() || !configured) ? ALL_MODES.slice() : GUEST_MODES.slice();
  const modeAllowed  = (m) => allowedModes().includes(m);

  /* ---------- auth actions (Google only) ---------- */
  async function signInWithGoogle() {
    if (!supa) { notConfigured(); return; }
    await supa.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: location.href.split('#')[0] },
    });
  }
  async function signOut() {
    if (!supa) return;
    await supa.auth.signOut();
  }
  function notConfigured() {
    alert(
      'Supabase hali sozlanmagan.\n\n' +
      'assets/js/config.js faylida SUPABASE_URL va SUPABASE_ANON_KEY ' +
      'qiymatlarini to‘ldiring.'
    );
  }

  /* ---------- history (limit D) ---------- */
  // Only persisted for signed-in users. Guests: no-op (kept local in app).
  async function saveHistory(kind, inputText, outputText) {
    if (!supa || !isLoggedIn()) return;
    try {
      await supa.from('history').insert({
        user_id: state.user.id,
        kind,
        input_text: (inputText || '').slice(0, 4000),
        output_text: (outputText || '').slice(0, 4000),
      });
    } catch (_) { /* non-blocking */ }
  }

  /* ---------- helpers for the UI ---------- */
  function displayName() {
    const u = state.user;
    if (!u) return '';
    const m = u.user_metadata || {};
    return m.full_name || m.name || u.email || 'You';
  }
  function avatarUrl() {
    const m = (state.user && state.user.user_metadata) || {};
    return m.avatar_url || m.picture || '';
  }

  /* ---------- bind a character limit + live counter to an input ---------- */
  // Adds maxlength, a "123 / 200" counter, and an upgrade hint for guests.
  // Re-applies automatically when auth state changes.
  const bound = new Set();
  function bindLimit(el) {
    if (!el || bound.has(el)) return;
    bound.add(el);

    const counter = document.createElement('div');
    counter.className = 'spk-counter';
    el.insertAdjacentElement('afterend', counter);

    const apply = () => {
      const max = limits().chars;
      el.setAttribute('maxlength', max);
      if (el.value.length > max) el.value = el.value.slice(0, max);
      paint();
    };
    const paint = () => {
      const max = limits().chars;
      const len = el.value.length;
      const atCap = len >= max;
      counter.classList.toggle('warn', atCap);
      counter.innerHTML = (isLoggedIn() || !atCap || !configured)
        ? `${len} / ${max}`
        : `${len} / ${max} — <a href="#" class="spk-counter-cta">Limitni 2000 ga oshiring: Google bilan kiring</a>`;
    };

    el.addEventListener('input', paint);
    counter.addEventListener('click', (e) => {
      if (e.target.closest('.spk-counter-cta')) { e.preventDefault(); signInWithGoogle(); }
    });
    onChange(apply);
    apply();
  }

  /* ---------- init: read session + subscribe ---------- */
  if (supa) {
    supa.auth.getSession().then(({ data }) => {
      state.user = data.session ? data.session.user : null;
      state.ready = true;
      emit();
    });
    supa.auth.onAuthStateChange((_event, session) => {
      state.user = session ? session.user : null;
      state.ready = true;
      emit();
    });
  }

  /* ---------- public API ---------- */
  window.Speakly = {
    configured,
    onChange,
    isLoggedIn,
    tier,
    limits,
    // daily checks (B)
    canCheck, checksRemaining, registerCheck,
    // per-feature daily limits (F): name = 'ielts' | 'pron'
    featCanUse, featRemaining, featRegister,
    // English Modes access (E)
    allowedModes, modeAllowed, ALL_MODES: ALL_MODES.slice(),
    // auth
    signInWithGoogle, signOut,
    // user info
    displayName, avatarUrl, getUser: () => state.user,
    // history (D)
    saveHistory,
    // ui helper (A)
    bindLimit,
  };
})();
