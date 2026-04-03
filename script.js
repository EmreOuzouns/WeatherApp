const cityInput = document.getElementById('cityInput');
const searchBtn = document.getElementById('searchBtn');
const locationBtn = document.getElementById('locationBtn');
const favoriteBtn = document.getElementById('favoriteBtn');
const favoritesBar = document.getElementById('favoritesBar');
const weatherContent = document.getElementById('weatherContent');
const forecastSection = document.getElementById('forecastSection');
const forecastContainer = document.getElementById('forecastContainer');
const loadingSpinner = document.getElementById('loadingSpinner');
const installAppBtn = document.getElementById('installAppBtn');

// WMO hava durumu kodlarımı karşılıklarıyla eşleştiriyorum
const weatherCodes = {
    0: 'Açık', 1: 'Çoğunlukla Açık', 2: 'Parçalı Bulutlu', 3: 'Kapalı',
    45: 'Sisli', 48: 'Kırağı', 51: 'Hafif Çiseleme', 53: 'Çiseleme', 55: 'Yoğun Çiseleme',
    56: 'Hafif Dondurucu Çiseleme', 57: 'Dondurucu Çiseleme',
    61: 'Hafif Yağmur', 63: 'Yağmur', 65: 'Şiddetli Yağmur',
    66: 'Hafif Dondurucu Yağmur', 67: 'Dondurucu Yağmur',
    71: 'Hafif Kar', 73: 'Kar Yağışlı', 75: 'Yoğun Kar', 77: 'Kar Taneleri',
    80: 'Hafif Sağanak Yağış', 81: 'Sağanak Yağış', 82: 'Şiddetli Sağanak Yağış',
    85: 'Hafif Kar Sağanağı', 86: 'Kar Sağanağı',
    95: 'Fırtına', 96: 'Hafif Dolu Fırtınası', 99: 'Şiddetli Dolu Fırtınası'
};

const weatherIcons = {
    0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️', 45: '🌫️', 48: '🌫️',
    51: '🌧️', 53: '🌧️', 55: '🌧️', 56: '🌧️', 57: '🌧️',
    61: '🌧️', 63: '🌧️', 65: '⛈️', 66: '🌧️', 67: '🌧️',
    71: '❄️', 73: '❄️', 75: '❄️', 77: '❄️',
    80: '🌧️', 81: '🌧️', 82: '⛈️',
    85: '❄️', 86: '❄️',
    95: '⛈️', 96: '⛈️', 99: '⛈️'
};

let currentCityName = '';
let currentCityTimeZone = '';
let clockInterval;
let deferredPrompt;

// Başlangıçta favori şehirlerimi yüklüyorum
loadFavorites();

searchBtn.addEventListener('click', () => handleSearch(cityInput.value.trim()));
locationBtn.addEventListener('click', handleLocationSearch);
favoriteBtn.addEventListener('click', toggleFavorite);
cityInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch(cityInput.value.trim());
});

// PWA kurulum eventlerimi dinliyorum
window.addEventListener('beforeinstallprompt', (e) => {
    // Mobildeki varsayılan bildirim çubuğunu engelliyorum
    e.preventDefault();
    // Eventi daha sonra tetiklemek için değişkene atıyorum
    deferredPrompt = e;
    // Uygulama yüklenebilir olduğunu belirtmek için butonu gösteriyorum
    installAppBtn.classList.remove('hidden');
});

installAppBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    // Kullanıcıya kurulum penceresini gösteriyorum
    deferredPrompt.prompt();
    // Kullanıcının kurulum kararı vermesini bekliyorum
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    // Kurulum işlemi tamamlandıktan sonra prompt'u siliyorum
    deferredPrompt = null;
    // Kurulum butonunu ekrandan kaldırıyorum
    installAppBtn.classList.add('hidden');
});

window.addEventListener('appinstalled', (event) => {
    console.log('👍 App was installed');
    installAppBtn.classList.add('hidden');
    showToast('Uygulama zaten yüklendi');
});

