#!/bin/bash
#
# 📋 HAI Tech Academy - Server Status
# Usage: ./status.sh
#

echo ""
echo "╔════════════════════════════════════════════════╗"
echo "║        📋 HAI Tech Server Status               ║"
echo "╚════════════════════════════════════════════════╝"
echo ""

# Check website
WEBSITE_PID=$(pgrep -f "node server.js" | head -1)
if [ -n "$WEBSITE_PID" ]; then
    echo "🌐 Website (8080):  ✅ Running (PID: $WEBSITE_PID)"
else
    echo "🌐 Website (8080):  ❌ Not running"
fi

# Check LMS API
LMS_PID=$(pgrep -f "node api/server.js" | head -1)
if [ -n "$LMS_PID" ]; then
    echo "📚 LMS API (3001):  ✅ Running (PID: $LMS_PID)"
else
    echo "📚 LMS API (3001):  ❌ Not running"
fi

# Check ports
echo ""
echo "🔌 Port Check:"
if nc -z localhost 8080 2>/dev/null; then
    echo "   Port 8080: ✅ Open"
else
    echo "   Port 8080: ❌ Closed"
fi

if nc -z localhost 3001 2>/dev/null; then
    echo "   Port 3001: ✅ Open"
else
    echo "   Port 3001: ❌ Closed"
fi

echo ""
