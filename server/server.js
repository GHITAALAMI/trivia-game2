import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import sqlite3 from 'sqlite3';

// Crée l'application Express
const app = express();
const server = http.createServer(app);

// Crée un serveur Socket.io avec la configuration CORS
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000", // L'origine de ton frontend React
        methods: ["GET", "POST"],
    }
});

// Connexion à la base de données SQLite
const db = new sqlite3.Database('./trivia.db');

// Liste des questions
const questions = [
    {
        id: 1,
        question: "Quelle est la capitale de la France ?",
        options: ["Paris", "Londres", "Berlin", "Madrid"],
        correctAnswer: "Paris"
    },
    {
        id: 2,
        question: "Quel est le plus grand océan du monde ?",
        options: ["Océan Pacifique", "Océan Atlantique", "Océan Indien", "Océan Arctique"],
        correctAnswer: "Océan Pacifique"
    },
    {
        id: 3,
        question: "Qui a peint la Joconde ?",
        options: ["Leonard de Vinci", "Vincent van Gogh", "Pablo Picasso", "Michel-Ange"],
        correctAnswer: "Leonard de Vinci"
    },
    {
        id: 4,
        question: "Quelle est la planète la plus proche du soleil ?",
        options: ["Mercure", "Venus", "Mars", "Jupiter"],
        correctAnswer: "Mercure"
    },
    {
        id: 5,
        question: "Quel est l'élément chimique le plus abondant dans l'univers ?",
        options: ["Hydrogène", "Oxygène", "Carbone", "Hélium"],
        correctAnswer: "Hydrogène"
    },
    {
        id: 6,
        question: "En quelle année a eu lieu la Révolution française ?",
        options: ["1789", "1799", "1769", "1779"],
        correctAnswer: "1789"
    },
    {
        id: 7,
        question: "Quel est le plus grand mammifère terrestre ?",
        options: ["Éléphant d'Afrique", "Girafe", "Rhinocéros", "Hippopotame"],
        correctAnswer: "Éléphant d'Afrique"
    },
    {
        id: 8,
        question: "Quelle est la capitale du Japon ?",
        options: ["Tokyo", "Pékin", "Séoul", "Bangkok"],
        correctAnswer: "Tokyo"
    },
    {
        id: 9,
        question: "Qui a écrit 'Les Misérables' ?",
        options: ["Victor Hugo", "Émile Zola", "Gustave Flaubert", "Albert Camus"],
        correctAnswer: "Victor Hugo"
    },
    {
        id: 10,
        question: "Quel est le plus long fleuve du monde ?",
        options: ["Nil", "Amazone", "Mississippi", "Yangtsé"],
        correctAnswer: "Nil"
    }
];

// Exemple de route pour vérifier que le serveur fonctionne
app.get('/', (req, res) => {
    res.send('Server is running');
});

// Stockage des sessions de jeu
const gameSessions = new Map();

