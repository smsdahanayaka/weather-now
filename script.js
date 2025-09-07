// Configuration
const API_KEY = "def82428c35a440589e65204250709";
const BASE_URL = "https://api.weatherapi.com/v1";

// State
let currentUnit = "metric";
let currentTheme = "light";
let map;
let weatherMarker;
let searchTimeout;
let favorites = JSON.parse(localStorage.getItem("weatherFavorites") || "[]");

// DOM Elements
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const locationBtn = document.getElementById("locationBtn");
const unitToggle = document.getElementById("unitToggle");
const themeToggle = document.getElementById("themeToggle");
const loadingContainer = document.getElementById("loadingContainer");
const errorContainer = document.getElementById("errorContainer");
const weatherContent = document.getElementById("weatherContent");
const alertsContainer = document.getElementById("alertsContainer");
const favoritesContainer = document.getElementById("favoritesContainer");
const addFavoriteBtn = document.getElementById("addFavoriteBtn");

// Initialize App
document.addEventListener("DOMContentLoaded", function () {
  initializeTheme();
  initializeMap();
  setupEventListeners();
  renderFavorites();

  // Load default location (user's location or fallback)
  getUserLocation();
});

function setupEventListeners() {
  searchBtn.addEventListener("click", () => searchWeather(searchInput.value));
  locationBtn.addEventListener("click", getUserLocation);
  unitToggle.addEventListener("click", toggleUnits);
  themeToggle.addEventListener("click", toggleTheme);
  addFavoriteBtn.addEventListener("click", addToFavorites);

  // Search on Enter key
  searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      searchWeather(searchInput.value);
    }
  });

  // Debounced search
  searchInput.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    if (e.target.value.trim()) {
      searchTimeout = setTimeout(() => {
        // Could add search suggestions here
      }, 300);
    }
  });
}

// Weather API Functions
async function searchWeather(query) {
  if (!query.trim()) {
    showError("Please enter a location to search");
    return;
  }

  showLoading();

  try {
    const currentWeather = await fetchCurrentWeather(query);
    const forecast = await fetchForecast(query);
    const history = await fetchHistory(query);

    displayWeatherData(currentWeather, forecast, history);
    updateMap(currentWeather.location.lat, currentWeather.location.lon, query);
  } catch (error) {
    console.error("Weather search error:", error);
    showError(
      "Unable to fetch weather data. Please check your location and try again."
    );
  }
}

async function fetchCurrentWeather(query) {
  const response = await fetch(
    `${BASE_URL}/current.json?key=${API_KEY}&q=${encodeURIComponent(
      query
    )}&aqi=yes&alerts=yes`
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
}

async function fetchForecast(query) {
  const response = await fetch(
    `${BASE_URL}/forecast.json?key=${API_KEY}&q=${encodeURIComponent(
      query
    )}&days=3&aqi=no&alerts=yes`
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
}

async function fetchHistory(query) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 7);

  const promises = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(endDate.getDate() - i - 1);
    const dateStr = date.toISOString().split("T")[0];

    promises.push(
      fetch(
        `${BASE_URL}/history.json?key=${API_KEY}&q=${encodeURIComponent(
          query
        )}&dt=${dateStr}`
      )
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null)
    );
  }

  const results = await Promise.all(promises);
  return results.filter((result) => result !== null);
}

function displayWeatherData(currentData, forecastData, historyData) {
  hideLoading();
  hideError();
  showWeatherContent();

  // Display alerts if present
  displayAlerts(currentData.alerts || forecastData.alerts);

  // Current weather
  displayCurrentWeather(currentData);

  // Forecast
  displayForecast(forecastData.forecast.forecastday);

  // History
  displayHistory(historyData);

  // Cache the successful data
  localStorage.setItem(
    "lastWeatherData",
    JSON.stringify({
      current: currentData,
      forecast: forecastData,
      history: historyData,
      timestamp: Date.now(),
    })
  );
}

