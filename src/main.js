import './style.css';
import { Game } from './Game.js';
import { StartupMenu } from './StartupMenu.js';
import { GameSidebar } from './GameSidebar.js';

const app = document.querySelector('#app');
app.innerHTML = '<div id="game-root"></div><div id="sidebar-root"></div>';

const game = new Game(document.querySelector('#game-root'));
const sidebar = new GameSidebar(document.querySelector('#sidebar-root'), {
  undo: () => game.undoMove(),
  restart: () => game.restartGame(),
  resign: () => game.resign(),
  draw: () => game.offerDraw(),
  replay: (action, value) => game.handleReplayControl(action, value),
});
game.setSidebar(sidebar);
game.start();
const startupMenu = new StartupMenu(app, (settings) => game.beginGame(settings), () => game.startMenuMusic());
if (sessionStorage.getItem('skyChessAutoStartAfterRestart') === 'true') {
  sessionStorage.removeItem('skyChessAutoStartAfterRestart');
  window.requestAnimationFrame(() => startupMenu.start());
}
