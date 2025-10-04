const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const workbookPath = path.resolve(process.argv[2] || '../UnitTierList.xlsx');
const unitNameArg = process.argv[3];
const deltaArg = parseInt(process.argv[4], 10) || 0;

if (!unitNameArg) {
    console.error('Usage: node apply_vote_to_xlsx.js [workbookPath] "Unit Name" delta');
    console.error('Example: node apply_vote_to_xlsx.js UnitTierList.xlsx "Goblin Axeman" 1');
    process.exit(1);
}

if (!fs.existsSync(workbookPath)) {
    console.error('Workbook not found at', workbookPath);
    process.exit(1);
}

function normalize(s) {
    return String(s || '').toLowerCase().replace(/\s+/g, '');
}

const wb = xlsx.readFile(workbookPath);
const sheetName = 'Tier List';
if (!wb.Sheets[sheetName]) {
    console.error('Sheet "Tier List" not found in workbook. Available sheets:', wb.SheetNames.join(', '));
    process.exit(1);
}

const ws = wb.Sheets[sheetName];
const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });
if (!rows || rows.length < 1) {
    console.error('No rows in sheet');
    process.exit(1);
}

const headers = rows[0].map(h => String(h).trim());
const unitNameCol = headers.indexOf('UnitName') !== -1 ? headers.indexOf('UnitName') : headers.indexOf('Unit Name');
const numericalRankCol = headers.indexOf('NumericalRank') !== -1 ? headers.indexOf('NumericalRank') : headers.indexOf('Numerical Rank');

if (unitNameCol === -1 || numericalRankCol === -1) {
    console.error('Could not find UnitName or NumericalRank columns. Headers:', headers.join(', '));
    process.exit(1);
}

const targetNorm = normalize(unitNameArg);

// Levenshtein distance for fuzzy matching
function levenshtein(a, b) {
    a = String(a || '');
    b = String(b || '');
    const al = a.length, bl = b.length;
    if (al === 0) return bl;
    if (bl === 0) return al;
    const dp = Array(al + 1).fill(null).map(() => Array(bl + 1).fill(0));
    for (let i = 0; i <= al; i++) dp[i][0] = i;
    for (let j = 0; j <= bl; j++) dp[0][j] = j;
    for (let i = 1; i <= al; i++) {
        for (let j = 1; j <= bl; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
        }
    }
    return dp[al][bl];
}

let foundIndex = -1;
// First try exact normalized match
for (let i = 1; i < rows.length; i++) {
    const cell = rows[i][unitNameCol];
    if (cell && normalize(cell) === targetNorm) {
        foundIndex = i;
        break;
    }
}

// If not exact, attempt fuzzy match using levenshtein on normalized names
if (foundIndex === -1) {
    let best = { idx: -1, dist: Infinity };
    for (let i = 1; i < rows.length; i++) {
        const cell = rows[i][unitNameCol];
        if (!cell) continue;
        const dist = levenshtein(normalize(cell), targetNorm);
        if (dist < best.dist) best = { idx: i, dist };
    }
    // Accept fuzzy match if distance is reasonably small (e.g., <= 3 or <=10% of length)
    if (best.idx !== -1) {
        const cand = String(rows[best.idx][unitNameCol] || '');
        const threshold = Math.max(3, Math.floor(cand.length * 0.12));
        if (best.dist <= threshold) foundIndex = best.idx;
    }
}

if (foundIndex === -1) {
    console.error(JSON.stringify({ error: 'Unit not found', unit: unitNameArg }));
    process.exit(1);
}

const cellName = rows[foundIndex][unitNameCol];
const curr = rows[foundIndex][numericalRankCol];
const currNum = (typeof curr === 'number') ? curr : parseInt(curr, 10) || 0;
const newVal = Math.max(0, currNum + deltaArg);
rows[foundIndex][numericalRankCol] = newVal;
console.log(JSON.stringify({ updated: { unit: cellName, from: currNum, to: newVal } }));

// backup and write
const backupPath = workbookPath.replace(/\.xlsx$/i, '.vote_backup.xlsx');
fs.copyFileSync(workbookPath, backupPath);
const newWs = xlsx.utils.aoa_to_sheet(rows);
wb.Sheets[sheetName] = newWs;
xlsx.writeFile(wb, workbookPath);
console.log('Workbook updated in place:', workbookPath);
console.log('Backup written to:', backupPath);
