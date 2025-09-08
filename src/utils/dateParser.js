// src/utils/dateParser.js
function parseDate(dateString) {
  if (typeof dateString !== "string" || dateString.length !== 8) {
    console.error(`Invalid date string format: ${dateString}`);
    return new Date(NaN);
  }
  const day = parseInt(dateString.substring(0, 2), 10);
  const month = parseInt(dateString.substring(2, 4), 10) - 1;
  const year = parseInt(dateString.substring(4, 8), 10);
  return new Date(year, month, day);
}

module.exports = { parseDate };
