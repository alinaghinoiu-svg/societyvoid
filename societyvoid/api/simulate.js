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

  const cultureList = cultures.map(c => c.name).join(", ");

  const prompt = `You are a socio-economic simulator. Analyze this event and return JSON.

EVENT: "${scenario}"
CULTURES TO ANALYZE: ${cultureList}

Return a JSON object with this exact structure:
{
  "global_emotions": [
    {"name": "Hope", "intensity": 65, "attitude": "invest and explore"},
    {"name": "Fear", "intensity": 45, "attitude": "avoid risk and save"}
  ],
  "cultures": [
    {
      "name": "CULTURE_NAME",
      "flag_emoji": "FLAG",
      "dominant_emotion": "Hope",
      "emotional_profile": "Two sentences about how this culture reacts emotionally.",
      "attitude": "Specific economic behavior this culture takes.",
      "economic_impact": {
        "consumer_spending": 10,
        "investment_flow": 15,
        "market_sentiment": 12,
        "social_stability": 5
      }
    }
  ],
  "global_economic_forecast": {
    "short_term": "One sentence about next 30 days.",
    "long_term": "One sentence about next 12 months.",
    "winning_sectors": ["Technology", "Healthcare", "Finance"],
    "losing_sectors": ["Manufacturing", "Retail"],
    "opportunity_score": 68
  },
  "strategic_verdict": "Two sentences of strategic advice for decision makers."
}

Analyze the event for all ${cultures.length} cultures: ${cultureList}
Use emotions from: Fear, Anger, Hope, Trust, Disgust, Surprise, Anxiety, Euphoria
Economic values must be integers between -40 and 40.`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        max_tokens: 2000,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are a socio-economic simulator. Always respond with valid JSON only."
          },
          { role: "user", content: prompt }
        ],
      }),
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const text = data.choices?.[0]?.message?.content || "";
    const parsed = JSON.parse(text);
    return res.status(200).json(parsed);

  } catch (e) {
    return res.status(500).json({ error: e.message || "Simulation failed. Please try again." });
  }
}
