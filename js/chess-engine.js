// Geometry for partial teaching positions, including boards without kings.
const files = 'abcdefgh';
const squares = Array.from({ length: 64 }, (_, index) => files[index % 8] + (8 - (index >> 3)));
const symbols = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟︎',
};
const pieceName = { K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight', P: 'pawn' };
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const indexOfSquare = square => (Number(square[1]) - 1) * 8 + files.indexOf(square[0]);

// Accept either a simple piece map or a FEN string.
function positionMap(position = {}) {
  if (typeof position !== 'string') return { ...position };
  if (position === 'start') position = START;
  const rows = position.split(' ')[0].split('/');
  const pieces = {};
  if (rows.length !== 8) throw Error('Expected eight FEN ranks');
  rows.forEach((row, index) => {
    let file = 0;
    for (const piece of row) {
      if (/^[1-8]$/.test(piece)) file += Number(piece);
      else if (/^[prnbqkPRNBQK]$/.test(piece) && file < 8) {
        const color = piece === piece.toUpperCase() ? 'w' : 'b';
        pieces[files[file++] + (8 - index)] = color + piece.toUpperCase();
      } else throw Error('Invalid FEN piece');
    }
    if (file !== 8) throw Error('Invalid FEN rank');
  });
  return pieces;
}

const straight = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const diagonal = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const knight = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];

function geometryTargets(origin, position, attacks = false) {
  const piece = position[origin];
  if (!piece) return [];
  const [color, type] = piece;
  const file = files.indexOf(origin[0]);
  const rank = Number(origin[1]);
  const destinations = [];
  const at = (x, y) => x >= 0 && x < 8 && y >= 1 && y <= 8 ? files[x] + y : null;

  // Pawns move straight, but attack diagonally.
  if (type === 'P') {
    const direction = color === 'w' ? 1 : -1;
    const one = at(file, rank + direction);
    const two = at(file, rank + 2 * direction);
    if (!attacks && one && !position[one]) {
      destinations.push(one);
      if (rank === (color === 'w' ? 2 : 7) && two && !position[two]) destinations.push(two);
    }
    for (const offset of [-1, 1]) {
      const square = at(file + offset, rank + direction);
      if (square && (attacks || (position[square] && position[square][0] !== color))) destinations.push(square);
    }
    return destinations;
  }

  const directions = type === 'N' ? knight : type === 'B' ? diagonal : type === 'R' ? straight : [...straight, ...diagonal];
  for (const [df, dr] of directions) {
    for (let distance = 1; distance < 8; distance++) {
      const square = at(file + df * distance, rank + dr * distance);
      if (!square) break;
      if (attacks || position[square]?.[0] !== color) destinations.push(square);
      if (position[square] || type === 'K' || type === 'N') break;
    }
  }
  return destinations;
}

const knightTargets = (square, position = {}) => geometryTargets(square, { ...position, [square]: position[square] || 'wN' });


