/*
 * Houz Ticket — the door scanner.
 *
 * Talks to the same endpoints the admin console uses, and the server shares one
 * checkInTicket between them. That is deliberate: a pass admitted here reads as
 * used in the console immediately, and one admitted in the console is refused
 * here. Two copies of "already used" would eventually disagree, and the night
 * it happened would be the night it mattered.
 */
'use strict';

/*
 * Which host to talk to.
 *
 * Both are tried because only one of them is canonical and the other redirects
 * to it, and a redirect is fatal here in a way that is easy to miss: a CORS
 * preflight does NOT follow redirects. The browser sends OPTIONS, gets a 308,
 * and fails the check without ever trying the real request — which surfaces in
 * the app as a rejected fetch, identical to being offline.
 *
 * The apex is first because it is what NEXT_PUBLIC_SITE_URL is set to. Whichever
 * answers is remembered, so this costs one extra request once per install and
 * nothing afterwards.
 */
var API_HOSTS = ['https://houzofvybe.com', 'https://www.houzofvybe.com'];
var HOST_KEY = 'houz-door-api';
var TOKEN_KEY = 'houz-door-token';
var EXPIRY_KEY = 'houz-door-expires';

function apiHosts() {
  var remembered = null;
  try { remembered = localStorage.getItem(HOST_KEY); } catch (e) { /* private mode */ }
  if (!remembered) return API_HOSTS.slice();
  // The remembered one first, the rest still behind it: a domain can change.
  return [remembered].concat(API_HOSTS.filter(function (h) { return h !== remembered; }));
}

function rememberHost(host) {
  try { localStorage.setItem(HOST_KEY, host); } catch (e) { /* fine without it */ }
}

/**
 * fetch, against whichever host answers.
 *
 * Only a *network-level* rejection moves on to the next host. An HTTP error is
 * a real answer from a reachable server — a wrong access code must not send us
 * hunting for a different domain.
 */
function apiFetch(path, options) {
  var hosts = apiHosts();

  function attempt(i) {
    if (i >= hosts.length) return Promise.reject(new Error('unreachable'));
    return fetch(hosts[i] + path, options).then(
      function (response) {
        rememberHost(hosts[i]);
        return response;
      },
      function (error) {
        if (i + 1 < hosts.length) return attempt(i + 1);
        throw error;
      },
    );
  }

  return attempt(0);
}

var el = function (id) { return document.getElementById(id); };
var mode = 'check';
var busy = false;
var stream = null;
var raf = 0;
var lastPayload = '';
var lastAt = 0;

/* ---------- session --------------------------------------------------- */

function saveSession(token, expiresAt) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(EXPIRY_KEY, expiresAt);
  } catch (e) { /* private mode: the session just lasts this launch */ }
}

function currentToken() {
  try {
    var token = localStorage.getItem(TOKEN_KEY);
    var expires = localStorage.getItem(EXPIRY_KEY);
    if (!token || !expires) return null;
    // Checked here as well as on the server so an expired session shows a
    // sign-in screen rather than a failed scan with a customer waiting.
    if (new Date(expires).getTime() <= Date.now()) return null;
    return token;
  } catch (e) { return null; }
}

function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EXPIRY_KEY);
  } catch (e) { /* nothing to clear */ }
}

/* ---------- sign in --------------------------------------------------- */

function signIn() {
  var code = el('code').value.trim();
  if (!code) return;
  el('signIn').disabled = true;
  el('loginError').textContent = '';

  apiFetch('/api/door/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: code })
  })
    .then(function (r) { return r.json().then(function (b) { return { ok: r.ok, body: b }; }); })
    .then(function (res) {
      if (!res.ok || !res.body.data) {
        el('loginError').textContent = (res.body && res.body.error) || 'Could not sign in.';
        return;
      }
      saveSession(res.body.data.token, res.body.data.expiresAt);
      el('code').value = '';
      startScanning();
    })
    .catch(function () { el('loginError').textContent = 'No connection. Check the network.'; })
    .then(function () { el('signIn').disabled = false; });
}

/* ---------- camera ---------------------------------------------------- */

function startScanning() {
  el('login').classList.add('hidden');
  el('scanner').classList.remove('hidden');

  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d', { willReadFrequently: true });
  var video = el('video');

  navigator.mediaDevices
    .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
    .then(function (s) {
      stream = s;
      video.srcObject = s;
      return video.play();
    })
    .then(function () { raf = requestAnimationFrame(tick); })
    .catch(function () {
      el('hint').textContent =
        'Camera blocked. Allow camera access for Houz Ticket in Android settings.';
    });

  function tick() {
    if (!busy && video.readyState === video.HAVE_ENOUGH_DATA) {
      // Downscaled on purpose. A QR held up to a phone fills a lot of the
      // frame, and decoding a smaller buffer keeps scanning fast on the cheap
      // handsets that end up being used on a door.
      var w = 480;
      var h = Math.round((video.videoHeight / video.videoWidth) * w) || 640;
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(video, 0, 0, w, h);
      var img = ctx.getImageData(0, 0, w, h);
      var found = window.jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
      if (found && found.data) handleScan(found.data);
    }
    raf = requestAnimationFrame(tick);
  }
}

