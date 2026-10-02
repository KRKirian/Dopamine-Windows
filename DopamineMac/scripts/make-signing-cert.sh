#!/usr/bin/env bash
# Creates a self-signed code-signing certificate so every build carries the same signature.
#
# macOS ties the Accessibility grant to the app's signature. Ad hoc signing gives each build a new
# one, so updated and reinstalled copies lose the permission; with one stable certificate they keep
# it. Gatekeeper still treats the app as unnotarised either way.
#
#   ./scripts/make-signing-cert.sh            # imports into the login keychain
#   KEYCHAIN=/path/to.keychain-db ./scripts/make-signing-cert.sh
#
# Keep the files it writes to ~/.dopamine-signing: every release must use the same certificate.
set -euo pipefail

NAME="Dopamine Self-Signed"
KEYCHAIN="${KEYCHAIN:-$HOME/Library/Keychains/login.keychain-db}"
OUT="${OUT_DIR:-$HOME/.dopamine-signing}"
VALID_DAYS=3650

if security find-certificate -c "$NAME" "$KEYCHAIN" >/dev/null 2>&1; then
  echo "\"$NAME\" is already in $KEYCHAIN — reuse it (see $OUT) rather than making a new one." >&2
  exit 1
fi

mkdir -p "$OUT"
chmod 700 "$OUT"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

cat >"$WORK/cert.cnf" <<EOF
[req]
distinguished_name = dn
x509_extensions = ext
prompt = no
[dn]
CN = $NAME
[ext]
basicConstraints = critical,CA:false
keyUsage = critical,digitalSignature
extendedKeyUsage = critical,codeSigning
EOF

# /usr/bin/openssl is LibreSSL, whose PKCS#12 output `security import` accepts.
PASSWORD="$(/usr/bin/openssl rand -hex 16)"
/usr/bin/openssl req -x509 -newkey rsa:2048 -nodes -days "$VALID_DAYS" -config "$WORK/cert.cnf" \
  -keyout "$WORK/key.pem" -out "$WORK/cert.pem" 2>/dev/null
/usr/bin/openssl pkcs12 -export -inkey "$WORK/key.pem" -in "$WORK/cert.pem" -name "$NAME" \
  -passout "pass:$PASSWORD" -out "$OUT/dopamine-signing.p12"
printf '%s' "$PASSWORD" >"$OUT/password.txt"
chmod 600 "$OUT/dopamine-signing.p12" "$OUT/password.txt"

security import "$OUT/dopamine-signing.p12" -k "$KEYCHAIN" -P "$PASSWORD" -T /usr/bin/codesign >/dev/null
echo "✓ Imported \"$NAME\" into $KEYCHAIN; scripts/bundle.sh now signs with it."
echo
echo "For CI, add the same certificate as repository secrets:"
echo "  base64 -i \"$OUT/dopamine-signing.p12\" | gh secret set MACOS_CERT_P12"
echo "  gh secret set MACOS_CERT_PASSWORD < \"$OUT/password.txt\""
