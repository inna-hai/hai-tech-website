#!/bin/bash
cd /home/ameidar/.openclaw/workspace/projects/hai-tech-website
exec python3 -m http.server 8080 --bind 0.0.0.0
