/**
 * Re-export App from the app-shell module for backward compatibility.
 * main.tsx imports from '@den-web/shell' — this barrel keeps that working.
 */
export { default } from '@den-web/shell/App';
