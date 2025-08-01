const ExcelJS = require('exceljs');
const fs = require('fs-extra');
const path = require('path');
const TranslationService = require('./TranslationService');

class ExcelProcessor {
  constructor() {
    this.translationService = new TranslationService();
    this.outputDir = path.join(__dirname, '../../output');
    fs.ensureDirSync(this.outputDir);
    
    this.countryToLanguage = {
      '1025': 'ARA', '1026': 'BGR', '1027': 'CAT', '1028': 'CHT', '1029': 'CSY',
      '1030': 'DAN', '1031': 'DEU', '1032': 'ELL', '1033': 'ENU', '1034': 'ESP',
      '1035': 'FIN', '1036': 'FRA', '1037': 'HEB', '1038': 'HUN', '1040': 'ITA',
      '1041': 'JPN', '1042': 'KOR', '1043': 'NLD', '1044': 'NOR', '1045': 'PLK',
      '1046': 'PTB', '1048': 'ROM', '1049': 'RUS', '1050': 'HRV', '1051': 'SKY',
      '1052': 'SQI', '1053': 'SVE', '1054': 'THA', '1055': 'TRK', '1057': 'IND',
      '1058': 'UKR', '1059': 'BEL', '1060': 'SLV', '1061': 'ETI', '1062': 'LVI',
      '1063': 'LTH', '1066': 'VIT', '1069': 'EUQ', '1081': 'HIN', '1086': 'MSL',
      '1110': 'GLC', '2052': 'CHS', '2057': 'ENG', '2070': 'PTG', '2074': 'SRM',
      '3082': 'ESN', '3098': 'SRN', '5146': 'BSC'
    };
  }

  async processExcelFile(filePath) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.worksheets[0];

    const languageColumns = this.identifyLanguageColumns(worksheet);
    
    if (Object.keys(languageColumns).length === 0) {
      throw new Error('No recognized country code columns found. Expected format: 1031(DEU), 1036(FRA), etc.');
    }

    const sourceColumn = this.findSourceColumn(worksheet, languageColumns);
    if (!sourceColumn) {
      throw new Error('No source column with text for translation was found');
    }

    const targetColumns = this.findTargetColumns(languageColumns, sourceColumn);
    
    if (targetColumns.length === 0) {
      throw new Error('No target columns for translation were found');
    }

    const textsToTranslate = this.extractTextsForTranslation(worksheet, sourceColumn, targetColumns);

    if (textsToTranslate.length === 0) {
      throw new Error('No texts for translation were found');
    }

    let translatedCount = 0;
    for (const targetColumn of targetColumns) {
      const textsForThisLanguage = textsToTranslate.filter(t => 
        t.targetColumns.includes(targetColumn.columnIndex)
      );

      if (textsForThisLanguage.length === 0) continue;

      const translations = await this.translationService.translateTexts(
        textsForThisLanguage.map(t => t.text),
        sourceColumn.language,
        targetColumn.language
      );

      textsForThisLanguage.forEach((textInfo, index) => {
        if (translations[index]) {
          const targetCell = worksheet.getCell(textInfo.row + 1, targetColumn.columnIndex + 1);
          targetCell.value = translations[index];
          translatedCount++;
        }
      });
    }

    const outputFilename = `translated_${Date.now()}.xlsx`;
    const outputPath = path.join(this.outputDir, outputFilename);
    
    await workbook.xlsx.writeFile(outputPath);
    
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

  hasGrayBackground(cell) {
    if (!cell.fill || cell.fill.type !== 'pattern') return false;
    
    const fill = cell.fill;
    
    if (fill.fgColor) {
      // Check theme colors with tint
      if (fill.fgColor.theme !== undefined && fill.fgColor.tint !== undefined) {
        if (fill.fgColor.theme === 0 && fill.fgColor.tint < -0.05) return true;
        if (fill.fgColor.theme === 1 && fill.fgColor.tint < -0.1) return true;
      }
      
      // Check common gray RGB values
      if (fill.fgColor.argb) {
        const grayColors = [
          'ffc0c0c0', 'ffd3d3d3', 'ffa9a9a9', 'ff808080', 'ff696969',
          'ff778899', 'ff2f4f4f', 'fff5f5f5', 'fff0f0f0', 'ffe0e0e0',
          'ffcccccc', 'ffb8b8b8', 'ff999999', 'ff666666'
        ];
        
        if (grayColors.includes(fill.fgColor.argb.toLowerCase())) return true;
      }
    }
    
    return fill.bgColor && fill.bgColor.theme === 0;
  }

  shouldTranslateCell(cell) {
    if (!cell.value) return false;
    
    const text = cell.value.toString().trim();
    if (!text || text.length < 2) return false;
    
    // Skip pure numbers
    if (/^\d+(\.\d+)?$/.test(text)) return false;
    
    // Skip very short non-alphabetic text
    if (text.length < 3 && !/[a-zA-ZăâîșțĂÂÎȘȚàáâãäåæçèéêëìíîïñòóôõöøùúûüýÿ]/.test(text)) return false;
    
    // Skip cells with gray background
    if (this.hasGrayBackground(cell)) return false;
    
    return true;
  }

  identifyLanguageColumns(worksheet) {
    const columns = {};
    const headerRow = worksheet.getRow(1);
    
    headerRow.eachCell((cell, colNumber) => {
      if (!cell.value) return;
      
      const header = cell.value.toString().trim();
      const match = header.match(/^(\d+)\(([A-Z]{3})\)$/);
      
      if (match) {
        const countryCode = match[1];
        const langCode = match[2];
        
        if (this.countryToLanguage[countryCode] === langCode) {
          columns[colNumber - 1] = {
            columnIndex: colNumber - 1,
            header: header,
            countryCode: countryCode,
            language: langCode
          };
        }
      }
    });
    
    return columns;
  }

  findSourceColumn(worksheet, languageColumns) {
    let bestColumn = null;
    let maxTextCount = 0;
    
    for (const columnIndex in languageColumns) {
      const column = languageColumns[columnIndex];
      let textCount = 0;
      
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        
        const cell = row.getCell(parseInt(columnIndex) + 1);
        if (this.shouldTranslateCell(cell)) {
          textCount++;
        }
      });
      
      if (textCount > maxTextCount) {
        maxTextCount = textCount;
        bestColumn = column;
      }
    }
    
    return bestColumn;
  }

  findTargetColumns(languageColumns, sourceColumn) {
    const targets = [];
    
    for (const columnIndex in languageColumns) {
      const column = languageColumns[columnIndex];
      
      if (column.columnIndex !== sourceColumn.columnIndex) {
        targets.push(column);
      }
    }
    
    return targets;
  }

  extractTextsForTranslation(worksheet, sourceColumn, targetColumns) {
    const texts = [];
    
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      
      const sourceCell = row.getCell(sourceColumn.columnIndex + 1);
      
      if (!this.shouldTranslateCell(sourceCell)) return;
      
      const emptyTargetColumns = targetColumns.filter(targetCol => {
        const targetCell = row.getCell(targetCol.columnIndex + 1);
        const cellValue = targetCell.value;
        return !cellValue || !cellValue.toString().trim();
      });
      
      if (emptyTargetColumns.length > 0) {
        texts.push({
          row: rowNumber - 1,
          text: sourceCell.value.toString(),
          sourceColumn: sourceColumn.columnIndex,
          targetColumns: emptyTargetColumns.map(col => col.columnIndex)
        });
      }
    });
    
    return texts;
  }

  async testConfiguration() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured in .env');
    }
    
    await this.translationService.testConnection();
    return true;
  }
}

module.exports = ExcelProcessor;