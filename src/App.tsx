/**
 * Re-export App from the app-shell module for backward compatibility.
 * main.tsx imports from './App' — this barrel keeps that working.
 */
export { default } from './app-shell/App';
