#!/usr/bin/env bash
#
# Patch the shipped APK's bundled web assets and re-sign it, without a full
# Android build.
#
# Why this exists: rebuilding needs the Android SDK, and the machine this was
# last done on could not reach dl.google.com. The scanner's UI is plain HTML and
# JS in apk/www, so a change there does not need a compile — it needs the file
# swapped inside the APK and the archive signed again.
#
#   ./apk/patch-and-sign.sh
#
# Tools: apksigner and zipalign. Both are in the Android build-tools, and both
# are also packaged by Debian/Ubuntu, which is how they were obtained without
# Google's host:
#   apt-get install -y apksigner zipalign
#
# ---------------------------------------------------------------------------
# THE SIGNING KEY IS THE PART THAT MATTERS
# ---------------------------------------------------------------------------
# Android will only install an update over an existing app when both are signed
# by the SAME key. Sign with a different one and the phone refuses until the old
# app is uninstalled — which on event night means every door phone, by hand.
#
# The APK currently published at /houz-ticket.apk is signed with:
#
#   SHA-256  2E:66:74:A0:AE:74:0E:D5:50:95:CE:FC:40:48:2C:CD:E8:AA:F2:E6:8D:CC:
#            30:19:81:59:CA:AC:44:FD:A6:DA
#   DN       CN=Houz of Vybe Door, O=Houz of Vybe, C=IN
#
# Keep that keystore. It is deliberately NOT in this repository — a private
# signing key in git history is not something you can take back — so store it
# somewhere durable (a password manager, or your own secure storage) and point
# this script at it:
#
#   export DOOR_KEYSTORE=/path/to/door.keystore
#   export DOOR_KEYSTORE_PASS=...
#   export DOOR_KEY_ALIAS=houzdoor
#
# If that key is ever lost, the next APK cannot be an update to the current one.
# The app still works; everybody just has to uninstall and reinstall once. The
# check at the end of this script tells you which situation you are in before
# you hand the file to anybody.
set -euo pipefail

cd "$(dirname "$0")/.."

APK_IN=${APK_IN:-public/houz-ticket.apk}
APK_OUT=${APK_OUT:-public/houz-ticket.apk}
KEYSTORE=${DOOR_KEYSTORE:-}
KS_PASS=${DOOR_KEYSTORE_PASS:-}
KEY_ALIAS=${DOOR_KEY_ALIAS:-houzdoor}
# The key the published APK is signed with. A build that matches this installs
# as an update; one that does not needs an uninstall first.
EXPECTED_SHA256=${DOOR_KEY_SHA256:-2e6674a0ae740ed55095cefc40482ccde8aaf2e68dcc30198159caac44fda6da}

for tool in apksigner zipalign python3; do
  command -v "$tool" >/dev/null || { echo "missing: $tool" >&2; exit 1; }
done

if [[ -z $KEYSTORE || ! -f $KEYSTORE ]]; then
  cat >&2 <<'MSG'
DOOR_KEYSTORE is not set, or points at nothing.

Signing with a fresh key would produce an APK that cannot install over the one
already on the door phones. Set DOOR_KEYSTORE to the real keystore, or if it is
genuinely lost, generate one and accept that everybody uninstalls once:

  keytool -genkeypair -keystore door.keystore -alias houzdoor \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=Houz of Vybe Door, O=Houz of Vybe, C=IN"
MSG
  exit 1
fi

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

echo "==> replacing assets/public/* from apk/www"
python3 - "$APK_IN" "$WORK/repacked.apk" <<'PY'
import sys, zipfile, os

src_path, out_path = sys.argv[1], sys.argv[2]

# The old signature is regenerated below; carrying it forward leaves a stale,
# invalid v1 block inside the archive.
DROP = {'META-INF/MANIFEST.MF', 'META-INF/CERT.SF', 'META-INF/CERT.RSA'}

src = zipfile.ZipFile(src_path)
replaced = []
with zipfile.ZipFile(out_path, 'w') as out:
    for info in src.infolist():
        if info.filename in DROP:
            continue
        data = src.read(info.filename)
        if info.filename.startswith('assets/public/'):
            local = os.path.join('apk/www', info.filename[len('assets/public/'):])
            if os.path.isfile(local):
                data = open(local, 'rb').read()
                replaced.append(info.filename)
        # Storage mode is copied, not chosen. resources.arsc must stay STORED:
        # compressing it makes the APK uninstallable at targetSdk >= 30.
        zi = zipfile.ZipInfo(info.filename, date_time=info.date_time)
        zi.compress_type = info.compress_type
        zi.external_attr = info.external_attr
        zi.internal_attr = info.internal_attr
        zi.create_system = info.create_system
        out.writestr(zi, data)

for name in replaced:
    print(f"    {name}")
if not replaced:
    print("    (nothing matched apk/www — check the paths)", file=sys.stderr)
PY

echo "==> aligning"
zipalign -p -f 4 "$WORK/repacked.apk" "$WORK/aligned.apk"
zipalign -c 4 "$WORK/aligned.apk"

echo "==> signing (v1 + v2 + v3)"
# v2 or higher is required at targetSdk >= 30. jarsigner does v1 only, which
# produces something the phone rejects at install.
apksigner sign \
  --ks "$KEYSTORE" --ks-pass "pass:$KS_PASS" --key-pass "pass:$KS_PASS" \
  --ks-key-alias "$KEY_ALIAS" \
  --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true \
  --out "$WORK/signed.apk" "$WORK/aligned.apk"

apksigner verify --verbose "$WORK/signed.apk" | grep -E '^Verified using v[123]'

ACTUAL=$(apksigner verify --print-certs "$WORK/signed.apk" \
         | sed -n 's/.*certificate SHA-256 digest: //p' | head -1)

echo
if [[ $ACTUAL == "$EXPECTED_SHA256" ]]; then
  echo "SAME KEY as the published APK — installs as an update, no uninstall needed."
else
  echo "DIFFERENT KEY from the published APK."
  echo "  expected $EXPECTED_SHA256"
  echo "  got      $ACTUAL"
  echo "  Every phone must uninstall the old app before installing this one."
fi

mv "$WORK/signed.apk" "$APK_OUT"
echo "==> wrote $APK_OUT"