// Génère un code unique pour la session
function generateSessionCode() {
    let code;
    do {
        // Génère un code de 6 caractères en majuscules (lettres et chiffres)
        code = Math.random().toString(36).substring(2, 8).toUpperCase();
        console.log('Code généré:', code); // Debug
    } while (gameSessions.has(code)); // Vérifie si le code existe déjà
    return code;
}

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id); // Debug

    // Création d'une nouvelle session de jeu
    socket.on('createGame', ({ username }) => {
        try {
            const sessionCode = generateSessionCode();
            console.log('Création de nouvelle session:');
            console.log('Code généré:', sessionCode);
            console.log('Username:', username);

            const gameSession = {
                code: sessionCode,
                host: socket.id,
                hostUsername: username,
                players: [{
                    id: socket.id,
                    username: username,
                    score: 0
                }],
                started: false,
                currentQuestionIndex: 0,
                questions: questions.sort(() => Math.random() - 0.5).slice(0, 10)
            };

            gameSessions.set(sessionCode, gameSession);
            
            console.log('Session créée et stockée:');
            console.log('Toutes les sessions actives:', Array.from(gameSessions.keys()));
            console.log('Vérification de la session:', gameSessions.get(sessionCode) ? 'Existe' : 'N\'existe pas');

            socket.join(sessionCode);
            
            socket.emit('gameCreated', {
                sessionCode: sessionCode,
                players: gameSession.players
            });
        } catch (error) {
            console.error('Erreur lors de la création:', error);
            socket.emit('error', { message: 'Erreur lors de la création de la partie' });
        }
    });

    // Rejoindre une session existante
    socket.on('joinGame', ({ sessionCode, username }) => {
        try {
            sessionCode = sessionCode.toUpperCase();
            console.log('Tentative de connexion avec les données suivantes:');
            console.log('Code de session:', sessionCode);
            console.log('Username:', username);
            console.log('Toutes les sessions actives:', Array.from(gameSessions.keys()));
            
            const gameSession = gameSessions.get(sessionCode);
            
            if (!gameSession) {
                console.log('Session non trouvée pour le code:', sessionCode);
                socket.emit('error', { 
                    message: 'Code de session invalide ou inexistant',
                    details: `Code fourni: ${sessionCode}`
                });
                return;
            }

            console.log('Session trouvée:', {
                code: gameSession.code,
                players: gameSession.players,
                started: gameSession.started
            });

            if (gameSession.started) {
                socket.emit('error', { message: 'La partie a déjà commencé' });
                return;
            }

            // Vérifier si le pseudo n'est pas déjà utilisé dans cette session
            if (gameSession.players.some(player => player.username === username)) {
                socket.emit('error', { message: 'Ce pseudo est déjà utilisé dans cette partie' });
                return;
            }

            // Ajouter le nouveau joueur à la session
            const player = {
                id: socket.id,
                username: username,
                score: 0
            };

            gameSession.players.push(player);
            socket.join(sessionCode);

            // Informer TOUS les joueurs, y compris celui qui vient de rejoindre
            io.to(sessionCode).emit('playerJoined', {
                players: gameSession.players
            });

            // Confirmer au nouveau joueur
            socket.emit('joinedGame', {
                sessionCode,
                players: gameSession.players,
                isHost: false
            });

            console.log('Joueurs après ajout:', gameSession.players); // Debug

        } catch (error) {
            console.error('Erreur complète:', error);
            socket.emit('error', { message: 'Erreur lors de la connexion à la partie' });
        }
    });

    // Démarrer la partie
    socket.on('startGame', ({ sessionCode }) => {
        console.log('Tentative de démarrage de la partie:', sessionCode);
        const gameSession = gameSessions.get(sessionCode);
        
        if (gameSession && gameSession.host === socket.id) {
            // Vérifier qu'il y a au moins un joueur (l'hôte)
            if (gameSession.players.length >= 1) {
                console.log('Démarrage de la partie...');
                gameSession.started = true;
                
                // Informer tous les joueurs que la partie commence
                io.to(sessionCode).emit('gameStarted');
                
                // Envoyer la première question
                setTimeout(() => {
                    sendQuestion(sessionCode);
                }, 1000);
            } else {
                socket.emit('error', { message: 'Il faut au moins un joueur pour démarrer la partie' });
            }
        } else {
            console.log('Erreur de démarrage:', gameSession ? 'Pas l\'hôte' : 'Session non trouvée');
        }
    });

    // Gère la réponse du client
    socket.on('answer', ({ answer, sessionCode }) => {
        const gameSession = gameSessions.get(sessionCode);
        if (!gameSession) return;

        const currentQuestion = gameSession.questions[gameSession.currentQuestionIndex];
        const isCorrect = answer === currentQuestion.correctAnswer;
        
        // Mise à jour du score du joueur
        const player = gameSession.players.find(p => p.id === socket.id);
        if (player && isCorrect) {
            // Calcul du score basé sur le temps restant
            // Logique à implémenter plus tard
            player.score += 10;
        }

        socket.emit('result', {
            correct: isCorrect,
            message: isCorrect ? 'Bonne réponse!' : 'Mauvaise réponse...'
        });

        // Informer tous les joueurs des scores mis à jour
        io.to(sessionCode).emit('playerJoined', {
            players: gameSession.players
        });

        // Passe à la question suivante
        gameSession.currentQuestionIndex++;
        setTimeout(() => {
            sendQuestion(sessionCode);
        }, 1000);
    });

    // Logique de déconnexion du client
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        // Parcourir toutes les sessions pour trouver et retirer le joueur
        for (const [code, session] of gameSessions.entries()) {
            const playerIndex = session.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                // Retirer le joueur de la session
                const removedPlayer = session.players.splice(playerIndex, 1)[0];
                
                // Si c'était l'hôte, terminer la partie
                if (session.host === socket.id) {
                    io.to(code).emit('gameOver', { 
                        message: "L'hôte a quitté la partie",
                        players: session.players
                    });
                    gameSessions.delete(code);
                } else {
                    // Informer les autres joueurs
                    io.to(code).emit('playerLeft', {
                        username: removedPlayer.username,
                        players: session.players
                    });
                }
                
                // Si plus aucun joueur, supprimer la session
                if (session.players.length === 0) {
                    gameSessions.delete(code);
                }
                break;
            }
        }
    });
});

// Fonction pour envoyer une question à tous les joueurs d'une session
function sendQuestion(sessionCode) {
    const gameSession = gameSessions.get(sessionCode);
    if (!gameSession) return;

    if (gameSession.currentQuestionIndex < gameSession.questions.length) {
        const question = gameSession.questions[gameSession.currentQuestionIndex];
        io.to(sessionCode).emit('question', {
            question: question.question,
            options: question.options
        });
    } else {
        // Fin de la partie
        io.to(sessionCode).emit('gameOver', {
            message: 'Partie terminée!',
            players: gameSession.players.sort((a, b) => b.score - a.score)
        });
    }
}

// Démarre le serveur
server.listen(5000, () => {
    console.log('Server running on port 5000');
});
