import React from 'react';
import ReactDOM from 'react-dom/client';
// Carbon styles — light theme ("white"). Setting $theme here makes the whole
// app render in Carbon's minimal light theme.
import './styles.scss';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
