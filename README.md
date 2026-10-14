# Ma Santé

Site de suivi personnel : médicaments, signes vitaux, ordonnances et notes.

- **Front** : HTML/CSS/JS vanilla, hébergé sur **GitHub Pages**
- **Données et comptes** : **Google Sheet**, via une API **Apps Script**
- **Photos** : dossier **Google Drive** privé (jamais partagé publiquement)
- **Notifications** : email automatique avant la fin de validité d'une ordonnance

---

## Installation (≈ 15 min)

### 1. Préparer le Google Sheet et le dossier Drive

1. Ouvre le Sheet. Clique sur **Partager** et vérifie que l'*Accès général* est sur **Restreint**. Personne d'autre que toi ne doit pouvoir l'ouvrir : le site y accède via le script, pas via le lien.
2. Fais la même vérification pour le dossier Drive des images.

### 2. Installer le script

1. Dans le Sheet, ouvre **Extensions → Apps Script**.
2. Crée 7 fichiers de script et colle le contenu du dossier `apps-script/` :
   `Code.gs`, `Data.gs`, `Auth.gs`, `Photos.gs`, `Notifs.gs`, `Setup.gs`, `Pin.gs`.
   Le fichier `Code.gs` existe déjà : remplace son contenu.
3. *(Recommandé)* Va dans **Paramètres du projet (⚙️) → Afficher le fichier manifeste « appsscript.json »**, puis colle le contenu de `apps-script/appsscript.json`.
4. Dans la barre du haut, choisis la fonction **`setup`**, puis clique sur **▶ Exécuter**.
   Autorise l'accès : Sheets, Drive, envoi d'emails, déclencheurs. Si Google affiche « Application non validée », clique sur **Paramètres avancés → Accéder à… (non sécurisé)**. C'est normal, puisque c'est ton propre script.
5. Dans le journal d'exécution, tu dois lire : `✅ Installation terminée. Compte admin créé → admin / ChangeMoi123!`

### 3. Déployer l'API

1. Clique sur **Déployer → Nouveau déploiement**, puis sur la roue ⚙️ et choisis **Application Web**.
2. Règle **Exécuter en tant que : Moi**.
3. Règle **Qui a accès : Tout le monde**.
   C'est obligatoire pour que GitHub Pages puisse appeler l'API. Les données restent protégées : chaque appel exige une session valide.
4. Clique sur **Déployer** et copie l'**URL de l'application Web** (elle se termine par `/exec`).

### 4. Configurer et publier le site

1. Ouvre `js/config.js` et colle l'URL dans `API_URL`.
2. Pousse le dossier sur un dépôt GitHub (sans le dossier `apps-script/` si tu préfères).
3. Va dans **Settings → Pages → Deploy from a branch → main / root**.
4. Ouvre le site et connecte-toi avec **admin / ChangeMoi123!**.
5. Dans **Mon compte**, change le mot de passe et vérifie ton email.
6. Dans **Administration → Nouveau compte**, crée les 2 utilisateurs, avec leur email pour les rappels.
7. Dans **Administration**, clique sur **Envoyer un email de test** pour vérifier les notifications.

### Mettre à jour le script plus tard

