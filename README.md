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
# --- DATENBANK (SQLite) ---
DATABASE_URL="file:./dev.db"
PRISMA_CLIENT_ENGINE_TYPE="library"
PRISMA_CLI_QUERY_ENGINE_TYPE="library"

# --- INFLUXDB (z.B. Home Assistant) ---
INFLUXDB_URL="http://192.168.1.10:8086"
INFLUXDB_TOKEN="DeinTokenHier=="
INFLUXDB_ORG="home_assistant"
INFLUXDB_BUCKET="home_assistant"

# --- SICHERHEIT ---
JWT_SECRET="ein-sehr-langes-geheimes-passwort"
```

### 3. Starten mit Docker (Empfohlen)
```bash
docker-compose up -d
```
Die App ist nun unter `http://localhost:3000` erreichbar.
Standard-Login: `admin@strom.de` / `admin` (Bitte sofort ändern!)

### 4. Manuelle Installation (Dev)
```bash
npm install
npm run dev
```

## 🛠 Technologien
- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
- **Database**: SQLite (via Prisma ORM)
- **Time Series**: InfluxDB V2
- **Styling**: TailwindCSS & Framer Motion
- **Auth**: JOSE (JWT) & OTP

## 📝 Lizenz
MIT
