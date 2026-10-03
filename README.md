# FlipEnglish 🃏

Des flashcards ludiques pour apprendre ses premiers mots d'anglais, thème par thème.

## Lancer le site sur votre ordinateur

1. Installez [Node.js](https://nodejs.org) (version 18 ou plus récente).
2. Dans un terminal, placez-vous dans ce dossier puis lancez :

   ```bash
   npm install
   npm start
   ```

3. Ouvrez http://localhost:3000 dans votre navigateur.

## Ajouter ou modifier des mots

Tous les mots sont dans `data/words.json`. Chaque thème a un `id` (sans espace ni accent), un `name`, un `emoji`, une `color` et une liste `words` de paires `{ "fr": "...", "en": "..." }`. Redémarrez le serveur après une modification.

## Mettre le site en ligne avec GitHub et Render

1. Créez un dépôt sur GitHub et envoyez-y ce dossier.
2. Créez un compte gratuit sur [render.com](https://render.com) en vous connectant avec GitHub.
3. Cliquez sur **New → Web Service** et choisissez votre dépôt.
4. Réglages :
   - **Runtime** : Node
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
   - **Instance Type** : Free
5. Cliquez sur **Create Web Service**. Après quelques minutes, Render affiche l'adresse publique du site (en `.onrender.com`).

À chaque fois que vous envoyez une modification sur GitHub, Render remet le site à jour automatiquement.

> Sur l'offre gratuite, le site se met en veille après un moment sans visite : la première ouverture suivante peut prendre une trentaine de secondes.

## Structure

| Fichier | Rôle |
| --- | --- |
| `server.js` | Serveur Express : sert le site et l'API `/api/themes` |
| `data/words.json` | Les thèmes et leurs mots |
| `public/index.html` | La page (accueil, révision, bilan) |
| `public/style.css` | Le design |
| `public/script.js` | Les cartes, la prononciation et la progression |

La progression est enregistrée dans le navigateur (`localStorage`) : elle est propre à chaque appareil et aucun compte n'est nécessaire.
