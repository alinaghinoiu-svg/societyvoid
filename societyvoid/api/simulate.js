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

  const cultureList = cultures.map(c => `${c.name}`).join(", ");

  const prompt = `Analyze this event: "${scenario}"

For cultures: ${cultureList}

Respond with ONLY this JSON structure, no other text:
{"global_emotions":[{"name":"Hope","intensity":70,"attitude":"invest and explore"},{"name":"Fear","intensity":40,"attitude":"avoid risk"}],"cultures":[{"name":"United States","flag_emoji":"US","dominant_emotion":"Hope","emotional_profile":"Americans react with optimism and entrepreneurial spirit. They see opportunity in this change.","attitude":"Invest in new technologies and adapt quickly","economic_impact":{"consumer_spending":8,"investment_flow":12,"market_sentiment":15,"social_stability":5}},{"name":"Germany","flag_emoji":"DE","dominant_emotion":"Fear","emotional_profile":"Germans approach this cautiously. Systematic analysis before action is typical.","attitude":"Wait and analyze before committing resources","economic_impact":{"consumer_spending":-5,"investment_flow":-3,"market_sentiment":-8,"social_stability":2}}],"global_economic_forecast":{"short_term":"Markets react with volatility in the first 30 days","long_term":"Structural adaptation leads to new equilibrium over 12 months","winning_sectors":["Technology","Healthcare","Finance"],"losing_sectors":["Traditional retail","Manufacturing"],"opportunity_score":65},"strategic_verdict":"Decision makers should act swiftly but carefully. The emotional climate favors bold moves with risk management."}

Now generate the SAME structure but for: "${scenario}" with cultures: ${cultureList}
Use only ASCII characters. No special quotes. Return only valid JSON.`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_KEY}`
      },
      body: JSON.stringify({
        model: "gemma2-9b-it",
        max_tokens: 2000,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: "You are a JSON generator. Output only valid JSON. Never use special characters or smart quotes. Always use straight ASCII double quotes."
          },
          { role: "user", content: prompt }
        ],
      }),
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    let text = data.choices?.[0]?.message?.content || "";
    
    // Aggressive cleaning
    text = text
      .replace(/```json/gi, "").replace(/```/g, "")
      .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
      .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
      .replace(/[\u2032\u2033]/g, "'")
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
      .trim();

    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("Invalid response format");
    
    const jsonStr = text.slice(start, end + 1);
    const parsed = JSON.parse(jsonStr);
    
    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: e.message || "Simulation failed. Please try again." });
  }
}