// Values from the supplied C++ eval.cpp. Each row is one rank.
const tables = {
  mg: {
    p: [
         0,    0,    0,    0,    0,    0,    0,    0,
        98,  134,   61,   95,   68,  126,   34,  -11,
        -6,    7,   26,   31,   65,   56,   25,  -20,
       -14,   13,    6,   21,   23,   12,   17,  -23,
       -27,   -2,   -5,   12,   17,    6,   10,  -25,
       -26,   -4,   -4,  -10,    3,    3,   33,  -12,
       -35,   -1,  -20,  -23,  -15,   24,   38,  -22,
         0,    0,    0,    0,    0,    0,    0,    0,
    ],
    n: [
      -167,  -89,  -34,  -49,   61,  -97,  -15, -107,
       -73,  -41,   72,   36,   23,   62,    7,  -17,
       -47,   60,   37,   65,   84,  129,   73,   44,
        -9,   17,   19,   53,   37,   69,   18,   22,
       -13,    4,   16,   13,   28,   19,   21,   -8,
       -23,   -9,   12,   10,   19,   17,   25,  -16,
       -29,  -53,  -12,   -3,   -1,   18,  -14,  -19,
      -105,  -21,  -58,  -33,  -17,  -28,  -19,  -23,
    ],
    b: [
       -29,    4,  -82,  -37,  -25,  -42,    7,   -8,
       -26,   16,  -18,  -13,   30,   59,   18,  -47,
       -16,   37,   43,   40,   35,   50,   37,   -2,
        -4,    5,   19,   50,   37,   37,    7,   -2,
        -6,   13,   13,   26,   34,   12,   10,    4,
         0,   15,   15,   15,   14,   27,   18,   10,
         4,   15,   16,    0,    7,   21,   33,    1,
       -33,   -3,  -14,  -21,  -13,  -12,  -39,  -21,
    ],
    r: [
        32,   42,   32,   51,   63,    9,   31,   43,
        27,   32,   58,   62,   80,   67,   26,   44,
        -5,   19,   26,   36,   17,   45,   61,   16,
       -24,  -11,    7,   26,   24,   35,   -8,  -20,
       -36,  -26,  -12,   -1,    9,   -7,    6,  -23,
       -45,  -25,  -16,  -17,    3,    0,   -5,  -33,
       -44,  -16,  -20,   -9,   -1,   11,   -6,  -71,
       -19,  -13,    1,   17,   16,    7,  -37,  -26,
    ],
    q: [
       -28,    0,   29,   12,   59,   44,   43,   45,
       -24,  -39,   -5,    1,  -16,   57,   28,   54,
       -13,  -17,    7,    8,   29,   56,   47,   57,
       -27,  -27,  -16,  -16,   -1,   17,   -2,    1,
        -9,  -26,   -9,  -10,   -2,   -4,    3,   -3,
       -14,    2,  -11,   -2,   -5,    2,   14,    5,
       -35,   -8,   11,    2,    8,   15,   -3,    1,
        -1,  -18,   -9,   10,  -15,  -25,  -31,  -50,
    ],
    k: [
       -65,   23,   16,  -15,  -56,  -34,    2,   13,
        29,   -1,  -20,   -7,   -8,   -4,  -38,  -29,
        -9,   24,    2,  -16,  -20,    6,   22,  -22,
       -17,  -20,  -12,  -27,  -30,  -25,  -14,  -36,
       -49,   -1,  -27,  -39,  -46,  -44,  -33,  -51,
       -14,  -14,  -22,  -46,  -44,  -30,  -15,  -27,
         1,    7,   -8,  -64,  -43,  -16,    9,    8,
       -15,   36,   12,  -54,    8,  -28,   24,   14,
    ],
    material: [0, 82, 337, 365, 477, 1025, 20000],
  },
  eg: {
    p: [
         0,    0,    0,    0,    0,    0,    0,    0,
       178,  173,  158,  134,  147,  132,  165,  187,
        94,  100,   85,   67,   56,   53,   82,   84,
        32,   24,   13,    5,   -2,    4,   17,   17,
        13,    9,   -3,   -7,   -7,   -8,    3,   -1,
         4,    7,   -6,    1,    0,   -5,   -1,   -8,
        13,    8,    8,   10,   13,    0,    2,   -7,
         0,    0,    0,    0,    0,    0,    0,    0,
    ],
    n: [
       -58,  -38,  -13,  -28,  -31,  -27,  -63,  -99,
       -25,   -8,  -25,   -2,   -9,  -25,  -24,  -52,
       -24,  -20,   10,    9,   -1,   -9,  -19,  -41,
       -17,    3,   22,   22,   22,   11,    8,  -18,
       -18,   -6,   16,   25,   16,   17,    4,  -18,
       -23,   -3,   -1,   15,   10,   -3,  -20,  -22,
       -42,  -20,  -10,   -5,   -2,  -20,  -23,  -44,
       -29,  -51,  -23,  -15,  -22,  -18,  -50,  -64,
    ],
    b: [
       -14,  -21,  -11,   -8,   -7,   -9,  -17,  -24,
        -8,   -4,    7,  -12,   -3,  -13,   -4,  -14,
         2,   -8,    0,   -1,   -2,    6,    0,    4,
        -3,    9,   12,    9,   14,   10,    3,    2,
        -6,    3,   13,   19,    7,   10,   -3,   -9,
       -12,   -3,    8,   10,   13,    3,   -7,  -15,
       -14,  -18,   -7,   -1,    4,   -9,  -15,  -27,
       -23,   -9,  -23,   -5,   -9,  -16,   -5,  -17,
    ],
    r: [
        13,   10,   18,   15,   12,   12,    8,    5,
        11,   13,   13,   11,   -3,    3,    8,    3,
         7,    7,    7,    5,    4,   -3,   -5,   -3,
         4,    3,   13,    1,    2,    1,   -1,    2,
         3,    5,    8,    4,   -5,   -6,   -8,  -11,
        -4,    0,   -5,   -1,   -7,  -12,   -8,  -16,
        -6,   -6,    0,    2,   -9,   -9,  -11,   -3,
        -9,    2,    3,   -1,   -5,  -13,    4,  -20,
    ],
    q: [
        -9,   22,   22,   27,   27,   19,   10,   20,
       -17,   20,   32,   41,   58,   25,   30,    0,
       -20,    6,    9,   49,   47,   35,   19,    9,
         3,   22,   24,   45,   57,   40,   57,   36,
       -18,   28,   19,   47,   31,   34,   39,   23,
       -16,  -27,   15,    6,    9,   17,   10,    5,
       -22,  -23,  -30,  -16,  -16,  -23,  -36,  -32,
       -33,  -28,  -22,  -43,   -5,  -32,  -20,  -41,
    ],
    k: [
       -74,  -35,  -18,  -18,  -11,   15,    4,  -17,
       -12,   17,   14,   17,   17,   38,   23,   11,
        10,   17,   23,   15,   20,   45,   44,   13,
        -8,   22,   24,   27,   26,   33,   26,    3,
       -18,   -4,   21,   24,   27,   23,    9,  -11,
       -19,   -3,   11,   21,   23,   16,    7,   -9,
       -27,  -11,    4,   13,   14,    4,   -5,  -17,
       -53,  -34,  -21,  -11,  -28,  -14,  -24,  -43,
    ],
    material: [0, 94, 281, 297, 512, 936, 20000],
  },
};


