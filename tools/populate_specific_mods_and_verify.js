const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const workbookPath = path.resolve(process.argv[2] || 'UnitTierList.xlsx');
const sheetName = process.argv[3] || 'Mod List';

if (!fs.existsSync(workbookPath)) {
    console.error('Workbook not found at', workbookPath);
    process.exit(1);
}

const wb = xlsx.readFile(workbookPath);
const ws = wb.Sheets[sheetName];
if (!ws) {
    console.error('Sheet not found:', sheetName);
    process.exit(1);
}

let rows = xlsx.utils.sheet_to_json(ws, { header: 1 });
if (!rows || rows.length === 0) {
    console.error('No rows in sheet');
    process.exit(1);
}

const headers = rows[0].map(h => String(h).trim());
function setCell(rowIdx, colName, value) {
    const colIdx = headers.indexOf(colName);
    if (colIdx === -1) {
        console.warn('Header not found:', colName);
        return;
    }
    rows[rowIdx][colIdx] = value;
}

// Find row indices for the mods by ModName (assuming ModName is in headers)
const modNameCol = headers.indexOf('ModName') !== -1 ? headers.indexOf('ModName') : headers.indexOf('Mod Name');
if (modNameCol === -1) {
    console.error('Could not find ModName column in headers:', headers.join(', '));
    process.exit(1);
}

function findRowIndexByModName(modName) {
    for (let i = 1; i < rows.length; i++) {
        const cell = rows[i][modNameCol];
        if (cell && String(cell).trim() === modName) return i;
    }
    return -1;
}

const modsToUpdate = [
    {
        id: 'SmallPoison',
        fields: {
            AttackEffectDamage: 2,
            AttackEffectRate: 0.3,
            AttackEffectCount: 8
        }
    },
    {
        id: 'MediumFire',
        fields: {
            AttackEffectDamage: 10,
            AttackEffectRate: 0.5,
            AttackEffectCount: 3
        }
    },
    {
        id: 'MediumMirror',
        fields: {
            DefenseMirrorPercent: 0.15
        }
    }
];

const updated = [];
modsToUpdate.forEach(mod => {
    const idx = findRowIndexByModName(mod.id);
    if (idx === -1) {
        console.warn('Mod not found in sheet:', mod.id);
        return;
    }
    Object.entries(mod.fields).forEach(([k, v]) => {
        setCell(idx, k, v);
    });
    updated.push(mod.id);
});

if (updated.length > 0) {
    // write backup and save
    const backupPath = workbookPath.replace(/\.xlsx$/i, '.postpopulate.backup.xlsx');
    fs.copyFileSync(workbookPath, backupPath);
    const newWs = xlsx.utils.aoa_to_sheet(rows);
    wb.Sheets[sheetName] = newWs;
    xlsx.writeFile(wb, workbookPath);
    console.log('Updated mods:', updated.join(', '));
    console.log('Backup of previous workbook written to', backupPath);
} else {
    console.log('No mods were updated.');
}

// --- Verification: compute DPS for Goblin Axeman with MediumFire applied ---
// Use the same simplified calculation logic from Staging/script.js

function applySingleModEffect(unit, mod) {
    const modifiedUnit = { ...unit };
    mod.effects.forEach(effect => {
        const stat = effect.stat;
        const amount = effect.amount;
        // Only handling the cases we need for this test
        switch (stat) {
            case 'AttackEffectDamage':
                if (typeof amount === 'number') modifiedUnit.AttackEffectDamage = (typeof modifiedUnit.AttackEffectDamage === 'number' ? modifiedUnit.AttackEffectDamage : 0) + amount;
                break;
            case 'AttackEffectCount':
                if (typeof amount === 'number') modifiedUnit.AttackEffectCount = (typeof modifiedUnit.AttackEffectCount === 'number' ? modifiedUnit.AttackEffectCount : 0) + amount;
                break;
            case 'AttackEffectRate':
                if (typeof amount === 'number') {
                    if (typeof modifiedUnit.AttackEffectRate !== 'number' || amount < modifiedUnit.AttackEffectRate) modifiedUnit.AttackEffectRate = amount;
                }
                break;
            case 'DefenseMirrorPercent':
                if (typeof amount === 'number') modifiedUnit.DefenseMirrorPercent = (typeof modifiedUnit.DefenseMirrorPercent === 'number' ? modifiedUnit.DefenseMirrorPercent : 0) + amount;
                break;
            default:
                break;
        }
    });
    return modifiedUnit;
}

