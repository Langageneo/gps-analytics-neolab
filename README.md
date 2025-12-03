# gps-analytics-neolab
GPS-précision&amp;pro système d'Analyse donnée Market livraison Yango glovoo et jumia intégré 
# 🚀 GPS&ANALYTICS_MARKETING Neo-Lab

Site web professionnel avec système de paiement, base de données et GPS Analytics

**Par Parfait Guiri**  
📞 +225 05 55 70 94 75 | ✉️ parfaitguiri@gmail.com

---

## ✨ Fonctionnalités

- 🎨 **Design moderne techno-neon** avec animations fluides
- 👥 **Système de membres** (inscription, connexion, profils)
- 📚 **Vente de livre numérique** (LangageNeo)
- 💳 **Paiement Mobile Money** (Orange, MTN, Moov, Wave)
- 📅 **Abonnements mensuels** avec gestion automatique
- 🌍 **GPS Precision Pro** - Analytics avec vraies API satellites
- 📊 **Dashboard Admin** complet pour gestion
- 🔐 **Authentification JWT** sécurisée
- 📧 **Système de contact** avec emails automatiques

---

## 🗂️ Structure du Projet

```
gps-analytics-neolab/
├── public/
│   ├── index.html              # Site principal
│   ├── admin.html              # Dashboard admin
│   └── assets/
│       └── langageneo.pdf      # Votre livre (à ajouter)
├── netlify/
│   └── functions/
│       ├── auth.js             # Authentification
│       ├── payment.js          # Paiements Mobile Money
│       ├── contact.js          # Messages & emails
│       ├── gps-analytics.js    # GPS avec API satellites
│       └── book-access.js      # Gestion accès livre
├── database/
│   └── schema.sql              # Structure base de données
├── netlify.toml                # Configuration Netlify
├── package.json                # Dépendances Node.js
├── .env.example                # Variables d'environnement
└── README.md                   # Ce fichier
```

---

## 🚀 Déploiement Étape par Étape

### 1️⃣ Prérequis

- Compte GitHub
- Compte Netlify (gratuit)
- Compte Neon Database (gratuit)
- Compte provider paiement (CinetPay/FedaPay/PayDunya)

### 2️⃣ Créer la Base de Données Neon

