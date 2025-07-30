// js/script.js
<<<<<<< HEAD
// This file handles fetching, parsing, filtering, and rendering unit and mod data,
// along with the unit tier list, from Google Sheets CSV URLs using the gviz/tq endpoint.

import { unitImages } from './unitImages.js';
import { gameData } from './gameData.js'; // Import gameData (unchanged)

// IMPORTANT: Google Sheet Public CSV URLs using gviz/tq endpoint for CORS compatibility
// This format allows dynamic fetching from Google Sheets directly from the client-side.
const GOOGLE_SHEET_TIER_LIST_CSV_URL = 'https://docs.google.com/spreadsheets/d/2PACX-1vQO78VJA7y_g5zHpzw1gTaJhLV2mjNdRxA33zcj1WPFj-QYxQS09nInTQXg6kXNJcjm4f7Gk7lPVZuV/gviz/tq?tqx=out:csv&gid=0';
const GOOGLE_SHEET_UNIT_DATA_CSV_URL = 'https://docs.google.com/spreadsheets/d/2PACX-1vQO78VJA7y_g5zHpzw1gTaJhLV2mjNdRxA33zcj1WPFj-QYxQS09nInTQXg6kXNJcjm4f7Gk7lPVZuV/gviz/tq?tqx=out:csv&gid=201310748';
const GOOGLE_SHEET_MOD_DATA_CSV_URL = 'https://docs.google.com/spreadsheets/d/2PACX-1vQO78VJA7y_g5zHpzw1gTaJhLV2mjNdRxA33zcj1WPFj-QYxQS09nInTQXg6kXNJcjm4f7Gk7lPVZuV/gviz/tq?tqx=out:csv&gid=331730679';
=======
// Removed imports for rawUnitData and rawModData as data will now be fetched from Google Sheets.
// import { rawUnitData } from './unitsData.js';
// import { rawModData } from './modsData.js';

import { unitImages } from './unitImages.js';
import { gameData } from './gameData.js'; // Import gameData

// IMPORTANT: Google Sheet CSV URLs for Unit and Mod data
const GOOGLE_SHEET_UNIT_DATA_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQO78VJA7y_g5zHpzw1gTaJhLV2mjNdRxA33zcj1WPFj-QYxQS09nInTQXg6kXNJcjm4f7Gk7lPVZuV/pub?gid=201310748&single=true&output=csv';
const GOOGLE_SHEET_MOD_DATA_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQO78VJA7y_g5zHpzw1gTaJhLV2mjNdRxA33zcj1WPFj-QYxQS09nInTQXg6kXNJcjm4f7Gk7lPVZuV/pub?gid=331730679&single=true&output=csv';
>>>>>>> parent of 9b74971 (Revert "WePushingToMAINYALL")

let units = []; // Stores parsed unit data
let mods = [];  // Stores parsed mod data
let currentSortColumn = null;
let currentSortDirection = 'asc'; // 'asc' or 'desc'
let modEffectsEnabled = false; // State for global mod effects toggle
let maxLevelGlobalEnabled = false; // Global state for max level toggle

// DOM Elements
const unitTableBody = document.getElementById('unitTableBody');
const searchInput = document.getElementById('searchInput');
const rarityFilter = document.getElementById('rarityFilter');
const classFilter = document.getElementById('classFilter');
const tableHeaders = document.querySelectorAll('#unitTable th[data-sort]');
const darkModeToggle = document.getElementById('darkModeToggle');
const unitsTab = document.getElementById('unitsTab');
const modsTab = document.getElementById('modsTab');
const unitsContent = document.getElementById('unitsContent');
const modsContent = document.getElementById('modsContent');
const modCheckboxesContainer = document.getElementById('modCheckboxesContainer');
const unitDetailsContainer = document.getElementById('unitDetailsContainer');
const modsTableBody = document.getElementById('modsTableBody'); // Make sure this element exists in index.html
const loadingSpinner = document.getElementById('loadingSpinner');
const toggleModEffects = document.getElementById('toggleModEffects');
const toggleMaxLevel = document.getElementById('toggleMaxLevel');

// Utility function to debounce input for better performance
const debounce = (func, delay) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
};

/**
 * Fetches CSV data from a given URL and parses it into an array of objects.
 * Assumes the first row is the header.
 * @param {string} url - The URL of the CSV file.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of objects.
 */
<<<<<<< HEAD
function normalizeString(str) {
    return String(str).toLowerCase().replace(/\s/g, '');
}

/**
 * Fetches CSV data from a given URL.
 * @param {string} url - The URL of the CSV file.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of objects,
 * where each object represents a row in the CSV.
 */