function applyModsToUnit(baseUnit, modsToApply) {
    let currentUnit = { ...baseUnit };
    modsToApply.forEach(mod => {
        currentUnit = applySingleModEffect(currentUnit, mod);
    });
    return currentUnit;
}

function getUnitStatsAtLevel(baseUnit, level, selectedMods) {
    const calculatedUnit = { ...baseUnit };
    // For this simple verification we assume base unit provided already has the numeric stats
    // Apply mods
    const afterMods = applyModsToUnit(calculatedUnit, selectedMods);
    // Compute DPS per site logic
    let dps = 0;
    if (typeof afterMods.Damage === 'number' && typeof afterMods.Cooldown === 'number' && afterMods.Cooldown > 0) {
        dps = afterMods.Damage / afterMods.Cooldown;
        if (typeof afterMods.AttackEffectDamage === 'number' && afterMods.AttackEffectDamage > 0 &&
            typeof afterMods.AttackEffectCount === 'number' && afterMods.AttackEffectCount > 0 &&
            typeof afterMods.AttackEffectRate === 'number' && afterMods.AttackEffectRate > 0) {
            const dotDPS = (afterMods.AttackEffectDamage * afterMods.AttackEffectCount) / afterMods.AttackEffectRate;
            dps += dotDPS;
        }
    }
    afterMods.DPS = dps;
    return afterMods;
}

// Load mods from sheet for the verification
const fetchedMods = [];
for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const obj = {};
    headers.forEach((h, c) => {
        obj[h] = row[c] !== undefined ? row[c] : 'N/A';
    });
    fetchedMods.push(obj);
}

function transformFetchedModData(fetchedMods) {
    return fetchedMods.map(modRow => {
        const mod = { id: modRow.ModName || modRow['Mod Name'], label: modRow.Title || modRow.ModName, rarity: modRow.Rarity || 'Common', effects: [], effectDescription: modRow.Effect || '' };
        // Map known effect columns to mod.effects entries
        const mapping = ['AttackEffectDamage', 'AttackEffectCount', 'AttackEffectRate', 'AttackEffectDamagePercent', 'AttackEffectCooldownPercent', 'DefenseMirrorPercent'];
        mapping.forEach(col => {
            if (modRow[col] !== undefined && modRow[col] !== 'N/A' && modRow[col] !== '') {
                const val = modRow[col];
                if (typeof val === 'number') {
                    mod.effects.push({ stat: col, amount: val });
                } else {
                    const parsed = parseFloat(val);
                    if (!isNaN(parsed)) mod.effects.push({ stat: col, amount: parsed });
                }
            }
        });
        return mod;
    });
}

const transformedMods = transformFetchedModData(fetchedMods);

// Find MediumFire mod and test
const mediumFire = transformedMods.find(m => m.id === 'MediumFire');
if (!mediumFire) {
    console.error('MediumFire not found in transformed mods');
    process.exit(1);
}

// Base Goblin Axeman stats as specified in the request
const goblinAxeman = { Label: 'Goblin Axeman', Damage: 25, Cooldown: 1.75 };

const finalUnit = getUnitStatsAtLevel(goblinAxeman, 1, [mediumFire]);
console.log('Final unit after applying MediumFire:', finalUnit);
console.log('Computed DPS (rounded to 2 decimals):', finalUnit.DPS.toFixed(2));

process.exit(0);
