#!/bin/sh

set -e

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$SCRIPT_DIR"

# 存储所有子进程的 PID
pids=""

# 清理函数：优雅关闭所有服务
cleanup() {
    echo ""
    echo "🛑 正在关闭所有服务..."
    
    # 发送 SIGTERM 信号给所有子进程
    for pid in $pids; do
        if kill -0 "$pid" 2>/dev/null; then
            service_name=$(ps -p "$pid" -o comm= 2>/dev/null || echo "unknown")
            echo "   关闭进程 $pid ($service_name)..."
            kill -TERM "$pid" 2>/dev/null
        fi
    done
    
    # 等待所有进程退出（最多等待 5 秒）
    sleep 1
    for pid in $pids; do
        if kill -0 "$pid" 2>/dev/null; then
            # 如果还在运行，等待最多 4 秒
            timeout=4
            while [ $timeout -gt 0 ] && kill -0 "$pid" 2>/dev/null; do
                sleep 1
                timeout=$((timeout - 1))
            done
            # 如果仍然在运行，强制关闭
            if kill -0 "$pid" 2>/dev/null; then
                echo "   强制关闭进程 $pid..."
                kill -KILL "$pid" 2>/dev/null
            fi
        fi
    done
    
    echo "✅ 所有服务已关闭"
    exit 0
}

echo "🚀 开始启动所有服务..."
echo ""

# 切换到构建目录
cd "$BUILD_DIR" || exit 1

ls -lah

# ── Base de datos persistente de producción ──────────────────────────────────
# El paquete de despliegue incluye db/custom.db (snapshot del repo), pero esa
# copia SOLO sirve como BD inicial de arranque. La BD viva de producción vive
# en /app/data/custom.db, FUERA del paquete: un nuevo despliegue nunca la pisa
# y los datos existentes se conservan.
PACKAGED_DB_PATH="./db/custom.db"
PERSIST_DB_DIR="/app/data"
PERSIST_DB_PATH="$PERSIST_DB_DIR/custom.db"
PERSIST_BACKUP_DIR="$PERSIST_DB_DIR/backups"
PERSIST_DATABASE_URL="file:$PERSIST_DB_PATH"

# Solo se considera BD "externa" la que apunta a otro destino (p. ej. PostgreSQL).
# El valor antiguo file:/app/db/custom.db (BD empaquetada) se redirige a la
# persistente para que los despliegues no pisen los datos de producción.
case "${DATABASE_URL:-}" in
    ""|"file:/app/db/custom.db"|"file:./db/custom.db"|"file:$PACKAGED_DB_PATH")
        USE_PERSISTENT_DB=1
        ;;
    *)
        USE_PERSISTENT_DB=0
        ;;
esac

if [ "$USE_PERSISTENT_DB" = "1" ]; then
    mkdir -p "$PERSIST_DB_DIR" "$PERSIST_BACKUP_DIR"

    if [ -f "$PERSIST_DB_PATH" ]; then
        # Copia de seguridad antes de arrancar; se conservan las 5 más recientes
        BACKUP_FILE="$PERSIST_BACKUP_DIR/custom-$(date +%Y%m%d-%H%M%S).db"
        cp "$PERSIST_DB_PATH" "$BACKUP_FILE"
        ls -1t "$PERSIST_BACKUP_DIR"/custom-*.db 2>/dev/null | tail -n +6 | xargs -r rm -f
        echo "🗄️  BD persistente detectada: $PERSIST_DB_PATH (datos de producción conservados)"
        echo "🗄️  Backup de arranque: $BACKUP_FILE"
    elif [ -f "$PACKAGED_DB_PATH" ]; then
        cp "$PACKAGED_DB_PATH" "$PERSIST_DB_PATH"
        echo "🗄️  Primer arranque: BD inicial adoptada del paquete ($PACKAGED_DB_PATH)"
    else
        echo "❌ No existe $PERSIST_DB_PATH ni $PACKAGED_DB_PATH; no se puede iniciar"
        exit 1
    fi

    # Sincroniza tablas/columnas nuevas del esquema SIN borrar datos existentes.
    # Si falla (p. ej. sin red para descargar el CLI), se continúa con el actual.
    if [ -f "./prisma/schema.prisma" ]; then
        echo "🗄️  Sincronizando esquema de Prisma (no destructivo)..."
        if DATABASE_URL="$PERSIST_DATABASE_URL" bunx prisma@6 db push --skip-generate --schema ./prisma/schema.prisma; then
            echo "✅ Esquema sincronizado"
        else
            echo "⚠️  No se pudo sincronizar el esquema; se continúa con el existente"
        fi
    fi

    export DATABASE_URL="$PERSIST_DATABASE_URL"
fi

# 启动 Next.js 服务器
if [ -f "./next-service-dist/server.js" ]; then
    echo "🚀 启动 Next.js 服务器..."
    cd next-service-dist/ || exit 1
    
    # Configurar variables de entorno
    export NODE_ENV=production
    export PORT="${PORT:-3000}"
    export HOSTNAME="${HOSTNAME:-0.0.0.0}"
    # DATABASE_URL ya está definida: la persistente (arriba) o una externa del entorno

    if [ "$DATABASE_URL" = "$PERSIST_DATABASE_URL" ]; then
        echo "🗄️  Usando BD persistente: $PERSIST_DB_PATH"
    else
        echo "🗄️  Usando BD externa especificada: $DATABASE_URL"
    fi
    
    # 后台启动 Next.js
    bun server.js &
    NEXT_PID=$!
    pids="$NEXT_PID"
    
    # 等待一小段时间检查进程是否成功启动
    sleep 1
    if ! kill -0 "$NEXT_PID" 2>/dev/null; then
        echo "❌ Next.js 服务器启动失败"
        exit 1
    else
        echo "✅ Next.js 服务器已启动 (PID: $NEXT_PID, Port: $PORT)"
    fi
    
    cd ../
else
    echo "⚠️  未找到 Next.js 服务器文件: ./next-service-dist/server.js"
fi

# 启动 mini-services
if [ -f "./mini-services-start.sh" ]; then
    echo "🚀 启动 mini-services..."
    
    # 运行启动脚本（从根目录运行，脚本内部会处理 mini-services-dist 目录）
    sh ./mini-services-start.sh &
    MINI_PID=$!
    pids="$pids $MINI_PID"
    
    # 等待一小段时间检查进程是否成功启动
    sleep 1
    if ! kill -0 "$MINI_PID" 2>/dev/null; then
        echo "⚠️  mini-services 可能启动失败，但继续运行..."
    else
        echo "✅ mini-services 已启动 (PID: $MINI_PID)"
    fi
elif [ -d "./mini-services-dist" ]; then
    echo "⚠️  未找到 mini-services 启动脚本，但目录存在"
else
    echo "ℹ️  mini-services 目录不存在，跳过"
fi

# 启动 Caddy（如果存在 Caddyfile）
echo "🚀 启动 Caddy..."

# Caddy 作为前台进程运行（主进程）
echo "✅ Caddy 已启动（前台运行）"
echo ""
echo "🎉 所有服务已启动！"
echo ""
echo "💡 按 Ctrl+C 停止所有服务"
echo ""

# Caddy 作为主进程运行
exec caddy run --config Caddyfile --adapter caddyfile
