const gameModes = ['legal', 'game', 'best', 'compare'];
const signed = number => number > 0 ? '+' + number : String(number);

function mountBoards() {
  for (const root of document.querySelectorAll('[data-chess-demo]')) {
    mountBoard(root);
  }
}

// Each board owns its position, selection, game history and controls.
function mountBoard(root) {
  const config = JSON.parse(root.dataset.chessDemo);
  const mode = config.mode || 'geometry';
  const initial = positionMap(config.position);
  const legalMode = gameModes.includes(mode);
  const startingFen = config.position === 'start' ? START : config.position;
  const game = legalMode ? new Chess(startingFen) : null;
  const board = root.querySelector('.demo-board');
  const status = root.querySelector('[data-board-status]');
  // Create the same accessible 8 × 8 grid for every example.
  const grid = board.querySelector('.fallback-board');
  squares.forEach((square, index) => {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.dataset.square = square;
    cell.className = 'demo-square ' + ((Math.floor(index / 8) + index % 8) % 2 ? 'dark-square' : 'light-square');
    const piece = document.createElement('span');
    piece.className = 'piece';
    piece.setAttribute('aria-hidden', 'true');
    cell.append(piece);
    grid.append(cell);
  });
  const select = root.querySelector('[data-piece]');
  const phaseSelect = root.querySelector('[data-phase]');
  const promotion = root.querySelector('[data-promotion]');
  const history = root.querySelector('[data-history]');
  const detail = root.querySelector('[data-detail]');
  const undo = root.querySelector('[data-undo]');
  const analyze = root.querySelector('[data-analyze]');
  const depthSelect = root.querySelector('[data-depth]');

  const colorSelect = root.querySelector('[data-player-color]');
  let playerColor = 'w';
  let flipped = false;
  let position = { ...initial };
  let origin = config.origin || null;
  let last = null;
  let pending = null;
  let busy = false;
  let token = 0;
  let phase = 'mg';
  let selectedPiece = config.piece || 'N';

  // History is a display-only timeline; the engine always keeps its live position.
  const historyDialog = root.querySelector('[data-history-dialog]');
  const settingsDialog = root.querySelector('[data-settings-dialog]');
  const moveLists = [...root.querySelectorAll('[data-move-list]')];
  const historySteps = [...root.querySelectorAll('[data-history-step]')];
  const resultBoxes = [...root.querySelectorAll('[data-game-result]')];
  const newGame = root.querySelector('[data-new-game]');
  let snapshots = mode === 'game' ? [{ fen: game.fen(), move: null, notation: '' }] : [];
  let reviewIndex = null; // null means the live position; zero is the starting position.
  let renderedSnapshots = null;
  let wasFinished = false;
  const reviewing = () => reviewIndex !== null;
  const currentIndex = () => reviewIndex ?? snapshots.length - 1;

  // Standard algebraic notation (including captures, disambiguation and check).
  function notationFor(move) {
    if (move.flags === 'k') return 'O-O';
    if (move.flags === 'q') return 'O-O-O';
    const capture = Boolean(move.captured) || move.flags === 'e';
    let name = move.piece === 'p' ? (capture ? move.from[0] : '') : move.piece.toUpperCase();
    if (move.piece !== 'p') {
      const alternatives = game.moves({ verbose: true }).filter(other =>
        other.piece === move.piece && other.to === move.to && other.from !== move.from);
      if (alternatives.length) {
        if (!alternatives.some(other => other.from[0] === move.from[0])) name += move.from[0];
        else if (!alternatives.some(other => other.from[1] === move.from[1])) name += move.from[1];
        else name += move.from;
      }
    }
    return name + (capture ? 'x' : '') + move.to + (move.promotion ? '=' + move.promotion.toUpperCase() : '');
  }

  function playMove(move) {
    const notation = mode === 'game' ? notationFor(move) : '';
    const played = game.move({ from: move.from, to: move.to, promotion: move.promotion });
    if (mode === 'game') {
      const suffix = game.isCheckmate() ? '#' : game.isCheck() ? '+' : '';
      snapshots = [...snapshots, { fen: game.fen(), move: played, notation: notation + suffix }];
    }
    return played;
  }

  function showPosition(index) {
    if (mode !== 'game' || index < 0 || index >= snapshots.length) return;
    reviewIndex = index === snapshots.length - 1 ? null : index;
    origin = null;
    pending = null;
    if (promotion) promotion.hidden = true;
    paint();
  }

  function renderHistory() {
    if (mode !== 'game') return;
    // Rebuild only when a real move, undo or reset changes the timeline.
    const changed = renderedSnapshots !== snapshots;
    if (changed) {
      for (const list of moveLists) {
        list.replaceChildren();
        if (snapshots.length === 1) {
          const empty = document.createElement('p');
          empty.className = 'empty-history';
          empty.textContent = 'No moves yet';
          list.append(empty);
        }
        for (let index = 1; index < snapshots.length; index += 2) {
          const row = document.createElement('div');
          row.className = 'move-row';
          const number = document.createElement('span');
          number.textContent = String((index + 1) / 2) + '.';
          row.append(number);
          for (let offset = 0; offset < 2; offset++) {
            const item = snapshots[index + offset];
            if (!item) { row.append(document.createElement('span')); continue; }
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.moveIndex = String(index + offset);
            button.textContent = item.notation;
            button.setAttribute('aria-label', `${number.textContent} ${offset ? 'Black' : 'White'} ${item.notation}`);
            row.append(button);
          }
          list.append(row);
        }
      }
      renderedSnapshots = snapshots;
    }
    for (const list of moveLists) {
      for (const button of list.querySelectorAll('[data-move-index]')) {
        const active = Number(button.dataset.moveIndex) === currentIndex();
        if (active) button.setAttribute('aria-current', 'true');
        else button.removeAttribute('aria-current');
      }
      // Scroll the list, not the page; keep the selected move in view.
      const active = list.querySelector('[aria-current="true"]');
      if (active && list.clientHeight) {
        const itemBounds = active.getBoundingClientRect();
        const listBounds = list.getBoundingClientRect();
        if (itemBounds.bottom > listBounds.bottom) list.scrollTop += itemBounds.bottom - listBounds.bottom;
        if (itemBounds.top < listBounds.top) list.scrollTop -= listBounds.top - itemBounds.top;
      }
    }
    for (const button of historySteps) {
      const backward = ['first', 'previous'].includes(button.dataset.historyStep);
      button.disabled = backward ? currentIndex() === 0 : currentIndex() === snapshots.length - 1;
    }
    const result = game.isGameOver();
    const mate = game.isCheckmate();
    for (const box of resultBoxes) {
      box.hidden = !result;
      if (result) {
        box.querySelector('[data-result-title]').textContent = mate ? (game.turn() === 'w' ? 'Black wins' : 'White wins') : 'Draw';
        box.querySelector('[data-result-reason]').textContent = mate ? 'By checkmate' : game.isStalemate() ? 'By stalemate' : game.isInsufficientMaterial() ? 'Insufficient material' : game.isThreefoldRepetition() ? 'Threefold repetition' : '50-move rule';
      }
    }
    if (newGame) newGame.hidden = !result;
    // Announce a newly finished game once; reviewing old positions never reopens it.
    const justFinished = result && !wasFinished;
    wasFinished = result;
    if (justFinished && !reviewing() && historyDialog && !historyDialog.open && !settingsDialog?.open) {
      historyDialog.showModal();
    }
  }

  for (const list of moveLists) {
    list.addEventListener('click', event => {
      const move = event.target.closest('[data-move-index]');
      if (move) showPosition(Number(move.dataset.moveIndex));
    });
  }
  for (const button of historySteps) {
    button.addEventListener('click', () => {
      const index = currentIndex();
      const destinations = { first: 0, previous: index - 1, next: index + 1, last: snapshots.length - 1 };
      showPosition(destinations[button.dataset.historyStep]);
    });
  }
  root.querySelector('[data-open-history]')?.addEventListener('click', () => {
    historyDialog.showModal();
    renderHistory();
  });
  root.querySelector('[data-open-settings]')?.addEventListener('click', () => settingsDialog.showModal());
  newGame?.addEventListener('click', resetBoard);

  // Board orientation follows the player's color.
  function orientBoard(blackAtBottom) {
    if (flipped === blackAtBottom) return;
    flipped = blackAtBottom;
    const ranks = root.querySelector('.board-ranks');
    const fileLabels = root.querySelector('.board-files');
    for (const container of [grid, ranks, fileLabels]) {
      container.append(...Array.from(container.children).reverse());
    }
  }

  // Black's game starts with the computer's opening move.
  function hasPlayerMoved() {
    return game.history().length > (playerColor === 'b' ? 1 : 0);
  }

  colorSelect?.addEventListener('change', () => {
    playerColor = colorSelect.value;
    orientBoard(playerColor === 'b');
    resetBoard();
  });

  function targets() {
    if (!origin || reviewing()) return [];
    if (mode === 'geometry') return geometryTargets(origin, position);
    if (mode === 'attack') return geometryTargets(origin, position, true);
    if (game && !busy && !game.isGameOver() && (mode !== 'game' || game.turn() === playerColor)) {
      return game.moves({ square: origin, verbose: true }).map(move => move.to);
    }
    return [];
  }

  function paint() {
    if (game) position = positionMap(reviewing() ? snapshots[reviewIndex].fen : game.fen());
    const displayedLast = reviewing() ? snapshots[reviewIndex].move : last;
    if (mode === 'game') board.setAttribute('aria-disabled', String(reviewing()));
    const reached = new Set(targets());
    for (const cell of board.querySelectorAll('[data-square]')) {
      const square = cell.dataset.square;
      const piece = position[square];
      cell.classList.toggle('is-origin', square === origin);
      cell.classList.toggle('is-target', reached.has(square));
      cell.classList.toggle('is-last', Boolean(displayedLast && [displayedLast.from, displayedLast.to].includes(square)));
      cell.classList.toggle('has-piece', Boolean(piece));
      cell.classList.toggle('black-piece', piece?.[0] === 'b');
      cell.tabIndex = square === (origin || 'a1') ? 0 : -1;
      const name = piece ? `, ${piece[0] === 'w' ? 'white' : 'black'} ${pieceName[piece[1]]}` : '';
      cell.setAttribute('aria-label', square + name + (reached.has(square) ? ', reachable' : ''));
      const symbol = cell.querySelector('.piece');
      if (symbol) symbol.textContent = piece ? symbols['b' + piece[1]] : '';
    }
    updateStatus(reached.size);
    undo.disabled = busy || reviewing() || (mode === 'game' ? !hasPlayerMoved() : !game?.history().length);
    if (colorSelect) colorSelect.disabled = busy || hasPlayerMoved();
    analyze.disabled = busy || Boolean(game?.isGameOver());
    renderHistory();
  }

  function updateStatus(count) {
    if (game) {
      if (busy) status.textContent = 'Computer is thinking…';
      else if (game.isCheckmate()) status.textContent = (game.turn() === 'w' ? 'Black' : 'White') + ' wins by checkmate';
      else if (game.isStalemate()) status.textContent = 'Draw by stalemate';
      else if (game.isDraw()) status.textContent = 'Draw';
      else status.textContent = (game.turn() === 'w' ? 'White' : 'Black') + ' to move' + (game.isCheck() ? ' · Check' : '') + (origin ? ` · ${count} destinations` : '');
      if (mode === 'game') {
        status.textContent = `You play ${playerColor === 'w' ? 'White' : 'Black'} · ${status.textContent}`;
      }
      if (history) history.textContent = game.history().join('  ') || 'No moves yet';
    } else if (mode === 'coordinates') {
      status.textContent = origin ? `${origin}: index ${indexOfSquare(origin)} · rank ${Number(origin[1]) - 1} · file ${files.indexOf(origin[0])}` : 'Select any square.';
    } else if (mode === 'pesto') {
      paintHeatmap();
    } else if (mode === 'static') {
      status.textContent = config.status || (config.position === 'start' ? 'Starting position · 32 pieces' : `${Object.keys(position).length} pieces`);
    } else if (mode === 'attack') {
      status.textContent = origin ? `${pieceName[position[origin]?.[1]] || 'Piece'} on ${origin} attacks ${count} squares` : 'Select a piece.';
    } else {
      status.textContent = origin && position[origin] ? `${pieceName[position[origin][1]]} on ${origin} · ${count} reachable squares` : 'Select a piece.';
    }
  }

  function paintHeatmap() {
    const square = origin || 'd4';
    const piece = 'w' + selectedPiece;
    const { material, bonus } = pieceScore(piece, square, phase);
    status.textContent = `${square} · ${material} ${bonus < 0 ? '−' : '+'} ${Math.abs(bonus)} = ${material + bonus} cp`;
    for (const cell of board.querySelectorAll('[data-square]')) {
      const value = pieceScore(piece, cell.dataset.square, phase).bonus;
      cell.style.setProperty('--heat', String(Math.min(.75, Math.abs(value) / 140)));
      cell.classList.toggle('heat-plus', value >= 0);
      cell.classList.toggle('heat-minus', value < 0);
      const label = cell.querySelector('.heat-number') || document.createElement('span');
      label.className = 'heat-number';
      label.textContent = signed(value);
      if (!label.parentNode) cell.append(label);
    }
  }

  function finishMove(move) {
    last = playMove(move);
    origin = null;
    pending = null;
    if (promotion) promotion.hidden = true;
    paint();
    if (mode === 'game' && game.turn() !== playerColor && !game.isGameOver()) computer();
  }

  async function computer() {
    if (busy || game.turn() === playerColor || game.isGameOver()) return;
    busy = true;
    paint();
    const currentToken = ++token;
    const depth = Number(depthSelect.value || 2);
    const fen = game.fen();
    const computerColor = game.turn() === 'w' ? 'White' : 'Black';
    await new Promise(resolve => setTimeout(resolve, 30));
    if (currentToken !== token) return;
    try {
      const result = search(game, depth, { order: true });
      if (currentToken !== token || game.fen() !== fen) return;
      busy = false;
      if (result.move) {
        last = playMove(result.move);
        detail.textContent = `Computer: ${last.from}${last.to} · ${result.nodes} nodes · score ${signed(result.score)} cp (${computerColor})`;
      }
      paint();
    } catch (error) {
      busy = false;
      paint();
      detail.textContent = 'Search could not finish: ' + error.message;
    }
  }

  function choose(square) {
    if (busy || pending || reviewing() || mode === 'static') return;
    if (mode === 'coordinates') {
      origin = square;
      paint();
      return;
    }
    if (mode === 'pesto') {
      origin = square;
      position = { [square]: 'w' + selectedPiece };
      paint();
      return;
    }
    if (game) {
      if (game.isGameOver() || (mode === 'game' && game.turn() !== playerColor)) return;
      if (position[square]?.[0] === game.turn()) {
        origin = square;
        paint();
        return;
      }
      const options = origin ? game.moves({ square: origin, verbose: true }).filter(move => move.to === square) : [];
      if (options.length > 1) {
        pending = options;
        promotion.hidden = false;
        promotion.querySelector('button').focus();
      } else if (options.length === 1) finishMove(options[0]);
      return;
    }
    if (mode === 'geometry' && origin && targets().includes(square)) {
      position[square] = position[origin];
      delete position[origin];
      origin = square;
      paint();
    } else if (position[square]) {
      origin = square;
      paint();
    }
  }

  board.addEventListener('click', event => {
    const cell = event.target.closest('[data-square]');
    if (cell && board.contains(cell)) choose(cell.dataset.square);
  });
  board.addEventListener('keydown', event => {
    const cell = event.target.closest('[data-square]');
    if (!cell) return;
    const offsets = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    const shift = offsets[event.key];
    const square = cell.dataset.square;
    if (shift) {
      event.preventDefault();
      const direction = flipped ? -1 : 1;
      const file = files.indexOf(square[0]) + shift[0] * direction;
      const rank = Number(square[1]) + shift[1] * direction;
      if (file >= 0 && file < 8 && rank >= 1 && rank <= 8) {
        cell.tabIndex = -1;
        const next = board.querySelector(`[data-square="${files[file] + rank}"]`);
        next.tabIndex = 0;
        next.focus();
      }
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      choose(square);
      if (!pending) board.querySelector(`[data-square="${origin || square}"]`)?.focus();
    }
  });

  function resetBoard() {
    token++;
    busy = false;
    pending = null;
    if (promotion) promotion.hidden = true;
    origin = config.origin || null;
    position = { ...initial };
    last = null;
    if (game) game.load(startingFen);
    if (mode === 'game') {
      reviewIndex = null;
      snapshots = [{ fen: game.fen(), move: null, notation: '' }];
    }
    if (mode === 'pesto') {
      selectedPiece = config.piece || 'N';
      phase = 'mg';
      select.value = selectedPiece;
      phaseSelect.value = phase;
    }
    detail.textContent = '';
    paint();
    if (mode === 'game' && game.turn() !== playerColor && !game.isGameOver()) computer();
  }
  root.querySelector('[data-reset]').addEventListener('click', resetBoard);
  undo.addEventListener('click', () => {
    if (!game || busy || reviewing() || (mode === 'game' && !hasPlayerMoved())) return;
    game.undo();
    if (mode === 'game' && game.turn() !== playerColor && hasPlayerMoved()) game.undo();
    if (mode === 'game') snapshots = snapshots.slice(0, game.history().length + 1);
    pending = null;
    if (promotion) promotion.hidden = true;
    origin = null;
    last = mode === 'game' ? snapshots.at(-1).move : null;
    detail.textContent = '';
    paint();
  });
  promotion?.addEventListener('click', event => {
    if (!pending) return;
    const type = event.target.dataset.promote;
    if (type === 'cancel') {
      pending = null;
      if (promotion) promotion.hidden = true;
      paint();
      return;
    }
    const move = pending.find(candidate => candidate.promotion === type);
    if (move) finishMove(move);
  });
  select.addEventListener('change', () => {
    selectedPiece = select.value;
    position = { [origin || 'd4']: 'w' + selectedPiece };
    paint();
  });
  phaseSelect.addEventListener('change', () => {
    phase = phaseSelect.value;
    paint();
  });
  analyze.addEventListener('click', async () => {
    if (!game || busy) return;
    busy = true;
    const currentToken = ++token;
    paint();
    await new Promise(resolve => setTimeout(resolve, 20));
    if (currentToken !== token) return;
    try {
      const depth = Number(depthSelect.value);
      if (mode === 'compare') {
        const a = search(game, depth, { order: false });
        const b = search(game, depth, { order: true });
        detail.textContent = `Unordered: ${a.nodes} nodes, ${a.cutoffs} cutoffs. Ordered: ${b.nodes} nodes, ${b.cutoffs} cutoffs. Scores: ${a.score}, ${b.score} cp.`;
      } else {
        const result = search(game, depth, { order: true, allCandidates: true });
        const candidates = result.candidates.sort((a, b) => b.score - a.score);
        detail.textContent = candidates.map(move => `${move.move}: ${signed(move.score)} cp`).join('\n') + `\n${result.nodes} nodes. Best: ${result.move?.from || ''}${result.move?.to || ''}`;
        last = result.move;
      }
    } catch (error) {
      detail.textContent = error.message;
    }
    busy = false;
    paint();
  });

  paint();
}


