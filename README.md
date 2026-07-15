# Chrisflix Vote

Webapp zum Abstimmen über Jellyfin-Bibliotheken. User loggen sich mit ihren Jellyfin-Accounts ein, sehen ihre freigegebenen Bibliotheken und stimmen pro Film/Serie ab: behalten (grün) oder löschen (rot).

## Features

- **Login mit Jellyfin-Account** - jeder User nutzt seine existierenden Zugangsdaten
- **Bibliotheken** - User sehen nur die für ihr Profil freigegebenen Bibliotheken
- **Voting-Gitter** - alle Filme/Serien einer Bibliothek als Gitter mit Cover, Name und Vote-Button
- **Farb-Markierung** - grün = mindestens 1 Stimme (behalten), rot = 0 Stimmen (löschen)
- **Löschliste** - alle roten Filme & Serien alphabetisch sortiert, getrennt nach Filmen und Serien
- **Admin-Funktion** - Admins können Einträge aus der Löschliste ausblenden (z.B. wenn bereits gelöscht)
- **Image-Proxy** - Bilder werden durch das Backend geleitet, kein direkter Jellyfin-Zugriff nötig

## Setup

### Mit Docker (empfohlen)

1. Docker-Netzwerk erstellen (falls noch nicht vorhanden):
   ```bash
   docker network create proxy-network
   ```

2. Build & Start:
   ```bash
   docker compose up -d --build
   ```

3. Die App läuft auf `http://localhost:3000`

### Reverse Proxy (Nginx)

Beispiel-Konfiguration in `nginx-example.conf`. Kopiere nach `/etc/nginx/sites-available/` und passe `server_name` an.

### Ohne Docker (zum Entwickeln)

```bash
npm install
npm start
```

## Konfiguration

| Environment Variable | Standard | Beschreibung |
|---------------------|----------|-------------|
| `JELLYFIN_URL` | `http://192.168.178.130:8096` | URL des Jellyfin-Servers |
| `PORT` | `3000` | Port der Webapp |
| `DATA_DIR` | `./data` | Verzeichnis für Vote-Daten |

## Wie es funktioniert

1. User loggt sich mit Jellyfin-Username & Passwort ein
2. Backend authentifiziert sich bei Jellyfin und erhält Access-Token
3. User sieht seine Bibliotheken (nur die für sein Profil freigegebenen)
4. Beim Öffnen einer Bibliothek werden alle Filme/Serien geladen
5. Klick auf den Vote-Button toggelt die Stimme (grün/rot)
6. Die Löschliste zeigt alle roten (0-Stimmen) Inhalte alphabetisch
