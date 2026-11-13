#!/bin/zsh
# מוסך טארק – הפעלה חד-פעמית של התראות לטלפון (Web Push)
# Creates a key pair: the private key goes only into the Supabase secret store,
# the public key is saved to push-public-key.txt (it is meant to be public – the app uses it).
set -e
cd "$(dirname "$0")"
D=$(mktemp -d); trap 'rm -rf "$D"' EXIT; umask 077
openssl ecparam -genkey -name prime256v1 -noout -out "$D/k.pem" 2>/dev/null
python3 - "$D/k.pem" "$D/env" <<'PY' > push-public-key.txt
import sys, subprocess, base64, re
txt = subprocess.run(['openssl', 'ec', '-in', sys.argv[1], '-text', '-noout'], capture_output=True, text=True).stdout
def block(label):
    m = re.search(label + r':\s*\n((?:\s+[0-9a-f:]+\n)+)', txt)
    return bytes.fromhex(re.sub(r'[\s:]', '', m.group(1)))
priv = block('priv')[-32:].rjust(32, b'\0'); pub = block('pub')
assert len(pub) == 65 and pub[0] == 4
b64 = lambda b: base64.urlsafe_b64encode(b).decode().rstrip('=')
open(sys.argv[2], 'w').write(f"VAPID_PUBLIC={b64(pub)}\nVAPID_PRIVATE={b64(priv)}\nVAPID_SUBJECT=https://khamaysi15.github.io/tarek-garage/\n")
print(b64(pub))
PY
supabase secrets set --env-file "$D/env" --project-ref yopertfgqpdxxufdaomr >/dev/null
echo "✓ התראות הופעלו. המפתח הציבורי נשמר ב-push-public-key.txt"
