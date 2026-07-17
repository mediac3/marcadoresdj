#!/bin/bash
# Persistent launcher for MarcadoresDJ standalone server
# Uses setsid to fully detach from controlling terminal

LOG=/home/z/my-project/dev.out.log
cd /home/z/my-project/.next/standalone

# Kill any existing instance
pkill -9 -f "node server.js" 2>/dev/null
sleep 1

# Start fresh in new session
setsid bash -c 'exec node server.js' < /dev/null > "$LOG" 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" > /home/z/my-project/.server.pid
disown $SERVER_PID 2>/dev/null
echo "Server started with PID: $SERVER_PID"
sleep 4
if kill -0 $SERVER_PID 2>/dev/null; then
  echo "Server is alive"
else
  echo "Server died"
  cat "$LOG"
fi
