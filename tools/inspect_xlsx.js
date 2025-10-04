const xlsx = require('xlsx');
const path = require('path');
const file = path.resolve(process.argv[2] || '../UnitTierList.xlsx');
const wb = xlsx.readFile(file);
console.log('Workbook sheets:');
wb.SheetNames.forEach(name => console.log('-', name));
