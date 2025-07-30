// src/services/ExcelProcessor.js - English version with style preservation
const XLSX = require('xlsx');
const fs = require('fs-extra');
const path = require('path');
const TranslationService = require('./TranslationService');

class ExcelProcessor {
  constructor() {
    this.translationService = new TranslationService();
    this.outputDir = path.join(__dirname, '../../output');
    fs.ensureDirSync(this.outputDir);
    
    // Country code to language mapping
    this.countryToLanguage = {
      '1031': 'DEU', // German
      '1036': 'FRA', // French  
      '1040': 'ITA', // Italian
      '1034': 'ESP', // Spanish
      '2070': 'POR', // Portuguese
      '1043': 'NLD', // Dutch
      '1053': 'SVE', // Swedish
      '1044': 'NOR', // Norwegian
      '1030': 'DAN', // Danish
      '1035': 'FIN', // Finnish
      '1045': 'POL', // Polish
      '1029': 'CZE', // Czech
      '1038': 'HUN', // Hungarian
      '1048': 'ROM', // Romanian
      '1049': 'RUS', // Russian
      '1041': 'JPN', // Japanese
      '1042': 'KOR', // Korean
      '2052': 'CHN', // Chinese
      '1025': 'ARA', // Arabic
      '2057': 'ENG'  // English
    };
  }

  // Main Excel file processing function
  async processExcelFile(filePath) {
    console.log('📖 Reading Excel file...');
    const workbook = XLSX.readFile(filePath, { cellStyles: true });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const range = XLSX.utils.decode_range(worksheet['!ref']);

    console.log('🔍 Identifying language columns...');
    const languageColumns = this.identifyLanguageColumns(worksheet, range);
    
    console.log('📝 Found columns:', Object.keys(languageColumns).map(col => 
      `${languageColumns[col].header} (${languageColumns[col].language})`
    ).join(', '));

    // Find source column (the one with most content)
    const sourceColumn = this.findSourceColumn(worksheet, range, languageColumns);
    if (!sourceColumn) {
      throw new Error('No source column with text for translation was found');
    }

    console.log(`🎯 Source column: ${sourceColumn.header} (${sourceColumn.language})`);

    // Find target columns (empty or partially empty)
    const targetColumns = this.findTargetColumns(languageColumns, sourceColumn);
    
    if (targetColumns.length === 0) {
      throw new Error('No target columns for translation were found');
    }

    console.log(`🎯 Target columns: ${targetColumns.map(col => 
      `${col.header} (${col.language})`
    ).join(', ')}`);

    // Extract texts for translation
    const textsToTranslate = this.extractTextsForTranslation(
      worksheet, range, sourceColumn, targetColumns
    );

    console.log(`📝 Found ${textsToTranslate.length} texts for translation`);

    if (textsToTranslate.length === 0) {
      throw new Error('No texts for translation were found');
    }

    // Translate texts
    let translatedCount = 0;
    for (const targetColumn of targetColumns) {
      console.log(`🌐 Translating to ${targetColumn.language}...`);
      
      const textsForThisLanguage = textsToTranslate.filter(t => 
        t.targetColumns.includes(targetColumn.columnIndex)
      );

      const translations = await this.translationService.translateTexts(
        textsForThisLanguage.map(t => t.text),
        sourceColumn.language,
        targetColumn.language
      );

      // Apply translations to worksheet WITH STYLE PRESERVATION
      textsForThisLanguage.forEach((textInfo, index) => {
        if (translations[index]) {
          const targetAddress = XLSX.utils.encode_cell({
            r: textInfo.row,
            c: targetColumn.columnIndex
          });
          
          // Find source cell to copy styles from
          const sourceAddress = XLSX.utils.encode_cell({
            r: textInfo.row,
            c: sourceColumn.columnIndex
          });
          const sourceCell = worksheet[sourceAddress];
          
          // Create target cell preserving original styles
          worksheet[targetAddress] = {
            v: translations[index],
            t: 's',
            // COPY STYLES from source cell (preserves gray background, etc.)
            s: sourceCell && sourceCell.s ? { ...sourceCell.s } : undefined
          };
          translatedCount++;
        }
      });
    }

    // Save file
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
        
        columns[C] = {
          columnIndex: C,
          header: header,
          countryCode: countryCode,
          language: langCode
        };
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

  // Check if cell has gray background
  hasGrayBackground(cell) {
    if (!cell.s || !cell.s.patternType) return false;
    
    return cell.s.patternType === 'solid' && 
           cell.s.fgColor && 
           cell.s.fgColor.tint && 
           cell.s.fgColor.tint < 0;
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