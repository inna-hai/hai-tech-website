#!/bin/bash
cd /home/ameidar/.openclaw/workspace/projects/hai-tech-website

echo "🚀 Starting HAI Tech servers..."

# Kill existing
pkill -f "node server.js" 2>/dev/null
pkill -f "node api/server.js" 2>/dev/null
sleep 1

# Start website (port 8080)
nohup node server.js > logs/website.log 2>&1 &
echo "✅ Website started (port 8080)"

# Start LMS API (port 3001)
nohup node lms/api/server.js > logs/lms-api.log 2>&1 &
echo "✅ LMS API started (port 3001)"

echo "🎉 All servers running!"