async function handleSearch(city) {
    if (!city) return;
    showLoading(true);

    try {
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1&language=tr&format=json`;
        const geoRes = await fetch(geoUrl);
        const geoData = await geoRes.json();

        if (!geoData.results || geoData.results.length === 0) throw new Error('Şehir bulunamadı');

        const { latitude, longitude, name, country } = geoData.results[0];
        await fetchWeatherData(latitude, longitude, name, country);
    } catch (error) {
        showError(error.message);
    } finally {
        showLoading(false);
    }
}

async function handleLocationSearch() {
    if (!navigator.geolocation) {
        showError("Tarayıcınız konum özelliğini desteklemiyor.");
        return;
    }

    showLoading(true);
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const { latitude, longitude } = position.coords;
            // Koordinatlarımı alıp hava durumu listesinde şimdilik 'Konumunuz' adıyla getiriyorum
            await fetchWeatherData(latitude, longitude, "Konumunuz", "");
        },
        (error) => {
            showLoading(false);
            showError("Konum alınamadı: " + error.message);
        }
    );
}

async function fetchWeatherData(lat, lon, city, country) {
    currentCityName = city; // Şehrimi favorilerime eklenebilmesi için değişkenime aktarıyorum
    try {
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,surface_pressure,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=auto`;
        const weatherRes = await fetch(weatherUrl);
        const weatherData = await weatherRes.json();

        currentCityTimeZone = weatherData.timezone; // Saatimi otomatik ayarlayabilmek için saat dilimi bilgisini saklıyorum
        updateUI(city, country, weatherData.current, weatherData.daily);
        updateForecast(weatherData.daily);
        updateFavoriteBtnState();
        startLiveClock();
    } catch (error) {
        showError(error.message);
    }
}

function updateUI(city, country, current, daily) {
    const date = new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const weatherCondition = weatherCodes[current.weather_code] || 'Bilinmiyor';

    // Gün doğumu ve gün batımı saatlerimi işlemek üzere ayrıştırıyorum
    let sunriseStr = "Bilinmiyor";
    let sunsetStr = "Bilinmiyor";
    if (daily && daily.sunrise && daily.sunset) {
        // Gelen uzun tarih metninden sadece saat ve dakika kısmını alıyorum
        const sr = new Date(daily.sunrise[0]);
        const ss = new Date(daily.sunset[0]);
        sunriseStr = sr.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        sunsetStr = ss.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    }

    // Arka planımı geçerli vakte ve havaya göre güncelliyorum
    updateBackground(current.weather_code, current.wind_speed_10m, current.is_day);

    const pressure = current.surface_pressure || 1010;
    let fishingText = "Hava balık tutmak için ortalama";
    let fishingQuality = "Ortalama";
    if (pressure >= 1015) {
        fishingText = "Hava balık tutmak için mükemmel";
        fishingQuality = "Mükemmel";
    } else if (pressure < 1005) {
        fishingText = "Hava balık tutmak için kötü";
        fishingQuality = "Kötü";
    }

    weatherContent.innerHTML = `
        <div class="fade-in">
            <h2 class="city-name">${city} ${country ? ', ' + country : ''}</h2>
            <p class="date">${date}</p>
            <p class="local-time" id="localTime">Yükleniyor...</p>
            
            <div class="temperature-container">
                <div class="temp">${Math.round(current.temperature_2m)}°</div>
                <div class="condition">${weatherCondition}</div>
            </div>

            <div class="details-grid">
                <div class="detail-item">
                    <span class="detail-label">Nem</span>
                    <span class="detail-value">%${current.relative_humidity_2m}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Rüzgar</span>
                    <span class="detail-value">${current.wind_speed_10m} km/s</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Basınç</span>
                    <span class="detail-value">${Math.round(pressure)} hPa</span>
                </div>
                <div class="detail-item tooltip-container" title="${fishingText}">
                    <span class="detail-label">Balık 🎣</span>
                    <span class="detail-value fishing-status ${fishingQuality === 'Mükemmel' ? 'excellent' : (fishingQuality === 'Kötü' ? 'bad' : 'average')}">${fishingQuality}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Gün Doğumu 🌅</span>
                    <span class="detail-value">${sunriseStr}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Gün Batımı 🌇</span>
                    <span class="detail-value">${sunsetStr}</span>
                </div>
            </div>
        </div>
    `;
    forecastSection.classList.remove('hidden');
}

