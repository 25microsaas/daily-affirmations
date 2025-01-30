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
        this.LOCATION_CACHE_KEY = 'weather_location';
        this.CITY_CACHE_KEY = 'weather_city';
        this.CACHE_DURATION = 1800000; // 30 minutes
        this.LOCATION_CACHE_DURATION = 3600000; // 1 hour
        this.API_KEY = null;
        this.hasLocationPermission = false;
        this.currentCity = null;
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

    // Initialize API key and load saved city
    async init(apiKey) {
        this.API_KEY = apiKey;
        await this.loadSavedCity();
        await this.checkLocationPermission();
        await this.loadCachedData();
        this.setupSearchInterface();
    }

    // Setup search interface
    setupSearchInterface() {
        const searchButton = document.getElementById('weatherSearchButton');
        const searchPanel = document.getElementById('weatherSearch');
        const searchInput = document.getElementById('weatherSearchInput');
        const closeButton = document.getElementById('weatherSearchClose');
        const searchMessage = document.getElementById('weatherSearchMessage');

        if (!searchButton || !searchPanel || !searchInput || !closeButton) return;

        // Show search panel
        searchButton.addEventListener('click', () => {
            searchPanel.classList.add('show');
            searchInput.focus();
        });

        // Hide search panel
        closeButton.addEventListener('click', () => {
            searchPanel.classList.remove('show');
            searchInput.value = '';
            searchMessage.textContent = 'Type a city name to search';
        });

        // Handle search input with debounce
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();
            
            if (query.length < 2) {
                searchMessage.textContent = 'Type a city name to search';
                return;
            }

            searchMessage.textContent = 'Searching...';
            
            searchTimeout = setTimeout(async () => {
                try {
                    const data = await this.getWeatherByCity(query);
                    this.updateDisplay(data);
                    searchPanel.classList.remove('show');
                    searchInput.value = '';
                } catch (error) {
                    searchMessage.textContent = 'City not found. Please try again.';
                }
            }, 500);
        });

        // Handle Enter key
        searchInput.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                const query = e.target.value.trim();
                if (query.length < 2) return;

                searchMessage.textContent = 'Searching...';
                
                try {
                    const data = await this.getWeatherByCity(query);
                    this.updateDisplay(data);
                    searchPanel.classList.remove('show');
                    searchInput.value = '';
                } catch (error) {
                    searchMessage.textContent = 'City not found. Please try again.';
                }
            }
        });

        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && searchPanel.classList.contains('show')) {
                searchPanel.classList.remove('show');
                searchInput.value = '';
                searchMessage.textContent = 'Type a city name to search';
            }
        });

        // Prevent dragging when interacting with search
        searchPanel.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });
    }

    // Load saved city preference
    async loadSavedCity() {
        try {
            const result = await chrome.storage.local.get(this.CITY_CACHE_KEY);
            this.currentCity = result[this.CITY_CACHE_KEY] || null;
            return this.currentCity;
        } catch (error) {
            console.error('Failed to load saved city:', error);
            return null;
        }
    }

    // Save city preference
    async saveCity(city) {
        try {
            await chrome.storage.local.set({ [this.CITY_CACHE_KEY]: city });
            this.currentCity = city;
        } catch (error) {
            console.error('Failed to save city:', error);
        }
    }

    // Clear saved city
    async clearCity() {
        try {
            await chrome.storage.local.remove(this.CITY_CACHE_KEY);
            this.currentCity = null;
        } catch (error) {
            console.error('Failed to clear city:', error);
        }
    }

    // Get weather by city name
    async getWeatherByCity(city) {
        try {
            if (!this.API_KEY) {
                throw new WeatherError('API key not initialized', 'API_KEY_MISSING');
            }

            const endpoint = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${this.API_KEY}&units=metric`;
            const response = await fetch(endpoint, { timeout: 5000 });
            
            if (!response.ok) {
                throw new WeatherError(
                    'City not found',
                    'CITY_NOT_FOUND',
                    { status: response.status }
                );
            }

            const data = await response.json();
            await this.cacheData(data);
            await this.saveCity(city);
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

    // Get current position with timeout
    async getCurrentPosition(force = false) {
        if (!force && this.hasLocationPermission) {
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
        } else {
            throw new WeatherError('Location permission not granted', 'LOCATION_PERMISSION_DENIED');
        }
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

    // Check location permission
    async checkLocationPermission() {
        try {
            const permission = await navigator.permissions.query({ name: 'geolocation' });
            this.hasLocationPermission = permission.state === 'granted';
            
            // Listen for permission changes
            permission.addEventListener('change', () => {
                this.hasLocationPermission = permission.state === 'granted';
                if (this.hasLocationPermission) {
                    this.update(true); // Force update when permission is granted
                }
            });

            // If we don't have permission but have a saved city, that's fine
            if (!this.hasLocationPermission && this.currentCity) {
                return;
            }

            // If we don't have permission and no saved city, we'll show the search interface
            if (!this.hasLocationPermission) {
                const elements = {
                    temp: document.getElementById('weatherTemp'),
                    city: document.getElementById('weatherCity'),
                    icon: document.getElementById('weatherIcon')
                };

                if (elements.temp) elements.temp.textContent = '--°C';
                if (elements.city) elements.city.textContent = 'Enter location';
                if (elements.icon) elements.icon.textContent = 'search';
            }

            return this.hasLocationPermission;
        } catch (error) {
            console.warn('Location permission check failed:', error);
            this.hasLocationPermission = false;
            return false;
        }
    }

    // Main update function
    async update(force = false) {
        try {
            // Check if weather is enabled in settings
            const settings = stateManager.getSettings();
            if (!settings.showWeather) {
                const widget = document.getElementById('weather-widget');
                if (widget) widget.style.display = 'none';
                return;
            }

            // Try to load cached weather data first if not forcing update
            if (!force) {
                const cached = await this.loadCachedData();
                if (cached) {
                    this.updateDisplay(cached);
                    return;
                }
            }

            // If we have a saved city, use that
            if (this.currentCity) {
                const data = await this.getWeatherByCity(this.currentCity);
                this.updateDisplay(data);
                return;
            }

            // Only try to get location-based weather if we have permission
            if (this.hasLocationPermission) {
                const position = await this.getCurrentPosition(!force);
                const data = await this.fetchWeatherData(position);
                this.updateDisplay(data);
            } else {
                // Show search interface state
                const elements = {
                    temp: document.getElementById('weatherTemp'),
                    city: document.getElementById('weatherCity'),
                    icon: document.getElementById('weatherIcon')
                };

                if (elements.temp) elements.temp.textContent = '--°C';
                if (elements.city) elements.city.textContent = 'Enter location';
                if (elements.icon) elements.icon.textContent = 'search';
            }
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