> **Mise à jour v1.2** (stock, fiche d'urgence, rapport, code PIN) : ajoute le nouveau fichier `Pin.gs`, remplace `Code.gs`, `Auth.gs`, `Notifs.gs` et `Setup.gs`, **relance `setup()`** (nouvelles colonnes de stock + onglets `FicheUrgence` et `Appareils`), puis déploie une nouvelle version.
>
> **Mise à jour v1.1** (emojis réglables) : colle les nouveaux `.gs`, **relance `setup()`** pour ajouter les colonnes `saison_qte` et `saison_vitesse` à l'onglet Utilisateurs, puis déploie une nouvelle version comme décrit ci-dessous.


Après une modification d'un fichier `.gs` :

1. Va dans **Déployer → Gérer les déploiements → ✏️ (modifier)**.
2. Choisis **Version : Nouvelle version**, puis clique sur **Déployer**.

L'URL ne change pas.

---

## Fonctionnement

| Page | Contenu |
|---|---|
| **Accueil** | Prises du jour (validation rapide), dernières mesures, ordonnances à renouveler, notes épinglées |
| **Médicaments** | Généré depuis les ordonnances actives, par catégorie : *Constant* (matin / midi / soir / nuit, bouton ✓ ou ✗), *Réserve* (bouton « + Dose » avec l'heure), *Autre*. Navigation par jour. |
| **Signes vitaux** | Saisie groupée (glycémie, tension, fréquence cardiaque, fréquence respiratoire, saturation, douleur 0-10), graphique global et par signe, historique modifiable, export CSV et PDF par signe ou complet, **schéma de correction** |
| **Ordonnances** | Tableau médicament / dosage / catégorie / date / validité / posologie `0-0-0-0`. La validité se définit par **date de fin** ou par **durée**. Photo de l'ordonnance (import ou lien), archivage. |
| **Notes** | Notes libres, recherche, épinglage |
| **Fiche d'urgence** | Informations vitales, plein écran pour les secours, QR code, PDF, accès hors connexion |
| **Rapport médecin** | PDF complet sur une période : traitements, observance, signes vitaux, correction |
| **Mon compte** | Nom, prénom, email, photo (import ou lien), mot de passe, couleur, mode clair / sombre / auto, mode daltonien, thème de saison, sons |
| **Administration** | Comptes (création, rôle, désactivation, mot de passe), **consultation des données de chaque compte** (lecture seule), paramètres (nom, logo, favicon, délai d'alerte, unité de glycémie) |

**Stock de médicaments.** Dans une ordonnance, active « Suivre le stock » et indique la quantité actuelle.
- Chaque prise validée décompte la dose prévue, et l'annulation d'une prise la rend au stock. Pour la réserve, c'est la « quantité par dose » qui est décomptée.
- Le stock affiché donne le nombre de jours restants et la date d'épuisement estimée.
- Le bouton 📦, ou un clic sur le badge de stock, permet d'ajouter une boîte ou de corriger le stock.
- L'alerte se déclenche sous le seuil : 7 jours par défaut, réglable par ordonnance ou dans l'administration. Elle apparaît sur l'accueil et part dans l'email du matin.

**Fiche d'urgence.** Elle regroupe allergies, pathologies, traitements en cours (repris automatiquement des ordonnances), dispositifs, contacts, médecin et directives.
- Le mode **« Afficher pour les secours »** passe en plein écran, avec un fort contraste et des boutons d'appel.
- La fiche existe aussi en **QR code** (texte seul, lisible sans connexion) et en PDF.
- L'option « Garder une copie sur cet appareil » ajoute un bouton 🚑 sur l'écran de connexion. Il donne accès à la fiche sans mot de passe : à activer uniquement sur son propre téléphone.

**Rapport médecin.** Il s'agit d'un PDF sur une période au choix (jusqu'à 6 mois). Chaque section se coche ou se décoche :
- résumé de la fiche d'urgence ;
- traitements, avec la validité et le stock ;
- observance par médicament (prises validées / prévues) et doses de réserve ;
- signes vitaux (statistiques et graphiques), avec le détail des mesures en option ;
- schéma de correction, avec le nombre de corrections indiquées ;
- notes épinglées.

**Code PIN.** Il s'active dans *Mon compte → Code PIN*, et ne fonctionne que sur l'appareil où il a été créé.
- Au lancement, un écran de profils s'affiche (pratique si plusieurs personnes utilisent le même téléphone), suivi d'un clavier numérique.
- Le verrouillage automatique en arrière-plan est réglable : immédiatement, 1, 5, 15 ou 60 minutes, ou jamais.
- Après 5 codes faux, le PIN est supprimé et le mot de passe est de nouveau demandé.
- Chaque utilisateur voit la liste de ses appareils et peut les révoquer.

**Alerte insuline.** Le schéma de correction se saisit dans *Signes vitaux → Schéma de correction*. Chaque palier va de la valeur « De » (incluse) à la valeur « Jusqu'à » (exclue). Quand on saisit une glycémie, le palier correspondant s'affiche en rouge avec les unités prévues, accompagné d'un son d'alerte. L'application ne fait aucun calcul : elle affiche uniquement le schéma saisi.

**Thèmes de saison.** En mode *Automatique*, la saison suit la date :

| Thème | Période |
|---|---|
| Halloween | 15 oct. → 1er nov. |
| Noël | 1er → 26 déc. |
| Pâques | semaine de Pâques |
| Saisons | le reste de l'année |

Ces thèmes ajoutent seulement des emojis et une mélodie. Ils ne changent pas les couleurs.

- **Emojis qui se baladent** : ils parcourent tout le site. Chaque utilisateur règle leur **quantité** (0 à 60) et leur **vitesse** (0 à 10) dans *Mon compte → Apparence*. L'animation se met en pause quand l'onglet est caché.
- **Choix des emojis** : l'admin les définit pour chaque saison dans *Administration → Emojis des thèmes de saison*, avec un bouton d'aperçu. Une case vide reprend les emojis par défaut.

**Couleurs.** Chaque thème (rouge, bleu, vert, magenta) teinte tout le site : fond, surfaces, bordures, textes et accents, en mode clair comme en mode sombre. Les couleurs d'état (validé / attention / danger) restent fixes pour garder leur sens.

**Notifications.** Chaque matin vers 8h, un email part à chaque utilisateur :
- une première fois quand une ordonnance entre dans la fenêtre d'alerte (15 jours par défaut) ;
- une seconde fois le jour de son expiration.

Si la validité de l'ordonnance est modifiée, l'alerte repart à zéro.

**Installation sur téléphone.** Le site est une PWA. Pour l'ajouter à l'écran d'accueil :
- **iPhone** : Safari → Partager → *Sur l'écran d'accueil* ;
- **Android** : Chrome → ⋮ → *Installer l'application*.

---

## Logo et favicon

1. Renseigne les liens dans **Administration → Paramètres**. Le changement est immédiat, sans redéployer.
2. Pour l'icône de l'application installée sur téléphone, remplace aussi `icon.svg`. L'idéal est d'ajouter `icon-192.png` et `icon-512.png`, puis de les référencer dans `manifest.json`.

## Sécurité

- Les mots de passe sont hachés (SHA-256 itéré + sel unique). Ils ne sont jamais stockés en clair.
- Les sessions durent 30 jours avec « Rester connecté ». Sans cette option, elles se terminent à la fermeture du navigateur.
- Après 5 tentatives de connexion ratées, le compte est bloqué 15 minutes.
- Les photos sont servies par l'API après un contrôle d'accès. Les fichiers Drive restent privés.
- L'admin peut consulter les autres comptes en **lecture seule**.
- Il s'agit d'un outil de suivi personnel, pas d'un dispositif médical. Les valeurs de référence des graphiques (`APP_CONFIG.REFERENCES` dans `js/config.js`) sont indicatives et peuvent être ajustées.

## Structure

```
index.html · manifest.json · sw.js · icon.svg
css/   themes.css (couleurs, sombre, daltonien) · style.css
js/    config · ui · api · sons · saisons · themes · photos · export · router · app
js/pages/  accueil · medicaments · signes · ordonnances · notes · compte · admin
apps-script/  Code · Data · Auth · Photos · Notifs · Setup (.gs) · appsscript.json
```