function updateForecast(daily) {
    forecastContainer.innerHTML = '';

    // Haftalık tahmin için API'den gelen günlük verileri parçalıyorum
    for (let i = 0; i < 7; i++) {
        const dateStr = new Date(daily.time[i]).toLocaleDateString('tr-TR', { weekday: 'short' });
        const maxTemp = Math.round(daily.temperature_2m_max[i]);
        const minTemp = Math.round(daily.temperature_2m_min[i]);
        const code = daily.weather_code[i];
        const icon = weatherIcons[code] || '❓';

        const card = document.createElement('div');
        card.className = 'forecast-card';
        card.innerHTML = `
            <div class="forecast-day">${dateStr}</div>
            <div class="forecast-icon">${icon}</div>
            <div class="forecast-temp">${maxTemp}° <span>${minTemp}°</span></div>
        `;
        forecastContainer.appendChild(card);
    }
}

// Favori şehir yönetimimi sağlayan fonksiyonlarımı tanımlıyorum
function toggleFavorite() {
    if (!currentCityName) return;

    let favorites = JSON.parse(localStorage.getItem('weatherFavorites')) || [];
    const index = favorites.indexOf(currentCityName);

    if (index === -1) {
        favorites.push(currentCityName);
        showToast('Favorilere eklendi');
    } else {
        favorites.splice(index, 1);
        showToast('Favorilerden çıkarıldı');
    }

    localStorage.setItem('weatherFavorites', JSON.stringify(favorites));
    loadFavorites();
    updateFavoriteBtnState();
}

function loadFavorites() {
    const favorites = JSON.parse(localStorage.getItem('weatherFavorites')) || [];
    favoritesBar.innerHTML = '';

    if (favorites.length > 0) {
        favoritesBar.classList.remove('hidden');
        favorites.forEach(city => {
            const chip = document.createElement('div');
            chip.className = 'favorite-chip';
            chip.innerText = city;
            chip.onclick = () => handleSearch(city);
            favoritesBar.appendChild(chip);
        });
    } else {
        favoritesBar.classList.add('hidden');
    }
}

function updateFavoriteBtnState() {
    const favorites = JSON.parse(localStorage.getItem('weatherFavorites')) || [];
    if (favorites.includes(currentCityName)) {
        favoriteBtn.querySelector('svg').setAttribute('fill', 'currentColor');
    } else {
        favoriteBtn.querySelector('svg').setAttribute('fill', 'none');
    }
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerText = msg;
    toast.classList.remove('hidden');
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.classList.add('hidden'), 300); // Kaybolma animasyonunun bitmesini bekliyorum
    }, 3000);
}

function startLiveClock() {
    if (clockInterval) clearInterval(clockInterval);
    updateClockDisplay();
    clockInterval = setInterval(updateClockDisplay, 1000);
}

