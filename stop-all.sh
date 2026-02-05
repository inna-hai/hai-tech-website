#!/bin/bash
#
# 🛑 HAI Tech Academy - Stop All Servers
# Usage: ./stop-all.sh
#

echo ""
echo "🛑 Stopping HAI Tech servers..."

pkill -f "node server.js" 2>/dev/null
pkill -f "node api/server.js" 2>/dev/null

sleep 1

echo "✅ All servers stopped"
echo ""
