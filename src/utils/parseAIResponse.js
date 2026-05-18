/**
 * Robustly parse AI JSON responses and validate the schema.
 * Includes fallback logic for malformed output.
 */
export function parseAIResponse(rawResponse) {
  let cleaned = rawResponse.trim();
  
  // 1. Strip markdown fences if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/```$/, '').trim();
  } else if (cleaned.includes('{') && cleaned.includes('}')) {
    // If there's text outside the JSON, try to extract the JSON block
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  } else if (!cleaned.startsWith('{') && cleaned.includes('}')) {
    // If we primed with '{', the model might start directly with key-value pairs
    cleaned = '{' + cleaned;
  }

  try {
    const parsed = JSON.parse(cleaned);
    
    // 2. Validate and sanitize fields
    const message = parsed.message || parsed.response || parsed.text || parsed.reply || parsed.content || "I'm listening. Please tell me more.";
    
    // Check if emotional telemetry fields were completely omitted by the model
    const wasOmitted = !parsed.emotion && !parsed.intensity && !parsed.stress_level;

    let emotion = parsed.emotion || "calm";
    if (typeof emotion === 'string') {
      emotion = emotion.toLowerCase().trim();
      if (emotion === 'hopeful') emotion = 'happy';
      else if (emotion === 'angry') emotion = 'stressed';
      else if (emotion === 'confused' || emotion === 'neutral') emotion = 'calm';
      else if (!['happy', 'calm', 'anxious', 'sad', 'stressed'].includes(emotion)) {
        emotion = 'calm';
      }
    } else {
      emotion = 'calm';
    }

    return {
      message,
      emotion,
      intensity: typeof parsed.intensity === 'number' ? parsed.intensity : 0.5,
      stress_level: typeof parsed.stress_level === 'number' ? parsed.stress_level : 0.3,
      crisis: Boolean(parsed.crisis) || false,
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      mood_tag: parsed.mood_tag || (wasOmitted ? "fallback" : emotion)
    };
  } catch (error) {
    console.error('❌ Failed to parse AI JSON response:', error.message);
    console.debug('Raw response:', rawResponse);
    
    // 3. Fallback: Wrap raw text as message
    return {
      message: rawResponse.trim() || "I'm sorry, I'm having trouble processing that. Could you say it again?",
      emotion: "calm",
      intensity: 0.5,
      stress_level: 0.3,
      crisis: false,
      suggestions: [],
      mood_tag: "fallback"
    };
  }
}
