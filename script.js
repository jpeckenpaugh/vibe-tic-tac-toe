
    const boardEl = document.getElementById('board');
    const statusEl = document.getElementById('status');
    const resetBtn = document.getElementById('reset');
    const startBtn = document.getElementById('start');
    const titleScreen = document.getElementById('title-screen');
    const gameEl = document.getElementById('game');
    const gameOverEl = document.getElementById('game-over');
    const gameOverTitle = document.getElementById('game-over-title');
    const leaderboardBtn = document.getElementById('leaderboard-btn');
    const leaderboardEl = document.getElementById('leaderboard');
    const leaderboardClose = document.getElementById('leaderboard-close');
    const lbX = document.getElementById('lb-x');
    const lbO = document.getElementById('lb-o');
    const lbDraws = document.getElementById('lb-draws');
    const playAgainBtn = document.getElementById('play-again');
    const toMenuBtn = document.getElementById('to-menu');
    const aboutBtn = document.getElementById('about-btn');
    const aboutEl = document.getElementById('about');
    const aboutClose = document.getElementById('about-close');
    const optionsBtn = document.getElementById('options-btn');
    const optionsEl = document.getElementById('options');
    const optionsClose = document.getElementById('options-close');
    const colorXInput = document.getElementById('color-x');
    const colorOInput = document.getElementById('color-o');
    const soundToggle = document.getElementById('sound-toggle');
    const resetStatsBtn = document.getElementById('reset-stats');
    const themeButtons = Array.from(document.querySelectorAll('.theme-option'));

    const SETTINGS_KEY = 'tic-tac-toe-settings';
    const themes = {
      default: { x: 'X', o: 'O' },
      cats: { x: '🐱', o: '🐶' },
      stars: { x: '⭐', o: '🌙' },
      swords: { x: '⚔️', o: '🛡️' },
      hearts: { x: '❤️', o: '💙' },
      food: { x: '🍕', o: '🍔' }
    };
    let settings = loadSettings();

    function loadSettings() {
      try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        const data = raw ? JSON.parse(raw) : {};
        return {
          theme: data.theme || 'default',
          colorX: data.colorX || '#2563eb',
          colorO: data.colorO || '#dc2626',
          sound: data.sound !== false
        };
      } catch (e) {
        return { theme: 'default', colorX: '#2563eb', colorO: '#dc2626', sound: true };
      }
    }

    function saveSettings() {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }

    function getSymbol(player) {
      const theme = themes[settings.theme] || themes.default;
      return theme[player.toLowerCase()] || player;
    }

    function applySettings() {
      const root = document.documentElement;
      root.style.setProperty('--color-x', settings.colorX);
      root.style.setProperty('--color-o', settings.colorO);
      soundToggle.checked = settings.sound;
      colorXInput.value = settings.colorX;
      colorOInput.value = settings.colorO;
      themeButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === settings.theme);
      });
      if (gameEl.classList.contains('show')) {
        render();
      }
    }

    let audioCtx = null;
    function ensureAudio() {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      return audioCtx;
    }
    function playTone(freq, duration, type, gainValue, when) {
      try {
        const ctx = ensureAudio();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = ctx.currentTime + (when || 0);
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(gainValue || 0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + duration);
      } catch (e) {}
    }
    function playMove() {
      if (!settings.sound) return;
      playTone(440, 0.08, 'triangle', 0.15);
    }
    function playWin() {
      if (!settings.sound) return;
      playTone(523, 0.15, 'sine', 0.2);
      playTone(659, 0.15, 'sine', 0.2, 0.15);
      playTone(784, 0.25, 'sine', 0.2, 0.3);
    }
    function playDraw() {
      if (!settings.sound) return;
      playTone(330, 0.12, 'sine', 0.15);
      playTone(294, 0.2, 'sine', 0.15, 0.15);
    }

    const STORAGE_KEY = 'tic-tac-toe-stats';
    let stats = loadStats();

    function loadStats() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const data = raw ? JSON.parse(raw) : {};
        return {
          x: data.x || 0,
          o: data.o || 0,
          draws: data.draws || 0
        };
      } catch (e) {
        return { x: 0, o: 0, draws: 0 };
      }
    }

    function saveStats() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    }

    function recordResult(winner) {
      if (winner === 'X') stats.x++;
      else if (winner === 'O') stats.o++;
      else stats.draws++;
      saveStats();
    }

    let board = Array(9).fill(null);
    let currentPlayer = 'X';
    let gameOver = false;
    let winningLine = null;
    let lastMove = null;

    const winLines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];

    function render() {
      boardEl.innerHTML = '';
      board.forEach((value, i) => {
        const cell = document.createElement('button');
        const isWinCell = winningLine && winningLine.includes(i);
        cell.className = 'cell'
          + (value ? ' ' + value.toLowerCase() : '')
          + (isWinCell ? ' win' : '')
          + (winningLine && !isWinCell ? ' dim' : '')
          + (i === lastMove ? ' placed' : '');
        cell.textContent = value ? getSymbol(value) : '';
        cell.disabled = !!value || gameOver;
        if (!value && !gameOver) {
          cell.classList.add('preview');
          cell.style.setProperty('--preview', getSymbol(currentPlayer));
        }
        cell.addEventListener('click', () => handleMove(i));
        boardEl.appendChild(cell);
      });
    }

    function checkWinner() {
      for (const line of winLines) {
        const [a, b, c] = line;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
          return line;
        }
      }
      return null;
    }

    function showGameOver(title, colorClass) {
      gameOverTitle.textContent = title;
      gameOverTitle.className = colorClass;
      gameOverEl.classList.add('show');
    }
    function hideGameOver() {
      gameOverEl.classList.remove('show');
    }

    function playAgain() {
      hideGameOver();
      reset();
    }

    function toMenu() {
      hideGameOver();
      gameEl.classList.remove('show');
      titleScreen.classList.remove('hide');
    }

    function showLeaderboard() {
      lbX.textContent = stats.x;
      lbO.textContent = stats.o;
      lbDraws.textContent = stats.draws;
      leaderboardEl.classList.add('show');
    }

    function hideLeaderboard() {
      leaderboardEl.classList.remove('show');
    }

    function showAbout() {
      aboutEl.classList.add('show');
    }

    function hideAbout() {
      aboutEl.classList.remove('show');
    }

    function showOptions() {
      applySettings();
      optionsEl.classList.add('show');
    }

    function hideOptions() {
      optionsEl.classList.remove('show');
    }

    function resetStats() {
      if (confirm('Reset all leaderboard stats?')) {
        stats = { x: 0, o: 0, draws: 0 };
        saveStats();
      }
    }

    function handleMove(i) {
      if (board[i] || gameOver) return;
      board[i] = currentPlayer;
      lastMove = i;
      const winLine = checkWinner();
      if (winLine) {
        gameOver = true;
        winningLine = winLine;
        statusEl.textContent = getSymbol(currentPlayer) + ' wins!';
        recordResult(currentPlayer);
        playWin();
        render();
        spawnConfetti();
        showGameOver(getSymbol(currentPlayer) + ' wins!', currentPlayer.toLowerCase());
      } else if (board.every(cell => cell)) {
        gameOver = true;
        statusEl.textContent = "It's a draw!";
        recordResult(null);
        playDraw();
        render();
        showGameOver("It's a draw!", '');
      } else {
        playMove();
        currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
        statusEl.textContent = getSymbol(currentPlayer) + "'s turn";
        render();
      }
    }

    function spawnConfetti() {
      const colors = ['#2563eb', '#dc2626', '#22c55e', '#f59e0b', '#a855f7', '#ec4899'];
      for (let n = 0; n < 60; n++) {
        const piece = document.createElement('div');
        piece.className = 'confetti';
        piece.style.left = (Math.random() * 100) + 'vw';
        piece.style.width = (6 + Math.random() * 6) + 'px';
        piece.style.height = (10 + Math.random() * 8) + 'px';
        piece.style.background = colors[Math.floor(Math.random() * colors.length)];
        piece.style.animationDuration = (1.6 + Math.random() * 1.6) + 's';
        piece.style.animationDelay = (Math.random() * 0.6) + 's';
        document.body.appendChild(piece);
        piece.addEventListener('animationend', () => piece.remove());
      }
    }

    function reset() {
      board = Array(9).fill(null);
      currentPlayer = 'X';
      gameOver = false;
      winningLine = null;
      lastMove = null;
      statusEl.textContent = getSymbol('X') + "'s turn";
      render();
    }

    function startGame() {
      titleScreen.classList.add('hide');
      gameEl.classList.add('show');
      reset();
    }

    startBtn.addEventListener('click', startGame);
    resetBtn.addEventListener('click', reset);
    leaderboardBtn.addEventListener('click', showLeaderboard);
    leaderboardClose.addEventListener('click', hideLeaderboard);
    playAgainBtn.addEventListener('click', playAgain);
    toMenuBtn.addEventListener('click', toMenu);
    aboutBtn.addEventListener('click', showAbout);
    aboutClose.addEventListener('click', hideAbout);
    optionsBtn.addEventListener('click', showOptions);
    optionsClose.addEventListener('click', hideOptions);

    themeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        settings.theme = btn.dataset.theme;
        saveSettings();
        applySettings();
      });
    });

    colorXInput.addEventListener('input', () => {
      settings.colorX = colorXInput.value;
      saveSettings();
      applySettings();
    });
    colorOInput.addEventListener('input', () => {
      settings.colorO = colorOInput.value;
      saveSettings();
      applySettings();
    });

    soundToggle.addEventListener('change', () => {
      settings.sound = soundToggle.checked;
      saveSettings();
    });

    resetStatsBtn.addEventListener('click', resetStats);

    applySettings();
  