const XLSX = require('xlsx');
const fs = require('fs-extra');
const path = require('path');
const TranslationService = require('./TranslationService');

class ExcelProcessor {
  constructor() {
    this.translationService = new TranslationService();
    this.outputDir = path.join(__dirname, '../../output');
    fs.ensureDirSync(this.outputDir);
    
    // Country code to language mapping from Askia
    this.countryToLanguage = {
      '1025': 'ARA', // Arabic (Saudi Arabia)
      '1026': 'BGR', // Bulgarian
      '1027': 'CAT', // Catalan
      '1028': 'CHT', // Chinese (Taiwan)
      '1029': 'CSY', // Czech
      '1030': 'DAN', // Danish
      '1031': 'DEU', // German (Germany)
      '1032': 'ELL', // Greek
      '1033': 'ENU', // English (United States)
      '1034': 'ESP', // Spanish (Spain Traditional)
      '1035': 'FIN', // Finnish
      '1036': 'FRA', // French (France)
      '1037': 'HEB', // Hebrew
      '1038': 'HUN', // Hungarian
      '1040': 'ITA', // Italian (Italy)
      '1041': 'JPN', // Japanese
      '1042': 'KOR', // Korean
      '1043': 'NLD', // Dutch (Netherlands)
      '1044': 'NOR', // Norwegian (Bokmål)
      '1045': 'PLK', // Polish
      '1046': 'PTB', // Portuguese (Brazil)
      '1048': 'ROM', // Romanian
      '1049': 'RUS', // Russian
      '1050': 'HRV', // Croatian
      '1051': 'SKY', // Slovak
      '1052': 'SQI', // Albanian
      '1053': 'SVE', // Swedish
      '1054': 'THA', // Thai
      '1055': 'TRK', // Turkish
      '1057': 'IND', // Indonesian
      '1058': 'UKR', // Ukrainian
      '1059': 'BEL', // Belarusian
      '1060': 'SLV', // Slovenian
      '1061': 'ETI', // Estonian
      '1062': 'LVI', // Latvian
      '1063': 'LTH', // Lithuanian
      '1066': 'VIT', // Vietnamese
      '1069': 'EUQ', // Basque
      '1081': 'HIN', // Hindi
      '1086': 'MSL', // Malay (Malaysia)
      '1110': 'GLC', // Galician
      '2052': 'CHS', // Chinese (Simplified)
      '2057': 'ENG', // English (United Kingdom)
      '2070': 'PTG', // Portuguese (Portugal)
      '2074': 'SRM', // Serbian (Latin)
      '3082': 'ESN', // Spanish (Spain Modern)
      '3098': 'SRN', // Serbian (Cyrillic)
      '5146': 'BSC'  // Bosnian
    };
  }

  // Main Excel file processing function
  async processExcelFile(filePath) {
    const workbook = XLSX.readFile(filePath, { cellStyles: true });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const range = XLSX.utils.decode_range(worksheet['!ref']);

    const languageColumns = this.identifyLanguageColumns(worksheet, range);
    
    if (Object.keys(languageColumns).length === 0) {
      throw new Error('No recognized country code columns found. Expected format: 1031(DEU), 1036(FRA), etc.');
    }

    // Find source column (the one with most content)
    const sourceColumn = this.findSourceColumn(worksheet, range, languageColumns);
    if (!sourceColumn) {
      throw new Error('No source column with text for translation was found');
    }

    // Find target columns (empty or partially empty)
    const targetColumns = this.findTargetColumns(languageColumns, sourceColumn);
    
    if (targetColumns.length === 0) {
      throw new Error('No target columns for translation were found');
    }

    // Extract texts for translation
    const textsToTranslate = this.extractTextsForTranslation(
      worksheet, range, sourceColumn, targetColumns
    );

    if (textsToTranslate.length === 0) {
      throw new Error('No texts for translation were found');
    }

    // Translate texts
    let translatedCount = 0;
    for (const targetColumn of targetColumns) {
      const textsForThisLanguage = textsToTranslate.filter(t => 
        t.targetColumns.includes(targetColumn.columnIndex)
      );

      const translations = await this.translationService.translateTexts(
        textsForThisLanguage.map(t => t.text),
        sourceColumn.language,
        targetColumn.language
      );

      // Apply translations to worksheet with enhanced style preservation
      textsForThisLanguage.forEach((textInfo, index) => {
        if (translations[index]) {
          const targetAddress = XLSX.utils.encode_cell({
            r: textInfo.row,
            c: targetColumn.columnIndex
          });
          
          // Get source cell to copy styles from
          const sourceAddress = XLSX.utils.encode_cell({
            r: textInfo.row,
            c: sourceColumn.columnIndex
          });
          const sourceCell = worksheet[sourceAddress];
          
          // Check if target cell already exists and has gray background
          const existingTargetCell = worksheet[targetAddress];
          const targetHasGrayBackground = existingTargetCell && this.hasGrayBackground(existingTargetCell);
          
          // Create target cell with proper style preservation
          const newCell = {
            v: translations[index],
            t: 's'
          };
          
          // Handle style preservation logic
          if (targetHasGrayBackground) {
            // Target already has gray background - preserve it completely
            newCell.s = existingTargetCell.s ? { ...existingTargetCell.s } : undefined;
          } else if (sourceCell?.s) {
            // Target doesn't have gray background - copy from source
            newCell.s = { ...sourceCell.s };
          }
          
          worksheet[targetAddress] = newCell;
          translatedCount++;
        }
      });
    }

    // Save processed file
    const outputFilename = `translated_${Date.now()}.xlsx`;
    const outputPath = path.join(this.outputDir, outputFilename);
    
    XLSX.writeFile(workbook, outputPath, { cellStyles: true });
    
    return {
      filename: outputFilename,
      stats: {
        sourceColumn: sourceColumn.header,
        targetColumns: targetColumns.map(col => col.header),
        textsFound: textsToTranslate.length,
        translationsApplied: translatedCount
      }
    };
  }

