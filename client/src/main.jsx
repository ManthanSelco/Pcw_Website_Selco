import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/fixes.css';

// No <StrictMode>: it mounts twice in development, which would start the
// Webflow/GSAP animations twice.
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