function displayCurrentWeather(data) {
  const { current, location } = data;

  document.getElementById("currentTemp").textContent = `${Math.round(
    currentUnit === "metric" ? current.temp_c : current.temp_f
  )}°${currentUnit === "metric" ? "C" : "F"}`;

  document.getElementById(
    "currentLocation"
  ).textContent = `${location.name}, ${location.country}`;

  document.getElementById("currentDescription").textContent =
    current.condition.text;

  document.getElementById(
    "currentHumidity"
  ).textContent = `${current.humidity}%`;

  document.getElementById("currentWind").textContent = `${Math.round(
    currentUnit === "metric" ? current.wind_kph : current.wind_mph
  )} ${currentUnit === "metric" ? "km/h" : "mph"}`;

  document.getElementById("currentVisibility").textContent = `${Math.round(
    currentUnit === "metric" ? current.vis_km : current.vis_miles
  )} ${currentUnit === "metric" ? "km" : "mi"}`;

  document.getElementById("currentFeelsLike").textContent = `${Math.round(
    currentUnit === "metric" ? current.feelslike_c : current.feelslike_f
  )}°${currentUnit === "metric" ? "C" : "F"}`;

  // Update weather icon
  updateWeatherIcon(
    document.getElementById("currentIcon"),
    current.condition.code,
    current.is_day
  );
}

function displayForecast(forecastDays) {
  const container = document.getElementById("forecastContainer");
  container.innerHTML = "";

  forecastDays.forEach((day, index) => {
    if (index === 0) return; // Skip today

    const forecastItem = document.createElement("div");
    forecastItem.className = "forecast-item";

    const date = new Date(day.date);
    const dayName = date.toLocaleDateString("en-US", { weekday: "short" });

    forecastItem.innerHTML = `
                    <div class="forecast-date">${dayName}</div>
                    <div class="forecast-icon">
                        <i class="${getWeatherIcon(
                          day.day.condition.code,
                          1
                        )}"></i>
                    </div>
                    <div class="forecast-description">${
                      day.day.condition.text
                    }</div>
                    <div class="forecast-temps">
                        <span class="temp-high">${Math.round(
                          currentUnit === "metric"
                            ? day.day.maxtemp_c
                            : day.day.maxtemp_f
                        )}°</span>
                        <span class="temp-low">${Math.round(
                          currentUnit === "metric"
                            ? day.day.mintemp_c
                            : day.day.mintemp_f
                        )}°</span>
                    </div>
                `;

    container.appendChild(forecastItem);
  });
}

function displayHistory(historyData) {
  const container = document.getElementById("historyContainer");
  container.innerHTML = "";

  if (!historyData || historyData.length === 0) {
    container.innerHTML =
      '<p style="text-align: center; color: var(--text-secondary);">Historical data not available</p>';
    return;
  }

  historyData.forEach((dayData) => {
    if (!dayData || !dayData.forecast || !dayData.forecast.forecastday[0])
      return;

    const day = dayData.forecast.forecastday[0];
    const date = new Date(day.date);

    const historyItem = document.createElement("div");
    historyItem.className = "history-item";

    historyItem.innerHTML = `
                    <div class="history-date">${date.toLocaleDateString()}</div>
                    <div>${Math.round(
                      currentUnit === "metric"
                        ? day.day.maxtemp_c
                        : day.day.maxtemp_f
                    )}° / ${Math.round(
      currentUnit === "metric" ? day.day.mintemp_c : day.day.mintemp_f
    )}°</div>
                    <div>${day.day.condition.text}</div>
                    <div>💧 ${day.day.totalprecip_mm || 0}mm</div>
                `;

    container.appendChild(historyItem);
  });
}

function displayAlerts(alerts) {
  if (!alerts || !alerts.alert || alerts.alert.length === 0) {
    alertsContainer.classList.add("hidden");
    return;
  }

  alertsContainer.classList.remove("hidden");
  alertsContainer.innerHTML = "";

  alerts.alert.forEach((alert) => {
    const alertElement = document.createElement("div");
    alertElement.className = `alert ${
      alert.severity === "severe" ? "alert-danger" : "alert-warning"
    }`;

    alertElement.innerHTML = `
                    <strong>${alert.headline}</strong><br>
                    <small>${alert.desc}</small>
                `;

    alertsContainer.appendChild(alertElement);
  });
}

// Geolocation
function getUserLocation() {
  if (!navigator.geolocation) {
    showError("Geolocation is not supported by this browser");
    return;
  }

  showLoading();

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      searchWeather(`${latitude},${longitude}`);
    },
    (error) => {
      console.error("Geolocation error:", error);
      // Fallback to a default location
      searchWeather("London");
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000, // 5 minutes
    }
  );
}

// Map Functions
function initializeMap() {
  map = L.map("map").setView([51.505, -0.09], 10);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
  }).addTo(map);

  map.on("click", function (e) {
    const { lat, lng } = e.latlng;
    searchWeather(`${lat},${lng}`);
  });
}

function updateMap(lat, lon, locationName) {
  if (weatherMarker) {
    map.removeLayer(weatherMarker);
  }

  weatherMarker = L.marker([lat, lon])
    .addTo(map)
    .bindPopup(locationName)
    .openPopup();

  map.setView([lat, lon], 10);
}