const kinds = ' pnbrqk';
const weights = [0, 0, 1, 1, 2, 4, 0];

function pieceScore(piece, square, phase) {
  const color = piece[0];
  const type = piece[1].toLowerCase();
  const rank = Number(square[1]);
  const file = files.indexOf(square[0]);
  const index = (color === 'w' ? 8 - rank : rank - 1) * 8 + file;
  const table = tables[phase];
  return { material: table.material[kinds.indexOf(type)], bonus: table[type][index] };
}

// Blend middlegame and endgame evaluations according to remaining material.
function evaluatePosition(position) {
  let mg = 0;
  let eg = 0;
  let phase = 0;
  for (const [square, piece] of Object.entries(position)) {
    const middle = pieceScore(piece, square, 'mg');
    const end = pieceScore(piece, square, 'eg');
    const sign = piece[0] === 'w' ? 1 : -1;
    mg += sign * (middle.material + middle.bonus);
    eg += sign * (end.material + end.bonus);
    phase += weights[kinds.indexOf(piece[1].toLowerCase())];
  }
  phase = Math.min(24, phase);
  return { mg, eg, phase, score: Math.trunc((mg * phase + eg * (24 - phase)) / 24) };
}


const value = { p: 100, n: 200, b: 200, r: 300, q: 400, k: 500 };
const attacker = { p: 6, n: 5, b: 5, r: 4, q: 3, k: 2 };
const mvvLva = move => move.captured ? value[move.captured] * 10 + attacker[move.piece] : 0;
const scorePosition = (game, color) => evaluatePosition(positionMap(game.fen())).score * (color === 'w' ? 1 : -1);

// Adapted from Zhang Zeyu's chess-ai minimax / alpha-beta implementation (MIT).
// See notices.txt. The browser engine is independent of the C++ engine.
function search(game, depth, { prune = true, order = false, allCandidates = false } = {}) {
  const color = game.turn();
  const rootMoves = game.moves({ verbose: true });
  let nodes = 0;
  let cutoffs = 0;
  const sorted = moves => order ? moves.slice().sort((a, b) => mvvLva(b) - mvvLva(a)) : moves;

  function visit(remaining, alpha, beta, maximizing, ply) {
    nodes++;
    const children = game.moves({ verbose: true });
    if (!children.length) return game.isCheck() ? (maximizing ? -100000 + ply : 100000 - ply) : 0;
    if (game.isInsufficientMaterial() || game.isThreefoldRepetition() || Number(game.fen().split(' ')[4]) >= 100) return 0;
    if (remaining <= 0) return scorePosition(game, color);

    let best = maximizing ? -Infinity : Infinity;
    for (const move of sorted(children)) {
      game.move({ from: move.from, to: move.to, promotion: move.promotion });
      const score = visit(remaining - 1, alpha, beta, !maximizing, ply + 1);
      game.undo();
      if (maximizing) {
        best = Math.max(best, score);
        alpha = Math.max(alpha, best);
      } else {
        best = Math.min(best, score);
        beta = Math.min(beta, best);
      }
      if (prune && alpha >= beta) {
        cutoffs++;
        break;
      }
    }
    return best;
  }

  if (game.isGameOver()) return { move: null, score: game.isCheckmate() ? -100000 : 0, nodes, cutoffs, candidates: [] };
  let best = -Infinity;
  let bestMove = null;
  const candidates = [];
  for (const move of sorted(rootMoves)) {
    game.move({ from: move.from, to: move.to, promotion: move.promotion });
    const score = visit(Math.max(1, depth) - 1, allCandidates ? -Infinity : best, Infinity, false, 1);
    game.undo();
    candidates.push({ move: move.from + move.to + (move.promotion || ''), score });
    if (score > best) {
      best = score;
      bestMove = move;
    }
  }
  return { move: bestMove, score: best, nodes, cutoffs, candidates };
}

