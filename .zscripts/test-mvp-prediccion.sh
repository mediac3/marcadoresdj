#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# test-mvp-prediccion.sh — API tests for the "Jugador del Partido" (MVP) and
# the Win/Draw/Win (1X2) Dixon-Coles prediction endpoints.
#
# Requires the dev server running (default http://localhost:3000):
#   npm run dev
# Usage:
#   bash .zscripts/test-mvp-prediccion.sh [BASE_URL]
# ─────────────────────────────────────────────────────────────────────────────
set -u

BASE_URL="${1:-http://localhost:3000}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
PASS=0
FAIL=0

ok()   { PASS=$((PASS+1)); echo "  ok  $1"; }
fail() { FAIL=$((FAIL+1)); echo "  FAIL $1 ${2:-}"; }

check() { # check <desc> <cond(1=ok, 0=fail)>
  if [ "$2" = "1" ]; then ok "$1"; else fail "$1" "${3:-}"; fi
}

# node_json <file> <node-predicate-script> — script reads the JSON file path
# from argv[1], prints space-separated 0/1 results.
node_json() {
  node -e "$2" "$1" 2>/dev/null || echo ""
}

echo "MVP + Predicción 1X2 — tests de API contra $BASE_URL"
echo "──────────────────────────────────────────────────────────"

# 1. Server is up (ping responds 204 No Content)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/ping" || echo "000")
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "204" ]; then ok "servidor arriba ($HTTP_CODE)"; else
  echo "  FAIL servidor no responde ($HTTP_CODE). Arranca con: npm run dev"; exit 1
fi

# 2. Pick test events from the public list
curl -s "$BASE_URL/api/public/events" -o "$TMP_DIR/events.json"

SELECT_JS='
const d = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
const all = [...(d.events||[]), ...((d.nonTournamentEvents)||[])];
for (const t of (d.tournaments||[])) for (const p of t.phases||[]) all.push(...(p.events||[]));
const uniq = new Map(all.map(e => [e.id, e]));
const list = [...uniq.values()];
const withActions = list.filter(e => (e.actions||[]).some(a => a.playerId));
const scoreable = withActions.filter(e => ["FINISHED","LIVE","PAUSED"].includes(e.status));
const upcoming = list.find(e => e.status === "SCHEDULED");
const noActions = list.find(e => (e.actions||[]).length === 0);
process.stdout.write([
  (scoreable[0]||withActions[0]||{}).id || "-",
  (upcoming || scoreable[0] || list[0] || {}).id || "-",
  (noActions || {}).id || "-",
].join(" "));
'
IDS=$(node_json "$TMP_DIR/events.json" "$SELECT_JS")
MVP_ID=$(echo "$IDS" | awk '{print $1}')
PRED_ID=$(echo "$IDS" | awk '{print $2}')
NONSCORE_ID=$(echo "$IDS" | awk '{print $3}')

if [ "$MVP_ID" != "-" ] && [ -n "$MVP_ID" ]; then ok "evento con acciones encontrado ($MVP_ID)"; else fail "no hay eventos con acciones en la BD (semilla necesaria)"; fi
if [ "$PRED_ID" != "-" ] && [ -n "$PRED_ID" ]; then ok "evento para predicción encontrado ($PRED_ID)"; else fail "no hay eventos para predicción"; fi

# 3. MVP en el detalle del evento
if [ "$MVP_ID" != "-" ] && [ -n "$MVP_ID" ]; then
  curl -s "$BASE_URL/api/public/events/$MVP_ID" -o "$TMP_DIR/detail.json"
  MVP_JS='
const d = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
const m = d && d.mvp;
const out = [];
out.push(d && d.success === true ? 1 : 0);
out.push(m && m.mvp && typeof m.mvp.playerName === "string" && m.mvp.playerName.length > 0 ? 1 : 0);
out.push(m && Number(m.mvp.rating) >= 1 && Number(m.mvp.rating) <= 10 ? 1 : 0);
out.push(m && m.mvp.breakdown && typeof m.mvp.breakdown.goals === "number" && m.mvp.breakdown.goals > 0 ? 1 : 0);
out.push(m && Array.isArray(m.podium) && m.podium.length >= 1 && m.podium.length <= 3 ? 1 : 0);
process.stdout.write(out.join(" "));
'
  RES=$(node_json "$TMP_DIR/detail.json" "$MVP_JS")
  check "detail: success=true" "$(echo "$RES" | awk '{print $1}')"
  check "mvp: jugador con nombre" "$(echo "$RES" | awk '{print $2}')"
  check "mvp: rating en escala 1-10" "$(echo "$RES" | awk '{print $3}')"
  check "mvp: breakdown.goals > 0" "$(echo "$RES" | awk '{print $4}')"
  check "mvp: podio 1-3" "$(echo "$RES" | awk '{print $5}')"
  INFO_JS='
