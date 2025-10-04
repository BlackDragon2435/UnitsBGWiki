const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const filePath = path.resolve(process.argv[2] || '../UnitTierList.xlsx');
const sheetName = process.argv[3] || 'Mod List';

if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
}

const wb = xlsx.readFile(filePath);
if (!wb.Sheets[sheetName]) {
    console.error('Sheet not found:', sheetName);
    console.log('Available sheets:', wb.SheetNames);
    process.exit(1);
}

const ws = wb.Sheets[sheetName];
const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });
const header = rows[0] || [];

const newColumns = [
    'AttackEffectDamage',
    'AttackEffectCount',
    'AttackEffectRate',
    'AttackEffectDamagePercent',
    'AttackEffectCooldownPercent',
    'AttackEffectLifesteal',
    'AttackEffectSlowPercent',
    'AttackEffectSlowAttackPercent',
    'AttackEffectTime',
    'AttackEffectType',
    'AttackEffectKey',
    'DefenseMirrorPercent',
    'Desc'
];

let added = [];
newColumns.forEach(col => {
    if (!header.includes(col)) {
        header.push(col);
        added.push(col);
    }
});

if (added.length === 0) {
    console.log('No new columns to add. Sheet already has all columns.');
} else {
    // Update header row
    rows[0] = header;

    // If there are no data rows (only header), append two sample rows
    if (rows.length <= 1) {
        rows.push([
            'DOT_Fire_01',
            'Scorching Threads',
            'Rare',
            'AttackEffectDamage',
            10,
            0.0,
            'Periodic fire damage',
            10,
            3,
            1.5,
            ,
            ,
            ,
            ,
            ,
            'Damage',
            'DOT_Fire_01',
            ,
            'Deals 10 HP every 1.5s for 3 ticks'
        ]);

        rows.push([
            'BARD_BOOST_01',
            'Bardic Anthem',
            'Legendary',
            'AttackEffectDamagePercent',
            0.20,
            0.0,
            'Temporarily increases damage and attack speed',
            ,
            ,
            ,
            0.20,
            0.10,
            ,
            ,
            ,
            4,
            'UpDamage',
            'BARD_BOOST_01',
            ,
            '+20% Damage and +10% Attack Speed for 4s'
        ]);
    } else {
        // Update sheet keeping existing rows; ensure every row has same number of columns
        const colCount = header.length;
        for (let r = 1; r < rows.length; r++) {
            rows[r].length = Math.max(rows[r].length, colCount);
        }
    }

    // Convert back to sheet and write backup + file
    const newWs = xlsx.utils.aoa_to_sheet(rows);
    wb.Sheets[sheetName] = newWs;

    const backupPath = filePath.replace(/\.xlsx$/i, '.backup.xlsx');
    fs.copyFileSync(filePath, backupPath);
    xlsx.writeFile(wb, filePath);

    console.log('Added columns:', added.join(', '));
    console.log('Backup created at', backupPath);
    console.log('Workbook updated in place:', filePath);
}

process.exit(0);
