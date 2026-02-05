# ⚡ OnePagerGenerator

> **Supercharged Presentation Generator**  
> Un outil ultra-performant pour générer des présentations PowerPoint à partir de données CSV. 
> Fait par **Alexandre Enouf** (Lead Dev BirdPerson Team) avec ❤️

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-19-blue.svg)
![Rust](https://img.shields.io/badge/Rust-2024-orange.svg)
![Tauri](https://img.shields.io/badge/Tauri-2.0-indigo.svg)
![pnpm](https://img.shields.io/badge/pnpm-10-yellow.svg)

---

## 🚀 Pourquoi OnePagerGenerator ?

OnePagerGenerator permet d'automatiser la création de rapports "One Pager" à grande échelle. Que vous ayez 10 ou 1000 présentations à générer, l'outil utilise un moteur Rust ultra-rapide pour traiter vos données et remplir vos templates PowerPoint en un clin d'œil.

### ✨ Fonctionnalités Clés
- **Multi-langues Automatique** : Détecte automatiquement les langues disponibles dans vos templates (FR, EN, DE, IT, ES, etc.).
- **Smart Mappings** : Mappage intelligent entre vos colonnes CSV et vos tags PowerPoint (`<<Tag>>`).
- **Comparaison YoY** : Support pour les données de l'année précédente afin de générer des comparaisons historiques.
- **Validation en Temps Réel** : Vérification immédiate de la validité de vos fichiers CSV et de la structure de vos templates.
- **Expérience Premium** : Interface moderne, interactive et fluide avec des micro-animations.

---

## 🛠️ Stack Technique

- **Frontend** : [React 19](https://react.dev/), [Vite](https://vitejs.dev/), [Tailwind CSS](https://tailwindcss.com/), [Framer Motion](https://www.framer.com/motion/).
- **Core Engine** : [Rust](https://www.rust-lang.org/) via [Tauri 2.0](https://tauri.app/).
- **Gestionnaire de Paquets** : [pnpm](https://pnpm.io/).
- **UI Components** : Lucide React, Shadcn/ui inspiration.

---

## 📥 Téléchargement & Installation

### Version Stable
Vous pouvez télécharger la dernière version stable pour macOS et Windows sur la page des [Releases](https://github.com/AlexandreEn/OnePagerGenerator/releases/latest).

### Installation (Développement)
```bash
# Cloner le projet
git clone https://github.com/AlexandreEn/OnePagerGenerator.git
cd OnePager

# Installer les dépendances
pnpm install
```

---

## 🚀 Déploiement & Automatisation

Ce repository est configuré avec des **GitHub Actions** pour faciliter la maintenance :

- **Releases Automatiques** : Dès qu'un tag `v*` est poussé sur GitHub, l'application est compilée pour macOS et Windows, et une release est créée automatiquement.
- **Landing Page** : Le site de présentation dans le dossier `/website` est automatiquement déployé sur **GitHub Pages** à chaque modification sur `main`.

---

## 📖 Guide de démarrage & Utilisation

### 1. Pré-requis Importants
- **Dossiers en local** : Pour que l'application fonctionne, il est impératif que les dossiers du Drive (Templates, etc.) soient téléchargés et accessibles en local sur votre machine. L'app ne peut pas accéder aux fichiers s'ils sont uniquement dans le cloud.
- **Matériel** : Avoir un Mac Apple Silicon (processeur M1 minimum).

### 2. Gestion des Templates
L'application scanne intelligemment le dossier que vous lui fournissez :
- **Structure** : Utilisez le dossier principal (celui du Drive). Il doit contenir un sous-dossier par langue (ex: `FR`, `EN`, `ES`) avec les fichiers `.pptx` à l'intérieur.
- **Détection** : Dès que ce dossier est sélectionné dans l'app, les langues disponibles sont détectées automatiquement.
- **Sélection** : Des boutons apparaissent pour chaque langue. Vous pouvez cliquer dessus pour désactiver celles dont vous n'avez pas besoin pour la génération en cours.

---

## 🛠️ Dépannage macOS (Premier Lancement)

Si vous rencontrez un blocage Apple (Gatekeeper), ouvrez le **Terminal** et tapez la commande suivante pour retirer l'attribut de sécurité "quarantaine" :

```bash
xattr -cr /Applications/OnePagerGenerator.app
```

Vous pouvez ensuite lancer l'application normalement.

---

## 📂 Structure du Projet

```text
OnePager/
├── src/               # Code React (Interface utilisateur)
├── src-tauri/         # Code Rust (Moteur de génération PPTX)
│   ├── src/
│   │   ├── csv_handler.rs   # Logique de lecture CSV
│   │   └── pptx_engine.rs   # Moteur de fusion PowerPoint
├── public/            # Assets statiques
├── package.json       # Scripts et dépendances
└── tauri.conf.json    # Configuration Tauri
```

---

## 👤 Auteur

**Alexandre Enouf**  
Lead Developer @ BirdPerson Team

---

## 📜 License

Ce projet est sous licence [MIT](LICENSE).
