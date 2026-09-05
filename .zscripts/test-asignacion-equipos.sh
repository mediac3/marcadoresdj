#!/usr/bin/env bash
# Tests locales: asignación de equipos por ADMIN (Creador Asignado)
BASE=http://localhost:3000
PASS=0; FAIL=0
check() {
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "OK    $1 -> $3";
  else FAIL=$((FAIL+1)); echo "FAIL  $1 -> esperado $2, obtuve $3"; fi
}
login() { curl -s -X POST $BASE/api/auth/login -H "Content-Type: application/json" -d "{\"username\":\"$1\",\"password\":\"Test1234!\"}" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).token||''))"; }

TA=$(login testadmin); TC=$(login testcreator); TC2=$(login testcreator2); TI=$(login testinit)
C1=cmtou68mc0001ogo8mqurgz4t   # testcreator
C2=cmtou68mo0002ogo8u4x9pjy1   # testcreator2
TEAM=cms906qkk0017jopp9rf4vaac # Colombia-Mas (createdById = null)

echo "== 1. ADMIN asigna el equipo a CREADOR 1 (campo createdById) =="
code=$(curl -s -o /dev/null -w "%{http_code}" -X PUT $BASE/api/teams/$TEAM -H "Authorization: Bearer $TA" -H "Content-Type: application/json" -d "{\"createdById\":\"$C1\"}")
check "ADMIN PUT asignando createdById" 200 $code
owner=$(cd /d/marcadoresdj 2>/dev/null || cd D:/marcadoresdj; DATABASE_URL="file:D:/marcadoresdj/db/test-local.db" node -e "const{PrismaClient}=require('@prisma/client');const db=new PrismaClient();db.team.findUnique({where:{id:'$TEAM'},select:{createdById:true}}).then(t=>{console.log(t.createdById);return db.\$disconnect()})")
check "BD: equipo asignado a C1" "$C1" "$owner"

echo
echo "== 2. CREADOR 1 (asignado) puede gestionar el equipo =="
code=$(curl -s -o /dev/null -w "%{http_code}" -X PUT $BASE/api/teams/$TEAM -H "Authorization: Bearer $TC" -H "Content-Type: application/json" -d '{"shortName":"CM"}')
check "C1 editar equipo asignado" 200 $code
code=$(curl -s -o D:/marcadoresdj/.zscripts/asg-p1.json -w "%{http_code}" -X POST $BASE/api/teams/$TEAM/players -H "Authorization: Bearer $TC" -H "Content-Type: application/json" -d '{"name":"Jugador Asignado","number":66,"position":"Delantero"}')
check "C1 crear jugador en equipo asignado" 201 $code
PID=$(node -e "console.log(require('D:/marcadoresdj/.zscripts/asg-p1.json').player.id)")
code=$(curl -s -o /dev/null -w "%{http_code}" -X PUT $BASE/api/players/$PID -H "Authorization: Bearer $TC" -H "Content-Type: application/json" -d '{"name":"Jugador Asignado Editado"}')
check "C1 editar jugador de equipo asignado" 200 $code

echo
echo "== 3. CREADOR 1 NO puede reasignar el equipo =="
code=$(curl -s -o /dev/null -w "%{http_code}" -X PUT $BASE/api/teams/$TEAM -H "Authorization: Bearer $TC" -H "Content-Type: application/json" -d "{\"createdById\":\"$C1\"}")
check "C1 intenta enviarse createdById => 403" 403 $code

echo
echo "== 4. CREADOR 2 (sin asignación) queda bloqueado =="
code=$(curl -s -o /dev/null -w "%{http_code}" -X PUT $BASE/api/teams/$TEAM -H "Authorization: Bearer $TC2" -H "Content-Type: application/json" -d '{"shortName":"XX"}')
check "C2 editar equipo no asignado => 403" 403 $code
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/teams/$TEAM/players -H "Authorization: Bearer $TC2" -H "Content-Type: application/json" -d '{"name":"X","number":3,"position":"Y"}')
check "C2 crear jugador en equipo no asignado => 403" 403 $code
code=$(curl -s -o /dev/null -w "%{http_code}" -X PUT $BASE/api/players/$PID -H "Authorization: Bearer $TC2" -H "Content-Type: application/json" -d '{"name":"X"}')
check "C2 editar jugador de equipo no asignado => 403" 403 $code