// Favorites System
function renderFavorites() {
  favoritesContainer.innerHTML = "";

  favorites.forEach((favorite, index) => {
    const favoriteItem = document.createElement("div");
    favoriteItem.className = "favorite-item";
    favoriteItem.innerHTML = `
                    <span>${favorite}</span>
                    <span class="favorite-remove" onclick="removeFavorite(${index})">
                        <i class="fas fa-times"></i>
                    </span>
                `;

    favoriteItem.onclick = (e) => {
      if (!e.target.closest(".favorite-remove")) {
        searchWeather(favorite);
      }
    };

    favoritesContainer.appendChild(favoriteItem);
  });
}

function addToFavorites() {
  const location = document.getElementById("currentLocation").textContent;

  if (!favorites.includes(location)) {
    favorites.push(location);
    localStorage.setItem("weatherFavorites", JSON.stringify(favorites));
    renderFavorites();
  }
}

function removeFavorite(index) {
  favorites.splice(index, 1);
  localStorage.setItem("weatherFavorites", JSON.stringify(favorites));
  renderFavorites();
}

// Theme Functions
function initializeTheme() {
  const savedTheme = localStorage.getItem("weatherTheme") || "light";
  currentTheme = savedTheme;
  document.documentElement.setAttribute("data-theme", currentTheme);
  updateThemeIcon();
}

function toggleTheme() {
  currentTheme = currentTheme === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", currentTheme);
  localStorage.setItem("weatherTheme", currentTheme);
  updateThemeIcon();
}

function updateThemeIcon() {
  const icon = themeToggle.querySelector("i");
  icon.className = currentTheme === "light" ? "fas fa-moon" : "fas fa-sun";
}

// Unit Functions
function toggleUnits() {
  currentUnit = currentUnit === "metric" ? "imperial" : "metric";
  unitToggle.textContent = currentUnit === "metric" ? "°C" : "°F";
  localStorage.setItem("weatherUnit", currentUnit);

  // Re-render current data with new units
  const cachedData = localStorage.getItem("lastWeatherData");
  if (cachedData) {
    const data = JSON.parse(cachedData);
    displayWeatherData(data.current, data.forecast, data.history);
  }
}

// Weather Icon Functions
function updateWeatherIcon(element, conditionCode, isDay) {
  element.innerHTML = `<i class="${getWeatherIcon(conditionCode, isDay)}"></i>`;
}

function getWeatherIcon(conditionCode, isDay) {
  const iconMap = {
    1000: isDay ? "fas fa-sun" : "fas fa-moon", // Clear
    1003: isDay ? "fas fa-cloud-sun" : "fas fa-cloud-moon", // Partly cloudy
    1006: "fas fa-cloud", // Cloudy
    1009: "fas fa-cloud", // Overcast
    1030: "fas fa-smog", // Mist
    1063: "fas fa-cloud-sun-rain", // Patchy rain possible
    1066: "fas fa-snowflake", // Patchy snow possible
    1069: "fas fa-cloud-meatball", // Patchy sleet possible
    1072: "fas fa-cloud-rain", // Patchy freezing drizzle possible
    1087: "fas fa-bolt", // Thundery outbreaks possible
    1114: "fas fa-wind", // Blowing snow
    1117: "fas fa-wind", // Blizzard
    1135: "fas fa-smog", // Fog
    1147: "fas fa-smog", // Freezing fog
    1150: "fas fa-cloud-drizzle", // Patchy light drizzle
    1153: "fas fa-cloud-drizzle", // Light drizzle
    1168: "fas fa-cloud-drizzle", // Freezing drizzle
    1171: "fas fa-cloud-drizzle", // Heavy freezing drizzle
    1180: "fas fa-cloud-sun-rain", // Patchy light rain
    1183: "fas fa-cloud-rain", // Light rain
    1186: "fas fa-cloud-rain", // Moderate rain at times
    1189: "fas fa-cloud-rain", // Moderate rain
    1192: "fas fa-cloud-showers-heavy", // Heavy rain at times
    1195: "fas fa-cloud-showers-heavy", // Heavy rain
    1198: "fas fa-cloud-rain", // Light freezing rain
    1201: "fas fa-cloud-rain", // Moderate or heavy freezing rain
    1204: "fas fa-cloud-meatball", // Light sleet
    1207: "fas fa-cloud-meatball", // Moderate or heavy sleet
    1210: "fas fa-snowflake", // Patchy light snow
    1213: "fas fa-snowflake", // Light snow
    1216: "fas fa-snowflake", // Patchy moderate snow
    1219: "fas fa-snowflake", // Moderate snow
    1222: "fas fa-snowflake", // Patchy heavy snow
    1225: "fas fa-snowflake", // Heavy snow
    1237: "fas fa-cloud-meatball", // Ice pellets
    1240: "fas fa-cloud-sun-rain", // Light rain shower
    1243: "fas fa-cloud-showers-heavy", // Moderate or heavy rain shower
    1246: "fas fa-cloud-showers-heavy", // Torrential rain shower
    1249: "fas fa-cloud-meatball", // Light sleet showers
    1252: "fas fa-cloud-meatball", // Moderate or heavy sleet showers
    1255: "fas fa-snowflake", // Light snow showers
    1258: "fas fa-snowflake", // Moderate or heavy snow showers
    1261: "fas fa-cloud-meatball", // Light showers of ice pellets
    1264: "fas fa-cloud-meatball", // Moderate or heavy showers of ice pellets
    1273: "fas fa-bolt", // Patchy light rain with thunder
    1276: "fas fa-bolt", // Moderate or heavy rain with thunder
    1279: "fas fa-bolt", // Patchy light snow with thunder
    1282: "fas fa-bolt", // Moderate or heavy snow with thunder
  };

  return iconMap[conditionCode] || "fas fa-question";
}

