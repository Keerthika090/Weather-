let input = document.querySelector("input");
let btn = document.querySelector("button");
let output = document.querySelector("#output");
let unitSelect = document.querySelector("#unit");

let key = "9209b060d4a2934b6ac803700f132782";

async function getWeather() {
  let cityName = input.value.trim();
  let unit = unitSelect.value;

  if (cityName === "") {
    output.innerHTML = "<h3>⚠ Please enter a city</h3>";
    return;
  }

  output.innerHTML = "⏳ Loading...";

  try {
    let url;

    // Kelvin doesn't need units param
    if (unit === "kelvin") {
      url = `https://api.openweathermap.org/data/2.5/weather?q=${cityName}&appid=${key}`;
    } else {
      url = `https://api.openweathermap.org/data/2.5/weather?q=${cityName}&appid=${key}&units=${unit}`;
    }

    let res = await fetch(url);

    if (res.status === 404) {
      output.innerHTML = "<h3>❌ City Not Found</h3>";
      return;
    }

    let data = await res.json();
    let date = new Date().toLocaleString();

    // Temperature handling
    let temp = data.main.temp;
    let feels = data.main.feels_like;
    let symbol = "K";

    if (unit === "metric") symbol = "°C";
    if (unit === "imperial") symbol = "°F";

    // Dynamic background
    let weatherMain = data.weather[0].main.toLowerCase();
    if (weatherMain.includes("cloud")) {
      document.body.style.background = "linear-gradient(135deg,#757F9A,#D7DDE8)";
    } else if (weatherMain.includes("rain")) {
      document.body.style.background = "linear-gradient(135deg,#373B44,#4286f4)";
    } else if (weatherMain.includes("clear")) {
      document.body.style.background = "linear-gradient(135deg,#f7971e,#ffd200)";
    } else {
      document.body.style.background = "linear-gradient(135deg,#1d2671,#c33764)";
    }

    output.innerHTML = `
      <h2>${data.name}</h2>
      <p>📅 ${date}</p>
      <img src="https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png"/>
      <p>🌡 Temp: ${temp} ${symbol}</p>
      <p>🤗 Feels Like: ${feels} ${symbol}</p>
      <p>☁ ${data.weather[0].description}</p>
      <p>💧 Humidity: ${data.main.humidity}%</p>
      <p>ضغط Pressure: ${data.main.pressure} hPa</p>
      <p>🌬 Wind: ${data.wind.speed} m/s</p>
    `;

    // ✅ Clear input after success
    input.value = "";

  } catch (err) {
    output.innerHTML = "<h3>⚠ Network Error</h3>";
  }
}

// Click event
btn.addEventListener("click", getWeather);

// Enter key
input.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    getWeather();
  }
});