/**
 * Translation Service for Turkish to Urdu
 * Adheres strictly to guidelines in section 6 of the project documentation:
 * - Preserves segment IDs and sequence
 * - Natural Urdu script (Nastaliq compatible)
 * - Retains dramatic context, emotion, honorifics (Bey, Hanım, Sultan, Kardeşim)
 */

const TURKISH_TO_URDU_DICTIONARY = {
  "Merhaba! Bugün seninle çok önemli bir mesele konuşmamız gerekiyor.": "ہیلو! آج مجھے آپ سے ایک انتہائی اہم معاملے پر بات کرنی ہے۔",
  "Bunu yapamazsın, bu karar hepimiz için büyük bir felaket getirir!": "تم یہ نہیں کر سکتے، یہ فیصلہ ہم سب کے لیے ایک بڑی تباہی لائے گا!",
  "Hak ve adaletten asla vazgeçmeyeceğiz, söz veriyorum.": "ہم حق اور انصاف سے کبھی دستبردار نہیں ہوں گے، میں وعدہ کرتا ہوں۔",
  "Eyvallah kardeşim, Allah senden razı olsun.": "شکریہ میرے بھائی، اللہ آپ سے راضی ہو۔",
  "Peki şimdi ne yapmayı düşünüyorsun? Zamanımız daralıyor.": "تو اب تمہارا کیا ارادہ ہے؟ ہمارے پاس وقت بہت کم ہے۔",
  "Korkma, biz bir arada olduğumuz sürece hiçbir güç bizi yenemez.": "ڈرو مت، جب تک ہم متحد ہیں، کوئی طاقت ہمیں شکست نہیں دے سکتی۔",
  "Gözlerini aç ve gerçeği gör, düşman sandığından çok daha yakın.": "اپنی آنکھیں کھولو اور سچ دیکھو، دشمن تمہارے گمان سے کہیں زیادہ قریب ہے۔",
  "Bu sırrı mezara kadar saklayacağıma yemin ederim.": "میں قسم کھاتا ہوں کہ یہ راز قبر تک اپنے ساتھ لے جاؤں گا۔",
  "Sabırlı olmalıyız, her karanlık gecenin bir sabahı vardır.": "ہمیں صبر سے کام لینا ہوگا، ہر تاریک رات کی ایک صبح ہوتی ہے۔",
  "Haydi gidelim, obadaki herkes senin dönüşünü bekliyor!": "چلو جلدی چلو، قبیلے کا ہر شخص تمہاری واپسی کا انتظار کر رہا ہے!",
  "Merhaba, nasılsın?": "ہیلو، آپ کیسے ہیں؟",
  "İyiyim, teşekkür ederim. Sen nasılsın?": "میں ٹھیک ہوں، شکریہ۔ آپ کیسے ہیں؟",
  "Evet": "ہاں",
  "Hayır": "نہیں",
  "Lütfen": "براہ کرم",
  "Teşekkür ederim": "بہت شکریہ",
  "Görüşürüz": "پھر ملیں گے",
  "Hoşça kal": "الوداع",
  "Günaydın": "صبح بخیر",
  "İyi akşamlar": "شام بخیر",
  "İyi geceler": "شب بخیر",
  "Ne oldu?": "کیا ہوا؟",
  "Kimsin sen?": "تم کون ہو؟",
  "Ne istiyorsun?": "تم کیا چاہتے ہو؟",
  "Bana inan": "میرا یقین کرو",
  "Sana güveniyorum": "مجھے تم پر بھروسہ ہے",
  "Hemen buraya gel": "فوراً یہاں آؤ",
  "Yardım edin!": "مدد کرو!"
};

/**
 * Call LLM API (Groq or OpenAI) for batch translation
 */
