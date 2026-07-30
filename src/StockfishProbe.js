import workerScriptUrl from 'stockfish/bin/stockfish-18-lite-single.js?url';
import wasmUrl from 'stockfish/bin/stockfish-18-lite-single.wasm?url';

const output = document.querySelector('#output');
const write = (message) => {
  output.textContent += `\n${message}`;
  console.info('[Stockfish probe]', message);
};

write(`Engine URL: ${workerScriptUrl}`);
write(`WASM URL: ${wasmUrl}`);

const script = document.createElement('script');
script.src = workerScriptUrl;
script.onload = async () => {
  try {
    const engine = {
      locateFile: (file) => file.endsWith('.wasm') ? wasmUrl : file,
      listener: (message) => {
        const line = String(message).trim();
        write(`ENGINE: ${line}`);
        if (line.includes('uciok')) engine.ccall('command', null, ['string'], ['isready']);
        if (line.includes('readyok')) {
          engine.ccall('command', null, ['string'], ['position startpos']);
          engine.ccall('command', null, ['string'], ['go depth 1'], { async: true });
        }
      },
    };
    await script._exports(engine);
    write('ENGINE READY: sending uci');
    engine.ccall('command', null, ['string'], ['uci']);
  } catch (error) {
    write(`ERROR: ${error?.message || String(error)}`);
  }
};
script.onerror = () => write('ERROR: Stockfish script failed to load.');
document.head.appendChild(script);
