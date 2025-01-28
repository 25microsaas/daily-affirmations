// Weather Service Module
import stateManager from '../modules/state.js';

class WeatherError extends Error {
    constructor(message, code, details = {}) {
        super(message);
        this.name = 'WeatherError';
        this.code = code;
        this.details = details;
    }
}

class WeatherService {
    constructor() {
        this.CACHE_KEY = 'weather_data';
        this.CACHE_DURATION = 1800000; // 30 minutes
        this.API_KEY = null;
    }

    // Weather icon mapping
    iconMap = {
        '01d': 'wb_sunny',           // clear sky day
        '01n': 'nights_stay',        // clear sky night
        '02d': 'partly_cloudy_day',  // few clouds day
        '02n': 'nights_stay',        // few clouds night
        '03d': 'cloud',              // scattered clouds
        '03n': 'cloud',
        '04d': 'cloud',              // broken clouds
        '04n': 'cloud',
        '09d': 'water_drop',         // shower rain
        '09n': 'water_drop',
        '10d': 'rainy',              // rain
        '10n': 'rainy',
        '11d': 'thunderstorm',       // thunderstorm
        '11n': 'thunderstorm',
        '13d': 'ac_unit',            // snow
        '13n': 'ac_unit',
        '50d': 'foggy',              // mist
        '50n': 'foggy'
    };

    // Initialize API key
    async init(apiKey) {
        this.API_KEY = apiKey;
        await this.loadCachedData();
    }

    // Get current position with timeout
    async getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new WeatherError('Geolocation not supported', 'GEOLOCATION_UNSUPPORTED'));
                return;
            }

            const options = {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            };

            navigator.geolocation.getCurrentPosition(resolve, 
                (error) => reject(new WeatherError(
                    'Failed to get location',
                    'GEOLOCATION_ERROR',
                    { originalError: error }
                )), 
                options
            );
        });
    }

    // Fetch weather data
    async fetchWeatherData(position) {
        try {
            if (!this.API_KEY) {
                throw new WeatherError('API key not initialized', 'API_KEY_MISSING');
            }

            const endpoint = `https://api.openweathermap.org/data/2.5/weather?lat=${position.coords.latitude}&lon=${position.coords.longitude}&appid=${this.API_KEY}&units=metric`;
            
            const response = await fetch(endpoint, { timeout: 5000 });
            
            if (!response.ok) {
                throw new WeatherError(
                    'Weather API error',
                    'API_ERROR',
                    { status: response.status }
                );
            }
            
            const data = await response.json();
            await this.cacheData(data);
            return data;
        } catch (error) {
            if (error instanceof WeatherError) throw error;
            throw new WeatherError(
                'Failed to fetch weather data',
                'FETCH_ERROR',
                { originalError: error }
            );
        }
    }

    // Cache weather data
    async cacheData(data) {
        try {
            const cache = {
                data,
                timestamp: Date.now(),
                expiresAt: Date.now() + this.CACHE_DURATION
            };
            await chrome.storage.local.set({ [this.CACHE_KEY]: cache });
        } catch (error) {
            console.error('Failed to cache weather data:', error);
        }
    }

    // Load cached data
    async loadCachedData() {
        try {
            const result = await chrome.storage.local.get(this.CACHE_KEY);
            const cache = result[this.CACHE_KEY];
            
            if (cache && cache.expiresAt > Date.now()) {
                return cache.data;
            }
            return null;
        } catch (error) {
            console.error('Failed to load cached weather data:', error);
            return null;
        }
    }

    // Get weather icon
    getWeatherIcon(code) {
        return this.iconMap[code] || 'cloud';
    }

    // Format weather data for display
    formatWeatherData(data) {
        return {
            temperature: Math.round(data.main.temp),
            feelsLike: Math.round(data.main.feels_like),
            humidity: data.main.humidity,
            windSpeed: Math.round(data.wind.speed * 3.6), // Convert to km/h
            location: `${data.name}, ${data.sys.country}`,
            icon: this.getWeatherIcon(data.weather[0].icon)
        };
    }

    // Update weather display
    updateDisplay(data) {
        const elements = {
            temp: document.getElementById('weatherTemp'),
            city: document.getElementById('weatherCity'),
            icon: document.getElementById('weatherIcon'),
            humidity: document.getElementById('weatherHumidity'),
            wind: document.getElementById('weatherWind'),
            feelsLike: document.getElementById('weatherFeelsLike')
        };

        const formatted = this.formatWeatherData(data);

        if (elements.temp) elements.temp.textContent = `${formatted.temperature}°C`;
        if (elements.city) elements.city.textContent = formatted.location;
        if (elements.icon) elements.icon.textContent = formatted.icon;
        if (elements.humidity) elements.humidity.textContent = `${formatted.humidity}%`;
        if (elements.wind) elements.wind.textContent = `${formatted.windSpeed}km/h`;
        if (elements.feelsLike) elements.feelsLike.textContent = `Feels like ${formatted.feelsLike}°C`;
    }

    // Handle weather errors
    handleError() {
        const elements = {
            temp: document.getElementById('weatherTemp'),
            city: document.getElementById('weatherCity'),
            icon: document.getElementById('weatherIcon'),
            humidity: document.getElementById('weatherHumidity'),
            wind: document.getElementById('weatherWind'),
            feelsLike: document.getElementById('weatherFeelsLike')
        };

        if (elements.temp) elements.temp.textContent = '--°C';
        if (elements.city) elements.city.textContent = 'Weather Unavailable';
        if (elements.icon) elements.icon.textContent = 'cloud_off';
        if (elements.humidity) elements.humidity.textContent = '--%';
        if (elements.wind) elements.wind.textContent = '-- km/h';
        if (elements.feelsLike) elements.feelsLike.textContent = 'Feels like --°C';
    }

    // Main update function
    async update() {
        try {
            // Check if weather is enabled in settings
            const settings = stateManager.getSettings();
            if (!settings.showWeather) {
                const widget = document.getElementById('weather-widget');
                if (widget) widget.style.display = 'none';
                return;
            }

            // Try to load cached data first
            const cached = await this.loadCachedData();
            if (cached) {
                this.updateDisplay(cached);
                return;
            }

            // Get fresh data
            const position = await this.getCurrentPosition();
            const data = await this.fetchWeatherData(position);
            this.updateDisplay(data);

        } catch (error) {
            console.error('Weather update failed:', error);
            this.handleError();
        }
    }
}

// Create and export singleton instance
const weatherService = new WeatherService();
export default weatherService;
export { WeatherError }; 