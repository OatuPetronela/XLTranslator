const { OpenAI } = require('openai');

class TranslationService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    // Language mapping for clearer prompts
    this.languageNames = {
      'ARA': 'Arabic',
      'BGR': 'Bulgarian', 
      'CAT': 'Catalan',
      'CHT': 'Chinese (Traditional)',
      'CSY': 'Czech',
      'DAN': 'Danish',
      'DEU': 'German',
      'ELL': 'Greek',
      'ENU': 'English (US)',
      'ESP': 'Spanish',
      'FIN': 'Finnish',
      'FRA': 'French',
      'HEB': 'Hebrew',
      'HUN': 'Hungarian',
      'ITA': 'Italian',
      'JPN': 'Japanese',
      'KOR': 'Korean',
      'NLD': 'Dutch',
      'NOR': 'Norwegian',
      'PLK': 'Polish',
      'PTB': 'Portuguese (Brazil)',
      'ROM': 'Romanian',
      'RUS': 'Russian',
      'HRV': 'Croatian',
      'SKY': 'Slovak',
      'SQI': 'Albanian',
      'SVE': 'Swedish',
      'THA': 'Thai',
      'TRK': 'Turkish',
      'IND': 'Indonesian',
      'UKR': 'Ukrainian',
      'BEL': 'Belarusian',
      'SLV': 'Slovenian',
      'ETI': 'Estonian',
      'LVI': 'Latvian',
      'LTH': 'Lithuanian',
      'VIT': 'Vietnamese',
      'EUQ': 'Basque',
      'HIN': 'Hindi',
      'MSL': 'Malay',
      'GLC': 'Galician',
      'CHS': 'Chinese (Simplified)',
      'ENG': 'English (UK)',
      'PTG': 'Portuguese',
      'SRM': 'Serbian (Latin)',
      'ESN': 'Spanish (Modern)',
      'SRN': 'Serbian (Cyrillic)',
      'BSC': 'Bosnian'
    };
  }

  // Translate a list of texts to target language
  async translateTexts(texts, sourceLanguage, targetLanguage) {
    if (!texts || texts.length === 0) return [];
    
    const sourceLangName = this.languageNames[sourceLanguage] || sourceLanguage;
    const targetLangName = this.languageNames[targetLanguage] || targetLanguage;
    
    // Process in batches for efficiency
    const batchSize = 15;
    const allTranslations = [];
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      try {
        const batchTranslations = await this.translateBatch(
          batch, sourceLangName, targetLangName
        );
        allTranslations.push(...batchTranslations);
        
        // Pause between batches for rate limiting
        if (i + batchSize < texts.length) {
          await this.sleep(1000);
        }
      } catch (error) {
        // Add null values for failed translations
        for (let j = 0; j < batch.length; j++) {
          allTranslations.push(null);
        }
      }
    }
    
    return allTranslations;
  }

  // Translate a batch of texts
  async translateBatch(texts, sourceLanguage, targetLanguage) {
    const preparedTexts = texts.map(text => this.prepareTextForTranslation(text));
    
    const textList = preparedTexts.map((prepared, index) => 
      `${index + 1}. ${prepared.preparedText}`
    ).join('\n');

    const prompt = `Translate the following texts from ${sourceLanguage} to ${targetLanguage}.

IMPORTANT RULES:
- Keep ALL __TAG_X__ placeholders EXACTLY in their correct positions
- DO NOT translate or modify __TAG_X__ placeholders
- For very short texts (1-2 words), provide the most natural translation
- For incomplete or truncated texts, complete the translation logically
- Preserve original formatting and spacing
- Texts may contain HTML tags and special scripts - these must be preserved intact

Texts to translate:
${textList}

Respond ONLY with numbered translations, no explanations:`;

    const response = await this.openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: "You are a professional translator specialized in interface and application translation. You strictly follow instructions regarding placeholder preservation and formatting."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.2,
      max_tokens: 3000
    });

    const rawTranslations = this.parseResponse(response.choices[0].message.content);
    
    const finalTranslations = rawTranslations.map((translation, index) => {
      if (translation && preparedTexts[index]) {
        return this.restoreTagsInTranslation(
          translation, 
          preparedTexts[index].placeholderMap
        );
      }
      return translation;
    });

    return finalTranslations;
  }

  prepareTextForTranslation(text) {
    let preparedText = text;
    const placeholderMap = new Map();
    let tagIndex = 0;
    
    const htmlPattern = /<[^>]+>/g;
    const askiaPattern = /!!([^!]+)!!/g;
    
    preparedText = preparedText.replace(htmlPattern, (match) => {
      const placeholder = `__TAG_${tagIndex}__`;
      placeholderMap.set(placeholder, match);
      tagIndex++;
      return placeholder;
    });
    
    preparedText = preparedText.replace(askiaPattern, (match) => {
      const placeholder = `__TAG_${tagIndex}__`;
      placeholderMap.set(placeholder, match);
      tagIndex++;
      return placeholder;
    });
    
    return {
      preparedText,
      placeholderMap
    };
  }

  restoreTagsInTranslation(translatedText, placeholderMap) {
    let restoredText = translatedText;
    
    for (let [placeholder, originalTag] of placeholderMap) {
      restoredText = restoredText.replace(placeholder, originalTag);
    }
    
    return restoredText;
  }

  parseResponse(response) {
    const translations = [];
    const lines = response.trim().split('\n');
    
    for (const line of lines) {
      const match = line.match(/^\s*(\d+)\.\s*(.+)$/);
      if (match) {
        const index = parseInt(match[1]) - 1;
        const translation = match[2].trim();
        translations[index] = translation;
      }
    }
    
    return translations;
  }

  async testConnection() {
    await this.openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: "Hello, test connection" }],
      max_tokens: 10
    });
    
    return true;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = TranslationService;