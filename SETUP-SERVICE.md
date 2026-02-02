# הגדרת שירות systemd לשרת Hai Tech

## שלב 1: יצירת קובץ השירות

```bash
sudo nano /etc/systemd/system/haitech.service
```

הדבק את התוכן הזה:

```ini
[Unit]
Description=Hai Tech Website Server
After=network.target

[Service]
Type=simple
User=ameidar
WorkingDirectory=/home/ameidar/.openclaw/workspace/projects/hai-tech-website
ExecStart=/home/ameidar/.nvm/versions/node/v22.22.0/bin/node server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=8080

[Install]
WantedBy=multi-user.target
```

שמור וסגור (Ctrl+X, Y, Enter)

## שלב 2: הפעלת השירות

```bash
# טען מחדש את systemd
sudo systemctl daemon-reload

# הפעל את השירות
sudo systemctl start haitech

# הגדר שיעלה אוטומטית בהפעלה
sudo systemctl enable haitech

# בדוק סטטוס
sudo systemctl status haitech
```

## פקודות שימושיות

```bash
# הפעלה מחדש
sudo systemctl restart haitech

# עצירה
sudo systemctl stop haitech

# צפייה בלוגים
sudo journalctl -u haitech -f

# צפייה ב-20 השורות האחרונות
sudo journalctl -u haitech -n 20
```

## בדיקה

```bash
curl http://localhost:8080/api/health
```

צריך להחזיר:
```json
{"status":"ok","service":"hai-tech-server","aiEnabled":false}
```

---

**לאחר ההגדרה, השרת:**
- ✅ יעלה אוטומטית כשהשרת נדלק
- ✅ יתאושש אוטומטית מקריסות
- ✅ ירוץ ברקע תמיד