// UI State Functions
function showLoading() {
  loadingContainer.classList.remove("hidden");
  errorContainer.classList.add("hidden");
  weatherContent.classList.add("hidden");
}

function hideLoading() {
  loadingContainer.classList.add("hidden");
}

function showError(message) {
  hideLoading();
  errorContainer.classList.remove("hidden");
  weatherContent.classList.add("hidden");
  document.getElementById("errorMessage").textContent = message;
}

function hideError() {
  errorContainer.classList.add("hidden");
}

function showWeatherContent() {
  weatherContent.classList.remove("hidden");
}

// Initialize saved preferences
document.addEventListener("DOMContentLoaded", function () {
  const savedUnit = localStorage.getItem("weatherUnit");
  if (savedUnit) {
    currentUnit = savedUnit;
    unitToggle.textContent = currentUnit === "metric" ? "°C" : "°F";
  }

  // Try to load cached data on startup
  const cachedData = localStorage.getItem("lastWeatherData");
  if (cachedData) {
    try {
      const data = JSON.parse(cachedData);
      const age = Date.now() - data.timestamp;

      // Use cached data if less than 30 minutes old
      if (age < 30 * 60 * 1000) {
        displayWeatherData(data.current, data.forecast, data.history);
        updateMap(
          data.current.location.lat,
          data.current.location.lon,
          `${data.current.location.name}, ${data.current.location.country}`
        );
        return;
      }
    } catch (error) {
      console.error("Error loading cached data:", error);
    }
  }
});

// Error handling for API key
if (API_KEY === "REPLACE_WITH_YOUR_WEATHERAPI_KEY") {
  document.addEventListener("DOMContentLoaded", function () {
    showError(
      'Please replace "REPLACE_WITH_YOUR_WEATHERAPI_KEY" with your actual WeatherAPI key in the JavaScript code.'
    );
  });
}

// Debounced search functionality
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Performance optimization: Lazy load historical data
const debouncedSearch = debounce(searchWeather, 300);

// Service Worker registration for offline functionality (optional enhancement)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    // Uncomment the next line if you create a service worker
    // navigator.serviceWorker.register('/sw.js');
  });
}

// Accessibility improvements
document.addEventListener("keydown", function (e) {
  // ESC key to close any open modals or reset search
  if (e.key === "Escape") {
    searchInput.blur();
  }
});

// Add ARIA labels for screen readers
searchInput.setAttribute(
  "aria-label",
  "Search for weather by city, region, or country"
);
unitToggle.setAttribute(
  "aria-label",
  "Toggle temperature units between Celsius and Fahrenheit"
);
themeToggle.setAttribute("aria-label", "Toggle between light and dark theme");
locationBtn.setAttribute("aria-label", "Use current location for weather data");

// Console welcome message
console.log(`
        🌤️ Weather Now App
        ==================
        Built with vanilla HTML, CSS, and JavaScript
        Features: Current weather, 3-day forecast, 7-day history, interactive map, alerts, favorites
        API: WeatherAPI.com
        
        Don't forget to:
        1. Replace the API key with your actual WeatherAPI key
        2. Test all features
        3. Deploy to GitHub Pages
        `);
