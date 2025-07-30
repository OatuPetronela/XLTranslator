// src/services/ExcelProcessor.js
const XLSX = require('xlsx');
const fs = require('fs-extra');
const path = require('path');
const TranslationService = require('./TranslationService');

class ExcelProcessor {
  constructor() {
    this.translationService = new TranslationService();
    this.outputDir = path.join(__dirname, '../../output');
    fs.ensureDirSync(this.outputDir);
    
    // Maparea codurilor de țară la limbi
    this.countryToLanguage = {
      '1031': 'DEU', // German
      '1036': 'FRA', // French  
      '1040': 'ITA', // Italian
      '1034': 'ESP', // Spanish
      '2070': 'POR', // Portuguese
      '1043': 'NLD', // Dutch
      '1053': 'SWE', // Swedish
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

  // Procesează fișierul Excel principal
  async processExcelFile(filePath) {
    console.log('📖 Citire fișier Excel...');
    const workbook = XLSX.readFile(filePath, { cellStyles: true });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const range = XLSX.utils.decode_range(worksheet['!ref']);

    console.log('🔍 Identificare coloane de limbi...');
    const languageColumns = this.identifyLanguageColumns(worksheet, range);
    
    console.log('📝 Găsite coloane:', Object.keys(languageColumns).map(col => 
      `${languageColumns[col].header} (${languageColumns[col].language})`
    ).join(', '));

    // Găsește coloana sursă (prima cu conținut)
    const sourceColumn = this.findSourceColumn(worksheet, range, languageColumns);
    if (!sourceColumn) {
      throw new Error('Nu a fost găsită o coloană sursă cu text pentru traducere');
    }

    console.log(`🎯 Coloană sursă: ${sourceColumn.header} (${sourceColumn.language})`);

    // Găsește coloanele țintă (goale sau parțial goale)
    const targetColumns = this.findTargetColumns(languageColumns, sourceColumn);
    
    if (targetColumns.length === 0) {
      throw new Error('Nu au fost găsite coloane țintă pentru traducere');
    }

    console.log(`🎯 Coloane țintă: ${targetColumns.map(col => 
      `${col.header} (${col.language})`
    ).join(', ')}`);

    // Extrage textele pentru traducere
    const textsToTranslate = this.extractTextsForTranslation(
      worksheet, range, sourceColumn, targetColumns
    );

    console.log(`📝 Găsite ${textsToTranslate.length} texte pentru traducere`);

    if (textsToTranslate.length === 0) {
      throw new Error('Nu au fost găsite texte pentru traducere');
    }

    // Traduce textele
    let translatedCount = 0;
    for (const targetColumn of targetColumns) {
      console.log(`🌐 Traducere în ${targetColumn.language}...`);
      
      const textsForThisLanguage = textsToTranslate.filter(t => 
        t.targetColumns.includes(targetColumn.columnIndex)
      );

      const translations = await this.translationService.translateTexts(
        textsForThisLanguage.map(t => t.text),
        sourceColumn.language,
        targetColumn.language
      );

      // Aplică traducerile în worksheet
      textsForThisLanguage.forEach((textInfo, index) => {
        if (translations[index]) {
          const targetAddress = XLSX.utils.encode_cell({
            r: textInfo.row,
            c: targetColumn.columnIndex
          });
          
          worksheet[targetAddress] = {
            v: translations[index],
            t: 's'
          };
          translatedCount++;
        }
      });
    }

    // Salvează fișierul
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

  // Identifică coloanele de limbi din header
  identifyLanguageColumns(worksheet, range) {
    const columns = {};
    
    for (let C = range.s.c; C <= range.e.c; C++) {
      const headerCell = worksheet[XLSX.utils.encode_cell({r: 0, c: C})];
      if (!headerCell || !headerCell.v) continue;
      
      const header = headerCell.v.toString();
      
      // Caută pattern-ul: număr(cod_limba) ex: 1031(DEU) sau 2057(ENG)
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

  // Găsește coloana sursă (prima cu cel mai mult conținut)
  findSourceColumn(worksheet, range, languageColumns) {
    let bestColumn = null;
    let maxTextCount = 0;
    
    for (const columnIndex in languageColumns) {
      const column = languageColumns[columnIndex];
      let textCount = 0;
      
      // Numără textele din această coloană
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

  // Găsește coloanele țintă (cele care nu sunt sursa)
  findTargetColumns(languageColumns, sourceColumn) {
    const targets = [];
    
    for (const columnIndex in languageColumns) {
      const column = languageColumns[columnIndex];
      
      // Skip coloana sursă
      if (column.columnIndex === sourceColumn.columnIndex) continue;
      
      targets.push(column);
    }
    
    return targets;
  }

  // Extrage textele care trebuie traduse
  extractTextsForTranslation(worksheet, range, sourceColumn, targetColumns) {
    const texts = [];
    
    for (let R = 1; R <= range.e.r; R++) {
      const sourceAddress = XLSX.utils.encode_cell({r: R, c: sourceColumn.columnIndex});
      const sourceCell = worksheet[sourceAddress];
      
      if (!this.shouldTranslateCell(sourceCell)) continue;
      
      // Verifică care coloane țintă sunt goale pentru această linie
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

  // Verifică dacă o celulă trebuie tradusă
  shouldTranslateCell(cell) {
    if (!cell || !cell.v) return false;
    
    const text = cell.v.toString().trim();
    if (!text || text.length < 2) return false;
    
    // Skip numerele pure
    if (/^\d+$/.test(text)) return false;
    
    // Skip celulele cu background gri
    if (this.hasGrayBackground(cell)) return false;
    
    return true;
  }

  // Verifică dacă celula are background gri
  hasGrayBackground(cell) {
    if (!cell.s || !cell.s.patternType) return false;
    
    return cell.s.patternType === 'solid' && 
           cell.s.fgColor && 
           cell.s.fgColor.tint && 
           cell.s.fgColor.tint < 0;
  }

  // Test configurația
  async testConfiguration() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY nu este configurat în .env');
    }
    
    await this.translationService.testConnection();
    return true;
  }
}

module.exports = ExcelProcessor;