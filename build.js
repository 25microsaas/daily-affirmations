const fs = require('fs');
const path = require('path');

// Read the extension key from environment or generate a new one
const extensionKey = process.env.EXTENSION_KEY || generateSecureKey();

// Read the config file
const configPath = path.join(__dirname, 'js', 'config.js');
let configContent = fs.readFileSync(configPath, 'utf8');

// Replace the placeholder with actual key
configContent = configContent.replace('__EXTENSION_KEY__', extensionKey);

// Write back the modified file
fs.writeFileSync(configPath, configContent);

console.log('Extension key injected successfully');

// Helper function to generate a secure key
function generateSecureKey() {
    return require('crypto').randomBytes(32).toString('hex');
} 