function stopScanning() {
  if (raf) cancelAnimationFrame(raf);
  if (stream) {
    stream.getTracks().forEach(function (t) { t.stop(); });
  }
  stream = null;
}

/* ---------- scanning -------------------------------------------------- */

function handleScan(payload) {
  var now = Date.now();
  // The camera sees the same QR many times a second. Without this the pass
  // would be sent for admission repeatedly and the second attempt would come
  // back "already used" — us, refusing our own scan a moment earlier.
  if (payload === lastPayload && now - lastAt < 4000) return;
  lastPayload = payload;
  lastAt = now;

  var token = currentToken();
  if (!token) { signOut('Session expired — sign in again.'); return; }

  busy = true;
  if (navigator.vibrate) navigator.vibrate(30);

  apiFetch('/api/door/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ payload: payload, mode: mode, gate: 'Door app' })
  })
    .then(function (r) { return r.json().then(function (b) { return { status: r.status, body: b }; }); })
    .then(function (res) {
      if (res.status === 401) { signOut('Session expired — sign in again.'); return; }
      var outcome = res.body && res.body.data ? res.body.data : null;
      if (!outcome) {
        show({
          result: 'not_found',
          title: 'Could not check',
          message: (res.body && res.body.error) || 'Try again.'
        });
        return;
      }
      show(outcome);
    })
    .catch(function () {
      show({
        result: 'not_found',
        title: 'No connection',
        message: 'The pass was NOT checked. Try again before admitting.'
      });
    });
}

/* ---------- verdict --------------------------------------------------- */

var TONE = {
  admitted: 'go',
  duplicate: 'hold',
  wrong_event: 'hold',
  void: 'hold',
  refunded: 'hold',
  invalid_signature: 'stop',
  not_found: 'stop'
};

var GLYPH = {
  go: '<circle class="ring" cx="60" cy="60" r="50"/><path class="mark" d="M38 61l15 15 30-32"/>',
  hold: '<circle class="ring" cx="60" cy="60" r="50"/><path class="mark" d="M60 34v30"/><path class="mark" d="M60 80v2"/>',
  stop: '<circle class="ring" cx="60" cy="60" r="50"/><path class="mark" d="M42 42l36 36M78 42l-36 36"/>'
};

function show(outcome) {
  var tone = TONE[outcome.result] || 'stop';
  var v = el('verdict');
  var t = outcome.ticket || {};

  v.className = tone;
  el('vGlyph').innerHTML = GLYPH[tone];
  el('vTitle').textContent = outcome.title || '';
  el('vName').textContent = t.holderName || '';

  var bits = [];
  if (t.tierName) bits.push(t.tierName);
  if (t.admits > 1) bits.push('admits ' + t.admits);
  if (t.code) bits.push(t.code);
  el('vMeta').textContent = bits.join(' · ');

  // What the pass is worth at the bar, on the verdict rather than tucked away:
  // the person reading this is about to hand over a wristband.
  var cover = el('vCover');
  if (typeof t.redeemablePaise === 'number') {
    var zero = t.redeemablePaise === 0;
    cover.className = zero ? 'zero' : 'some';
    cover.textContent = zero
      ? 'ZERO REDEEMABLE'
      : '₹' + (t.redeemablePaise / 100).toLocaleString('en-IN') + ' redeemable';
    cover.style.display = '';
  } else {
    cover.style.display = 'none';
  }

  el('vMsg').textContent = outcome.message || '';
  v.classList.remove('hidden');

  if (navigator.vibrate) {
    navigator.vibrate(tone === 'go' ? [40] : tone === 'hold' ? [30, 60, 30] : [90, 50, 90]);
  }

  // An admit clears itself so the queue keeps moving. Anything else waits to be
  // dismissed, because it needs a person to decide what happens next.
  if (tone === 'go') setTimeout(dismiss, 2200);
}

function dismiss() {
  el('verdict').classList.add('hidden');
  busy = false;
}

function signOut(message) {
  clearSession();
  stopScanning();
  busy = false;
  el('verdict').classList.add('hidden');
  el('scanner').classList.add('hidden');
  el('login').classList.remove('hidden');
  el('loginError').textContent = message || '';
}

/* ---------- wiring ---------------------------------------------------- */

el('signIn').addEventListener('click', signIn);
el('code').addEventListener('keydown', function (e) { if (e.key === 'Enter') signIn(); });
el('signOut').addEventListener('click', function () { signOut(''); });
el('vNext').addEventListener('click', dismiss);

el('modeCheck').addEventListener('click', function () {
  mode = 'check';
  el('modeCheck').setAttribute('aria-pressed', 'true');
  el('modeAdmit').setAttribute('aria-pressed', 'false');
  el('hint').textContent = 'Check mode — looks at a pass without using it.';
});

el('modeAdmit').addEventListener('click', function () {
  mode = 'admit';
  el('modeCheck').setAttribute('aria-pressed', 'false');
  el('modeAdmit').setAttribute('aria-pressed', 'true');
  el('hint').textContent = 'Admit mode — each pass works once.';
});

// A session that is still inside its 24 hours goes straight to the camera.
if (currentToken()) startScanning();