function mountTrees() {
  for (const root of document.querySelectorAll('[data-tree]')) {
    mountTree(root);
  }
}

function mountTree(root) {
  const prune = root.dataset.tree === 'prune';
  const cells = [...root.querySelectorAll('[data-leaf]')];
  const branches = [...root.querySelectorAll('[data-branch]')];
  const output = root.querySelector('[data-tree-status]');
  const reverse = root.querySelector('[data-reverse]');
  const next = root.querySelector('[data-next]');
  const back = root.querySelector('[data-back]');
  let step = 0;
  let run;

  function update() {
    run = traceTree(cells.map(cell => Number(cell.value)), prune, reverse.checked);
    step = 0;
    draw();
  }

  function draw() {
    cells.forEach(cell => cell.parentElement.classList.remove('visited', 'skipped'));
    branches.forEach(branch => branch.textContent = '?');
    let event;
    for (event of run.events.slice(0, step)) {
      if (event.action === 'visit') cells[event.leaf].parentElement.classList.add('visited');
      if (event.action === 'skip') cells[event.leaf].parentElement.classList.add('skipped');
      if (event.action === 'return') branches[event.branch].textContent = event.beta;
    }
    root.querySelector('[data-root-score]').textContent = event && Number.isFinite(event.root) ? event.root : '?';
    if (!event) output.textContent = 'Choose Next to traverse the tree.';
    else if (step === run.events.length) output.textContent = `Result ${run.score} · ${run.visited} of 9 leaves evaluated`;
    else {
      const action = event.action === 'visit' ? 'Visit leaf ' + event.value : event.action === 'skip' ? 'Prune leaf' : 'Return branch ' + event.beta;
      const alpha = Number.isFinite(event.alpha) ? event.alpha : '−∞';
      const beta = Number.isFinite(event.beta) ? event.beta : '+∞';
      output.textContent = `${action} · α ${alpha} · β ${beta} · ${event.visited} leaves`;
    }
    next.disabled = step === run.events.length;
    back.disabled = step === 0;
  }

  next.addEventListener('click', () => { step++; draw(); });
  back.addEventListener('click', () => { step--; draw(); });
  root.querySelector('[data-run]').addEventListener('click', () => { step = run.events.length; draw(); });
  root.querySelector('[data-reset-tree]').addEventListener('click', update);
  reverse.addEventListener('change', update);
  cells.forEach(cell => cell.addEventListener('change', update));
  update();
}

mountBoards();
mountTrees();