async function fetchCSVData(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} from ${url}`);
        }
        const csvText = await response.text();
        return parseCSV(csvText);
    } catch (error) {
        console.error(`Error fetching data from ${url}:`, error);
        return [];
    }
}

/**
 * Parses CSV text into an array of objects.
 * Assumes the first row is the header.
 * @param {string} csvText - The CSV data as a string.
 * @returns {Array<Object>} An array of objects, where each object represents a row.
 */
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(header => header.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(value => value.trim());
        if (values.length !== headers.length) {
            console.warn(`Skipping malformed CSV row: ${lines[i]}`);
            continue;
        }
        const rowObject = {};
        headers.forEach((header, index) => {
            rowObject[header] = values[index];
        });
        data.push(rowObject);
    }
    return data;
}

/**
 * Processes raw unit data from CSV into a structured format.
 * Converts string "N/A" to 'N/A' and parses numbers.
 * @param {Array<Object>} csvData - Array of objects from CSV parsing.
 * @returns {Array<Object>} Array of processed unit objects.
 */
function processUnitCSVData(csvData) {
    return csvData.map(row => {
        const unit = {};
        for (const key in row) {
            let value = row[key];
            // Convert "N/A" to 'N/A' string for display consistency
            if (value === 'N/A') {
                unit[key] = 'N/A';
            } else if (!isNaN(parseFloat(value)) && isFinite(value)) {
                // Attempt to parse numbers, but keep "N/A" as string
                unit[key] = parseFloat(value);
            } else {
                unit[key] = value;
            }
        }
        unit.NormalizedLabel = normalizeString(unit.Label);
        return unit;
    });
}

/**
 * Processes raw mod data from CSV into a structured format.
 * Reconstructs mod objects with effects array and description.
 * @param {Array<Object>} csvData - Array of objects from CSV parsing.
 * @returns {Array<Object>} Array of processed mod objects.
 */
function processModCSVData(csvData) {
    return csvData.map(row => {
        const mod = {
            id: row.ModName, // Using ModName as a unique ID
            label: row.ModName,
            rarity: row.Rarity || 'Common',
            effects: []
        };

        const effect = {};
        if (row.Stat && row.Stat !== 'N/A') effect.stat = row.Stat;
        // Parse Amount and Chance as numbers if they exist and are not "N/A"
        if (row.Amount && row.Amount !== 'N/A') effect.amount = parseFloat(row.Amount);
        if (row.Chance && row.Chance !== 'N/A') effect.chance = parseFloat(row.Chance);
        if (row.Effect && row.Effect !== 'N/A') effect.description = row.Effect;

        if (Object.keys(effect).length > 0) {
            mod.effects.push(effect);
        }

        // Generate a readable effect description if not already provided or if it's "N/A"
        if (!mod.effectDescription || mod.effectDescription === 'N/A') {
            let effectDescParts = [];
            mod.effects.forEach(eff => {
                let desc = '';
                const stat = eff.stat;
                const amount = eff.amount;
                const chance = eff.chance;

                if (stat === "HP" || stat === "Damage") {
                    if (typeof amount === 'number') {
                        desc += `Increases ${stat} by ${(amount * 100).toFixed(0)}%`;
                    }
                } else if (stat === "Cooldown") {
                    if (typeof amount === 'number') {
                        desc += `Reduces ${stat} by ${Math.abs(amount).toFixed(2)}s`;
                    }
                } else if (stat === "CritChance" || stat === "EvadeChance" || stat === "Accuracy") {
                    if (typeof amount === 'number') {
                        desc += `Increases ${stat} by ${(amount * 100).toFixed(0)}%`;
                    }
                } else if (stat === "CritDamageCoeff") {
                    if (typeof amount === 'number') {
                        desc += `Increases Crit Damage Multiplier by ${(amount * 100).toFixed(0)}%`;
                    }
                } else if (stat === "Lifesteal") {
                    if (typeof amount === 'number') {
                        desc += `Heals by ${amount} HP for each attack`; // Amount is direct HP value
                    } else if (typeof chance === 'number') {
                        desc += `Heals by ${(chance * 100).toFixed(0)}% HP for each attack`; // If chance, assume percentage
                    }
                } else if (stat === "Knockback") {
                    if (typeof amount === 'number') {
                        desc += `Adds ${amount} Knockback`;
                    }
                } else if (["Frost", "Fire", "Poison", "Mirror"].includes(stat)) {
                    if (typeof chance === 'number') {
                        desc += `Applies ${stat} with ${(chance * 100).toFixed(0)}% chance`;
                    } else {
                        desc += `Applies ${stat}`; // If no chance specified, just state it applies
                    }
                }

                if (desc) effectDescParts.push(desc);
            });
            mod.effectDescription = effectDescParts.join('; ') || (mod.label === "Default" ? "Default unit properties" : 'No defined effect');
        }
        mod.appliesTo = "All"; // Default, as not specified in the mod data
        return mod;
    });
}
=======
async function fetchAndParseCSV(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const csvText = await response.text();
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',').map(header => header.trim());
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(value => value.trim());
            const row = {};
            headers.forEach((header, index) => {
                let value = values[index];
                // Attempt to convert to number if possible, otherwise keep as string
                if (!isNaN(value) && value !== '') {
                    row[header] = Number(value);
                } else if (value === 'N/A') {
                    row[header] = 'N/A'; // Keep N/A as string for clarity
                } else {
                    row[header] = value;
                }
            });
            data.push(row);
        }
        return data;
    } catch (error) {
        console.error(`Error fetching or parsing CSV from ${url}:`, error);
        return []; // Return empty array on error
    }
}

/**
 * Parses the raw unit data into a structured array of unit objects.
 * This function is now simplified as CSV parsing handles most of the structure.
 * @param {Array<Object>} csvData - The array of unit objects parsed from CSV.
 * @returns {Array<Object>} An array of unit objects with appropriate types.
 */
function parseUnitData(csvData) {
    return csvData.map(unit => {
        // Convert relevant fields to numbers, handling 'N/A'
        unit.Damage = unit.Damage === 'N/A' ? 'N/A' : Number(unit.Damage);
        unit.HP = unit.HP === 'N/A' ? 'N/A' : Number(unit.HP);
        unit.Cooldown = unit.Cooldown === 'N/A' ? 'N/A' : Number(unit.Cooldown);
        unit.CritChance = unit.CritChance === 'N/A' ? 'N/A' : Number(unit.CritChance);
        unit.CritDamage = unit.CritDamage === 'N/A' ? 'N/A' : Number(unit.CritDamage);
        unit.Accuracy = unit.Accuracy === 'N/A' ? 'N/A' : Number(unit.Accuracy);
        unit.EvadeChance = unit.EvadeChance === 'N/A' ? 'N/A' : Number(unit.EvadeChance);
        unit.Distance = unit.Distance === 'N/A' ? 'N/A' : Number(unit.Distance);
        unit.Knockback = unit.Knockback === 'N/A' ? 'N/A' : Number(unit.Knockback);
        unit.ShadowStepDistance = unit.ShadowStepDistance === 'N/A' ? 'N/A' : Number(unit.ShadowStepDistance);
        unit.ShadowStepCooldown = unit.ShadowStepCooldown === 'N/A' ? 'N/A' : Number(unit.ShadowStepCooldown);
        unit.AttackEffectLifesteal = unit.AttackEffectLifesteal === 'N/A' ? 'N/A' : Number(unit.AttackEffectLifesteal);
        unit.HPOffset = unit.HPOffset === 'N/A' ? 'N/A' : Number(unit.HPOffset);

        // Add a unique ID for each unit based on its UnitName (original key)
        unit.id = unit.UnitName;

        return unit;
    });
}

/**
 * Parses the raw mod data into a structured array of mod objects.
 * This function is now simplified as CSV parsing handles most of the structure.
 * @param {Array<Object>} csvData - The array of mod objects parsed from CSV.
 * @returns {Array<Object>} An array of mod objects with appropriate types.
 */
function parseModData(csvData) {
    return csvData.map(mod => {
        // Convert Amount and Chance to numbers, handling empty strings/N/A as 0 or 'N/A'
        mod.Amount = mod.Amount === '' || mod.Amount === 'N/A' ? 0 : Number(mod.Amount);
        mod.Chance = mod.Chance === '' || mod.Chance === 'N/A' ? 0 : Number(mod.Chance);
        return mod;
    });
}

/**
 * Calculates the modified stat value for a unit based on a given mod.
 * @param {Object} unit - The unit object.
 * @param {Object} mod - The mod object.
 * @param {string} statKey - The key of the stat to modify (e.g., 'HP', 'Damage').
 * @param {number} baseValue - The base value of the stat.
 * @returns {number} The modified stat value.
 */
function calculateModifiedStat(unit, mod, statKey, baseValue) {
    let modifiedValue = baseValue;

    // Handle percentage-based mods (Damage, HP, Cooldown, CritChance, EvadeChance, Accuracy, Mirror)
    if (['Damage', 'HP', 'Cooldown', 'CritChance', 'EvadeChance', 'Accuracy', 'Mirror'].includes(statKey) && typeof mod.Amount === 'number') {
        modifiedValue = baseValue * (1 + mod.Amount);
    }
    // Handle CritDamageCoeff which is a direct addition
    else if (statKey === 'CritDamageCoeff' && typeof mod.Amount === 'number') {
        modifiedValue = baseValue + mod.Amount;
    }
    // Handle Lifesteal which is a direct addition (amount is HP healed)
    else if (statKey === 'Lifesteal' && typeof mod.Amount === 'number') {
        modifiedValue = baseValue + mod.Amount;
    }
    // For other stats or if mod.Amount is not a number, return base value
    else {
        modifiedValue = baseValue;
    }

    return modifiedValue;
}

/**
 * Applies selected mods and global effects to unit stats.
 * @param {Object} unit - The original unit object.
 * @param {Array<string>} selectedModIds - Array of IDs of currently selected mods.
 * @param {boolean} applyMaxLevel - Whether to apply max level stat modifiers.
 * @returns {Object} A new unit object with modified stats.
 */
function applyModsAndLevelEffects(unit, selectedModIds, applyMaxLevel) {
    let modifiedUnit = { ...unit }; // Create a shallow copy to avoid modifying original unit

    // Apply global max level effects if enabled
    if (applyMaxLevel) {
        const unitClass = unit.Class;
        const unitRarity = unit.Rarity;

        if (gameData.StatModifiersByClassAndRarity[unitClass]) {
            const classModifiers = gameData.StatModifiersByClassAndRarity[unitClass];
            for (const stat in classModifiers) {
                if (classModifiers.hasOwnProperty(stat)) {
                    const modifier = classModifiers[stat];
                    if (modifier._attributes && modifier._attributes[unitRarity] !== undefined) {
                        const baseValue = typeof modifiedUnit[stat] === 'number' ? modifiedUnit[stat] : 0;
                        // For Cooldown, it's a reduction, so subtract the modifier
                        if (stat === 'Cooldown') {
                            modifiedUnit[stat] = baseValue + modifier._attributes[unitRarity];
                        } else {
                            modifiedUnit[stat] = baseValue * (1 + modifier._attributes[unitRarity]);
                        }
                    }
                }
            }
        }
    }
>>>>>>> parent of 9b74971 (Revert "WePushingToMAINYALL")

    // Apply selected mods
    selectedModIds.forEach(modId => {
        const mod = mods.find(m => m.ModName === modId); // Find mod by ModName (which is now the ID)
        if (mod) {
            const statKey = mod.Stat;
            if (statKey && modifiedUnit[statKey] !== undefined && modifiedUnit[statKey] !== 'N/A') {
                const baseValue = typeof modifiedUnit[statKey] === 'number' ? modifiedUnit[statKey] : 0;
                modifiedUnit[statKey] = calculateModifiedStat(modifiedUnit, mod, statKey, baseValue);
            }
            // Handle special effects like Frost, Poison, Fire, Healing, Bard, UpCooldown, UpDamage
            if (mod.Effect && mod.Effect !== "Default unit properties") {
                // For now, these are just descriptive and don't change numerical stats directly
                // If they were to change stats, the logic would go here.
            }
        }
    });

    return modifiedUnit;
}


/**
 * Renders the units table based on current filters and sort order.
 */
<<<<<<< HEAD
function applyModsToUnit(baseUnit, modsToApply) {
    let currentUnit = { ...baseUnit }; // Start with a fresh copy of the base unit
    modsToApply.forEach(mod => {
        currentUnit = applySingleModEffect(currentUnit, mod);
    });
    return currentUnit;
}

/**
 * Calculates a unit's stats at a specific level, applying class/rarity modifiers and then mods.
 * @param {Object} baseUnit - The original unit object (level 1 stats).
 * @param {number} level - The target level for the unit.
 * @param {Array<Object>} selectedMods - An array of mod objects to apply.
 * @returns {Object} A new unit object with calculated stats.
 */
function getUnitStatsAtLevel(baseUnit, level, selectedMods) {
    let calculatedUnit = { ...baseUnit }; // Start with base stats

    const unitClass = baseUnit.Class;
    const unitRarity = baseUnit.Rarity;

    // Apply StatsByClass modifiers based on unit's class and rarity
    if (gameData.StatsByClass[unitClass]) {
        const classStats = gameData.StatsByClass[unitClass];
        for (const statKey in classStats) {
            // Ensure the stat exists on the unit and is a number
            if (typeof calculatedUnit[statKey] === 'number' &&
                classStats[statKey]._attributes &&
                classStats[statKey]._attributes[unitRarity] !== undefined) {

                const modifier = classStats[statKey]._attributes[unitRarity];
                // Apply level scaling: (base_stat * (1 + modifier * (level - 1)))
                // This assumes linear scaling per level based on the modifier
                if (statKey === 'Cooldown') {
                    // Cooldown modifiers are additive and reduce cooldown
                    // We apply the modifier per level, linearly
                    calculatedUnit[statKey] = Math.max(0.1, calculatedUnit[statKey] + (modifier * (level - 1)));
                } else {
                    // Other stats are multiplicative
                    calculatedUnit[statKey] = calculatedUnit[statKey] * (1 + modifier * (level - 1));
                }
            }
        }
    }

    // Apply selected mods on top of the class/rarity modified stats
    calculatedUnit = applyModsToUnit(calculatedUnit, selectedMods);

    return calculatedUnit;
}


/**
 * Renders the unit table rows based on the provided data.
 * @param {Array<Object>} dataToRender - The array of unit objects to display.
 */
function renderUnitTable(dataToRender) {
=======
function renderUnitsTable() {
>>>>>>> parent of 9b74971 (Revert "WePushingToMAINYALL")
    unitTableBody.innerHTML = ''; // Clear existing rows
    unitDetailsContainer.innerHTML = ''; // Clear unit details

    const searchQuery = searchInput.value.toLowerCase();
    const selectedRarity = rarityFilter.value;
    const selectedClass = classFilter.value;

    let filteredUnits = units.filter(unit => {
        const matchesSearch = unit.Label.toLowerCase().includes(searchQuery);
        const matchesRarity = selectedRarity === 'All' || unit.Rarity === selectedRarity;
        const matchesClass = selectedClass === 'All' || unit.Class === selectedClass;
        return matchesSearch && matchesRarity && matchesClass;
    });

    // Apply sorting
    if (currentSortColumn) {
        filteredUnits.sort((a, b) => {
            let valA = a[currentSortColumn];
            let valB = b[currentSortColumn];

            // Handle 'N/A' values for sorting
            if (valA === 'N/A') valA = -Infinity; // Treat N/A as very small for numerical sorts
            if (valB === 'N/A') valB = -Infinity;

            if (typeof valA === 'string') {
                return currentSortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            } else {
                return currentSortDirection === 'asc' ? valA - valB : valB - valA;
            }
        });
    }

    // Apply mods and level effects if enabled
    const unitsToRender = filteredUnits.map(unit => {
        const selectedModIds = Array.from(modCheckboxesContainer.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
        return applyModsAndLevelEffects(unit, selectedModIds, maxLevelGlobalEnabled);
    });

    unitsToRender.forEach(unit => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer transition-colors duration-200';
        row.innerHTML = `
            <td class="py-3 px-6 whitespace-nowrap">
                <img src="${unitImages[unit.Label] || 'https://placehold.co/60x60/cccccc/333333?text=N/A'}" alt="${unit.Label}" class="w-10 h-10 rounded-full object-cover">
            </td>
            <td class="py-3 px-6 whitespace-nowrap font-medium text-gray-900 dark:text-gray-100">${unit.Label}</td>
            <td class="py-3 px-6 whitespace-nowrap">${unit.Class}</td>
            <td class="py-3 px-6 whitespace-nowrap">${unit.Rarity}</td>
            <td class="py-3 px-6 whitespace-nowrap">${unit.HP !== 'N/A' ? unit.HP.toFixed(2) : 'N/A'}</td>
            <td class="py-3 px-6 whitespace-nowrap">${unit.Damage !== 'N/A' ? unit.Damage.toFixed(2) : 'N/A'}</td>
            <td class="py-3 px-6 whitespace-nowrap">${unit.Cooldown !== 'N/A' ? unit.Cooldown.toFixed(2) : 'N/A'}</td>
            <td class="py-3 px-6 whitespace-nowrap">${unit.CritChance !== 'N/A' ? (unit.CritChance * 100).toFixed(2) + '%' : 'N/A'}</td>
            <td class="py-3 px-6 whitespace-nowrap">${unit.CritDamage !== 'N/A' ? unit.CritDamage.toFixed(2) : 'N/A'}</td>
            <td class="py-3 px-6 whitespace-nowrap">${unit.Accuracy !== 'N/A' ? unit.Accuracy.toFixed(2) : 'N/A'}</td>
            <td class="py-3 px-6 whitespace-nowrap">${unit.EvadeChance !== 'N/A' ? (unit.EvadeChance * 100).toFixed(2) + '%' : 'N/A'}</td>
            <td class="py-3 px-6 whitespace-nowrap">${unit.Distance !== 'N/A' ? unit.Distance.toFixed(2) : 'N/A'}</td>
            <td class="py-3 px-6 whitespace-nowrap">${unit.Knockback !== 'N/A' ? unit.Knockback.toFixed(2) : 'N/A'}</td>
        `;
        row.addEventListener('click', () => displayUnitDetails(unit.id)); // Use unit.id for details
        unitTableBody.appendChild(row);
    });
}

/**
 * Displays detailed information for a selected unit, including mod effects.
 * @param {string} unitId - The ID of the unit to display details for.
 */
function displayUnitDetails(unitId) {
    const originalUnit = units.find(u => u.id === unitId);
    if (!originalUnit) {
        unitDetailsContainer.innerHTML = '<p class="text-red-500">Unit not found.</p>';
        return;
    }

    // Get selected mods for calculation
    const selectedModIds = Array.from(modCheckboxesContainer.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
    const modifiedUnit = applyModsAndLevelEffects(originalUnit, selectedModIds, maxLevelGlobalEnabled);


<<<<<<< HEAD
        modColumnOrder.forEach(key => {
            const cell = row.insertCell();
            cell.classList.add('py-4', 'px-6', 'whitespace-nowrap', 'text-sm');
            if (key === 'label') {
                cell.classList.add('font-medium', 'text-gray-900', 'dark:text-gray-100');
            } else {
                cell.classList.add('text-gray-500', 'dark:text-gray-300');
            }
            cell.textContent = mod[key] !== undefined ? mod[key] : 'N/A';
        });
    });
}

/**
 * Fetches and parses tier list data from a Google Sheet CSV URL.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of tier list objects.
 */
async function fetchTierListData() {
    tierListSpinner.classList.remove('hidden');
    tierListTableContainer.classList.add('hidden');
    noTierListMessage.classList.add('hidden');
    try {
        if (!GOOGLE_SHEET_TIER_LIST_CSV_URL) {
            throw new Error("Google Sheet Tier List URL is not configured. Please update script.js with your public CSV URL.");
        }

        const csvText = await fetchCSVData(GOOGLE_SHEET_TIER_LIST_CSV_URL);
        // Tier list CSV already has correct headers and values, so direct parseCSV is fine
        const parsedTierList = parseCSV(csvText);
        // Add a normalized UnitName for easier matching with units data
        return parsedTierList.map(item => {
            if (item['UnitName']) {
                item.NormalizedUnitName = normalizeString(item['UnitName']);
            }
            return item;
        });
    } catch (error) {
        console.error("Error fetching tier list data:", error);
        noTierListMessage.textContent = `Failed to load tier list: ${error.message}`;
        noTierListMessage.classList.remove('hidden');
        return [];
    } finally {
        tierListSpinner.classList.add('hidden');
    }
}


/**
 * Renders the tier list table.
 * @param {Array<Object>} dataToRender - The array of tier list objects to display.
 */
function renderTierListTable(dataToRender) {
    tierListTableBody.innerHTML = ''; // Clear existing rows
    if (dataToRender.length === 0) {
        noTierListMessage.classList.remove('hidden');
        tierListTableContainer.classList.add('hidden');
        return;
    } else {
        noTierListMessage.classList.add('hidden');
        tierListTableContainer.classList.remove('hidden');
    }

    // Define the order of columns for the tier list table
    const tierListColumnOrder = ['UnitName', 'Tier', 'NumericalRank', 'Notes'];

    dataToRender.forEach(item => {
        const row = tierListTableBody.insertRow();
        row.classList.add('bg-white', 'dark:bg-gray-700');

        tierListColumnOrder.forEach(key => {
            const cell = row.insertCell();
            cell.classList.add('py-4', 'px-6', 'text-sm');
            if (key === 'UnitName' || key === 'Tier') {
                cell.classList.add('font-medium', 'text-gray-900', 'dark:text-gray-100', 'whitespace-nowrap');
            } else {
                cell.classList.add('text-gray-500', 'dark:text-gray-300', 'text-wrap');
            }
            cell.textContent = item[key] !== undefined ? item[key] : 'N/A';
        });
    });
=======
    let detailsHtml = `
        <div class="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg mt-8 border border-gray-200 dark:border-gray-700">
            <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">${originalUnit.Label} Details</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 unit-details-row">
                <div>
                    <img src="${unitImages[originalUnit.Label] || 'https://placehold.co/100x100/cccccc/333333?text=N/A'}" alt="${originalUnit.Label}" class="w-24 h-24 rounded-full object-cover mb-4">
                    <p><strong>Class:</strong> ${originalUnit.Class}</p>
                    <p><strong>Rarity:</strong> ${originalUnit.Rarity}</p>
                    <p><strong>Attack Effect:</strong> ${originalUnit.AttackEffect}</p>
                    <p><strong>Attack Effect Type:</strong> ${originalUnit.AttackEffectType}</p>
                    <p><strong>Attack Effect Lifesteal:</strong> ${originalUnit.AttackEffectLifesteal !== 'N/A' ? originalUnit.AttackEffectLifesteal.toFixed(2) : 'N/A'}</p>
                    <p><strong>Attack Effect Key:</strong> ${originalUnit.AttackEffectKey}</p>
                    <p><strong>Shadow Step Distance:</strong> ${originalUnit.ShadowStepDistance !== 'N/A' ? originalUnit.ShadowStepDistance.toFixed(2) : 'N/A'}</p>
                    <p><strong>Shadow Step Cooldown:</strong> ${originalUnit.ShadowStepCooldown !== 'N/A' ? originalUnit.ShadowStepCooldown.toFixed(2) : 'N/A'}</p>
                    <p><strong>HP Offset:</strong> ${originalUnit.HPOffset !== 'N/A' ? originalUnit.HPOffset.toFixed(2) : 'N/A'}</p>
                </div>
                <div>
                    <h3 class="text-lg font-semibold mb-2">Base Stats:</h3>
                    <ul>
                        <li><strong>HP:</strong> ${originalUnit.HP !== 'N/A' ? originalUnit.HP.toFixed(2) : 'N/A'}</li>
                        <li><strong>Damage:</strong> ${originalUnit.Damage !== 'N/A' ? originalUnit.Damage.toFixed(2) : 'N/A'}</li>
                        <li><strong>Cooldown:</strong> ${originalUnit.Cooldown !== 'N/A' ? originalUnit.Cooldown.toFixed(2) : 'N/A'}</li>
                        <li><strong>Crit Chance:</strong> ${originalUnit.CritChance !== 'N/A' ? (originalUnit.CritChance * 100).toFixed(2) + '%' : 'N/A'}</li>
                        <li><strong>Crit Damage:</strong> ${originalUnit.CritDamage !== 'N/A' ? originalUnit.CritDamage.toFixed(2) : 'N/A'}</li>
                        <li><strong>Accuracy:</strong> ${originalUnit.Accuracy !== 'N/A' ? originalUnit.Accuracy.toFixed(2) : 'N/A'}</li>
                        <li><strong>Evade Chance:</strong> ${originalUnit.EvadeChance !== 'N/A' ? (originalUnit.EvadeChance * 100).toFixed(2) + '%' : 'N/A'}</li>
                        <li><strong>Distance:</strong> ${originalUnit.Distance !== 'N/A' ? originalUnit.Distance.toFixed(2) : 'N/A'}</li>
                        <li><strong>Knockback:</strong> ${originalUnit.Knockback !== 'N/A' ? originalUnit.Knockback.toFixed(2) : 'N/A'}</li>
                    </ul>
                    ${(modEffectsEnabled || maxLevelGlobalEnabled) ? `
                    <h3 class="text-lg font-semibold mt-4 mb-2">Modified Stats:</h3>
                    <ul>
                        <li><strong>HP:</strong> ${modifiedUnit.HP !== 'N/A' ? modifiedUnit.HP.toFixed(2) : 'N/A'}</li>
                        <li><strong>Damage:</strong> ${modifiedUnit.Damage !== 'N/A' ? modifiedUnit.Damage.toFixed(2) : 'N/A'}</li>
                        <li><strong>Cooldown:</strong> ${modifiedUnit.Cooldown !== 'N/A' ? modifiedUnit.Cooldown.toFixed(2) : 'N/A'}</li>
                        <li><strong>Crit Chance:</strong> ${modifiedUnit.CritChance !== 'N/A' ? (modifiedUnit.CritChance * 100).toFixed(2) + '%' : 'N/A'}</li>
                        <li><strong>Crit Damage:</strong> ${modifiedUnit.CritDamage !== 'N/A' ? modifiedUnit.CritDamage.toFixed(2) : 'N/A'}</li>
                        <li><strong>Accuracy:</strong> ${modifiedUnit.Accuracy !== 'N/A' ? modifiedUnit.Accuracy.toFixed(2) : 'N/A'}</li>
                        <li><strong>Evade Chance:</strong> ${modifiedUnit.EvadeChance !== 'N/A' ? (modifiedUnit.EvadeChance * 100).toFixed(2) + '%' : 'N/A'}</li>
                        <li><strong>Distance:</strong> ${modifiedUnit.Distance !== 'N/A' ? modifiedUnit.Distance.toFixed(2) : 'N/A'}</li>
                        <li><strong>Knockback:</strong> ${modifiedUnit.Knockback !== 'N/A' ? modifiedUnit.Knockback.toFixed(2) : 'N/A'}</li>
                    </ul>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
    unitDetailsContainer.innerHTML = detailsHtml;
>>>>>>> parent of 9b74971 (Revert "WePushingToMAINYALL")
}


/**
 * Renders the mod checkboxes for filtering.
 */
function renderModCheckboxes() {
    modCheckboxesContainer.innerHTML = ''; // Clear existing checkboxes

    // Group mods by rarity
    const modsByRarity = mods.reduce((acc, mod) => {
        if (!acc[mod.Rarity]) {
            acc[mod.Rarity] = [];
        }
        acc[mod.Rarity].push(mod);
        return acc;
    }, {});

    // Define the order of rarities
    const rarityOrder = ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic", "Demonic", "Ancient"];

<<<<<<< HEAD
    // Now, expand the newly clicked row
    expandedUnitRowId = index;
    clickedRow.classList.add('expanded');

    // Create the new detail row
    const detailRow = unitTableBody.insertRow(clickedRow.rowIndex + 1);
    detailRow.classList.add('unit-details-row', 'bg-gray-50', 'dark:bg-gray-700', 'border-b', 'border-gray-200', 'dark:border-gray-600');
    detailRow.dataset.unitIndex = index; // Link to the unit row

    const detailCell = detailRow.insertCell(0);
    detailCell.colSpan = unitColumnOrder.length + 1; // Span all columns (including image)
    detailCell.classList.add('p-4', 'pt-2');

    const detailContent = document.createElement('div');
    detailContent.classList.add('flex', 'flex-col', 'md:flex-row', 'gap-4', 'text-sm');

    // Left side: Base Stats
    const baseStatsDiv = document.createElement('div');
    baseStatsDiv.classList.add('flex-1', 'p-3', 'rounded-lg', 'bg-gray-100', 'dark:bg-gray-600', 'shadow-inner');
    baseStatsDiv.innerHTML = `<h3 class="font-semibold text-lg mb-2 text-gray-800 dark:text-gray-100">Base Stats:</h3>
                              <ul id="baseStatsList" class="space-y-1 text-gray-700 dark:text-gray-200"></ul>`;
    detailContent.appendChild(baseStatsDiv);

    const baseStatsList = baseStatsDiv.querySelector('#baseStatsList');
    // Use allUnitStatsForDropdown to ensure all stats are displayed in the dropdown
    allUnitStatsForDropdown.forEach(key => {
        const li = document.createElement('li');
        let displayValue = unit[key];
        // Apply specific formatting for percentages and numbers
        if (['Cooldown', 'HP', 'Damage', 'Distance', 'CritChance', 'CritDamage', 'AttackEffectLifesteal', 'Knockback', 'Accuracy', 'EvadeChance'].includes(key)) {
            displayValue = typeof displayValue === 'number' ? displayValue.toFixed(2) : displayValue;
        }
        // Special formatting for percentage values
        if (['CritChance', 'EvadeChance', 'Accuracy'].includes(key) && typeof displayValue === 'number') {
            displayValue = (displayValue * 100).toFixed(2) + '%';
        }
        li.textContent = `${key}: ${displayValue !== undefined ? displayValue : 'N/A'}`;
        baseStatsList.appendChild(li);
    });

    // Right side: Mod Toggles and Applied Stats
    const modApplyDiv = document.createElement('div');
    modApplyDiv.classList.add('flex-1', 'p-3', 'rounded-lg', 'bg-blue-50', 'dark:bg-blue-900', 'shadow-inner');
    modApplyDiv.innerHTML = `<h3 class="font-semibold text-lg mb-2 text-blue-800 dark:text-blue-200">Apply Mods:</h3>
                             <div class="mb-4 flex items-center">
                                 <input type="checkbox" id="toggleMaxLevelUnit" class="mr-2 rounded text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400">
                                 <label for="toggleMaxLevelUnit" class="text-gray-700 dark:text-gray-300">Show Max Level (25)</label>
                             </div>
                             <div class="mb-4 flex items-center">
                                 <label for="levelInput" class="text-gray-700 dark:text-gray-300 mr-2">Level:</label>
                                 <input type="number" id="levelInput" value="1" min="1" max="25"
                                        class="p-1 border border-gray-300 dark:border-gray-600 rounded-md w-20 text-center
                                               bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                             </div>
                             <div id="modCheckboxesContainer" class="flex gap-x-4 gap-y-2 mb-4 text-gray-700 dark:text-gray-200 overflow-x-auto pb-2"></div>
                             <h3 class="font-semibold text-lg mb-2 text-blue-800 dark:text-blue-200">Stats with Mods:</h3>
                             <ul id="appliedStatsList" class="space-y-1 text-gray-700 dark:text-gray-200"></ul>
                             <h3 class="font-semibold text-lg mt-4 mb-2 text-blue-800 dark:text-blue-200">Active Mod Effects:</h3>
                             <ul id="activeModEffectsList" class="space-y-1 text-gray-700 dark:text-gray-200"></ul>`; // New section for mod effects
    detailContent.appendChild(modApplyDiv);

    const toggleMaxLevelUnit = modApplyDiv.querySelector('#toggleMaxLevelUnit');
    const levelInput = modApplyDiv.querySelector('#levelInput');
    const modCheckboxesContainer = modApplyDiv.querySelector('#modCheckboxesContainer');
    const appliedStatsList = modApplyDiv.querySelector('#appliedStatsList');
    const activeModEffectsList = modApplyDiv.querySelector('#activeModEffectsList'); // New DOM element for mod effects

    // Store selected mods for this specific unit's detail view
    let selectedModsForUnit = [];

    // Populate mod checkboxes, sorted by rarity in columns
    const modsByRarity = {};
    rarityOrder.forEach(rarity => modsByRarity[rarity] = []);
    mods.forEach(mod => {
        if (modsByRarity[mod.rarity]) {
            modsByRarity[mod.rarity].push(mod);
        }
    });

    // Create columns for each rarity
=======
>>>>>>> parent of 9b74971 (Revert "WePushingToMAINYALL")
    rarityOrder.forEach(rarity => {
        if (modsByRarity[rarity] && modsByRarity[rarity].length > 0) {
            const rarityGroup = document.createElement('div');
            rarityGroup.className = 'mb-4';
            rarityGroup.innerHTML = `<h4 class="text-base font-bold text-gray-900 dark:text-gray-100 mb-2">${rarity} Mods</h4>`;

            modsByRarity[rarity].forEach(mod => {
                const checkboxDiv = document.createElement('div');
                checkboxDiv.className = 'flex items-center mb-2';
                checkboxDiv.innerHTML = `
                    <input type="checkbox" id="mod-${mod.ModName}" value="${mod.ModName}" class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:focus:ring-blue-600">
                    <label for="mod-${mod.ModName}" class="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">${mod.Title} (${mod.Effect})</label>
                `;
                const checkbox = checkboxDiv.querySelector('input');
                checkbox.addEventListener('change', filterAndRenderUnits); // Re-render units when mod selection changes
                rarityGroup.appendChild(checkboxDiv);
            });
            modCheckboxesContainer.appendChild(rarityGroup);
        }
    });
}

/**
 * Renders the mods table.
 */
function renderModsTable() {
    modsTableBody.innerHTML = ''; // Clear existing rows
    mods.forEach(mod => {
        const row = document.createElement('tr');
        row.className = 'bg-white dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600';
        row.innerHTML = `
            <td class="py-3 px-6 whitespace-nowrap font-medium text-gray-900 dark:text-gray-100">${mod.Title}</td>
            <td class="py-3 px-6 whitespace-nowrap">${mod.Rarity}</td>
            <td class="py-3 px-6">${mod.Effect}</td>
        `;
        modsTableBody.appendChild(row);
    });
}

/**
 * Filters and re-renders units based on current search and filter criteria.
 */
function filterAndRenderUnits() {
    // Small delay to show spinner for a moment even if data loads fast
    loadingSpinner.classList.remove('hidden');
    setTimeout(() => {
        renderUnitsTable();
        loadingSpinner.classList.add('hidden');
    }, 50);
}

/**
 * Sorts the units data by the specified column.
 * @param {string} column - The column to sort by.
 */
function sortData(column) {
    if (currentSortColumn === column) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = column;
        currentSortDirection = 'asc';
    }
    filterAndRenderUnits(); // Re-render with new sort order
}

/**
 * Toggles dark mode on and off.
 */
function toggleDarkMode() {
    document.documentElement.classList.toggle('dark');
    const isDarkMode = document.documentElement.classList.contains('dark');
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
}

/**
 * Switches between unit and mod tabs.
 * @param {string} activeTabId - The ID of the tab to activate ('unitsTab' or 'modsTab').
 */
function switchTab(activeTabId) {
    // Deactivate all tabs and hide all content sections
    unitsTab.classList.remove('border-blue-500', 'text-blue-500');
    modsTab.classList.remove('border-blue-500', 'text-blue-500');
    unitsContent.classList.add('hidden');
    modsContent.classList.add('hidden');

    // Activate the selected tab and show its content
    if (activeTabId === 'unitsTab') {
        unitsTab.classList.add('border-blue-500', 'text-blue-500');
        unitsContent.classList.remove('hidden');
    } else if (activeTabId === 'modsTab') {
        modsTab.classList.add('border-blue-500', 'text-blue-500');
        modsContent.classList.remove('hidden');
    }
}

/**
 * Initializes the application by fetching data and setting up event listeners.
 */
async function init() {
    loadingSpinner.classList.remove('hidden'); // Show spinner on init

    // Fetch and parse unit data from Google Sheet
    const fetchedUnitData = await fetchAndParseCSV(GOOGLE_SHEET_UNIT_DATA_CSV_URL);
    units = parseUnitData(fetchedUnitData);

    // Fetch and parse mod data from Google Sheet
    const fetchedModData = await fetchAndParseCSV(GOOGLE_SHEET_MOD_DATA_CSV_URL);
    mods = parseModData(fetchedModData);

    // Populate filters (only if data is available)
    if (units.length > 0) {
        const rarities = [...new Set(units.map(unit => unit.Rarity))];
        rarities.forEach(rarity => {
            const option = document.createElement('option');
            option.value = rarity;
            option.textContent = rarity;
            rarityFilter.appendChild(option);
        });

<<<<<<< HEAD
    // Fetch and process unit data from CSV
    const rawUnitsCSVData = await fetchCSVData(GOOGLE_SHEET_UNIT_DATA_CSV_URL);
    units = processUnitCSVData(rawUnitsCSVData);

    // Fetch and process mod data from CSV
    const rawModsCSVData = await fetchCSVData(GOOGLE_SHEET_MOD_DATA_CSV_URL);
    mods = processModCSVData(rawModsCSVData);

    // Fetch tier list data and wait for it to complete
    tierList = await fetchTierListData();
=======
        const classes = [...new Set(units.map(unit => unit.Class))];
        classes.forEach(unitClass => {
            const option = document.createElement('option');
            option.value = unitClass;
            option.textContent = unitClass;
            classFilter.appendChild(option);
        });
    }

    // Render initial tables and checkboxes
    renderModCheckboxes();
    renderModsTable();
    filterAndRenderUnits(); // Initial render of units table
>>>>>>> parent of 9b74971 (Revert "WePushingToMAINYALL")

    // Hide spinner after initial render
    loadingSpinner.classList.add('hidden');

    // Set initial theme based on localStorage or system preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    }

    // Event Listeners
    // Search and Filter Events (debounced for performance)
    const debouncedFilterAndRenderUnits = debounce(filterAndRenderUnits, 300);
    searchInput.addEventListener('input', debouncedFilterAndRenderUnits);
    rarityFilter.addEventListener('change', filterAndRenderUnits);
    classFilter.addEventListener('change', filterAndRenderUnits);

    // Table Header Sorting Events
    tableHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const sortColumn = header.dataset.sort;
            if (sortColumn) {
                sortData(sortColumn);
            }
        });
    });

    // Dark Mode Toggle Event
    darkModeToggle.addEventListener('click', toggleDarkMode);

    // Tab Switching Events
    unitsTab.addEventListener('click', () => switchTab('unitsTab'));
    modsTab.addEventListener('click', () => switchTab('modsTab'));

    // Mod Effects Toggle Event (global)
    toggleModEffects.addEventListener('change', () => {
        modEffectsEnabled = toggleModEffects.checked;
        filterAndRenderUnits(); // Re-render units to apply/remove global mod effects
    });

    // Global Max Level Toggle Event
    toggleMaxLevel.addEventListener('change', () => {
        maxLevelGlobalEnabled = toggleMaxLevel.checked;
        filterAndRenderUnits(); // Re-render units to apply/remove global max level effects
    });
}

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);

