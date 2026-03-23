export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { scenario, cultures } = req.body;
  if (!scenario || !cultures) return res.status(400).json({ error: "Missing data" });

  const GROQ_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_KEY) return res.status(500).json({ error: "Server configuration error" });

  const prompt = `You are an advanced socio-economic simulator mapping events to emotions and economic consequences.

EVENT: "${scenario}"
CULTURES: ${cultures.map(c => `${c.name} (${c.desc})`).join(", ")}

Return ONLY raw valid JSON (no markdown, no backticks, start with {):
{
  "global_emotions":[{"name":"Fear","intensity":72,"attitude":"sell, hoard, avoid risk"}],
  "cultures":[{
    "name":"Country",
    "flag_emoji":"🇺🇸",
    "dominant_emotion":"Fear",
    "emotional_profile":"2 sentence culturally specific emotional reaction",
    "attitude":"concrete economic behavior triggered",
    "economic_impact":{"consumer_spending":-12,"investment_flow":-8,"market_sentiment":-15,"social_stability":-5}
  }],
  "global_economic_forecast":{
    "short_term":"30 day forecast",
    "long_term":"12 month forecast",
    "winning_sectors":["s1","s2","s3"],
    "losing_sectors":["s1","s2"],
    "opportunity_score":65
  },
  "strategic_verdict":"2-3 sentence verdict for decision-makers"
}
Rules: global_emotions 3-5 from: Fear,Anger,Hope,Trust,Disgust,Surprise,Anxiety,Euphoria. ${cultures.length} culture entries. Economic values -40 to +40.`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 2000, temperature: 0.65,
        messages: [
          { role: "system", content: "Socio-economic simulator. Valid JSON only. No markdown. Start with {" },
          { role: "user", content: prompt }
        ],
      }),
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    const text = data.choices?.[0]?.message?.content || "";
    const s = text.indexOf("{"), e = text.lastIndexOf("}");
    const parsed = JSON.parse(text.slice(s, e + 1));
    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: e.message || "Simulation failed" });
  }
}
