const KEY = "9209b060d4a2934b6ac803700f132782";

// Cached DOM references
const cityInput = document.getElementById("cityInput");
const searchBtn = document.getElementById("searchBtn");
const geoBtn = document.getElementById("geoBtn");
const unitSelect = document.getElementById("unit");
const output = document.getElementById("output");
const recentBtn = document.getElementById("recent-btn");
const recentDropdown = document.getElementById("recent-dropdown");

// State
let cache = {};
let recentCities = JSON.parse(localStorage.getItem("wx_recent") || "[]");
let currentAbort = null;
let lastCity = "";

// Weather condition → emoji icon map
const ICONS = {
  clear: "☀️", clouds: "⛅", rain: "🌧️", drizzle: "🌦️",
  thunderstorm: "⛈️", snow: "❄️", mist: "🌫️", fog: "🌫️",
  haze: "🌫️", smoke: "🌫️", dust: "🌪️", tornado: "🌪️", default: "🌡️"
};

function getIcon(main) {
  return ICONS[main.toLowerCase()] || ICONS.default;
}

function getSymbol(unit) {
  return unit === "metric" ? "°C" : unit === "imperial" ? "°F" : "K";
}

function getBg(main) {
  const m = main.toLowerCase();
  if (m.includes("cloud"))   return "linear-gradient(135deg,#2d3748,#4a5568)";
  if (m.includes("rain") || m.includes("drizzle")) return "linear-gradient(135deg,#1a2a4a,#2563eb)";
  if (m.includes("thunder")) return "linear-gradient(135deg,#1a1a2e,#4c1d95)";
  if (m.includes("snow"))    return "linear-gradient(135deg,#a8c0d6,#e8f4fd)";
  if (m.includes("clear"))   return "linear-gradient(135deg,#f37335,#fdc830)";
  if (m.includes("mist") || m.includes("fog")) return "linear-gradient(135deg,#4a5568,#718096)";
  return "linear-gradient(135deg,#1d2671,#c33764)";
}

function getDayName(timestamp, offset) {
  const d = new Date((timestamp + offset) * 1000);
  return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getUTCDay()];
}

function degToDir(deg) {
  const dirs = ["N","NE","E","SE","S","SW","W","NW"];
  return dirs[Math.round(deg / 45) % 8];
}

// ---------- Recent searches ----------
function saveRecent(city) {
  recentCities = [city, ...recentCities.filter(c => c.toLowerCase() !== city.toLowerCase())].slice(0, 5);
  localStorage.setItem("wx_recent", JSON.stringify(recentCities));
  renderRecent();
}

function renderRecent() {
  if (!recentCities.length) {
    recentDropdown.innerHTML = '<div class="dropdown-item muted">No recent searches</div>';
  } else {
    recentDropdown.innerHTML = recentCities
      .map(c => `<div class="dropdown-item" onclick="selectRecent('${c}')">${c}</div>`)
      .join("");
  }
}

function selectRecent(city) {
  cityInput.value = city;
  recentDropdown.classList.remove("open");
  getWeather();
}

recentBtn.addEventListener("click", () => {
  renderRecent();
  recentDropdown.classList.toggle("open");
});

document.addEventListener("click", e => {
  if (!recentBtn.contains(e.target) && !recentDropdown.contains(e.target)) {
    recentDropdown.classList.remove("open");
  }
});

// ---------- Skeleton loader ----------
function showSkeleton() {
  output.style.display = "block";
  output.innerHTML = `
    <div class="card main-weather">
      <div class="skeleton" style="height:24px;width:60%;margin:0 auto 8px"></div>
      <div class="skeleton" style="height:12px;width:40%;margin:0 auto 16px"></div>
      <div class="skeleton" style="height:64px;width:64px;border-radius:50%;margin:0 auto 12px"></div>
      <div class="skeleton" style="height:52px;width:120px;margin:0 auto 8px"></div>
      <div class="skeleton" style="height:14px;width:50%;margin:0 auto"></div>
      <div class="stats-grid" style="margin-top:18px">
        ${[1,2,3].map(() => `<div class="stat"><div class="skeleton" style="height:40px;border-radius:8px"></div></div>`).join("")}
      </div>
    </div>`;
}

// ---------- Error display ----------
function showError(icon, msg) {
  output.style.display = "block";
  output.innerHTML = `
    <div class="card error-card">
      <div class="error-icon">${icon}</div>
      <p style="font-size:15px">${msg}</p>
      <button class="retry-btn" onclick="getWeather('${lastCity}')">Try again</button>
    </div>`;
}

// ---------- Main fetch ----------
async function getWeather(cityOverride) {
  const city = (cityOverride || cityInput.value).trim();
  const unit = unitSelect.value;

  if (!city) {
    showError("⚠️", "Please enter a city name");
    return;
  }

  // Cache check (10 min TTL)
  const cacheKey = `${city.toLowerCase()}|${unit}`;
  const cached = cache[cacheKey];
  if (cached && Date.now() - cached.ts < 600_000) {
    render(cached.current, cached.forecast, unit);
    return;
  }

  // Cancel in-flight request
  if (currentAbort) currentAbort.abort();
  currentAbort = new AbortController();
  const { signal } = currentAbort;

  showSkeleton();
  lastCity = city;

  try {
    const unitParam = unit === "kelvin" ? "" : `&units=${unit}`;
    const base = `https://api.openweathermap.org/data/2.5`;

    const [currentRes, forecastRes] = await Promise.all([
      fetch(`${base}/weather?q=${encodeURIComponent(city)}&appid=${KEY}${unitParam}`, { signal }),
      fetch(`${base}/forecast?q=${encodeURIComponent(city)}&appid=${KEY}${unitParam}&cnt=40`, { signal })
    ]);

    if (currentRes.status === 404) { showError("❌", "City not found"); return; }
    if (!currentRes.ok)            { showError("⚠️", "Weather service error"); return; }

    const current  = await currentRes.json();
    const forecast = forecastRes.ok ? await forecastRes.json() : null;

    cache[cacheKey] = { current, forecast, ts: Date.now() };
    saveRecent(current.name);
    cityInput.value = "";
    document.body.style.background = getBg(current.weather[0].main);
    render(current, forecast, unit);

  } catch (err) {
    if (err.name === "AbortError") return;
    showError("🌐", "Network error. Check your connection.");
  }
}

