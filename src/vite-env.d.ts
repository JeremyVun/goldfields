/// <reference types="vite/client" />

interface Window {
  __gf?: {
    app: import('./ui/app').App;
    createInitialState: typeof import('./engine/state').createInitialState;
  };
}