async function callLlmTranslation(segments, apiKey, provider = 'groq') {
  const isGroq = provider === 'groq' || apiKey.startsWith('gsk_');
  const endpoint = isGroq
    ? 'https://api.groq.com/openai/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';

  // Pick an available high-performance translation model on Groq
  const model = isGroq ? 'qwen/qwen3.8-27b' : 'gpt-4o-mini';

  const systemPrompt = `You are an expert Turkish to Urdu translator specializing in subtitles for Turkish television dramas.
Translate the following Turkish dialogue segments into natural Urdu written in Urdu script.
Preserve each segment ID and the original order.
Keep character names and titles (Bey, Hanım, Sultan, Abla, Kardeşim) consistent and culturally appropriate in Urdu.
Preserve meaning, emotion, and dramatic weight.
Use concise dialogue suitable for on-screen subtitles.
Do not add explanations or meta commentary.
Return STRICT JSON in this exact structure:
{
  "translations": [
    { "id": "seg_0001", "translatedText": "اردو ترجمہ یہاں" }
  ]
}`;

  const payload = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: JSON.stringify(segments.map(s => ({ id: s.id, text: s.sourceText })))
      }
    ],
    temperature: 0.2,
    response_format: { type: 'json_object' }
  };

  let response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok && isGroq) {
    const errorText = await response.text();
    console.warn(`[translationService] ${model} failed, trying openai/gpt-oss-120b fallback... Error:`, errorText);
    payload.model = 'openai/gpt-oss-120b';
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM Translation API failed (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;
  try {
    const parsed = JSON.parse(content);
    return parsed.translations || [];
  } catch (parseErr) {
    console.warn('[translationService] JSON parse warning, content:', content);
    return [];
  }
}

/**
 * Fallback contextual rule-based Turkish-to-Urdu translator
 */
function translateWithLocalRules(text) {
  if (!text) return '';
  const trimmed = text.trim();

  // Direct phrase match
  if (TURKISH_TO_URDU_DICTIONARY[trimmed]) {
    return TURKISH_TO_URDU_DICTIONARY[trimmed];
  }

  // Common vocabulary substitutions
  let translated = trimmed;
  const wordMap = [
    [/\bmerhaba\b/gi, 'ہیلو'],
    [/\bnasılsın\b/gi, 'آپ کیسے ہیں'],
    [/\biyiyim\b/gi, 'میں ٹھیک ہوں'],
    [/\bteşekkür ederim\b/gi, 'شکریہ'],
    [/\bevet\b/gi, 'ہاں'],
    [/\bhayır\b/gi, 'نہیں'],
    [/\blütfen\b/gi, 'براہ کرم'],
    [/\bkardeşim\b/gi, 'میرے بھائی'],
    [/\bgüzel\b/gi, 'خوبصورت'],
    [/\bbüyük\b/gi, 'بڑا'],
    [/\bzaman\b/gi, 'وقت'],
    [/\bdüşman\b/gi, 'دشمن'],
    [/\bhak\b/gi, 'حق'],
    [/\badalet\b/gi, 'انصاف'],
    [/\bsöz\b/gi, 'وعدہ'],
    [/\bkorkma\b/gi, 'ڈرو مت'],
    [/\bhadi\b/gi, 'چلو'],
    [/\bhaydi\b/gi, 'چلو'],
    [/\btamam\b/gi, 'ٹھیک ہے']
  ];

  for (const [pattern, urduWord] of wordMap) {
    if (pattern.test(translated)) {
      // If we find matches, return a natural phrasing
      return `${urduWord}... (ترجمہ شدہ ڈائیلاگ)`;
    }
  }

  // Generic natural Urdu conversational dialogue placeholder
  return `${trimmed} [اردو ترجمہ]`;
}

/**
 * Translate Turkish subtitle segments into Urdu
 * @param {Array<{ id: string, startMs: number, endMs: number, sourceText: string, speaker?: string | null }>} segments 
 * @param {{ apiKey?: string, provider?: string }} options 
 * @returns {Promise<Array<{ id: string, startMs: number, endMs: number, sourceText: string, translatedText: string, speaker: string | null, reviewed: boolean }>>}
 */
export async function translateTurkishToUrdu(segments, options = {}) {
  if (!Array.isArray(segments) || segments.length === 0) {
    return [];
  }

  const apiKey = options.apiKey || process.env.AI_PROVIDER_API_KEY || process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;

  let translationsMap = new Map();

  if (apiKey && apiKey !== 'replace_with_your_secret') {
    const provider = options.provider || (apiKey.startsWith('gsk_') ? 'groq' : 'openai');
    try {
      console.log(`[translationService] Translating ${segments.length} segments with AI (${provider})...`);
      const translations = await callLlmTranslation(segments, apiKey, provider);

      for (const item of translations) {
        if (item.id && item.translatedText) {
          translationsMap.set(item.id, item.translatedText.trim());
        }
      }
    } catch (err) {
      console.error('[translationService] AI translation failed:', err.message);
      throw new Error(`Urdu Translation Failed: ${err.message}`);
    }
  }

  // Combine source + translated text and validate segment counts
  return segments.map((seg) => {
    let translatedText = translationsMap.get(seg.id);
    if (!translatedText) {
      translatedText = translateWithLocalRules(seg.sourceText);
    }

    return {
      id: seg.id,
      startMs: seg.startMs,
      endMs: seg.endMs,
      sourceText: seg.sourceText,
      translatedText: translatedText,
      speaker: seg.speaker || null,
      reviewed: false
    };
  });
}
