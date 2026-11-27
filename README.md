<img src="assets/logo.png" width="200" alt="OnyxChess Logo">
OnyxChess
build a chess engine from scratch

this website is to demonstrate another project i made @ https://github.com/sarthak-wadhawan/onyxchess

this is a tutorial on how to build a chess engine and the chess game from scratch. [Live Link](https://genius-navy-zeta.vercel.app/)<br/>

### 1. Homepage

![GIF 1](gifs/Adobe%20Express%20-%201.gif)

### 2. Tutorials

![GIF 2](gifs/Adobe%20Express%20-%202.gif)

### 3. Play chess

![GIF 3](gifs/Adobe%20Express%20-%204.gif)

### 4. Undo, reset, change color, and move history

![GIF 4](gifs/Adobe%20Express%20-%205.gif)

index.html                  Homepage: edit its HTML directly.
tutorial/<lesson>/index.html  Each lesson: edit headings, paragraphs and lists directly.
play/index.html             Playable chess page.
css/style.css               Site layout, typography, colors and navigation.
css/chess.css               Chessboard, controls, evaluation and search tree styling.
js/hero.js                  Homepage title reveal, scroll-to-logo and cursor trail.
js/site.js                  Menu and search (the static full-text index is here).
js/chess.js                 Board interactions and search tree controls.
js/chess-engine.js          Chess rules, PeSTO evaluation and AI search.
assets/                     Logo and original images.
notices.txt                 Third-party attribution.

To edit a page, open its HTML in your editor and save. Reload the browser.
To add/remove a lesson, copy/delete a lesson folder and update the navigation,
links and search index in js/site.js. Board configurations are in the HTML
as data-chess-demo attributes. All game rules are shared, not duplicated.

For Vercel, select Other as the framework; leave build command unset and use
project root as output. No environment variables or API keys are required.
Homepage: the title reveals on load, the description fades in, and scrolling fades
the description out as the title shrinks into the logo.
Chess pieces follow the pointer only on the hero; pause controls only the pieces.
The tutorial focuses on chess and its algorithms. All 13 pages remain.
No Astro runtime or generated preview folders.

Play chess: Settings contains your color and search depth. The Move history panel
opens a larger dialog; each individual move displays its saved position without
changing the live game. Use the last arrow to return to the latest position.
Reset starts a new game. The result appears when a game finishes.
The homepage Play chess link is after the tutorial; adjust .play-bottom in
css/style.css to change its spacing.
