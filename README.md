# 🤖 Serenity Craft Bot

Bienvenue dans le dépôt du bot Discord **Serenity Craft**. Ce bot professionnel propose un système complet de giveaways, de modération, de tickets et bien plus encore.

## 🚀 Étapes de configuration

Suivez ces étapes simples pour configurer et lancer votre bot.

### 1. Prérequis
- **Node.js** (v18.0.0 ou plus récent)
- **MySQL** ou **MariaDB** (pour la base de données)

### 2. Installation
Ouvrez votre terminal dans le dossier du projet et installez les dépendances :
```bash
npm install
```

### 3. Configuration du fichier `.env`
Créez un fichier `.env` à la racine du projet (copiez le contenu s'il n'existe pas) et remplissez les informations suivantes :

#### 🔑 Configuration Discord
- `DISCORD_TOKEN` : Le token de votre application Discord (via le portail développeur).
- `CLIENT_ID` : L'ID de votre bot.
- `GUILD_ID` : L'ID de votre serveur principal.

#### 💾 Configuration Base de Données
- `DB_HOST` : L'hôte de votre base de données (ex: `localhost`).
- `DB_NAME` : Le nom de votre base de données.
- `DB_USER` : Votre nom d'utilisateur.
- `DB_PASSWORD` : Votre mot de passe.
- `DB_PORT` : Le port MySQL (par défaut `3306`).

### 4. Configuration avancée
Vous pouvez personnaliser le comportement du bot (couleurs, messages, fonctionnalités activées) dans le fichier :
`src/config/discordconfig.yml`

---

## 🛠️ Commandes pour lancer le bot

| Commande | Usage |
| :--- | :--- |
| `node launcher.js` | Lancer le bot normalement |
| `npm run dev` | Lancer le bot avec le mode débug activé |
| `npm run clear-commands` | Supprimer toutes les commandes slash enregistrées |

## ✨ Fonctionnalités incluses
- 🎁 **Giveaways** : Système de concours performant.
- 🎟️ **Tickets** : Support client organisé par catégories.
- 🛡️ **Modération** : Anti-spam, sanctions automatiques et logs.
- 🎙️ **Support Vocal** : Salons éphémères automatiques.
- 📈 **Leveling** : Système d'expérience pour les membres.
- 💰 **Market** : Économie et rotation d'objets.