function updateClockDisplay() {
    const timeEl = document.getElementById('localTime');
    if (!timeEl) return;

    try {
        const timeZoneOpt = currentCityTimeZone ? { timeZone: currentCityTimeZone } : {};
        const timeStr = new Date().toLocaleTimeString('tr-TR', {
            ...timeZoneOpt,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        timeEl.innerText = "Yerel Saat: " + timeStr;
    } catch (e) {
        console.error("Timezone error:", e);
        timeEl.innerText = "Yerel Saat: " + new Date().toLocaleTimeString('tr-TR');
    }
}

// Canvas animasyonlarım için gerekli global değişkenlerimi tanımlıyorum
let animationId;
let particlesArray = [];
let weatherType = 'clear';
let isWindy = false;
let isDayTime = 1;

function updateBackground(code, windSpeed, isDay) {
    const bgContainer = document.getElementById('bgContainer');

    // Önceki arka plan sınıflarımı tamamen sıfırlıyorum
    bgContainer.className = 'background-container';

    // Eski veri durumunda bilgi gelmezse varsayılan olarak havayı gündüz kabul ediyorum
    isDayTime = (isDay === undefined) ? 1 : isDay;

    let type = 'clear';
    if (code >= 0 && code <= 1) type = 'clear';
    else if (code >= 2 && code <= 3) type = 'cloudy';
    else if ([45, 48].includes(code)) type = 'cloudy';
    else if ([51, 53, 56, 61, 63, 66, 80].includes(code)) type = 'rain'; // Hafif veya orta yağmurlu durumları belirliyorum
    else if ([55, 57, 65, 67, 81, 82, 95, 96, 99].includes(code)) type = 'heavy_rain'; // Şiddetli fırtınamsı yağışlarımı belirtiyorum
    else if ([71, 73, 75, 77, 85, 86].includes(code)) type = 'snow';

    bgContainer.classList.add('weather-bg', type);
    if (isDayTime === 0) {
        bgContainer.classList.add('night');
    }

    weatherType = type;
    isWindy = windSpeed > 20;

    initCanvas();
}

function initCanvas() {
    const canvas = document.getElementById('weatherCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    particlesArray = [];

    // Katmanlı paralaks animasyon motorumu kuruyorum
    let numberOfParticles = 0;
    if (weatherType === 'rain') numberOfParticles = 200; // Optimize edilmiş damla sayımı atıyorum
    else if (weatherType === 'snow') numberOfParticles = 300; // Yoğun kar efektimi yüklüyorum
    else if (weatherType === 'cloudy') numberOfParticles = 20; // Çoklu bulut animasyonumu tanımlıyorum
    else if (weatherType === 'clear') numberOfParticles = 1; // Ekrana tek bir güneş ya da ay çizdiriyorum

    if (isDayTime === 0 && weatherType === 'clear') {
        numberOfParticles += 100; // Karanlıktaki yıldızlarımı oluşturuyorum
    }

    if (isWindy) numberOfParticles += 40;

    let pCount = 0;

    // Ekranda oluşturabileceğim hava partiküllerimin sayısını belirliyorum
    let weatherParticleCount = 1;
    if (weatherType === 'cloudy') weatherParticleCount = 20;
    else if (weatherType === 'rain') weatherParticleCount = 200;
    else if (weatherType === 'heavy_rain') weatherParticleCount = 350; // Kasma yapmasını önleyerek sağanağı artırıyorum
    else if (weatherType === 'snow') weatherParticleCount = 300;

    for (let i = 0; i < weatherParticleCount; i++) {
        particlesArray.push(new Particle(canvas, weatherType));
    }

    // Gece hava açıksa arkaya yıldızlarımı diziyorum
    if (isDayTime === 0 && weatherType === 'clear') {
        for (let i = 0; i < 100; i++) {
            particlesArray.push(new Particle(canvas, 'star'));
        }
    }

    // Rüzgarlıysa rüzgar partiküllerimi çizdiriyorum
    if (isWindy) {
        for (let i = 0; i < 40; i++) {
            particlesArray.push(new Particle(canvas, 'wind'));
        }
    }

    if (animationId) cancelAnimationFrame(animationId);
    animate(canvas, ctx);
}

class Particle {
    constructor(canvas, type) {
        this.canvas = canvas;
        this.type = type;
        this.reset();
    }

    reset() {
        this.x = Math.random() * this.canvas.width;
        this.y = Math.random() * this.canvas.height;

        // Üç boyutlu derinlik hissi katmak için z-indeksini hesaplıyorum
        this.z = Math.random() * 0.8 + 0.2;

        if (this.type === 'rain' || this.type === 'heavy_rain') {
            let isHeavy = this.type === 'heavy_rain';
            let speedMult = isHeavy ? 2.5 : 1; // Kasırgada damla hızımı artırıyorum
            let lengthMult = isHeavy ? 2.5 : 1.5; // Kasırgada damlaların düşüş çizgisini uzatıyorum

            this.y = Math.random() * -this.canvas.height;
            this.speedY = (Math.random() * 10 + 10) * this.z * speedMult;
            this.speedX = (isHeavy ? 5 : 3) * this.z; // Rüzgar esiş açımı simüle ediyorum
            this.length = (Math.random() * 20 + 10) * this.z * lengthMult;
            this.thickness = (Math.random() * 2 + 1) * this.z * (isHeavy ? 1.5 : 1);
            this.opacity = Math.random() * 0.5 + (isHeavy ? 0.3 : 0.2); // Suyu daha doygun görünür yapıyorum
        } else if (this.type === 'snow') {
            this.y = Math.random() * -this.canvas.height;
            this.speedY = (Math.random() * 3 + 1) * this.z;
            this.speedX = (Math.random() * 2 - 1) * this.z;
            this.size = (Math.random() * 3 + 1) * this.z * 1.5;
            this.angle = Math.random() * Math.PI * 2;
            this.spin = (Math.random() * 0.05 - 0.02);
            this.opacity = this.z * 0.8 + 0.2;
        } else if (this.type === 'wind') {
            this.x = Math.random() * -this.canvas.width;
            this.speedX = (Math.random() * 20 + 15) * this.z;
            this.speedY = 0;
            this.length = (Math.random() * 200 + 50) * this.z;
            this.opacity = this.z * 0.3;
        } else if (this.type === 'cloudy') {
            this.size = (Math.random() * 200 + 100) * this.z;
            this.speedX = (Math.random() * 0.5 + 0.1) * this.z;
            this.speedY = 0;
            this.opacity = this.z * 0.15;
            this.y = Math.random() * (this.canvas.height / 2); // Bulutları gökyüzünün üst kısmında topluyorum
        } else if (this.type === 'clear') {
            this.x = this.canvas.width - 150;
            this.y = 150;
            // Saatime göre güneşimi veya ayımı hazırlıyorum
            this.size = isDayTime ? 80 : 60;
            this.angle = 0;
        } else if (this.type === 'star') {
            this.x = Math.random() * this.canvas.width;
            this.y = Math.random() * this.canvas.height;
            this.size = Math.random() * 1.5;
            this.opacity = Math.random();
            this.speedX = (Math.random() * 0.02) - 0.01; // Parlaklığımı değiştirerek yıldızlarıma parıltı kazandırıyorum
        }
    }

    update() {
        if (this.type === 'rain' || this.type === 'heavy_rain') {
            this.y += this.speedY;
            this.x += this.speedX;
            if (this.y > this.canvas.height) {
                this.x = Math.random() * this.canvas.width - (this.speedX * 50);
                this.y = -50;
            }
        } else if (this.type === 'snow') {
            this.y += this.speedY;
            this.angle += this.spin;
            this.x += Math.sin(this.angle) * this.z * 2;
            if (this.y > this.canvas.height) {
                this.x = Math.random() * this.canvas.width;
                this.y = -50;
            }
        } else if (this.type === 'wind') {
            this.x += this.speedX;
            if (this.x > this.canvas.width + this.length) {
                this.x = -this.length * 2;
            }
        } else if (this.type === 'cloudy') {
            this.x += this.speedX;
            if (this.x > this.canvas.width + this.size) {
                this.x = -this.size;
            }
        } else if (this.type === 'clear') {
            this.angle += 0.002;
        } else if (this.type === 'star') {
            this.opacity += this.speedX;
            if (this.opacity > 1 || this.opacity < 0.1) {
                this.speedX = -this.speedX;
            }
        }
    }

    draw(ctx) {
        if (this.type === 'rain' || this.type === 'heavy_rain') {
            // Cam damla hissi için şeffaflık veriyorum
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x + this.speedX, this.y + this.length);
            ctx.strokeStyle = `rgba(180, 220, 255, ${this.opacity})`;
            ctx.lineWidth = this.thickness;
            ctx.lineCap = 'round';
            ctx.shadowBlur = 4 * this.z;
            ctx.shadowColor = 'rgba(180, 220, 255, 0.8)';
            ctx.stroke();
            ctx.shadowBlur = 0; // Ayarlarımı geri sıfırlıyorum
        } else if (this.type === 'snow') {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${this.opacity})`;
            ctx.shadowBlur = 5;
            ctx.shadowColor = 'white';
            ctx.fill();
            ctx.shadowBlur = 0;
        } else if (this.type === 'wind') {
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x + this.length, this.y);
            ctx.strokeStyle = `rgba(255,255,255,${this.opacity})`;
            ctx.lineWidth = this.z * 2;
            ctx.stroke();
        } else if (this.type === 'cloudy') {
            let gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
            gradient.addColorStop(0, `rgba(255,255,255,${this.opacity})`);
            gradient.addColorStop(1, `rgba(255,255,255,0)`);

            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
            ctx.fill();
        } else if (this.type === 'clear') {
            if (isDayTime) {
                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.rotate(this.angle);
                ctx.fillStyle = 'rgba(255, 230, 100, 0.15)';
                for (let i = 0; i < 8; i++) {
                    ctx.rotate(Math.PI / 4);
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(30, -500);
                    ctx.lineTo(-30, -500);
                    ctx.fill();
                }
                ctx.restore();

                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = '#ffbb00';
                ctx.shadowBlur = 80;
                ctx.shadowColor = '#ffbb00';
                ctx.fill();
                ctx.shadowBlur = 0;
            } else {
                // Gökyüzüme hilal şeklinde ayımı çiziyorum
                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.beginPath();
                ctx.arc(0, 0, this.size, 0, Math.PI * 2);
                ctx.fillStyle = '#f6f1d5';
                ctx.shadowBlur = 30;
                ctx.shadowColor = '#f6f1d5';
                ctx.fill();

                // Ayımın üstüne gece rengimde bir daire kapatarak ona hilal şekli kazandırıyorum
                ctx.beginPath();
                ctx.arc(-this.size * 0.3, -this.size * 0.3, this.size * 1.1, 0, Math.PI * 2);
                // Gece arka planıma uyumlu bir renk vererek kesilmiş kısımları sahte bir şekilde saklıyorum
                ctx.fillStyle = '#050a24';
                ctx.shadowBlur = 0;
                ctx.fill();
                ctx.restore();
            }
        }
    }
}

let flashOpacity = 0;
let lastFlashTime = Date.now();

function animate(canvas, ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < particlesArray.length; i++) {
        particlesArray[i].update();
        particlesArray[i].draw(ctx);
    }

    // Fırtınam varsa havaya şimşek efekti çakıyorum
    if (weatherType === 'heavy_rain') {
        let now = Date.now();
        // Belirli saniye aralıklarıyla parlaklığı aniden artırıyorum
        if (now - lastFlashTime > Math.random() * 5000 + 3000) {
            flashOpacity = 0.8;
            lastFlashTime = now + (Math.random() * 2000); // Şimşeklerimin üst üste binmesini engelleyecek offset veriyorum
        }

        if (flashOpacity > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${flashOpacity})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            flashOpacity -= 0.05; // Şimşeğimi aniden söndürüp gizemi koruyorum 

            // Bazen şimşeği titreterek estetiğini artırıyorum
            if (flashOpacity < 0.3 && flashOpacity > 0.25 && Math.random() > 0.4) {
                flashOpacity += 0.4;
            }
        }
    }

    animationId = requestAnimationFrame(() => animate(canvas, ctx));
}

window.addEventListener('resize', () => {
    initCanvas();
});

// İlk yükleme ekranı boş kalmasın diye varsayılan olarak güneşli bulutsuz animasyonumu çalıştırıyorum
updateBackground(1, 0, 1);

function showError(message) {
    weatherContent.innerHTML = `
        <div class="fade-in" style="color: #ff6b6b; margin-top: 20px;">
            <p>😕 ${message}</p>
        </div>
    `;
    forecastSection.classList.add('hidden');
}

function showLoading(isLoading) {
    if (isLoading) {
        weatherContent.classList.add('hidden');
        forecastSection.classList.add('hidden');
        loadingSpinner.classList.remove('hidden');
    } else {
        weatherContent.classList.remove('hidden');
        loadingSpinner.classList.add('hidden');
    }
}
