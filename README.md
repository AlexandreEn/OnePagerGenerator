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

## 📥 Installation

```bash
# Cloner le projet
git clone [url-du-repo]
cd OnePager

# Installer les dépendances
pnpm install
```

---

## 📖 Utilisation

1. **Lancer l'application** :
   ```bash
   pnpm tauri dev
   ```

2. **Configurer vos sources** :
   - Glissez-déposez votre fichier **Standard CSV** (données actuelles).
   - Glissez-déposez le fichier **Previous Year CSV** (optionnel, pour YoY).

3. **Préparer vos templates** :
   - Organisez vos templates dans des dossiers par langue (ex: `/FR/mon_template.pptx`, `/EN/my_template.pptx`).

4. **Mapper vos données** :
   - Utilisez l'icône ⚙️ pour définir des règles de mappage spécifiques si vos colonnes ne correspondent pas directement aux tags.

5. **Lancer la magie** ✨ :
   - Cliquez sur **Generate Presentations** et regardez le moteur Rust faire le travail !

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
