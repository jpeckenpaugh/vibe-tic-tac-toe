# Tic-Tac-Toe

A simple single-page tic-tac-toe game built with plain HTML, CSS, and JavaScript — no frameworks or build tools required.

## Overview

Two players take turns placing their symbol on a 3x3 grid, trying to line up three in a row (horizontally, vertically, or diagonally). The first to do so wins; if the board fills with no winner, the game is a draw.

## Features

- Title screen with Start Game, Leaderboard, Options, and About
- Two-player local gameplay
- Responsive layout that scales to your viewport
- Persistent leaderboard tracking X wins, O wins, and draws
- Win-line highlight with color pop and dimming
- Hover preview of your next move
- Game-over overlay with Play Again and Menu
- Confetti celebration on a win
- Sound effects for moves, wins, and draws
- Options menu: piece themes (Classic, Cats & Dogs, Stars & Moon, etc.), symbol colors, and a sound toggle

## Getting Started

The game is a static site, so you can either open `index.html` directly in a browser or serve it with a simple web server.

### Option 1: Open directly

Double-click `index.html` to open it in your default browser.

### Option 2: Local web server

Run the included script to start a Python HTTP server on port 8080:

```bash
./run.sh
```

Then open http://localhost:8080 in your browser.

## Project Structure

```
tic-tac-toe/
├── index.html   # Page markup
├── style.css    # All styling
├── script.js    # Game logic
└── run.sh       # Launches a local web server
```

## How to Play

1. From the title screen, click **Start Game**.
2. Player X goes first; click an empty cell to place your mark.
3. The game announces the winner or a draw.
4. Choose **Play Again** for a rematch or **Menu** to return to the title screen.
5. Check the **Leaderboard** on the title screen to see cumulative results.

## Customization

Use the **Options** menu on the title screen to:

- Change the piece theme (e.g., Cats & Dogs, Stars & Moon)
- Choose custom colors for X and O
- Toggle sound effects on or off
- Reset the leaderboard stats

Your preferences and leaderboard are saved in your browser's local storage.
