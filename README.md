# Chrisflix Vote

A web app for voting on your Jellyfin media library. Users log in with their existing Jellyfin accounts, browse their accessible libraries, and vote on each movie or series: keep (green), last season (orange), or delete (red). An alphabetically sorted delete list shows all items with zero votes, separated by movies and series.

## Features

- **Jellyfin account login** - users authenticate with their existing Jellyfin credentials
- **Libraries** - users only see libraries their Jellyfin profile has access to
- **Voting grid** - all movies/series in a library displayed as a grid with cover art, title, and vote buttons
- **Color-coded status** - green = at least 1 keep vote, orange = last season, red = 0 votes (delete)
- **Delete list** - all red items sorted alphabetically, separated into movies and series
- **Admin features** - admins can hide items from the delete list (e.g. already deleted)
- **Image proxy** - cover images served through the backend, no direct Jellyfin access needed

## Setup

### With Docker (recommended)

1. Open `docker-compose.yml` and set `JELLYFIN_URL` to your Jellyfin server URL:
   ```yaml
   environment:
     - JELLYFIN_URL=http://YOUR_JELLYFIN_IP:8096
   ```

2. Build & start:
   ```bash
   docker compose up -d --build
   ```

3. The app runs on `http://localhost:3000`

### Reverse Proxy (Nginx)

Example configuration in `nginx-example.conf`. Copy to `/etc/nginx/sites-available/` and adjust `server_name`.

### Without Docker (for development)

```bash
npm install
npm start
```

## Configuration

| Environment Variable | Default | Description |
|---------------------|----------|-------------|
| `JELLYFIN_URL` | `http://localhost:8096` | URL of your Jellyfin server (set in `docker-compose.yml`) |
| `PORT` | `3000` | Port the web app runs on |
| `DATA_DIR` | `./data` | Directory for vote data storage |

## How it works

1. User logs in with their Jellyfin username & password
2. Backend authenticates with Jellyfin and receives an access token
3. User sees their libraries (only those their profile has access to)
4. Opening a library loads all movies/series
5. Clicking a vote button toggles the vote (keep / last season / remove)
6. The delete list shows all red (zero-vote) items alphabetically

---

# Chrisflix Vote (Deutsch)

Webapp zum Abstimmen über Jellyfin-Bibliotheken. User loggen sich mit ihren Jellyfin-Accounts ein, sehen ihre freigegebenen Bibliotheken und stimmen pro Film/Serie ab: behalten (grün), letzte Staffel (orange) oder löschen (rot). Eine alphabetisch sortierte Löschliste zeigt alle Items mit 0 Stimmen, getrennt nach Filmen und Serien.

## Features

- **Login mit Jellyfin-Account** - jeder User nutzt seine existierenden Zugangsdaten
- **Bibliotheken** - User sehen nur die für ihr Profil freigegebenen Bibliotheken
- **Voting-Gitter** - alle Filme/Serien einer Bibliothek als Gitter mit Cover, Name und Vote-Button
- **Farb-Markierung** - grün = mindestens 1 Stimme (behalten), orange = letzte Staffel, rot = 0 Stimmen (löschen)
- **Löschliste** - alle roten Filme & Serien alphabetisch sortiert, getrennt nach Filmen und Serien
- **Admin-Funktion** - Admins können Einträge aus der Löschliste ausblenden (z.B. wenn bereits gelöscht)
- **Image-Proxy** - Bilder werden durch das Backend geleitet, kein direkter Jellyfin-Zugriff nötig

## Setup

### Mit Docker (empfohlen)

1. `docker-compose.yml` öffnen und `JELLYFIN_URL` auf die URL deines Jellyfin-Servers anpassen:
   ```yaml
   environment:
     - JELLYFIN_URL=http://DEINE_JELLYFIN_IP:8096
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
| `JELLYFIN_URL` | `http://localhost:8096` | URL des Jellyfin-Servers (in `docker-compose.yml` anpassen) |
| `PORT` | `3000` | Port der Webapp |
| `DATA_DIR` | `./data` | Verzeichnis für Vote-Daten |

## Wie es funktioniert

1. User loggt sich mit Jellyfin-Username & Passwort ein
2. Backend authentifiziert sich bei Jellyfin und erhält Access-Token
3. User sieht seine Bibliotheken (nur die für sein Profil freigegebenen)
4. Beim Öffnen einer Bibliothek werden alle Filme/Serien geladen
5. Klick auf den Vote-Button toggelt die Stimme (behalten / letzte Staffel / entfernen)
6. Die Löschliste zeigt alle roten (0-Stimmen) Inhalte alphabetisch