1. Allez sur [neon.tech](https://neon.tech)
2. Créez un compte gratuit
3. Créez un nouveau projet
4. Créez une base de données `neolab_db`
5. Dans le Query Editor, copiez-collez le contenu de `database/schema.sql`
6. Exécutez le script pour créer les tables
7. Copiez votre `DATABASE_URL` (format: `postgresql://...`)

### 3️⃣ Configurer le Repo GitHub

```bash
# Cloner ou créer le repo
git init
git add .
git commit -m "Initial commit - GPS Analytics Neo-Lab"
git branch -M main
git remote add origin https://github.com/VOTRE-USERNAME/gps-analytics-neolab.git
git push -u origin main
```

### 4️⃣ Déployer sur Netlify

1. Allez sur [netlify.com](https://netlify.com)
2. Cliquez "Add new site" → "Import an existing project"
3. Connectez votre GitHub et sélectionnez le repo
4. Configuration build :
   - **Build command:** (laisser vide)
   - **Publish directory:** `public`
5. Cliquez "Deploy site"

### 5️⃣ Configurer les Variables d'Environnement

Dans Netlify Dashboard → Site settings → Environment variables :

**Ajouter toutes les variables de `.env.example` :**

```
DATABASE_URL=postgresql://...
JWT_SECRET=votre-secret-securise
SMTP_USER=parfaitguiri@gmail.com
SMTP_PASS=votre-app-password
CINETPAY_API_KEY=...
GOOGLE_MAPS_API_KEY=...
```

### 6️⃣ Uploader votre Livre PDF

**Option 1: Via Netlify UI**
1. Dans Netlify → Deploys → Drag & Drop
2. Glissez votre fichier `langageneo.pdf` dans `public/assets/`

**Option 2: Via Git**
```bash
cp /chemin/vers/langageneo.pdf public/assets/
git add public/assets/langageneo.pdf
git commit -m "Add book PDF"
git push
```

### 7️⃣ Activer Neon Extension sur Netlify

1. Netlify Dashboard → Integrations
2. Cherchez "Neon"
3. Cliquez "Enable"
4. Connectez votre database Neon

---

## 🔑 Configuration des APIs

### Gmail (SMTP)

1. Activer l'authentification à 2 facteurs
2. Générer un "App Password" : https://myaccount.google.com/apppasswords
3. Utilisez ce mot de passe dans `SMTP_PASS`

### Google Maps API

1. Console Google Cloud : https://console.cloud.google.com
2. Activer "Distance Matrix API" et "Geocoding API"
3. Créer une clé API
4. Ajouter dans `GOOGLE_MAPS_API_KEY`

### CinetPay (Recommandé pour Côte d'Ivoire)

1. Inscription : https://cinetpay.com
2. Dashboard → API Keys
3. Copier `API_KEY` et `SITE_ID`

**Autres options:**
- **FedaPay:** https://fedapay.com
- **PayDunya:** https://paydunya.com

---

## 📊 Utilisation du Dashboard Admin

**URL:** `https://votre-site.netlify.app/admin`

**Connexion:** Créez un compte avec votre email, puis manuellement dans la DB :

```sql
UPDATE users SET role = 'admin' WHERE email = 'parfaitguiri@gmail.com';
```

**Fonctionnalités:**
- 👥 Gérer utilisateurs
- 💰 Voir tous les paiements
- 📅 Gérer abonnements
- 📧 Lire messages
- 📚 Uploader/gérer le livre
- 📊 Statistiques en temps réel

---

## 🌍 API GPS Precision Pro

### Endpoints Disponibles

**Calculer Analytics**
```bash
POST /.netlify/functions/gps-analytics/calculate
Content-Type: application/json

{
  "userId": 1,
  "serviceType": "yango",
  "latStart": 5.3599517,
  "lonStart": -4.0082563,
  "latEnd": 5.3662155,
  "lonEnd": -4.0142013,
  "timeMinutes": 25,
  "price": 1500,
  "useRealAPI": true
}
```

**Response:**
```json
{
  "success": true,
  "analytics": {
    "distance": 12.45,
    "speed": 29.88,
    "hourlyRate": 3600,
    "efficiency": 92.5,
    "pricePerKm": 120.48,
    "score": 87
  }
}
```

---

## 💳 Flux de Paiement

### Achat Livre (17.500 XOF)

1. Client clique "Acheter"
2. Sélectionne opérateur Mobile Money
3. Entre son numéro
4. Redirection vers page paiement
5. Confirmation automatique
6. Accès immédiat au PDF

### Abonnement (2.500 XOF/mois)

1. Client s'abonne
2. Paiement traité
3. Accès activé pour 30 jours
4. Renouvellement manuel

---

## 🔒 Sécurité

- ✅ Tokens JWT pour authentification
- ✅ Passwords hashés avec bcrypt
- ✅ HTTPS obligatoire (Netlify)
- ✅ Variables d'environnement sécurisées
- ✅ Rate limiting sur APIs
- ✅ Validation des entrées

---

## 📱 Intégration WhatsApp

Pour recevoir notifications WhatsApp :

1. Utilisez **Twilio** ou **WhatsApp Business API**
2. Ajoutez webhook dans `contact.js`
3. Notifications instantanées sur messages

---

## 🐛 Debug & Logs

**Voir logs Netlify:**
```bash
netlify dev       # Local development
netlify logs      # Production logs
```

**Tester localement:**
```bash
npm install
netlify dev
# Site: http://localhost:8888
```

---

## 📈 Optimisations Futures

- [ ] Intégration Stripe pour cartes bancaires
- [ ] App mobile React Native
- [ ] Notifications push
- [ ] Chat en direct
- [ ] Analytics avancés avec AI
- [ ] API publique documentée

---

## 📞 Support

**Problème ?** Contactez-moi :
- 📧 parfaitguiri@gmail.com
- 📞 +225 05 55 70 94 75
- 💬 WhatsApp disponible

---

## 📄 Licence

© 2024 Parfait Guiri - GPS&ANALYTICS_MARKETING Neo-Lab  
Tous droits réservés

---

## 🎉 Crédits

Développé avec ❤️ par **Parfait Guiri**  
Technologies : React, Node.js, Neon PostgreSQL, Netlify Functions

**Propulsé par Neo-Lab** 🚀
