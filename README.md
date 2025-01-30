# Daily Affirmations Chrome Extension

Transform your new tab into a daily source of inspiration with personalized affirmations, beautiful backgrounds, and mindful reminders.

## Features

- **Daily Affirmations**: Get inspired with a new affirmation every time you open a new tab
- **Beautiful Backgrounds**: Dynamic nature-themed backgrounds that change daily
- **Weather Widget**: Stay informed with current weather conditions (optional)
- **Clock Display**: Keep track of time with an elegant clock widget (optional)
- **Customizable Themes**:
  - Multiple card styles (minimal, glass, solid)
  - Various background themes (nature, minimal, architecture, abstract)
  - Customizable font styles and text colors
- **Daily Reminders**: Set personalized reminders for your daily affirmation practice
- **Offline Support**: Works without internet connection
- **Settings Persistence**: Your preferences are automatically saved and synced
- **Data Backup**: Automatic backup system with rotation (keeps last 3 backups)

## Installation

1. Visit the [Chrome Web Store](https://chrome.google.com/webstore) (link coming soon)
2. Click "Add to Chrome"
3. Confirm the installation

## Usage

1. Open a new tab to see your daily affirmation
2. Click the gear icon (⚙️) to access settings:
   - Toggle weather and clock widgets
   - Change card style and background theme
   - Customize font and text color
   - Set up daily reminders
3. Click the menu icon (☰) to:
   - View favorite affirmations
   - Access custom collections
   - View statistics
   - Manage backup/restore

## Default Settings

The extension comes with carefully chosen defaults for the best experience:
- Card Style: Minimal
- Background Theme: Nature
- Text Color: White (#FFFFFF)
- Font Style: Default
- Weather Widget: Enabled
- Clock Widget: Enabled

## Privacy & Security

- No personal data collection
- Local storage with secure backup
- Optional weather widget requires location permission
- All data stays in your browser
- No third-party tracking

## Technical Details

### Architecture
- Built with Manifest V3 specifications
- Uses modern JavaScript/TypeScript
- Service Worker for background operations
- State management with automatic backup
- IndexedDB for offline support

### Storage
- Uses chrome.storage.sync for settings
- Local backup system with checksums
- Automatic state validation
- Error recovery mechanisms

### APIs Used
- Chrome Extension APIs
- Weather API (OpenWeatherMap)
- Background Images (Unsplash)

## Development

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Setup
1. Clone the repository:
```bash
git clone https://github.com/yourusername/daily-affirmations-extension.git
cd daily-affirmations-extension
```

2. Install dependencies:
```bash
npm install
```

3. Build the extension:
```bash
npm run build
```

4. Load in Chrome:
- Open Chrome
- Go to chrome://extensions/
- Enable "Developer mode"
- Click "Load unpacked"
- Select the `dist` folder

### Development Commands
- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run test`: Run tests
- `npm run lint`: Lint code

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Version History

See [CHANGELOG.md](CHANGELOG.md) for details about each release.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Weather data provided by [OpenWeatherMap](https://openweathermap.org/)
- Background images from [Unsplash](https://unsplash.com/)
- Icons from [Material Design Icons](https://material.io/icons/)

## Support

- Report bugs via [GitHub Issues](https://github.com/yourusername/daily-affirmations-extension/issues)
- Request features through [GitHub Discussions](https://github.com/yourusername/daily-affirmations-extension/discussions)
- Email support: support@daily-affirmation.today
