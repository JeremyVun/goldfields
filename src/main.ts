import './ui/styles.css';
import { App } from './ui/app';

const root = document.getElementById('screen');
if (root) {
  const app = new App(root);
  app.start();
} else {
  // Should never happen — index.html always provides #screen — but fail loudly in dev.
  console.error('goldrush: #screen element not found');
}
