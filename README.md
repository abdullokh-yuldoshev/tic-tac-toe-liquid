# Tic-Tac-Toe Liquid Premium 💧

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A modern, premium take on the classic Tic-Tac-Toe game. Built with vanilla HTML, CSS, and JavaScript, featuring a modular architecture and stunning iOS 26 "Liquid Glass" design language.

## 🌟 Features

- **Liquid Glass UI:** Soft gradients, deep blurs (`backdrop-filter`), and glassmorphism.
- **Responsive Design:** Optimized for all screen sizes, including safe areas for iPhone 15/16 Pro Max and Telegram WebApps.
- **Dark & Light Modes:** Seamless transition between themes.
- **Game Modes:** 
  - 1 vs 1
  - 1 vs AI (with 4 difficulty levels: Easy, Normal, Hard, Unbeatable)
  - 3 Players & 4 Players local multiplayer.
- **Customizable Boards:** Play on grids from 3x3 up to 10x10 with adjustable win conditions.
- **Immersive Feedback:** Web Audio API sound effects and haptic feedback.
- **Confetti Victory:** Particle system for winning moments.
- **Multi-language Support:** English, Russian, and Uzbek.

## 📂 Project Structure

This project has been refactored from a monolithic HTML file into a clean, modular structure:

```
tic-tac-toe-liquid/
├── index.html        # Main entry point (minimal markup)
├── css/
│   └── style.css     # Styles, themes, and animations
└── js/
    ├── game.js       # Core game logic, state machine, and DOM interactions
    ├── ai.js         # AI algorithms and move calculations
    ├── audio.js      # Web Audio API wrapper (Sfx)
    ├── confetti.js   # Canvas particle effects
    ├── haptic.js     # Vibration feedback module
    └── storage.js    # LocalStorage management
```

## 🚀 Getting Started

Since the project uses ES6 Modules (`<script type="module">`), you need to run it via a local web server (opening `index.html` directly via `file://` will cause CORS errors).

### Option 1: Live Server (VS Code)
1. Open the project in VS Code.
2. Install the **Live Server** extension.
3. Right-click on `index.html` and select **Open with Live Server**.

### Option 2: Node.js (http-server)
1. Install `http-server` globally (if you haven't):
   ```bash
   npm install -g http-server
   ```
2. Run it in the project directory:
   ```bash
   npx http-server
   ```
3. Open the provided URL in your browser (usually `http://localhost:8080`).

## 🛠 Tech Stack

- **HTML5** (Semantic structure)
- **Vanilla CSS3** (CSS Variables, Flexbox, Grid, Animations, Backdrop Filter)
- **Vanilla JavaScript** (ES6 Modules, DOM Manipulation)
- **Web Audio API**
- **Navigator Vibrate API**
- **Canvas API** (Confetti)

## 📄 License

This project is open-source and available under the MIT License.
