import './style.css';
import { Game } from './Game.js';
import { StartupMenu } from './StartupMenu.js';

const app = document.querySelector('#app');
app.innerHTML = '<div id="game-root"></div>';

const game = new Game(document.querySelector('#game-root'));
game.start();
new StartupMenu(app, (settings) => game.beginGame(settings));
