/**
 * Hostinger / cPanel Node.js Entry Point Wrapper
 * 
 * Hostinger's Node.js selector often defaults to looking for `app.js` or `server.js` 
 * in the root directory rather than interpreting `package.json` scripts properly.
 * 
 * This file simply proxies execution to the compiled backend server using ES module imports.
 */
import './dist/server.cjs';

