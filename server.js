const express = require('express');
const path = require('path');
const levels = require('./data/words.json');

// Tous les thèmes à plat, pour retrouver facilement un thème par son id.
const allThemes = levels.flatMap((level) => level.themes);

const app = express();
// Render fournit le port via la variable PORT ; 3000 en local.
const PORT = process.env.PORT || 3000;

// Sert les fichiers du site (HTML, CSS, JS).
app.use(express.static(path.join(__dirname, 'public')));

// Liste des niveaux et de leurs thèmes, sans les mots (plus léger pour l'accueil).
app.get('/api/levels', (req, res) => {
  const summary = levels.map((level) => ({
    id: level.id,
    name: level.name,
    emoji: level.emoji,
    themes: level.themes.map(({ id, name, emoji, color, words }) => ({
      id,
      name,
      emoji,
      color,
      count: words.length,
    })),
  }));
  res.json(summary);
});

// Un thème complet avec ses mots.
app.get('/api/themes/:id', (req, res) => {
  const theme = allThemes.find((t) => t.id === req.params.id);
  if (!theme) {
    return res.status(404).json({ error: 'Thème introuvable' });
  }
  res.json(theme);
});

app.listen(PORT, () => {
  console.log(`FlipEnglish est lancé sur http://localhost:${PORT}`);
});
