import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import './App.css';

const socket = io('http://localhost:5000');

function App() {
  const [username, setUsername] = useState('');
  const [sessionCode, setSessionCode] = useState('');
  const [gameState, setGameState] = useState('initial'); // 'initial', 'waiting', 'playing', 'finished'
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState([]);
  const [result, setResult] = useState('');
  const [players, setPlayers] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(10);
  const [errorTimeout, setErrorTimeout] = useState(null);

  const showError = (message, duration = 3000) => {
    if (errorTimeout) {
      clearTimeout(errorTimeout);
    }
    setError(message);
    const timeout = setTimeout(() => setError(''), duration);
    setErrorTimeout(timeout);
  };

  useEffect(() => {
    // Écouter la création de partie
    socket.on('gameCreated', (data) => {
      console.log('Partie créée:', data);
      if (data.sessionCode) {
        setSessionCode(data.sessionCode);
        setPlayers(data.players || []);
        setGameState('waiting');
        setIsHost(true);
        setError('');
      }
    });

    // Amélioration de la gestion de joinedGame
    socket.on('joinedGame', (data) => {
      console.log('Tentative de rejoindre la partie:', data);
      if (data.sessionCode) {
        setSessionCode(data.sessionCode);
        setPlayers(data.players || []);
        setGameState('waiting');
        setIsHost(false);
        setError('');
      }
    });

    // Amélioration de la gestion des joueurs
    socket.on('playerJoined', (data) => {
      console.log('Mise à jour des joueurs:', data);
      if (data.players) {
        setPlayers(data.players);
      }
    });

    // Écouter les questions
    socket.on('question', (data) => {
      setQuestion(data.question);
      setOptions(data.options);
      setResult('');
      setGameState('playing');
      setTimeLeft(10);
    });

    // Écouter les résultats
    socket.on('result', (data) => {
      setResult(data.message);
    });

    // Écouter la fin du jeu
    socket.on('gameOver', (data) => {
      setGameState('finished');
      setPlayers(data.players);
      setQuestion(data.message);
    });

    // Écouter les erreurs
    socket.on('error', (data) => {
      console.log('Erreur reçue:', data);
      let errorMessage = data.message;
      
      switch(data.message) {
        case 'Code de session invalide ou inexistant':
          errorMessage = '❌ Ce code de session n\'existe pas. Vérifiez le code et réessayez.';
          break;
        case 'La partie a déjà commencé':
          errorMessage = '⚠️ Impossible de rejoindre : la partie a déjà commencé.';
          break;
        case 'Ce pseudo est déjà utilisé dans cette partie':
          errorMessage = '⚠️ Ce pseudo est déjà pris. Choisissez-en un autre.';
          break;
        default:
          errorMessage = `❌ ${data.message}`;
      }
      showError(errorMessage);
    });

    // Écouter quand un joueur quitte
    socket.on('playerLeft', (data) => {
      setPlayers(data.players);
      showError(`👋 ${data.username} a quitté la partie`);
    });

    // Écouter quand l'hôte quitte
    socket.on('hostLeft', () => {
      showError("⚠️ L'hôte a quitté la partie. La partie va se terminer.", 5000);
      setTimeout(() => {
        setGameState('initial');
        setPlayers([]);
        setSessionCode('');
      }, 3000);
    });

    // Ajouter un événement pour écouter le démarrage du jeu
    socket.on('gameStarted', () => {
      setGameState('playing');
      setError('');
    });

    return () => {
      socket.off('gameCreated');
      socket.off('joinedGame');
      socket.off('playerJoined');
      socket.off('question');
      socket.off('result');
      socket.off('gameOver');
      socket.off('error');
      socket.off('playerLeft');
      socket.off('hostLeft');
      socket.off('gameStarted');
      if (errorTimeout) {
        clearTimeout(errorTimeout);
      }
    };
  }, [errorTimeout]);

  // Timer pour le compte à rebours
  useEffect(() => {
    let timer;
    if (gameState === 'playing' && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [gameState, timeLeft]);

  const createGame = (e) => {
    e.preventDefault();
    if (username.trim()) {
      console.log('Création de partie avec username:', username); // Debug
      socket.emit('createGame', { username: username.trim() });
    } else {
      setError('Veuillez entrer un pseudo');
    }
  };

  const joinGame = (e) => {
    e.preventDefault();
    const trimmedUsername = username.trim();
    const trimmedSessionCode = sessionCode.trim().toUpperCase();

    if (!trimmedUsername) {
      showError('⚠️ Veuillez entrer un pseudo');
      return;
    }

    if (trimmedUsername.length < 2) {
      showError('⚠️ Le pseudo doit contenir au moins 2 caractères');
      return;
    }

    if (!trimmedSessionCode) {
      showError('⚠️ Veuillez entrer un code de session');
      return;
    }

    if (trimmedSessionCode.length !== 6) {
      showError('⚠️ Le code de session doit contenir exactement 6 caractères');
      return;
    }

    console.log('Tentative de connexion:', {
      username: trimmedUsername,
      sessionCode: trimmedSessionCode
    });

    socket.emit('joinGame', {
      username: trimmedUsername,
      sessionCode: trimmedSessionCode
    });
  };

  const startGame = () => {
    if (sessionCode) {
      console.log('Démarrage de la partie:', sessionCode); // Debug
      socket.emit('startGame', { sessionCode: sessionCode });
    }
  };

  const handleAnswerClick = (answer) => {
    socket.emit('answer', { answer, sessionCode });
  };

  const getErrorClass = (errorMessage) => {
    if (errorMessage.includes('❌')) return 'error error-critical';
    if (errorMessage.includes('⚠️')) return 'error error-warning';
    if (errorMessage.includes('👋')) return 'error error-info';
    return 'error';
  };

  // Affichage selon l'état du jeu
  if (gameState === 'initial') {
    return (
      <div className="App">
        <h1>Trivia Game</h1>
        {error && (
          <div className={getErrorClass(error)}>
            {error}
          </div>
        )}
        <div className="form-container">
          <div className="form-section">
            <h2>Nouvelle Partie</h2>
            <form onSubmit={createGame}>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Votre pseudo"
                required
              />
              <button type="submit">Créer une partie</button>
            </form>
            {sessionCode && (
              <div className="session-info">
                <h3>Code de session généré :</h3>
                <div className="session-code">{sessionCode}</div>
                <p className="session-instruction">
                  Partagez ce code avec vos amis pour qu'ils puissent rejoindre la partie !
                </p>
              </div>
            )}
          </div>

          <div className="divider">OU</div>

          <div className="form-section">
            <h2>Rejoindre une partie</h2>
            <form onSubmit={joinGame}>
              <div className="input-group">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Votre pseudo"
                  required
                  minLength="2"
                  maxLength="20"
                />
              </div>
              <div className="input-group">
                <input
                  type="text"
                  value={sessionCode}
                  onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                  placeholder="Code de session (6 caractères)"
                  required
                  maxLength="6"
                  pattern="[A-Z0-9]{6}"
                  title="Le code doit contenir 6 caractères (lettres majuscules ou chiffres)"
                />
              </div>
              <button 
                type="submit"
                disabled={!username.trim() || !sessionCode.trim() || sessionCode.trim().length !== 6}
              >
                Rejoindre la partie
              </button>
            </form>
            {error && <p className="error">{error}</p>}
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'waiting') {
    return (
      <div className="App">
        <h1>Salle d'attente</h1>
        <div className="session-info">
          <h2>Code de session: {sessionCode}</h2>
          <div className="players-count">
            Joueurs connectés: {players?.length || 0}
          </div>
        </div>
        <div className="players-list">
          <h3>Joueurs :</h3>
          <ul>
            {Array.isArray(players) && players.map((player) => (
              <li key={player.id} className={player.id === socket.id ? 'current-player' : ''}>
                {player.username} 
                {player.id === socket.id && " (vous)"}
                {player.id === players[0]?.id && " (hôte)"}
              </li>
            ))}
          </ul>
        </div>
        {isHost && (
          <div className="start-game-section">
            <button 
              onClick={startGame}
              className="start-button"
              disabled={!Array.isArray(players) || players.length < 1}
            >
              Démarrer la partie ({Array.isArray(players) ? players.length : 0} joueur{players?.length !== 1 ? 's' : ''})
            </button>
            {players?.length === 1 && (
              <p className="solo-message">
                Vous pouvez jouer seul ou attendre d'autres joueurs
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  if (gameState === 'playing') {
    return (
      <div className="App">
        <h1>Trivia Game</h1>
        <div className="timer">Temps restant : {timeLeft}s</div>
        <div className="question-container">
          <h2>{question}</h2>
          {result && <p className={result.includes('Bonne') ? 'correct' : 'incorrect'}>{result}</p>}
          <div className="options-container">
            {options && options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleAnswerClick(option)}
                className="option-button"
                disabled={result !== ''}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
        <div className="scoreboard">
          <h3>Scores :</h3>
          <ul>
            {players && players.map((player) => (
              <li key={player.id}>
                {player.username}: {player.score} points
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (gameState === 'finished') {
    return (
      <div className="App">
        <h1>Partie terminée!</h1>
        <div className="final-scores">
          <h2>Classement final</h2>
          <ol>
            {players && players.map((player) => (
              <li key={player.id}>
                {player.username}: {player.score} points
              </li>
            ))}
          </ol>
        </div>
        <button onClick={() => window.location.reload()}>Nouvelle partie</button>
      </div>
    );
  }
}

export default App;
