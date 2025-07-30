// src/services/TranslationService.js
const { OpenAI } = require('openai');

class TranslationService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    // Maparea limbilor pentru prompt-uri mai clare
    this.languageNames = {
      'ENG': 'English',
      'FRA': 'French',
      'DEU': 'German', 
      'ITA': 'Italian',
      'ESP': 'Spanish',
      'POR': 'Portuguese',
      'NLD': 'Dutch',
      'SVE': 'Swedish',
      'NOR': 'Norwegian',
      'DAN': 'Danish',
      'FIN': 'Finnish',
      'POL': 'Polish',
      'CZE': 'Czech',
      'HUN': 'Hungarian',
      'ROM': 'Romanian',
      'RUS': 'Russian',
      'JPN': 'Japanese',
      'KOR': 'Korean',
      'CHN': 'Chinese',
      'ARA': 'Arabic'
    };
  }

  // Traduce o listă de texte într-o limbă țintă
  async translateTexts(texts, sourceLanguage, targetLanguage) {
    if (!texts || texts.length === 0) return [];
    
    const sourceLangName = this.languageNames[sourceLanguage] || sourceLanguage;
    const targetLangName = this.languageNames[targetLanguage] || targetLanguage;
    
    console.log(`🔄 Traducere ${texts.length} texte din ${sourceLangName} în ${targetLangName}`);
    
    // Procesează în batch-uri pentru eficiență
    const batchSize = 15;
    const allTranslations = [];
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      console.log(`   📦 Batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(texts.length/batchSize)}`);
      
      try {
        const batchTranslations = await this.translateBatch(
          batch, sourceLangName, targetLangName
        );
        allTranslations.push(...batchTranslations);
        
        // Pauză între batch-uri pentru rate limiting
        if (i + batchSize < texts.length) {
          await this.sleep(1000);
        }
      } catch (error) {
        console.error(`❌ Eroare batch ${Math.floor(i/batchSize) + 1}:`, error.message);
        // Adaugă texte null pentru pozițiile care au eșuat
        for (let j = 0; j < batch.length; j++) {
          allTranslations.push(null);
        }
      }
    }
    
    return allTranslations;
  }

  // Traduce un batch de texte
  async translateBatch(texts, sourceLanguage, targetLanguage) {
    // Pregătește textele pentru traducere (înlocuiește tagurile cu placeholders)
    const preparedTexts = texts.map(text => this.prepareTextForTranslation(text));
    
    // Creează prompt-ul
    const textList = preparedTexts.map((prepared, index) => 
      `${index + 1}. ${prepared.preparedText}`
    ).join('\n');

    const prompt = `Traduce următoarele texte din ${sourceLanguage} în ${targetLanguage}.

REGULI IMPORTANTE:
- Păstrează EXACT toate placeholder-urile __TAG_X__ în pozițiile corecte
- NU traduce sau modifica placeholder-urile __TAG_X__
- Pentru texte foarte scurte (1-2 cuvinte), oferă traducerea cea mai naturală
- Pentru texte incomplete sau trunhiate, completează logic traducerea
- Păstrează formatarea și spațierea originală
- Textele pot conține taguri HTML și scripturi speciale - acestea trebuie păstrate intacte

Texte de tradus:
${textList}

Răspunde DOAR cu traducerile numerotate, fără explicații:`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: "Tu ești un translator profesionist specializat în traducerea de interfețe și aplicații. Urmărești cu strictețe instrucțiunile privind păstrarea placeholder-urilor și formatării."
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
      
      // Restaurează tagurile în traduceri
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

    } catch (error) {
      console.error('❌ Eroare OpenAI:', error.message);
      throw error;
    }
  }

  // Pregătește textul pentru traducere (înlocuiește tagurile cu placeholders)
  prepareTextForTranslation(text) {
    let preparedText = text;
    const placeholderMap = new Map();
    let tagIndex = 0;
    
    // Pattern pentru taguri HTML
    const htmlPattern = /<[^>]+>/g;
    
    // Pattern pentru scripturi Askia: !!ceva!!
    const askiaPattern = /!!([^!]+)!!/g;
    
    // Înlocuiește tagurile HTML
    preparedText = preparedText.replace(htmlPattern, (match) => {
      const placeholder = `__TAG_${tagIndex}__`;
      placeholderMap.set(placeholder, match);
      tagIndex++;
      return placeholder;
    });
    
    // Înlocuiește scripturile Askia
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

  // Restaurează tagurile în textul tradus
  restoreTagsInTranslation(translatedText, placeholderMap) {
    let restoredText = translatedText;
    
    // Înlocuiește fiecare placeholder cu tagul original
    for (let [placeholder, originalTag] of placeholderMap) {
      restoredText = restoredText.replace(placeholder, originalTag);
    }
    
    return restoredText;
  }

  // Parsează răspunsul de la AI
  parseResponse(response) {
    const translations = [];
    const lines = response.trim().split('\n');
    
    for (const line of lines) {
      // Caută pattern-ul: număr. text
      const match = line.match(/^\s*(\d+)\.\s*(.+)$/);
      if (match) {
        const index = parseInt(match[1]) - 1;
        const translation = match[2].trim();
        translations[index] = translation;
      }
    }
    
    return translations;
  }

  // Test conexiunea cu OpenAI
  async testConnection() {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: "Hello, test connection" }],
        max_tokens: 10
      });
      
      console.log('✅ Conexiunea cu OpenAI funcționează');
      return true;
    } catch (error) {
      console.error('❌ Eroare conexiune OpenAI:', error.message);
      throw new Error(`Conexiunea cu OpenAI a eșuat: ${error.message}`);
    }
  }

  // Funcție helper pentru pauză
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = TranslationService;