echo
echo "== 5. ADMIN reasigna a CREADOR 2: C1 pierde, C2 gana =="
code=$(curl -s -o /dev/null -w "%{http_code}" -X PUT $BASE/api/teams/$TEAM -H "Authorization: Bearer $TA" -H "Content-Type: application/json" -d "{\"createdById\":\"$C2\"}")
check "ADMIN reasigna a C2" 200 $code
code=$(curl -s -o /dev/null -w "%{http_code}" -X PUT $BASE/api/teams/$TEAM -H "Authorization: Bearer $TC" -H "Content-Type: application/json" -d '{"shortName":"CM"}')
check "C1 ya no puede editar (reasignado) => 403" 403 $code
code=$(curl -s -o /dev/null -w "%{http_code}" -X PUT $BASE/api/players/$PID -H "Authorization: Bearer $TC" -H "Content-Type: application/json" -d '{"name":"X"}')
check "C1 ya no puede editar jugadores => 403" 403 $code
code=$(curl -s -o /dev/null -w "%{http_code}" -X PUT $BASE/api/teams/$TEAM -H "Authorization: Bearer $TC2" -H "Content-Type: application/json" -d '{"shortName":"CM2"}')
check "C2 ahora puede editar el equipo" 200 $code

echo
echo "== 6. ADMIN desasigna (null): solo admin lo gestiona =="
code=$(curl -s -o /dev/null -w "%{http_code}" -X PUT $BASE/api/teams/$TEAM -H "Authorization: Bearer $TA" -H "Content-Type: application/json" -d '{"createdById":null}')
check "ADMIN desasigna (createdById=null)" 200 $code
code=$(curl -s -o /dev/null -w "%{http_code}" -X PUT $BASE/api/teams/$TEAM -H "Authorization: Bearer $TC2" -H "Content-Type: application/json" -d '{"shortName":"CM"}')
check "C2 no puede editar equipo desasignado => 403" 403 $code
code=$(curl -s -o /dev/null -w "%{http_code}" -X PUT $BASE/api/teams/$TEAM -H "Authorization: Bearer $TA" -H "Content-Type: application/json" -d '{"shortName":"CM"}')
check "ADMIN sigue editando equipo desasignado" 200 $code
code=$(curl -s -o /dev/null -w "%{http_code}" -X PUT $BASE/api/teams/$TEAM -H "Authorization: Bearer $TA" -H "Content-Type: application/json" -d '{"createdById":"usuario-inexistente"}')
check "ADMIN asigna id inexistente => 400" 400 $code

echo
echo "== 7. Eliminar jugador respeta canDelete + asignación =="
code=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE $BASE/api/players/$PID -H "Authorization: Bearer $TA")
check "ADMIN elimina jugador" 200 $code
code=$(curl -s -o D:/marcadoresdj/.zscripts/asg-p2.json -w "%{http_code}" -X POST $BASE/api/teams/$TEAM/players -H "Authorization: Bearer $TA" -H "Content-Type: application/json" -d '{"name":"Temp Delete","number":67,"position":"Defensa"}')
PID2=$(node -e "console.log(require('D:/marcadoresdj/.zscripts/asg-p2.json').player.id)")
# reasignar a C1 y activar canDelete temporalmente
curl -s -X PUT $BASE/api/teams/$TEAM -H "Authorization: Bearer $TA" -H "Content-Type: application/json" -d "{\"createdById\":\"$C1\"}" > /dev/null
curl -s -X PUT $BASE/api/admin/permissions -H "Authorization: Bearer $TA" -H "Content-Type: application/json" -d '{"permissions":[{"role":"CREATOR","section":"teams","canView":true,"canCreate":true,"canEdit":true,"canDelete":true}]}' > /dev/null
code=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE $BASE/api/players/$PID2 -H "Authorization: Bearer $TC")
check "C1 (asignado, canDelete=T) elimina jugador" 200 $code
# restaurar canDelete=F
curl -s -X PUT $BASE/api/admin/permissions -H "Authorization: Bearer $TA" -H "Content-Type: application/json" -d '{"permissions":[{"role":"CREATOR","section":"teams","canView":true,"canCreate":true,"canEdit":true,"canDelete":false}]}' > /dev/null

echo
echo "== 8. Regresión: INICIADOR y visibilidad =="
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/teams/$TEAM/players -H "Authorization: Bearer $TI" -H "Content-Type: application/json" -d '{"name":"X","number":9,"position":"Y"}')
check "INITIATOR crear jugador => 403" 403 $code
code=$(curl -s -o /dev/null -w "%{http_code}" $BASE/api/teams/$TEAM -H "Authorization: Bearer $TC")
check "C1 sigue VIENDO el equipo (canView)" 200 $code
code=$(curl -s -o /dev/null -w "%{http_code}" $BASE/api/teams -H "Authorization: Bearer $TC")
check "C1 lista equipos (canView)" 200 $code

echo
echo "RESULTADO: $PASS OK / $FAIL FAIL"
