/**
 * AI Module containing logic for bot moves.
 */

/**
 * Checks for a win condition on the board.
 * Optimized for AI move simulation.
 */
export function checkWinFull(b, sz, goal) {
  const dirs = [[1,0], [0,1], [1,1], [1,-1]];
  for(let r=0; r<sz; r++) {
    for(let c=0; c<sz; c++) {
      const start = b[r*sz+c];
      if(!start) continue;
      
      for(let d of dirs) {
        let line = [];
        for(let k=0; k<goal; k++) {
          const nr = r + d[0]*k;
          const nc = c + d[1]*k;
          if(nr<0 || nr>=sz || nc<0 || nc>=sz) break;
          if(b[nr*sz+nc] === start) {
            line.push(nr*sz+nc);
          } else {
            break;
          }
        }
        if(line.length === goal) return { win:true, line:line };
      }
    }
  }
  return { win:false };
}

export function checkWinSimple(b, sz, goal) {
  return checkWinFull(b, sz, goal).win;
}

/**
 * Finds the best move for the AI.
 */
export function findBestMove(board, empties, settings, meSymbol, enemySymbol) {
  const sz = settings.size;
  const gl = settings.goal;

  // 1. Can I win right now?
  for (let i of empties) {
    board[i] = meSymbol;
    if (checkWinSimple(board, sz, gl)) { 
      board[i] = ""; 
      return i; 
    }
    board[i] = "";
  }
  
  // 2. Can the enemy win on the next turn? (Block them)
  for (let i of empties) {
    board[i] = enemySymbol;
    if (checkWinSimple(board, sz, gl)) { 
      board[i] = ""; 
      return i; 
    }
    board[i] = "";
  }
  
  // 3. Play close to the center
  const center = (sz - 1) / 2;
  const sortedEmpties = [...empties].sort((a, b) => {
    const ra = Math.floor(a/sz), ca = a%sz;
    const rb = Math.floor(b/sz), cb = b%sz;
    const da = Math.abs(ra - center) + Math.abs(ca - center);
    const db = Math.abs(rb - center) + Math.abs(cb - center);
    return da - db;
  });
  
  return sortedEmpties[0];
}

/**
 * Calculates a move for the bot based on difficulty level.
 */
export function getBotMove(board, settings, symbols) {
  const empties = board.map((v, i) => v === "" ? i : -1).filter(i => i !== -1);
  if (!empties.length) return -1;

  let mistakeChance = 0;
  if (settings.ai === "easy") mistakeChance = 0.7;
  if (settings.ai === "normal") mistakeChance = 0.3;
  if (settings.ai === "hard") mistakeChance = 0.1;

  if (Math.random() < mistakeChance) {
    // Random move (mistake)
    return empties[Math.floor(Math.random() * empties.length)];
  } else {
    // Best move
    return findBestMove(board, empties, settings, symbols[1], symbols[0]);
  }
}
