#!/usr/bin/env bash
# Tests locales: permisos de Equipos para roles CREADOR / INICIADOR
BASE=http://localhost:3000
PASS=0; FAIL=0
check() { # name expected actual
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "OK    $1 -> $3";
  else FAIL=$((FAIL+1)); echo "FAIL  $1 -> esperado $2, obtuve $3"; fi
}

login() { curl -s -X POST $BASE/api/auth/login -H "Content-Type: application/json" -d "{\"username\":\"$1\",\"password\":\"Test1234!\"}" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).token||''))"; }

TC=$(login testcreator); TI=$(login testinit); TA=$(login testadmin)
echo "tokens: creator=${TC:0:20}... initiator=${TI:0:20}... admin=${TA:0:20}..."
echo

TEAM=cms906qkk0017jopp9rf4vaac   # Colombia-Mas

# Modelo de asignación: el ADMIN asigna el equipo al CREADOR antes de probar flags
C1=$(cd D:/marcadoresdj && DATABASE_URL="file:D:/marcadoresdj/db/test-local.db" node -e "const{PrismaClient}=require('@prisma/client');const db=new PrismaClient();db.user.findUnique({where:{username:'testcreator'},select:{id:true}}).then(u=>{console.log(u.id);return db.\$disconnect()})")
curl -s -X PUT $BASE/api/teams/$TEAM -H "Authorization: Bearer $TA" -H "Content-Type: application/json" -d "{\"createdById\":\"$C1\"}" > /dev/null

echo "== CREADOR (permisos actuales: ver=T crear=T editar=T eliminar=F; equipo asignado por ADMIN) =="
code=$(curl -s -o /dev/null -w "%{http_code}" $BASE/api/teams -H "Authorization: Bearer $TC")
check "CREATOR GET /api/teams (canView)" 200 $code

code=$(curl -s -o D:/marcadoresdj/.zscripts/p1.json -w "%{http_code}" -X POST $BASE/api/teams/$TEAM/players -H "Authorization: Bearer $TC" -H "Content-Type: application/json" -d '{"name":"Jugador Prueba","number":99,"position":"Delantero"}')
check "CREATOR crear jugador en equipo ASIGNADO por admin" 201 $code
PID=$(node -e "console.log(require('D:/marcadoresdj/.zscripts/p1.json').player.id)")

code=$(curl -s -o /dev/null -w "%{http_code}" -X PUT $BASE/api/players/$PID -H "Authorization: Bearer $TC" -H "Content-Type: application/json" -d '{"name":"Jugador Editado","number":98}')
check "CREATOR editar jugador" 200 $code

code=$(curl -s -o /dev/null -w "%{http_code}" -X PUT $BASE/api/teams/$TEAM -H "Authorization: Bearer $TC" -H "Content-Type: application/json" -d '{"shortName":"COL"}')
check "CREATOR editar equipo asignado (bug reportado)" 200 $code

code=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/teams/$TEAM/players/batch -H "Authorization: Bearer $TC" -H "Content-Type: application/json" -d '{"players":[{"name":"Import A","number":21,"position":"Portero"}]}')
check "CREATOR importar jugadores (batch)" 201 $code

code=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE $BASE/api/players/$PID -H "Authorization: Bearer $TC")
check "CREATOR eliminar jugador (canDelete=F => 403)" 403 $code

echo
echo "== CREADOR: importar equipos (batch) asigna createdById =="
code=$(curl -s -o /tmp/tb.json -w "%{http_code}" -X POST $BASE/api/teams/batch -H "Authorization: Bearer $TC" -H "Content-Type: application/json" -d '{"teams":[{"name":"Equipo Test Perm","sport":"Baloncesto"}]}')
check "CREATOR POST /api/teams/batch" 201 $code

echo
echo "== INICIADOR (sin permisos en equipos) =="
code=$(curl -s -o /dev/null -w "%{http_code}" $BASE/api/teams -H "Authorization: Bearer $TI")
check "INITIATOR GET /api/teams (sin canView => 403)" 403 $code
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/teams/$TEAM/players -H "Authorization: Bearer $TI" -H "Content-Type: application/json" -d '{"name":"X","number":1,"position":"Y"}')
check "INITIATOR crear jugador (=> 403)" 403 $code

echo
echo "== ADMIN /api/admin/permissions ahora exige admin =="
code=$(curl -s -o /dev/null -w "%{http_code}" $BASE/api/admin/permissions)
check "sin token => 401" 401 $code
code=$(curl -s -o /dev/null -w "%{http_code}" $BASE/api/admin/permissions -H "Authorization: Bearer $TC")
check "con token CREADOR => 403" 403 $code
code=$(curl -s -o /dev/null -w "%{http_code}" $BASE/api/admin/permissions -H "Authorization: Bearer $TA")
check "con token ADMIN => 200" 200 $code

echo
echo "== Toggle de permisos en vivo (el panel debe reflejar efectos al instante) =="
# Quitar canEdit de teams a CREATOR
curl -s -X PUT $BASE/api/admin/permissions -H "Authorization: Bearer $TA" -H "Content-Type: application/json" -d '{"permissions":[{"role":"CREATOR","section":"teams","canView":true,"canCreate":true,"canEdit":false,"canDelete":false}]}' > /dev/null
code=$(curl -s -o /dev/null -w "%{http_code}" -X PUT $BASE/api/teams/$TEAM -H "Authorization: Bearer $TC" -H "Content-Type: application/json" -d '{"shortName":"COL"}')
check "CREATOR editar equipo con canEdit=F => 403" 403 $code
code=$(curl -s -o /dev/null -w "%{http_code}" -X PUT $BASE/api/players/$PID -H "Authorization: Bearer $TC" -H "Content-Type: application/json" -d '{"name":"Otro"}')
check "CREATOR editar jugador con canEdit=F => 403" 403 $code
# Quitar canCreate
curl -s -X PUT $BASE/api/admin/permissions -H "Authorization: Bearer $TA" -H "Content-Type: application/json" -d '{"permissions":[{"role":"CREATOR","section":"teams","canView":true,"canCreate":false,"canEdit":false,"canDelete":false}]}' > /dev/null
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/teams/$TEAM/players -H "Authorization: Bearer $TC" -H "Content-Type: application/json" -d '{"name":"Y","number":7,"position":"Z"}')
check "CREATOR crear jugador con canCreate=F => 403" 403 $code
# Restaurar estado original (ver=T crear=T editar=T eliminar=F)
curl -s -X PUT $BASE/api/admin/permissions -H "Authorization: Bearer $TA" -H "Content-Type: application/json" -d '{"permissions":[{"role":"CREATOR","section":"teams","canView":true,"canCreate":true,"canEdit":true,"canDelete":false}]}' > /dev/null
code=$(curl -s -o /dev/null -w "%{http_code}" -X PUT $BASE/api/teams/$TEAM -H "Authorization: Bearer $TC" -H "Content-Type: application/json" -d '{"shortName":"CM"}')
check "restaurado: CREATOR editar equipo => 200" 200 $code

echo
echo "== ADMIN sigue con acceso total =="
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/teams/$TEAM/players -H "Authorization: Bearer $TA" -H "Content-Type: application/json" -d '{"name":"Admin Add","number":77,"position":"Defensa"}')
check "ADMIN crear jugador" 201 $code
code=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE $BASE/api/players/$PID -H "Authorization: Bearer $TA")
check "ADMIN eliminar jugador" 200 $code

echo
echo "RESULTADO: $PASS OK / $FAIL FAIL"