const d = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
if (d.mvp) console.log("     → MVP: " + d.mvp.mvp.playerName + " (★" + d.mvp.mvp.rating + ") equipo=" + d.mvp.mvp.teamId.slice(0,8));
else console.log("     → MVP: null");
'
  node_json "$TMP_DIR/detail.json" "$INFO_JS"
fi

# 4. Predicción 1X2
if [ "$PRED_ID" != "-" ] && [ -n "$PRED_ID" ]; then
  curl -s "$BASE_URL/api/public/events/$PRED_ID/prediction" -o "$TMP_DIR/pred.json"
  PRED_JS='
const d = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
const p = d && d.prediction;
const out = [];
out.push(d && d.success === true ? 1 : 0);
out.push(p && ["dixon-coles","normal-difference"].includes(p.model) ? 1 : 0);
const s = p ? p.probA + p.probDraw + p.probB : -1;
out.push(s > 0.999999 && s < 1.000001 ? 1 : 0);
out.push(p && p.probA >= 0 && p.probA <= 1 && p.probDraw >= 0 && p.probDraw <= 1 && p.probB >= 0 && p.probB <= 1 ? 1 : 0);
out.push(p && p.teamA && p.teamB && typeof p.teamA.played === "number" && typeof p.teamB.played === "number" && Array.isArray(p.teamA.form) ? 1 : 0);
out.push(p && ["ALTA","MEDIA","BAJA"].includes(p.confidence) ? 1 : 0);
process.stdout.write(out.join(" "));
'
  RES=$(node_json "$TMP_DIR/pred.json" "$PRED_JS")
  check "prediction: success=true" "$(echo "$RES" | awk '{print $1}')"
  check "prediction: modelo válido" "$(echo "$RES" | awk '{print $2}')"
  check "prediction: probabilidades suman 1" "$(echo "$RES" | awk '{print $3}')"
  check "prediction: probabilidades en [0,1]" "$(echo "$RES" | awk '{print $4}')"
  check "prediction: stats y forma por equipo" "$(echo "$RES" | awk '{print $5}')"
  check "prediction: confianza definida" "$(echo "$RES" | awk '{print $6}')"
  INFO_JS='
const d = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
const p = d.prediction;
if (p) console.log("     → P(A)=" + (p.probA*100).toFixed(1) + "% P(X)=" + (p.probDraw*100).toFixed(1) + "% P(B)=" + (p.probB*100).toFixed(1) + "% · " + p.model + " · conf " + p.confidence + " · PJ " + p.teamA.played + "/" + p.teamB.played);
'
  node_json "$TMP_DIR/pred.json" "$INFO_JS"
fi

# 5. Evento sin acciones con jugador → detail sigue OK (mvp puede ser null)
if [ "$NONSCORE_ID" != "-" ] && [ -n "$NONSCORE_ID" ]; then
  curl -s "$BASE_URL/api/public/events/$NONSCORE_ID" -o "$TMP_DIR/detail2.json"
  R=$(node_json "$TMP_DIR/detail2.json" 'const d=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); process.stdout.write(d.success===true?"1":"0");')
  check "evento sin acciones: detail sigue OK" "$R"
fi

# 6. 404 en ids inexistentes
C1=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/public/events/no-existe/prediction")
if [ "$C1" = "404" ]; then ok "prediction 404 para id inexistente"; else fail "prediction devolvió $C1 (esperaba 404)"; fi

echo "──────────────────────────────────────────────────────────"
echo "Resultado: $PASS ok, $FAIL fallos"
if [ "$FAIL" -eq 0 ]; then echo "TODOS LOS TESTS PASARON ✔"; else exit 1; fi
