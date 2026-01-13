# ⚡ StromApp

Eine moderne Web-Anwendung zur Verwaltung und Abrechnung von Stromkosten, PV-Erträgen und Batteriespeichern. Ideal für die Familie oder WG, um Transparenz in die Energiekosten zu bringen.

## ✨ Features

- 📊 **Live Dashboard**: Aktueller Verbrauch, Kosten und Status (Einspeisung/Bezug) auf einen Blick.
- 📈 **Historie**: Detaillierte Auswertungen (Woche/Monat/Jahr) mit Kostenverlauf.
- ☀️ **PV & Batterie**: Intelligente Verrechnung von Eigenverbrauch und Netzbezug.
- 💰 **Flexible Tarife**: Unterstützung für interne PV-Preise, Netzpreise und Fallback-Preise.
- 🧾 **PDF Abrechnungen**: Automatische Generierung von monatlichen Abrechnungen.
- 🐳 **Docker Ready**: Einfache Installation via Docker Compose.
- 🔒 **Sicher**: JWT-Login, Admin-Bereich und 2FA-Support (TOTP).

## 🚀 Installation

### 1. Repository klonen
```bash
git clone https://github.com/D4rk-Sh4dw/Stromapp.git
cd Stromapp
```

### 2. Konfiguration (.env)
Kopiere die Beispiel-Konfiguration und passe sie an:
```bash
cp .env.example .env
```

Bearbeite die `.env` Datei mit deinen Daten:

```ini
# --- DATENBANK (PostgreSQL) ---
# Diese Werte werden von Docker Compose genutzt
POSTGRES_USER="stromapp"
POSTGRES_PASSWORD="securepassword"
POSTGRES_DB="stromapp"

# Für lokale Entwicklung (falls du nicht Docker Compose nutzt):
DATABASE_URL="postgresql://stromapp:securepassword@localhost:5432/stromapp?schema=public"

# --- INFLUXDB (z.B. Home Assistant) ---
INFLUXDB_URL="http://192.168.1.10:8086"
INFLUXDB_TOKEN="DeinTokenHier=="
INFLUXDB_ORG="home_assistant"
INFLUXDB_BUCKET="home_assistant"

# --- SICHERHEIT ---
JWT_SECRET="ein-sehr-langes-geheimes-passwort"
```

> **💡 Hinweis:** Das `INFLUXDB_TOKEN` Format ist `Username:Password` (z.B. `admin:meinpasswort`).

### 3. Starten mit Docker (Empfohlen)
```bash
docker-compose up -d
```

Die App ist nun unter `http://localhost:3000` erreichbar.

**Standard-Login:**
- E-Mail: `admin@strom.de`
- Passwort: `admin`

⚠️ **Wichtig:** Ändere das Passwort sofort nach dem ersten Login im Admin-Bereich!

### 4. Manuelle Installation (Dev)
```bash
npm install
npx prisma db push
npx prisma db seed
npm run dev
```

## 🛠 Technologien
- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
- **Database**: PostgreSQL (via Prisma ORM)
- **Time Series**: InfluxDB V2
- **Styling**: TailwindCSS & Framer Motion
- **Auth**: JOSE (JWT) & OTP (2FA)

## 📦 Docker Image
Das offizielle Docker-Image wird automatisch bei jedem Push auf `main` gebaut:
```bash
docker pull ghcr.io/d4rk-sh4dw/stromapp:nightly
```

## 📝 Lizenz
MIT
