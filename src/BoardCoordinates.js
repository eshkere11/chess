import { BOARD_SIZE, SQUARE_SIZE } from './constants.js';

// Chess notation is authoritative: file 0 is A (White's left), file 7 is H.
// The White camera views the board from negative Z, so world X is mirrored.
export const boardX = (column) => ((BOARD_SIZE - 1) / 2 - column) * SQUARE_SIZE;
export const boardZ = (row) => ((BOARD_SIZE - 1) / 2 - row) * SQUARE_SIZE;
export const boardColumnFromX = (x) => Math.round((BOARD_SIZE - 1) / 2 - x / SQUARE_SIZE);
export const boardRowFromZ = (z) => Math.round((BOARD_SIZE - 1) / 2 - z / SQUARE_SIZE);