// ---------- Render ----------
function render(d, forecast, unit) {
  const sym      = getSymbol(unit);
  const icon     = getIcon(d.weather[0].main);
  const date     = new Date().toLocaleDateString(undefined, { weekday:"long", month:"short", day:"numeric" });
  const sunriseT = new Date(d.sys.sunrise * 1000).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
  const sunsetT  = new Date(d.sys.sunset  * 1000).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
  const visKm    = d.visibility ? (d.visibility / 1000).toFixed(1) + " km" : "N/A";
  const windDir  = d.wind?.deg != null ? degToDir(d.wind.deg) : "";

  // Build 5-day forecast from 3-hourly list
  let forecastHTML = "";
  if (forecast) {
    const daily = {};
    forecast.list.forEach(item => {
      const day = getDayName(item.dt, d.timezone);
      if (!daily[day]) daily[day] = { high: -Infinity, low: Infinity, icon: item.weather[0].main };
      daily[day].high = Math.max(daily[day].high, item.main.temp_max);
      daily[day].low  = Math.min(daily[day].low,  item.main.temp_min);
    });

    const days = Object.entries(daily).slice(0, 5);
    forecastHTML = `
      <div class="card">
        <div class="forecast-title">5-day forecast</div>
        <div class="forecast-grid">
          ${days.map(([day, v]) => `
            <div class="fc-day">
              <div class="fc-day-name">${day}</div>
              <div class="fc-icon">${getIcon(v.icon)}</div>
              <div class="fc-high">${Math.round(v.high)}${sym}</div>
              <div class="fc-low">${Math.round(v.low)}${sym}</div>
            </div>`).join("")}
        </div>
      </div>`;
  }

  output.style.display = "block";
  output.innerHTML = `
    <div class="card main-weather">
      <div class="city-name">${d.name}, ${d.sys.country}</div>
      <div class="date-text">${date}</div>
      <div class="weather-icon">${icon}</div>
      <div class="temp-main">${Math.round(d.main.temp)}${sym}</div>
      <div class="description">${d.weather[0].description}</div>
      <div class="feels">Feels like ${Math.round(d.main.feels_like)}${sym}</div>
      <div class="stats-grid">
        <div class="stat">
          <div class="stat-icon">💧</div>
          <div class="stat-val">${d.main.humidity}%</div>
          <div class="stat-lbl">Humidity</div>
        </div>
        <div class="stat">
          <div class="stat-icon">🌬️</div>
          <div class="stat-val">${Math.round(d.wind.speed)} m/s</div>
          <div class="stat-lbl">Wind ${windDir}</div>
        </div>
        <div class="stat">
          <div class="stat-icon">⬇️</div>
          <div class="stat-val">${d.main.pressure}</div>
          <div class="stat-lbl">hPa</div>
        </div>
      </div>
      <div class="extra-grid">
        <div class="extra-item">
          <span class="extra-lbl">👁 Visibility</span>
          <span class="extra-val">${visKm}</span>
        </div>
        <div class="extra-item">
          <span class="extra-lbl">🌅 Sunrise</span>
          <span class="extra-val">${sunriseT}</span>
        </div>
        <div class="extra-item">
          <span class="extra-lbl">☁️ Cloud cover</span>
          <span class="extra-val">${d.clouds.all}%</span>
        </div>
        <div class="extra-item">
          <span class="extra-lbl">🌇 Sunset</span>
          <span class="extra-val">${sunsetT}</span>
        </div>
      </div>
    </div>
    ${forecastHTML}`;
}

// ---------- Geolocation ----------
geoBtn.addEventListener("click", () => {
  if (!navigator.geolocation) { showError("⚠️", "Geolocation not supported"); return; }
  geoBtn.textContent = "⌛";

  navigator.geolocation.getCurrentPosition(async pos => {
    geoBtn.textContent = "📍";
    const { latitude: lat, longitude: lon } = pos.coords;
    const unit = unitSelect.value;
    const unitParam = unit === "kelvin" ? "" : `&units=${unit}`;
    const base = `https://api.openweathermap.org/data/2.5`;
    showSkeleton();
    try {
      const [cRes, fRes] = await Promise.all([
        fetch(`${base}/weather?lat=${lat}&lon=${lon}&appid=${KEY}${unitParam}`),
        fetch(`${base}/forecast?lat=${lat}&lon=${lon}&appid=${KEY}${unitParam}&cnt=40`)
      ]);
      const current  = await cRes.json();
      const forecast = fRes.ok ? await fRes.json() : null;
      saveRecent(current.name);
      document.body.style.background = getBg(current.weather[0].main);
      render(current, forecast, unit);
    } catch {
      showError("🌐", "Failed to get location weather");
    }
  }, () => {
    geoBtn.textContent = "📍";
    showError("📍", "Location access denied");
  });
});

// ---------- Events ----------
searchBtn.addEventListener("click", () => getWeather());
cityInput.addEventListener("keydown", e => { if (e.key === "Enter") getWeather(); });
unitSelect.addEventListener("change", () => { if (lastCity) getWeather(lastCity); });
