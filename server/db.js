const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./trivia.db');

// Créer la table des questions si elle n'existe pas
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      reponse1 TEXT NOT NULL,
      reponse2 TEXT NOT NULL,
      reponse3 TEXT NOT NULL,
      reponse4 TEXT NOT NULL,
      bonne_reponse INTEGER NOT NULL
    )
  `);

  // Ajouter des questions avec des réponses et la bonne réponse
  const insert = db.prepare(`
    INSERT INTO questions (question, reponse1, reponse2, reponse3, reponse4, bonne_reponse)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // Insère plusieurs questions à la fois
  insert.run('Quelle est la capitale de la France?', 'Paris', 'Londres', 'Berlin', 'Madrid', 1);  // 1 est l'index de la bonne réponse (Paris)
  insert.run('Combien de continents y a-t-il ?', '5', '6', '7', '8', 3);  // 3 est l'index de la bonne réponse (7)
  insert.run('Qui a écrit "Les Misérables" ?', 'Victor Hugo', 'Emile Zola', 'Molière', 'Balzac', 1);  // 1 est l'index de la bonne réponse (Victor Hugo)
  insert.run('Quel est le plus grand océan ?', 'Atlantique', 'Indien', 'Arctique', 'Pacifique', 4);  // 4 est l'index de la bonne réponse (Pacifique)

  insert.finalize();  // Finalise l'insertion
});

module.exports = db;