// Fixed teaching tree. Each recorded event is one step in the visualization.
function traceTree(leaves, prune = true, reverse = false) {
  const events = [];
  const branches = reverse ? [2, 1, 0] : [0, 1, 2];
  let alpha = -Infinity;
  let root = -Infinity;
  let visited = 0;
  for (const branch of branches) {
    let beta = Infinity;
    const list = reverse ? [2, 1, 0] : [0, 1, 2];
    for (let index = 0; index < list.length; index++) {
      const leaf = branch * 3 + list[index];
      const value = leaves[leaf];
      visited++;
      beta = Math.min(beta, value);
      events.push({ branch, leaf, value, beta, alpha, root, visited, action: 'visit' });
      if (prune && beta <= alpha) {
        for (const skipped of list.slice(index + 1)) {
          events.push({ branch, leaf: branch * 3 + skipped, beta, alpha, root, visited, action: 'skip' });
        }
        break;
      }
    }
    root = Math.max(root, beta);
    alpha = Math.max(alpha, root);
    events.push({ branch, beta, alpha, root, visited, action: 'return' });
  }
  return { events, score: root, visited };
}


// Full-game rules for the standalone browser engine.
const opposite = c => c === 'w' ? 'b' : 'w';
function parse(fen) { const [p, turn = 'w', rights = '-', ep = '-', half = '0', full = '1'] = fen.split(' '); return { p: positionMap(p), turn, rights, ep, half: +half, full: +full }; }
function encode(s) { let out = []; for (let r = 8; r >= 1; r--) {
    let row = '', n = 0;
    for (const f of files) {
        const p = s.p[f + r];
        if (!p)
            n++;
        else {
            if (n) {
                row += n;
                n = 0;
            }
            row += p[0] === 'w' ? p[1] : p[1].toLowerCase();
        }
    }
    if (n)
        row += n;
    out.push(row);
} return `${out.join('/')} ${s.turn} ${s.rights || '-'} ${s.ep} ${s.half} ${s.full}`; }
function attacked(s, sq, by) { return Object.entries(s.p).some(([from, p]) => p[0] === by && geometryTargets(from, s.p, true).includes(sq)); }
const check = (s, c = s.turn) => attacked(s, Object.keys(s.p).find(x => s.p[x] === c + 'K'), opposite(c));
function apply(s, m) {
    const p = { ...s.p };
    let rights = s.rights.replace('-', '');
    const remove = x => { rights = rights.replace(x, ''); };
    const piece = p[m.from];
    delete p[m.from];
    p[m.to] = m.promotion ? s.turn + m.promotion.toUpperCase() : piece;
    if (m.flags === 'e')
        delete p[m.to[0] + m.from[1]];
    if (m.flags === 'k' || m.flags === 'q') {
        const r = m.from[1], f = m.flags === 'k' ? 'h' : 'a', t = m.flags === 'k' ? 'f' : 'd';
        p[t + r] = p[f + r];
        delete p[f + r];
    }
    if (piece[1] === 'K') {
        remove(s.turn === 'w' ? 'K' : 'k');
        remove(s.turn === 'w' ? 'Q' : 'q');
    }
    const corners = { a1: 'Q', h1: 'K', a8: 'q', h8: 'k' };
    for (const sq of [m.from, m.to])
        if (corners[sq])
            remove(corners[sq]);
    const ep = piece[1] === 'P' && Math.abs(+m.from[1] - +m.to[1]) === 2 ? m.from[0] + ((+m.from[1] + +m.to[1]) / 2) : '-';
    return { p, turn: opposite(s.turn), rights, ep, half: piece[1] === 'P' || m.captured ? 0 : s.half + 1, full: s.full + (s.turn === 'b' ? 1 : 0) };
}
function legal(s) {
    const moves = [];
    for (const [from, p] of Object.entries(s.p)) {
        if (p[0] !== s.turn)
            continue;
        const type = p[1];
        const add = (to, flags = 'n', captured = s.p[to]?.[1]?.toLowerCase()) => { if (s.p[to]?.[1] === 'K')
            return; const base = { from, to, color: s.turn, piece: type.toLowerCase(), flags, ...(captured ? { captured } : {}) }; if (type === 'P' && /[18]$/.test(to)) {
            for (const promotion of 'qrbn')
                moves.push({ ...base, promotion, flags: 'p' });
        }
        else
            moves.push(base); };
        for (const to of geometryTargets(from, s.p))
            add(to, s.p[to] ? 'c' : 'n');
        if (type === 'P' && s.ep !== '-' && Math.abs(files.indexOf(s.ep[0]) - files.indexOf(from[0])) === 1 && +s.ep[1] - +from[1] === (s.turn === 'w' ? 1 : -1) && !s.p[s.ep] && s.p[s.ep[0] + from[1]] === opposite(s.turn) + 'P')
            add(s.ep, 'e', 'p');
        const rank = s.turn === 'w' ? '1' : '8';
        if (type === 'K' && from === 'e' + rank && !check(s))
            for (const [flag, rook, path, cross, dest] of [['k', 'h', 'fg', 'fg', 'g'], ['q', 'a', 'bcd', 'dc', 'c']]) {
                const right = s.turn === 'w' ? flag.toUpperCase() : flag;
                if (s.rights.includes(right) && s.p[rook + rank] === s.turn + 'R' && [...path].every(f => !s.p[f + rank]) && [...cross].every(f => !attacked(s, f + rank, opposite(s.turn))))
                    add(dest + rank, flag);
            }
    }
    return moves.filter(m => !check(apply(s, m), s.turn));
}
function insufficient(s) { const other = Object.entries(s.p).filter(([, p]) => p[1] !== 'K'); return !other.length || (other.length === 1 && /[BN]/.test(other[0][1])) || (other.every(([, p]) => p[1] === 'B') && new Set(other.map(([sq]) => (files.indexOf(sq[0]) + Number(sq[1])) % 2)).size === 1); }
function repetitionKey(s) { const fields = encode(s).split(' '); if (s.ep !== '-' && !legal(s).some(m => m.flags === 'e'))
    fields[3] = '-'; return fields.slice(0, 4).join(' '); }
