#!/bin/zsh
# מוסך טארק – הפעלה חד-פעמית של Groq (זיהוי לוחית, מק"ט ותמלול מהירים)
# The key is read hidden and goes only into the Supabase secret store – it is not saved anywhere else.
set -e
cd "$(dirname "$0")"
print -n "הדבק את מפתח Groq (מתחיל ב-gsk_) ולחץ Enter: "
read -rs KEY; echo
[[ "$KEY" == gsk_* ]] || { echo "✗ המפתח צריך להתחיל ב-gsk_"; exit 1; }
CODE=$(curl -s -o /dev/null -w '%{http_code}' https://api.groq.com/openai/v1/models -H "Authorization: Bearer $KEY")
[[ "$CODE" == 200 ]] || { echo "✗ Groq דחה את המפתח (קוד $CODE). בדוק שהעתקת את כולו."; exit 1; }
supabase secrets set "GROQ_API_KEY=$KEY" --project-ref yopertfgqpdxxufdaomr >/dev/null
echo "✓ Groq הופעל. מעכשיו זיהוי הלוחית והתמלול עובדים דרך Groq (וג'מיני נשאר גיבוי)."
