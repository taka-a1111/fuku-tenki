// ふくてんき 中継API：スマホから外部APIへ直接つながらないときの予備経路
// 許可した取得先（天気・地名検索・逆ジオコーディング）以外には中継しない
const UA = "fuku-tenki/1.0 (https://fuku-tenki.vercel.app)";
const DAILY = "weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_probability_max,precipitation_sum,snowfall_sum,uv_index_max,wind_speed_10m_max";
const HOURLY = "temperature_2m,apparent_temperature,weather_code,precipitation_probability";

function num(v){ const n = Number(v); return Number.isFinite(n) ? n : null; }

module.exports = async (req, res) => {
  const q = req.query || {};
  let url, cache = "s-maxage=600, stale-while-revalidate=600";
  if (q.kind === "weather" || q.kind === "reverse") {
    const lat = num(q.lat), lon = num(q.lon);
    if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      res.status(400).json({ error: "bad coords" }); return;
    }
    if (q.kind === "weather") {
      url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&daily=${DAILY}&hourly=${HOURLY}&timezone=auto&forecast_days=15&wind_speed_unit=ms`;
    } else {
      url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}&zoom=14&accept-language=ja`;
      cache = "s-maxage=86400";
    }
  } else if (q.kind === "search" || q.kind === "geocode") {
    const s = String(q.q || "").trim().slice(0, 100);
    if (!s) { res.status(400).json({ error: "empty query" }); return; }
    url = q.kind === "search"
      ? `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(s)}&accept-language=ja&limit=8`
      : `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(s)}&count=8&language=ja&format=json`;
    cache = "s-maxage=86400";
  } else {
    res.status(400).json({ error: "unknown kind" }); return;
  }
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, "Accept": "application/json" } });
    const body = await r.text();
    res.status(r.status);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    if (r.ok) res.setHeader("Cache-Control", cache);
    res.send(body);
  } catch (e) {
    res.status(502).json({ error: "upstream unreachable" });
  }
};
