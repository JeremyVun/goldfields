import './ui/styles.css';
import { App } from './ui/app';

const root = document.getElementById('screen');
if (root) {
  const app = new App(root);
  app.start();
} else {
  console.error('goldrush: #screen element not found');
}