  // Identify language columns from header
  identifyLanguageColumns(worksheet, range) {
    const columns = {};
    
    for (let C = range.s.c; C <= range.e.c; C++) {
      const headerCell = worksheet[XLSX.utils.encode_cell({r: 0, c: C})];
      if (!headerCell || !headerCell.v) continue;
      
      const header = headerCell.v.toString();
      
      // Look for pattern: number(language_code) e.g. 1031(DEU) or 2057(ENG)
      const match = header.match(/^(\d+)\(([A-Z]{3})\)$/);
      if (match) {
        const countryCode = match[1];
        const langCode = match[2];
        
        // Check if this country code is supported
        if (this.countryToLanguage[countryCode] === langCode) {
          columns[C] = {
            columnIndex: C,
            header: header,
            countryCode: countryCode,
            language: langCode
          };
        }
      }
    }
    
    return columns;
  }

  // Find source column (the one with most content)
  findSourceColumn(worksheet, range, languageColumns) {
    let bestColumn = null;
    let maxTextCount = 0;
    
    for (const columnIndex in languageColumns) {
      const column = languageColumns[columnIndex];
      let textCount = 0;
      
      // Count texts in this column
      for (let R = 1; R <= range.e.r; R++) {
        const cellAddress = XLSX.utils.encode_cell({r: R, c: parseInt(columnIndex)});
        const cell = worksheet[cellAddress];
        
        if (this.shouldTranslateCell(cell)) {
          textCount++;
        }
      }
      
      if (textCount > maxTextCount) {
        maxTextCount = textCount;
        bestColumn = column;
      }
    }
    
    return bestColumn;
  }

  // Find target columns (those that are not the source)
  findTargetColumns(languageColumns, sourceColumn) {
    const targets = [];
    
    for (const columnIndex in languageColumns) {
      const column = languageColumns[columnIndex];
      
      // Skip source column
      if (column.columnIndex === sourceColumn.columnIndex) continue;
      
      targets.push(column);
    }
    
    return targets;
  }

  // Extract texts that need to be translated
  extractTextsForTranslation(worksheet, range, sourceColumn, targetColumns) {
    const texts = [];
    
    for (let R = 1; R <= range.e.r; R++) {
      const sourceAddress = XLSX.utils.encode_cell({r: R, c: sourceColumn.columnIndex});
      const sourceCell = worksheet[sourceAddress];
      
      if (!this.shouldTranslateCell(sourceCell)) continue;
      
      // Check which target columns are empty for this row
      const emptyTargetColumns = targetColumns.filter(targetCol => {
        const targetAddress = XLSX.utils.encode_cell({r: R, c: targetCol.columnIndex});
        const targetCell = worksheet[targetAddress];
        
        // Consider cell empty if it has no text content (but might have gray background)
        return !targetCell || !targetCell.v || !targetCell.v.toString().trim();
      });
      
      if (emptyTargetColumns.length > 0) {
        texts.push({
          row: R,
          text: sourceCell.v.toString(),
          sourceColumn: sourceColumn.columnIndex,
          targetColumns: emptyTargetColumns.map(col => col.columnIndex)
        });
      }
    }
    
    return texts;
  }

  // Check if a cell should be translated
  shouldTranslateCell(cell) {
    if (!cell || !cell.v) return false;
    
    const text = cell.v.toString().trim();
    if (!text || text.length < 2) return false;
    
    // Skip pure numbers
    if (/^\d+$/.test(text)) return false;
    
    // Skip cells with gray background
    if (this.hasGrayBackground(cell)) return false;
    
    return true;
  }

  // Enhanced gray background detection
  hasGrayBackground(cell) {
    if (!cell?.s) return false;
    
    const style = cell.s;
    
    // Method 1: Check for fill pattern
    if (style.fill && style.fill.patternType === 'solid') {
      const fgColor = style.fill.fgColor;
      if (fgColor) {
        if (fgColor.rgb) {
          const rgb = fgColor.rgb.toLowerCase();
          return /^[a-f0-9]{2}([a-f0-9]{2})\1$/.test(rgb) && rgb !== 'ffffff' && rgb !== '000000';
        }
        if (fgColor.indexed && [15, 16, 22, 43, 47, 48, 49, 50].includes(fgColor.indexed)) {
          return true;
        }
      }
    }
    
    // Method 2: Legacy pattern check
    if (style.patternType === 'solid' && style.fgColor) {
      if (style.fgColor.tint && style.fgColor.tint < 0) return true;
      if (style.fgColor.indexed && [15, 16, 22, 43, 47, 48, 49, 50].includes(style.fgColor.indexed)) {
        return true;
      }
    }
    
    return false;
  }
  // Test configuration
  async testConfiguration() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured in .env');
    }
    
    await this.translationService.testConnection();
    return true;
  }
}

module.exports = ExcelProcessor;