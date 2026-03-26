'use strict';

const { scan } = require('./scanner');
const { format, formatJson, formatSummary } = require('./reporter');
const { parseContent, isBuiltin, isLocalPath, extractPackageName } = require('./parser');

module.exports = {
  // Main scanning function
  scan,

  // Formatting utilities
  format,
  formatJson,
  formatSummary,

  // Low-level parsing utilities (for advanced use)
  parseContent,
  isBuiltin,
  isLocalPath,
  extractPackageName,
};
