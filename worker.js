import cheerio from "cheerio";

// Target markets
const TARGET_MARKETS = [
  { market_name: "SRIDEVI", open_time: "11:35 AM", close_time: "12:35 PM" },
  { market_name: "TIME BAZAR", open_time: "01:10 PM", close_time: "02:10 PM" },
  { market_name: "MADHUR DAY", open_time: "01:30 PM", close_time: "02:30 PM" },
  { market_name: "RAJDHANI DAY", open_time: "03:00 PM", close_time: "05:00 PM" },
  { market_name: "MILAN DAY", open_time: "03:10 PM", close_time: "05:10 PM" },
  { market_name: "KALYAN", open_time: "03:45 PM", close_time: "05:45 PM" },
  { market_name: "SRIDEVI NIGHT", open_time: "07:15 PM", close_time: "08:15 PM" },
  { market_name: "MADHUR NIGHT", open_time: "08:30 PM", close_time: "10:30 PM" },
  { market_name: "MILAN NIGHT", open_time: "09:10 PM", close_time: "11:10 PM" }
];

// Helper function to parse time
const parseTime = (timeStr) => {
  const [time, modifier] = timeStr.split(" ");
  let [hours, minutes] = time.split(":").map(Number);
  if (modifier === "PM" && hours !== 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;
  return new Date().setHours(hours, minutes, 0, 0);
};

// Format the winning number based on time
const formatWinningNumber = (winningNumber, market) => {
  const now = new Date().getTime();
  const openTime = parseTime(market.open_time);
  const closeTime = parseTime(market.close_time);

  if (now < openTime) return "***-**-***";
  if (now < closeTime) return `${winningNumber.slice(0, 3)}-${winningNumber[3] || ''}`;
  return winningNumber;
};

// Scrape the data
const scrapeWinningNumbers = async () => {
  try {
    console.log("Scraping data from: https://dpbosssnet.services/");
    
    const response = await fetch("https://dpbosssnet.services/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
        "Referer": "https://www.google.com/",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!response.ok) {
      throw new Error(`Received non-200 response: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const results = [];

    const findMarket = (name) => TARGET_MARKETS.find(m => m.market_name.toLowerCase() === name.toLowerCase());

    // Scrape results from .tkt-val
    $("div.tkt-val > div").each((_, element) => {
      const marketName = $(element).find("h4").text().trim();
      const winningNumber = $(element).find("span").text().trim();

      const market = findMarket(marketName);
      if (market && winningNumber) {
        results.push({
          market: marketName,
          winningNumber: formatWinningNumber(winningNumber, market)
        });
      }
    });

    // Scrape results from .lv-mc
    $("div.lv-mc").each((_, element) => {
      const spans = $(element).find("span");
      if (spans.length >= 2) {
        const marketName = spans.first().text().trim();
        const winningNumber = spans.eq(1).text().trim();

        const market = findMarket(marketName);
        if (market && winningNumber) {
          results.push({
            market: marketName,
            winningNumber: formatWinningNumber(winningNumber, market)
          });
        }
      }
    });

    console.log("Scraped Data:", results);
    return results;
  } catch (error) {
    console.error("Error scraping data:", error.message);
    return [];
  }
};

// Cloudflare Worker Entry Point
export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/api/results") {
      const data = await scrapeWinningNumbers();

      if (!data || data.length === 0) {
        return new Response(JSON.stringify({
          error: "No data scraped. Site may be blocking requests or changed structure.",
        }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response("Not Found", { status: 404 });
  },
};
