# Tic-Tac-Toe Liquid Premium v4.5.0

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A modern, premium take on the classic Tic-Tac-Toe game. Built with vanilla HTML, CSS, and JavaScript, featuring a **clean monolithic architecture** and stunning iOS "Liquid Glass" design language. Optimized for Telegram WebApp deployment.

## Features

- **Liquid Glass UI:** Deep dark backgrounds, frosted glass panels (`backdrop-filter: blur`), glowing neon accents, and dynamic micro-interactions.
- **Responsive Design:** Optimized for all screen sizes, including safe areas for iPhone 15/16 Pro Max and Telegram WebApps.
- **3 Themes:** Light, Dark, and Premium Gold (purchasable via Telegram Stars).
- **Game Modes:**
  - 1 vs 1 (Local & P2P Online)
  - 1 vs AI (4 difficulty levels: Easy, Normal, Hard, Unbeatable)
  - 3 Players & 4 Players local multiplayer.
- **Super Mode:** Draft-based ability system with 10 unique powers (Thor's Strike, Hacking, Blitzkrieg, etc.) and synchronized 20-second draft phase.
- **P2P Multiplayer:** WebRTC-based networking via PeerJS with room creation, link sharing, and real-time synchronization.
- **Customizable Boards:** Play on grids from 3x3 up to 10x10 with adjustable win conditions (3-5 in a row).
- **Immersive Feedback:** Web Audio API synthesized sounds (zero external files) and haptic feedback (Navigator Vibrate + Telegram Taptic Engine).
- **Confetti Victory:** Canvas particle system for winning moments.
- **Multi-language Support:** English, Russian, and Uzbek.
- **Career System:** XP-based leveling for PvE games.
- **Developer Console:** Built-in admin panel with network diagnostics and premium unlock controls.

## Architecture (v4.5.0 Clean Monolith)

```
tic-tac-toe-liquid/
├── index.html        # Main entry point (semantic HTML5)
├── css/
│   └── style.css     # Design system: Liquid Glass 4.0 + Gold Theme
└── js/
    └── game.js       # Monolithic engine: Audio, Haptic, Confetti, Storage,
                      # AI, Game, P2P Network, Super Mode, Monetization, Admin
```

### Key Architecture Principles

- **Zero Layout Thrashing:** DOM modifications batched via `requestAnimationFrame` with `DocumentFragment`.
- **Cached DOM References:** All elements resolved once during bootstrap in a single `DOM` object.
- **Deep-Clone Safety:** Settings snapshots via `JSON.parse(JSON.stringify())` to prevent mutations.
- **Zero External Audio Files:** All sounds synthesized via Web Audio API oscillators.
- **Rolling P2P Diagnostic Log:** Last 50 packets with timestamps for live debugging.

## Getting Started

Since the project uses a standard `<script>` tag, you can run it via any local web server.

### Option 1: Live Server (VS Code)
1. Open the project in VS Code.
2. Install the **Live Server** extension.
3. Right-click on `index.html` and select **Open with Live Server**.

### Option 2: Node.js (http-server)
```bash
npx http-server
```
Open the provided URL in your browser (usually `http://localhost:8080`).

## Tech Stack

- **HTML5** (Semantic structure)
- **Vanilla CSS3** (CSS Variables, Flexbox, Grid, Animations, Backdrop Filter)
- **Vanilla JavaScript** (ES6+, DOM Manipulation, Web Audio API)
- **PeerJS** (WebRTC P2P networking via CDN)
- **Canvas API** (Confetti particle effects)
- **Navigator Vibrate API** + **Telegram WebApp Taptic Engine**

## License

This project is open-source and available under the MIT License.