class Chess {
    constructor(fen = START) { this.load(fen); }
    load(fen) { this.s = parse(fen === 'start' ? START : fen); this.stack = []; this.log = []; }
    fen() { return encode(this.s); }
    turn() { return this.s.turn; }
    moves({ square, verbose = false } = {}) { const list = legal(this.s).filter(m => !square || m.from === square); return verbose ? list : list.map(m => m.from + m.to + (m.promotion || '')); }
    move(m) { const found = legal(this.s).find(x => x.from === m.from && x.to === m.to && (!x.promotion || x.promotion === m.promotion)); if (!found)
        throw Error('Illegal move'); this.stack.push(this.s); this.s = apply(this.s, found); this.log.push(found); return found; }
    undo() { if (!this.stack.length)
        return null; this.s = this.stack.pop(); return this.log.pop(); }
    history() { return this.log.map(m => m.from + m.to + (m.promotion || '')); }
    board() { return Array.from({ length: 8 }, (_, r) => squares.slice(r * 8, r * 8 + 8).map(square => { const p = this.s.p[square]; return p ? { square, color: p[0], type: p[1].toLowerCase() } : null; })); }
    isCheck() { return check(this.s); }
    isCheckmate() { return this.isCheck() && !legal(this.s).length; }
    isStalemate() { return !this.isCheck() && !legal(this.s).length; }
    isInsufficientMaterial() { return insufficient(this.s); }
    isThreefoldRepetition() { const key = repetitionKey(this.s); return [...this.stack, this.s].filter(s => repetitionKey(s) === key).length >= 3; }
    isDraw() { return this.s.half >= 100 || this.isStalemate() || this.isInsufficientMaterial() || this.isThreefoldRepetition(); }
    isGameOver() { return this.isCheckmate() || this.isDraw(); }
}
