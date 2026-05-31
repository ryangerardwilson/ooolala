import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {WebChat} from './web-chat';
import './globals.css';

const apiUrl = import.meta.env.VITE_OOOLALA_API_URL || 'http://localhost:4000';
const buildId = import.meta.env.VITE_OOOLALA_BUILD_ID || 'dev';
const root = document.getElementById('root');

if (!root) throw new Error('root element not found');

document.documentElement.dataset.ooolalaBuild = buildId;

createRoot(root).render(
  <StrictMode>
    <WebChat apiUrl={apiUrl} />
  </StrictMode>
);
