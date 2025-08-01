const { OpenAI } = require('openai');

class TranslationService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    this.languageNames = {
      'ARA': 'Arabic', 'BGR': 'Bulgarian', 'CAT': 'Catalan', 'CHT': 'Chinese (Traditional)',
      'CSY': 'Czech', 'DAN': 'Danish', 'DEU': 'German', 'ELL': 'Greek',
      'ENU': 'English (US)', 'ESP': 'Spanish', 'FIN': 'Finnish', 'FRA': 'French',
      'HEB': 'Hebrew', 'HUN': 'Hungarian', 'ITA': 'Italian', 'JPN': 'Japanese',
      'KOR': 'Korean', 'NLD': 'Dutch', 'NOR': 'Norwegian', 'PLK': 'Polish',
      'PTB': 'Portuguese (Brazil)', 'ROM': 'Romanian', 'RUS': 'Russian', 'HRV': 'Croatian',
      'SKY': 'Slovak', 'SQI': 'Albanian', 'SVE': 'Swedish', 'THA': 'Thai',
      'TRK': 'Turkish', 'IND': 'Indonesian', 'UKR': 'Ukrainian', 'BEL': 'Belarusian',
      'SLV': 'Slovenian', 'ETI': 'Estonian', 'LVI': 'Latvian', 'LTH': 'Lithuanian',
      'VIT': 'Vietnamese', 'EUQ': 'Basque', 'HIN': 'Hindi', 'MSL': 'Malay',
      'GLC': 'Galician', 'CHS': 'Chinese (Simplified)', 'ENG': 'English (UK)',
      'PTG': 'Portuguese', 'SRM': 'Serbian (Latin)', 'ESN': 'Spanish (Modern)',
      'SRN': 'Serbian (Cyrillic)', 'BSC': 'Bosnian'
    };
  }

  async translateTexts(texts, sourceLanguage, targetLanguage) {
    if (!texts || texts.length === 0) return [];
    
    const sourceLangName = this.languageNames[sourceLanguage] || sourceLanguage;
    const targetLangName = this.languageNames[targetLanguage] || targetLanguage;
    
    const batchSize = 8;
    const allTranslations = [];
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      try {
        const batchTranslations = await this.translateBatch(
          batch, sourceLangName, targetLangName
        );
        allTranslations.push(...batchTranslations);
        
        if (i + batchSize < texts.length) {
          await this.sleep(2000);
        }
      } catch (error) {
        for (let j = 0; j < batch.length; j++) {
          allTranslations.push(null);
        }
      }
    }
    
    return allTranslations;
  }

  async translateBatch(texts, sourceLanguage, targetLanguage) {
    const preparedTexts = texts.map(text => this.prepareTextForTranslation(text));
    
    const textList = preparedTexts.map((prepared, index) => 
      `${index + 1}. ${prepared.preparedText}`
    ).join('\n');

    const prompt = `You are a professional translator specializing in user interface and survey content translation.

CRITICAL INSTRUCTIONS:
1. Translate from ${sourceLanguage} to ${targetLanguage}
2. PRESERVE ALL __TAG_X__ placeholders EXACTLY as they are
3. DO NOT translate HTML tags, code, or __TAG_X__ placeholders
4. For short texts (1-3 words), provide the most natural translation
5. For incomplete sentences, complete them logically in the target language
6. Maintain original formatting, spacing, and punctuation style
7. If text contains technical terms, preserve their meaning accurately

INPUT TEXTS:
${textList}

RESPONSE FORMAT:
Provide ONLY numbered translations in this exact format:
1. [translation]
2. [translation]
3. [translation]
...

NO explanations, NO additional text, ONLY the numbered translations:`;

    const response = await this.openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: "You are an expert translator with perfect accuracy. You follow instructions exactly and never add explanations unless asked. You preserve all technical elements and placeholders perfectly."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 2000,
      presence_penalty: 0,
      frequency_penalty: 0
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
    
    // Protect HTML tags
    const htmlPattern = /<[^>]+>/g;
    preparedText = preparedText.replace(htmlPattern, (match) => {
      const placeholder = `__TAG_${tagIndex}__`;
      placeholderMap.set(placeholder, match);
      tagIndex++;
      return placeholder;
    });
    
    // Protect Askia scripts
    const askiaPattern = /!!([^!]+)!!/g;
    preparedText = preparedText.replace(askiaPattern, (match) => {
      const placeholder = `__TAG_${tagIndex}__`;
      placeholderMap.set(placeholder, match);
      tagIndex++;
      return placeholder;
    });
    
    // Protect URLs
    const urlPattern = /https?:\/\/[^\s]+/g;
    preparedText = preparedText.replace(urlPattern, (match) => {
      const placeholder = `__TAG_${tagIndex}__`;
      placeholderMap.set(placeholder, match);
      tagIndex++;
      return placeholder;
    });
    
    // Protect email addresses
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    preparedText = preparedText.replace(emailPattern, (match) => {
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
      restoredText = restoredText.replace(new RegExp(placeholder, 'g'), originalTag);
    }
    
    return restoredText;
  }

  parseResponse(response) {
    const translations = [];
    const lines = response.trim().split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      const patterns = [
        /^\s*(\d+)\.\s*(.+)$/,
        /^\s*(\d+)\)\s*(.+)$/,
        /^\s*(\d+):\s*(.+)$/,
        /^\s*(\d+)\s*-\s*(.+)$/
      ];
      
      for (const pattern of patterns) {
        const match = trimmedLine.match(pattern);
        if (match) {
          const index = parseInt(match[1]) - 1;
          const translation = match[2].trim();
          if (translation && translation !== '' && index >= 0) {
            translations[index] = translation;
            break;
          }
        }
      }
    }
    
    return translations;
  }

  async testConnection() {
    await this.openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: "Test" }],
      max_tokens: 5
    });
    return true;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = TranslationService;