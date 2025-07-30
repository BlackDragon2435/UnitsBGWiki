// js/script.js
import { unitImages } from './unitImages.js';
import { gameData } from './gameData.js'; // Import gameData

// Google Sheet CSV URLs
const GOOGLE_SHEET_TIER_LIST_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQO78VJA7y_g5zHpzw1gTaJhLV2mjNdRxA33zcj1WPFj-QYxQS09nInTQXg6kXNJcjm4f7Gk7lPVZuV/pub?gid=0&single=true&output=csv';
const GOOGLE_SHEET_UNIT_DATA_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQO78VJA7y_g5zHpzw1gTaJhLV2mjNdRxA33zcj1WPFj-QYxQS09nInTQXg6kXNJcjm4f7Gk7lPVZuV/pub?gid=201310748&single=true&output=csv';
const GOOGLE_SHEET_MOD_DATA_CSV_URL = 'https://docs.google.com/sheets/d/e/2PACX-1vQO78VJA7y_g5zHpzw1gTaJhLV2mjNdRxA33zcj1WPFj-QYxQS09nInTQXg6kXNJcjm4f7Gk7lPVZuV/pub?gid=331730679&single=true&output=csv';

let units = []; // Stores parsed unit data
let mods = [];  // Stores parsed mod data
let tierList = []; // Stores parsed tier list data
let currentSortColumn = null;
let currentSortDirection = 'asc'; // 'asc' or 'desc'
let modEffectsEnabled = false; // State for global mod effects toggle
let maxLevelGlobalEnabled = false; // Global state for max level toggle

// DOM Elements
const unitTableBody = document.getElementById('unitTableBody');
const searchInput = document.getElementById('searchInput');
const rarityFilter = document.getElementById('rarityFilter');
const classFilter = document.getElementById('classFilter');
const tableHeaders = document.querySelectorAll('#unitTable th');
const loadingSpinner = document.getElementById('loadingSpinner');
const unitTableContainer = document.getElementById('unitTableContainer');
const noResultsMessage = document.getElementById('noResultsMessage');
const darkModeToggle = document.getElementById('darkModeToggle');
const sunIcon = document.getElementById('sunIcon');
const moonIcon = document.getElementById('moonIcon');
const unitsTab = document.getElementById('unitsTab');
const modsTab = document.getElementById('modsTab');
const tierListTab = document.getElementById('tierListTab'); // New Tier List Tab
const unitsContent = document.getElementById('unitsContent');
const modsContent = document.getElementById('modsContent');
const tierListContent = document.getElementById('tierListContent'); // New Tier List Content
const toggleModEffects = document.getElementById('toggleModEffects');
const toggleMaxLevel = document.getElementById('toggleMaxLevel'); // Global Max Level toggle
const modsTableBody = document.querySelector('#modsTable tbody');
const tierListTableBody = document.getElementById('tierListTableBody'); // New Tier List Table Body
const tierListSpinner = document.getElementById('tierListSpinner'); // New Tier List Spinner
const tierListTableContainer = document.getElementById('tierListTableContainer'); // New Tier List Table Container
const noTierListMessage = document.getElementById('noTierListMessage'); // New No Tier List Message

let expandedUnitRowId = null; // To keep track of the currently expanded row

// Define the order of rarities for consistent filtering and display
const rarityOrder = ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic", "Demonic", "Ancient"];

// Define the order of columns for unit table display (simplified for main view)
const unitColumnOrder = [
    'Image', 'Label', 'Class', 'Rarity', 'HP', 'Damage', 'Cooldown'
];

// Define ALL possible unit stats for the detailed dropdown view
const allUnitStatsForDropdown = [
    'Label', 'Class', 'Rarity', 'HP', 'Damage', 'Cooldown', 'Distance',
    'CritChance', 'CritDamage', 'AttackEffect', 'AttackEffectType',
    'AttackEffectLifesteal', 'AttackEffectKey', 'Knockback', 'Accuracy',
    'EvadeChance', 'HPOffset', 'ShadowStepDistance', 'ShadowStepCooldown' // Including all potential stats
];

// --- Utility Functions ---

/**
 * Debounces a function, so it only runs after a certain delay from the last call.
 * Useful for input events like search to prevent excessive function calls.
 * @param {function} func - The function to debounce.
 * @param {number} delay - The delay in milliseconds.
 * @returns {function} The debounced function.
 */
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

/**
 * Fetches CSV data from a given URL and parses it into an array of objects.
 * Handles "N/A" conversion and number parsing.
 * @param {string} url - The URL of the CSV file.
 * @param {string} dataType - 'units', 'mods', or 'tiers' to determine parsing logic.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of parsed objects.
 */
async function fetchCSVData(url, dataType) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const csvText = await response.text();
        return parseCSV(csvText, dataType);
    } catch (error) {
        console.error(`Error fetching ${dataType} data:`, error);
        // Depending on the dataType, update specific error messages
        if (dataType === 'units') {
            noResultsMessage.textContent = `Failed to load unit data: ${error.message}`;
            noResultsMessage.classList.remove('hidden');
            unitTableContainer.classList.add('hidden');
        } else if (dataType === 'mods') {
            modsTableBody.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-red-600 dark:text-red-400">Failed to load mod data: ${error.message}</td></tr>`;
        } else if (dataType === 'tiers') {
            noTierListMessage.textContent = `Failed to load tier list: ${error.message}`;
            noTierListMessage.classList.remove('hidden');
            tierListTableContainer.classList.add('hidden');
        }
        return [];
    }
}

/**
 * Parses CSV text into an array of objects.
 * Assumes the first row is the header.
 * @param {string} csvText - The CSV data as a string.
 * @param {string} dataType - 'units', 'mods', or 'tiers' to apply specific parsing rules.
 * @returns {Array<Object>} An array of objects, where each object represents a row.
 */
function parseCSV(csvText, dataType) {
    const lines = csvText.trim().split('\n');
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(header => header.trim());
    const parsedData = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(value => value.trim());
        if (values.length !== headers.length) {
            console.warn(`Skipping malformed CSV row in ${dataType} data: ${lines[i]}`);
            continue;
        }
        const rowObject = {};
        headers.forEach((header, index) => {
            let value = values[index];

            // Convert "N/A" strings to actual 'N/A' string for consistent handling
            if (value === 'N/A') {
                rowObject[header] = 'N/A';
            } else if (!isNaN(parseFloat(value)) && isFinite(value)) {
                // Attempt to parse numbers, but only if it's a valid number
                rowObject[header] = parseFloat(value);
            } else {
                rowObject[header] = value;
            }
        });

        // Special handling for mods data to create 'effects' array
        if (dataType === 'mods') {
            const mod = {
                id: rowObject['Mod Name'], // Use Mod Name as a unique ID
                label: rowObject['Mod Name'],
                rarity: rowObject['Rarity'] || 'Common',
                effectDescription: rowObject['Effect Description'] || 'No defined effect',
                effects: []
            };

            const effect = {};
            if (rowObject['Stat']) effect.stat = rowObject['Stat'];
            if (rowObject['Amount'] !== undefined && rowObject['Amount'] !== 'N/A') effect.amount = rowObject['Amount'];
            if (rowObject['Chance'] !== undefined && rowObject['Chance'] !== 'N/A') effect.chance = rowObject['Chance'];

            if (Object.keys(effect).length > 0) {
                mod.effects.push(effect);
            }
            parsedData.push(mod);
        } else {
            parsedData.push(rowObject);
        }
    }
    return parsedData;
}


/**
 * Applies a single mod's effects to a unit.
 * @param {Object} unit - The unit object to apply mods to.
 * @param {Object} mod - The mod object to apply.
 * @returns {Object} A new unit object with mod effects applied.
 */
function applySingleModEffect(unit, mod) {
    const modifiedUnit = { ...unit }; // Create a shallow copy

    mod.effects.forEach(effect => {
        const stat = effect.stat;
        const amount = effect.amount;
        const chance = effect.chance; // Keep chance for potential future use or display

        // Ensure the unit property exists and is a number or N/A
        // Only apply if the stat is relevant and exists in the modifiedUnit
        if (modifiedUnit[stat] === undefined && stat !== 'Lifesteal') { // Lifesteal is special, maps to AttackEffectLifesteal
             return; // Stat does not exist on the unit, skip applying mod
        }

        // Initialize N/A stats if a mod applies a numeric amount to them
        if (modifiedUnit[stat] === 'N/A' && typeof amount === 'number') {
            if (['CritChance', 'CritDamage', 'EvadeChance', 'Accuracy', 'Knockback'].includes(stat)) {
                modifiedUnit[stat] = 0; // Initialize to 0 for addition
            }
        }
        // Special initialization for AttackEffectLifesteal if it's 'N/A'
        if (stat === 'Lifesteal' && modifiedUnit.AttackEffectLifesteal === 'N/A') {
            modifiedUnit.AttackEffectLifesteal = 0;
        }


        switch (stat) {
            case "HP":
            case "Damage":
                if (typeof modifiedUnit[stat] === 'number' && typeof amount === 'number') {
                    modifiedUnit[stat] = modifiedUnit[stat] * (1 + amount);
                }
                break;
            case "Cooldown":
                if (typeof modifiedUnit[stat] === 'number' && typeof amount === 'number') {
                    modifiedUnit[stat] = Math.max(0.1, modifiedUnit[stat] + amount); // Ensure cooldown doesn't go below 0.1
                }
                break;
            case "CritChance":
            case "EvadeChance":
            case "Accuracy":
                if (typeof modifiedUnit[stat] === 'number' && typeof amount === 'number') {
                    modifiedUnit[stat] = Math.min(1, modifiedUnit[stat] + amount); // Cap these at 1 (or 100%)
                }
                break;
            case "CritDamageCoeff": // Assuming this modifies CritDamage
                if (typeof modifiedUnit.CritDamage === 'number' && typeof amount === 'number') {
                    modifiedUnit.CritDamage = modifiedUnit.CritDamage * (1 + amount);
                } else if (modifiedUnit.CritDamage === 'N/A' && typeof amount === 'number') {
                    modifiedUnit.CritDamage = 1 + amount; // If N/A, assume base 1 and add multiplier
                }
                break;
            case "Lifesteal":
                // Lifesteal can be an 'amount' or derived from 'chance' in your data
                if (typeof modifiedUnit.AttackEffectLifesteal === 'number' && typeof amount === 'number') {
                    modifiedUnit.AttackEffectLifesteal += amount;
                } else if (typeof modifiedUnit.AttackEffectLifesteal === 'number' && typeof chance === 'number') {
                    // If Lifesteal is given as a chance, assume it's also an amount to add
                    modifiedUnit.AttackEffectLifesteal += (chance * 100); // Assuming chance is a multiplier, convert to percentage point
                } else if (modifiedUnit.AttackEffectLifesteal === 'N/A' && typeof amount === 'number') {
                    modifiedUnit.AttackEffectLifesteal = amount;
                } else if (modifiedUnit.AttackEffectLifesteal === 'N/A' && typeof chance === 'number') {
                    modifiedUnit.AttackEffectLifesteal = (chance * 100);
                }
                break;
            case "Knockback":
                if (typeof modifiedUnit[stat] === 'number' && typeof amount === 'number') {
                    modifiedUnit[stat] += amount;
                } else if (modifiedUnit[stat] === 'N/A' && typeof amount === 'number') {
                    modifiedUnit[stat] = amount;
                }
                break;
            case "Frost":
            case "Fire":
            case "Poison":
            case "Mirror":
                // This is more complex. For now, we'll just indicate their presence.
                // A more advanced system would track active debuffs/buffs.
                // For display, we might append to AttackEffect/Type if not already there.
                if (modifiedUnit.AttackEffect === 'N/A') modifiedUnit.AttackEffect = stat;
                else if (!modifiedUnit.AttackEffect.includes(stat)) modifiedUnit.AttackEffect += `, ${stat}`;

                if (modifiedUnit.AttackEffectType === 'N/A') modifiedUnit.AttackEffectType = stat;
                else if (!modifiedUnit.AttackEffectType.includes(stat)) modifiedUnit.AttackEffectType += `, ${stat}`;
                break;
        }
    });
    return modifiedUnit;
}


/**
 * Applies a list of mods to a unit.
 * @param {Object} baseUnit - The original unit object.
 * @param {Array<Object>} modsToApply - An array of mod objects to apply.
 * @returns {Object} The unit object with all specified mods applied.
 */
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
 * Formats a value for display in the table.
 * @param {*} value - The value to format.
 * @returns {string} The formatted string.
 */
function formatDisplayValue(value) {
    if (value === 'N/A') return 'N/A';
    if (typeof value === 'number') {
        // Format percentages for CritChance, EvadeChance, Accuracy
        if (value >= 0 && value <= 1) { // Heuristic for percentage-like values
            return (value * 100).toFixed(2) + '%';
        }
        // Format Cooldown to 2 decimal places
        if (value % 1 !== 0) { // Check if it has a decimal part
            return value.toFixed(2);
        }
    }
    return String(value);
}


// --- Rendering Functions ---

/**
 * Renders the unit table rows based on the provided data.
 * @param {Array<Object>} dataToRender - The array of unit objects to display.
 */
function renderUnitTable(dataToRender) {
    unitTableBody.innerHTML = ''; // Clear existing rows
    if (dataToRender.length === 0) {
        noResultsMessage.classList.remove('hidden');
        unitTableContainer.classList.add('hidden');
        return;
    } else {
        noResultsMessage.classList.add('hidden');
        unitTableContainer.classList.remove('hidden');
    }

    dataToRender.forEach((unit, index) => {
        // Determine which unit data to display (base or mod-affected)
        // If global max level is enabled, apply it before rendering
        const unitAtGlobalLevel = maxLevelGlobalEnabled ? getUnitStatsAtLevel(unit, 25, []) : unit;
        const unitToDisplay = modEffectsEnabled ? applyModsToUnit(unitAtGlobalLevel, mods) : unitAtGlobalLevel;


        const row = unitTableBody.insertRow();
        row.classList.add('cursor-pointer', 'unit-row'); // Add base classes

        row.dataset.unitIndex = index; // Store original index for detail lookup

        // Add image cell
        const imgCell = row.insertCell();
        imgCell.classList.add('py-2', 'px-4');
        const img = document.createElement('img');
        img.src = unitImages[unitToDisplay.Label] || 'https://placehold.co/60x60/cccccc/333333?text=N/A'; // Placeholder if no image
        img.alt = unitToDisplay.Label;
        img.classList.add('w-12', 'h-12', 'rounded-full', 'object-cover', 'shadow-sm');
        imgCell.appendChild(img);


        unitColumnOrder.slice(1).forEach(key => { // Skip 'Image' as it's handled above
            const cell = row.insertCell();
            let displayValue = unitToDisplay[key];

            // Apply specific styling for the 'Label' column to prevent collapse
            if (key === 'Label') {
                cell.classList.add('font-semibold', 'text-lg', `rarity-${unitToDisplay.Rarity.replace(/\s/g, '')}`, 'min-w-[100px]'); // min-width to prevent collapse
            } else if (['Class', 'Rarity'].includes(key)) {
                cell.classList.add('font-medium', 'text-base', 'min-w-[70px]'); // min-width for class/rarity
            } else if (['HP', 'Damage', 'Cooldown'].includes(key)) { // Apply min-width to core stats
                cell.classList.add('text-base', 'min-w-[60px]', 'text-center'); // Center numbers
                displayValue = typeof displayValue === 'number' ? displayValue.toFixed(2) : displayValue; // Format numbers
            } else if (['CritChance', 'EvadeChance', 'Accuracy'].includes(key)) {
                displayValue = typeof displayValue === 'number' ? (displayValue * 100).toFixed(2) + '%' : displayValue;
            } else if (['CritDamage', 'AttackEffectLifesteal'].includes(key)) {
                displayValue = typeof displayValue === 'number' ? displayValue.toFixed(2) : displayValue;
            }


            cell.textContent = displayValue !== undefined ? displayValue : 'N/A';
        });

        row.addEventListener('click', () => toggleUnitDetails(unit, row, index));
    });
}

/**
 * Renders the mod table rows.
 * @param {Array<Object>} dataToRender - The array of mod objects to display.
 */
function renderModTable(dataToRender) {
    modsTableBody.innerHTML = ''; // Clear existing rows
    if (dataToRender.length === 0) {
        modsTableBody.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-gray-600 dark:text-gray-400">No mod data available.</td></tr>';
        return;
    }

    const modColumnOrder = ['label', 'rarity', 'effectDescription']; // Define order for mods table

    dataToRender.forEach(mod => {
        const row = modsTableBody.insertRow();
        row.classList.add('bg-white', 'dark:bg-gray-700');

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
        const data = await fetchCSVData(GOOGLE_SHEET_TIER_LIST_CSV_URL, 'tiers');
        tierListTableContainer.classList.remove('hidden');
        return data;
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
    const tierListColumnOrder = ['Unit Name', 'Tier', 'Reasoning']; // Adjusted header names for display

    dataToRender.forEach(item => {
        const row = tierListTableBody.insertRow();
        row.classList.add('bg-white', 'dark:bg-gray-700');

        tierListColumnOrder.forEach(key => {
            const cell = row.insertCell();
            cell.classList.add('py-4', 'px-6', 'text-sm');
            if (key === 'Unit Name' || key === 'Tier') {
                cell.classList.add('font-medium', 'text-gray-900', 'dark:text-gray-100', 'whitespace-nowrap');
            } else {
                cell.classList.add('text-gray-500', 'dark:text-gray-300', 'text-wrap'); // Allow text wrapping for reasoning
            }
            cell.textContent = item[key] !== undefined ? item[key] : 'N/A';
        });
    });
}


// --- Detailed Unit View (Expandable Row) ---

/**
 * Toggles the detailed view for a unit.
 * @param {Object} unit - The base unit object.
 * @param {HTMLTableRowElement} clickedRow - The table row element that was clicked.
 * @param {number} index - The original index of the unit in the `units` array.
 */
function toggleUnitDetails(unit, clickedRow, index) {
    const existingDetailRow = unitTableBody.querySelector('.unit-details-row');
    const currentlyExpandedUnitIndex = existingDetailRow ? parseInt(existingDetailRow.dataset.unitIndex) : null;

    // Case 1: Clicked on an already expanded row (or its associated detail row)
    if (currentlyExpandedUnitIndex === index) {
        if (existingDetailRow) {
            existingDetailRow.remove();
        }
        clickedRow.classList.remove('expanded');
        expandedUnitRowId = null;
        return; // Done, just collapsed
    }

    // Case 2: Another row is expanded, or no row is expanded, and a new row is clicked
    if (existingDetailRow) {
        // Collapse the previously expanded row
        const prevExpandedUnitRow = unitTableBody.querySelector(`[data-unit-index="${currentlyExpandedUnitIndex}"]`);
        if (prevExpandedUnitRow) {
            prevExpandedUnitRow.classList.remove('expanded');
        }
        existingDetailRow.remove();
    }

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
        if (['CritChance', 'EvadeChance', 'Accuracy'].includes(key)) {
            displayValue = typeof displayValue === 'number' ? (displayValue * 100).toFixed(2) + '%' : displayValue;
        } else if (['Cooldown', 'CritDamage', 'AttackEffectLifesteal', 'HP', 'Damage', 'Knockback', 'HPOffset', 'ShadowStepDistance', 'ShadowStepCooldown'].includes(key)) {
            displayValue = typeof displayValue === 'number' ? displayValue.toFixed(2) : displayValue;
        }
        li.textContent = `${key}: ${displayValue !== undefined ? displayValue : 'N/A'}`;
        baseStatsList.appendChild(li);
    });

    // Right side: Mod Toggles and Applied Stats
    const modApplyDiv = document.createElement('div');
    modApplyDiv.classList.add('flex-1', 'p-3', 'rounded-lg', 'bg-blue-50', 'dark:bg-blue-900', 'shadow-inner');
    modApplyDiv.innerHTML = `<h3 class="font-semibold text-lg mb-2 text-blue-800 dark:text-blue-200">Apply Mods:</h3>
                             <div class="mb-4 flex items-center">
                                 <input type="checkbox" id="toggleMaxStats" class="mr-2 rounded text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400">
                                 <label for="toggleMaxStats" class="text-gray-700 dark:text-gray-300">Show Max Stats (TBD)</label>
                             </div>
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

    const toggleMaxStats = modApplyDiv.querySelector('#toggleMaxStats');
    const toggleMaxLevelUnit = modApplyDiv.querySelector('#toggleMaxLevelUnit'); // New DOM element for Max Level
    const levelInput = modApplyDiv.querySelector('#levelInput'); // New DOM element for Level Input
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
    rarityOrder.forEach(rarity => {
        if (modsByRarity[rarity].length > 0) {
            const rarityColumn = document.createElement('div');
            rarityColumn.classList.add('flex', 'flex-col', 'p-2', 'rounded-md', 'border', 'border-gray-200', 'dark:border-gray-600', 'flex-shrink-0'); // Column styling

            const rarityHeader = document.createElement('h4');
            rarityHeader.classList.add('font-bold', 'text-base', 'mt-2', 'mb-1', 'w-full', `text-rarity-${rarity.toLowerCase()}`); // Add rarity color class
            rarityHeader.textContent = `${rarity} Mods`;
            rarityColumn.appendChild(rarityHeader);

            modsByRarity[rarity].forEach(mod => {
                const label = document.createElement('label');
                label.classList.add('inline-flex', 'items-center', 'cursor-pointer', 'mb-1');
                label.title = mod.effectDescription; // Tooltip for effect description

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = mod.id; // Use mod.id to identify
                checkbox.dataset.rarity = mod.rarity; // Store rarity for disabling logic
                checkbox.classList.add('form-checkbox', 'h-4', 'w-4', 'text-blue-600', 'rounded', 'focus:ring-blue-500', 'dark:text-blue-400', 'dark:focus:ring-blue-400', 'mr-1');

                checkbox.addEventListener('change', (event) => {
                    const changedModId = event.target.value;
                    const changedModRarity = event.target.dataset.rarity;

                    if (event.target.checked) {
                        // If this mod is checked, uncheck all other mods of the same rarity
                        modCheckboxesContainer.querySelectorAll(`input[type="checkbox"][data-rarity="${changedModRarity}"]`).forEach(cb => {
                            if (cb.value !== changedModId) {
                                cb.checked = false;
                            }
                        });
                        selectedModsForUnit = selectedModsForUnit.filter(m => m.rarity !== changedModRarity); // Remove existing mod of this rarity
                        selectedModsForUnit.push(mod); // Add the newly selected mod
                    } else {
                        // If unchecked, simply remove it
                        selectedModsForUnit = selectedModsForUnit.filter(m => m.id !== changedModId);
                    }

                    // Ensure max stats toggle is off if individual mods are being selected
                    toggleMaxStats.checked = false;
                    updateAppliedStats(unit, selectedModsForUnit, appliedStatsList, toggleMaxStats.checked, toggleMaxLevelUnit.checked, parseInt(levelInput.value), activeModEffectsList);
                });

                label.appendChild(checkbox);
                label.appendChild(document.createTextNode(mod.label));
                rarityColumn.appendChild(label);
            });
            modCheckboxesContainer.appendChild(rarityColumn);
        }
    });

    // Event listener for Max Stats toggle
    toggleMaxStats.addEventListener('change', () => {
        if (toggleMaxStats.checked) {
            // Uncheck all individual mod checkboxes and Max Level toggle if Max Stats is enabled
            modCheckboxesContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
            selectedModsForUnit = []; // Clear selected mods
            levelInput.value = 25; // Set level to 25 when max stats is toggled
            toggleMaxLevelUnit.checked = true; // Sync max level toggle
        }
        updateAppliedStats(unit, selectedModsForUnit, appliedStatsList, toggleMaxStats.checked, toggleMaxLevelUnit.checked, parseInt(levelInput.value), activeModEffectsList);
    });

    // Event listener for Max Level toggle
    toggleMaxLevelUnit.addEventListener('change', () => {
        // Max Level can be combined with other mods, but not with Max Stats
        if (toggleMaxLevelUnit.checked) {
            toggleMaxStats.checked = false; // Uncheck Max Stats if Max Level is enabled
            levelInput.value = 25; // Set level to 25 when max level is toggled
        } else {
            levelInput.value = 1; // Reset level to 1 when max level is untoggled
        }
        updateAppliedStats(unit, selectedModsForUnit, appliedStatsList, toggleMaxStats.checked, toggleMaxLevelUnit.checked, parseInt(levelInput.value), activeModEffectsList);
    });

    // Event listener for Level Input
    levelInput.addEventListener('input', () => {
        let level = parseInt(levelInput.value);
        if (isNaN(level) || level < 1) {
            level = 1;
            levelInput.value = 1;
        } else if (level > 25) {
            level = 25;
            levelInput.value = 25;
        }
        // If level is manually changed, uncheck the Max Level toggle
        toggleMaxLevelUnit.checked = false;
        updateAppliedStats(unit, selectedModsForUnit, appliedStatsList, toggleMaxStats.checked, toggleMaxLevelUnit.checked, level, activeModEffectsList);
    });


    // Initial display of applied stats (no mods applied yet)
    updateAppliedStats(unit, selectedModsForUnit, appliedStatsList, false, false, parseInt(levelInput.value), activeModEffectsList);

    detailCell.appendChild(detailContent);
}

/**
 * Updates the displayed stats in the detailed unit view based on selected mods or max stats toggle.
 * @param {Object} baseUnit - The original unit object.
 * @param {Array<Object>} selectedMods - The mods currently selected for this unit.
 * @param {HTMLElement} listElement - The UL element to render stats into.
 * @param {boolean} showMaxStats - True if "Max Stats" should be displayed.
 * @param {boolean} showMaxLevel - True if "Max Level" should be displayed.
 * @param {number} currentLevel - The level to calculate stats for.
 * @param {HTMLElement} activeModEffectsListElement - The UL element to render active mod effects into.
 */
function updateAppliedStats(baseUnit, selectedMods, listElement, showMaxStats, showMaxLevel, currentLevel, activeModEffectsListElement) {
    listElement.innerHTML = ''; // Clear previous stats
    activeModEffectsListElement.innerHTML = ''; // Clear previous mod effects

    let unitToDisplay = { ...baseUnit };

    // Determine the level for calculation
    const levelForCalculation = showMaxLevel ? 25 : currentLevel;

    // If showMaxStats is true, apply all mods regardless of individual selection
    const modsToApplyForCalculation = showMaxStats ? mods : selectedMods;

    // Calculate stats at the determined level, then apply mods
    unitToDisplay = getUnitStatsAtLevel(baseUnit, levelForCalculation, modsToApplyForCalculation);

    // Render allUnitStatsForDropdown in the dropdown's "Stats with Mods" section
    allUnitStatsForDropdown.forEach(key => {
        const li = document.createElement('li');
        let displayValue = unitToDisplay[key];
        // Apply specific formatting for percentages and numbers
        if (['CritChance', 'EvadeChance', 'Accuracy'].includes(key)) {
            displayValue = typeof displayValue === 'number' ? (displayValue * 100).toFixed(2) + '%' : displayValue;
        } else if (['Cooldown', 'CritDamage', 'AttackEffectLifesteal', 'HP', 'Damage', 'Knockback', 'HPOffset', 'ShadowStepDistance', 'ShadowStepCooldown'].includes(key)) {
            displayValue = typeof displayValue === 'number' ? displayValue.toFixed(2) : displayValue;
        }
        li.textContent = `${key}: ${displayValue !== undefined ? displayValue : 'N/A'}`;

        // Highlight changes from base stats (considering the level calculation)
        const baseValueAtLevel1 = baseUnit[key]; // Compare against base level 1 stats
        const currentDisplayedValue = unitToDisplay[key];

        // Only highlight if the base value at level 1 is a number and different from current
        if (typeof baseValueAtLevel1 === 'number' && typeof currentDisplayedValue === 'number' && baseValueAtLevel1 !== currentDisplayedValue) {
            li.classList.add('font-bold', 'text-blue-600', 'dark:text-blue-300');
        } else if (typeof baseValueAtLevel1 === 'string' && typeof currentDisplayedValue === 'string' && baseValueAtLevel1 !== currentDisplayedValue) {
            // For string changes (like AttackEffect becoming 'Fire, Frost')
            li.classList.add('font-bold', 'text-blue-600', 'dark:text-blue-300');
        }
        listElement.appendChild(li);
    });

    // Populate Active Mod Effects
    const currentlyActiveMods = showMaxStats ? mods : selectedMods;
    if (currentlyActiveMods.length > 0) {
        currentlyActiveMods.forEach(mod => {
            if (mod.effectDescription && mod.effectDescription !== 'No defined effect') {
                const li = document.createElement('li');
                li.classList.add('text-gray-700', 'dark:text-gray-200');
                li.innerHTML = `<span class="font-semibold">${mod.label} (${mod.rarity}):</span> ${mod.effectDescription}`;
                activeModEffectsListElement.appendChild(li);
            }
        });
    } else {
        const li = document.createElement('li');
        li.classList.add('text-gray-500', 'dark:text-gray-400');
        li.textContent = 'No mods currently applied.';
        activeModEffectsListElement.appendChild(li);
    }
}


// --- Sorting and Filtering ---

/**
 * Sorts the units array based on the given column and current sort direction.
 * @param {string} column - The column key to sort by.
 */
function sortData(column) {
    // If sorting by image, do nothing or sort by Label instead
    if (column === 'Image') {
        column = 'Label';
    }

    if (currentSortColumn === column) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = column;
        currentSortDirection = 'asc'; // Default to ascending for new column
    }

    // Sort units (original data)
    units.sort((a, b) => {
        const valA = a[column];
        const valB = b[column];

        // Custom sort for Rarity
        if (column === 'Rarity') {
            const indexA = rarityOrder.indexOf(valA);
            const indexB = rarityOrder.indexOf(valB);
            return currentSortDirection === 'asc' ? indexA - indexB : indexB - indexA;
        }

        // Handle "N/A" values by treating them as lowest/highest for sorting
        if (valA === 'N/A' && valB === 'N/A') return 0;
        if (valA === 'N/A') return currentSortDirection === 'asc' ? 1 : -1;
        if (valB === 'N/A') return currentSortDirection === 'asc' ? -1 : 1;

        // Numeric comparison
        if (typeof valA === 'number' && typeof valB === 'number') {
            return currentSortDirection === 'asc' ? valA - valB : valB - valA;
        }
        // String comparison
        return currentSortDirection === 'asc' ?
            String(valA).localeCompare(String(valB)) :
            String(valB).localeCompare(String(valA));
    });
    filterAndRenderUnits(); // Re-render after sorting
}

/**
 * Filters the units data based on search input, rarity, and class filters, then renders the table.
 */
function filterAndRenderUnits() {
    const searchTerm = searchInput.value.toLowerCase();
    const selectedRarity = rarityFilter.value;
    const selectedClass = classFilter.value;

    const filteredUnits = units.filter(unit => {
        const matchesSearch = Object.values(unit).some(value =>
            String(value).toLowerCase().includes(searchTerm)
        );
        const matchesRarity = selectedRarity === '' || unit.Rarity === selectedRarity;
        const matchesClass = selectedClass === '' || unit.Class === selectedClass;

        return matchesSearch && matchesRarity && matchesClass;
    });

    renderUnitTable(filteredUnits);
}

/**
 * Populates the rarity filter dropdown.
 */
function populateRarityFilter() {
    rarityFilter.innerHTML = '<option value="">All Rarity</option>'; // Reset
    rarityOrder.forEach(rarity => {
        const option = document.createElement('option');
        option.value = rarity;
        option.textContent = rarity;
        rarityFilter.appendChild(option);
    });
}

/**
 * Populates the class filter dropdown.
 */
function populateClassFilter() {
    const classes = new Set();
    units.forEach(unit => {
        if (unit.Class) {
            classes.add(unit.Class);
        }
    });
    const sortedClasses = Array.from(classes).sort();
    classFilter.innerHTML = '<option value="">All Classes</option>'; // Reset
    sortedClasses.forEach(cls => {
        const option = document.createElement('option');
        option.value = cls;
        option.textContent = cls;
        classFilter.appendChild(option);
    });
}


// --- Dark Mode Toggle ---

/**
 * Toggles dark mode on/off and saves preference to localStorage.
 */
function toggleDarkMode() {
    document.documentElement.classList.toggle('dark');
    document.body.classList.toggle('dark'); // Toggle for body as well for custom CSS
    document.body.classList.toggle('light'); // Toggle light class for custom CSS
    const isDarkMode = document.documentElement.classList.contains('dark');
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    updateDarkModeIcons(isDarkMode);
}

/**
 * Updates the sun/moon icons based on the current dark mode state.
 * @param {boolean} isDarkMode - True if dark mode is active, false otherwise.
 */
function updateDarkModeIcons(isDarkMode) {
    if (isDarkMode) {
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
    } else {
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
    }
}

/**
 * Initializes dark mode based on user's system preference or saved setting.
 */
function initializeDarkMode() {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
        document.body.classList.remove('light');
        updateDarkModeIcons(true);
    } else {
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('dark');
        document.body.classList.add('light');
        updateDarkModeIcons(false);
    }
}


// --- Tab Switching ---

/**
 * Switches between unit, mod, and tier list tabs.
 * @param {string} tabId - The ID of the tab to activate ('unitsTab', 'modsTab', or 'tierListTab').
 */
async function switchTab(tabId) { // Made async to await fetchTierListData
    // Deactivate all tab buttons and hide all tab contents
    document.querySelectorAll('.tab-button').forEach(button => button.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));

    // Activate the clicked tab button and show its content
    document.getElementById(tabId).classList.add('active');
    if (tabId === 'unitsTab') {
        unitsContent.classList.remove('hidden');
        filterAndRenderUnits(); // Re-render units when switching back
    } else if (tabId === 'modsTab') {
        modsContent.classList.remove('hidden');
        renderModTable(mods); // Render mods when switching to mods tab
    } else if (tabId === 'tierListTab') { // Handle new Tier List tab
        tierListContent.classList.remove('hidden');
        tierList = await fetchTierListData(); // Fetch and store tier list data
        renderTierListTable(tierList); // Render tier list table
    }
    // Close any expanded unit details when switching tabs
    if (expandedUnitRowId !== null) {
        const prevExpandedRow = unitTableBody.querySelector(`[data-unit-index="${expandedUnitRowId}"]`);
        if (prevExpandedRow) {
            prevExpandedRow.classList.remove('expanded');
            if (prevExpandedRow.nextElementSibling && prevExpandedRow.nextElementSibling.classList.contains('unit-details-row')) {
                prevExpandedRow.nextElementSibling.remove();
            }
        }
        expandedUnitRowId = null;
    }
}


// --- Initialization ---

// Event Listeners
window.onload = async function() { // Made async to await data fetches
    initializeDarkMode(); // Set initial dark mode state

    loadingSpinner.classList.remove('hidden'); // Show spinner
    unitTableContainer.classList.add('hidden'); // Hide unit table
    modsContent.classList.add('hidden'); // Ensure mods content is hidden initially
    tierListContent.classList.add('hidden'); // Ensure tier list content is hidden initially

    try {
        // Fetch all data concurrently
        const [fetchedUnits, fetchedMods, fetchedTierList] = await Promise.all([
            fetchCSVData(GOOGLE_SHEET_UNIT_DATA_CSV_URL, 'units'),
            fetchCSVData(GOOGLE_SHEET_MOD_DATA_CSV_URL, 'mods'),
            fetchCSVData(GOOGLE_SHEET_TIER_LIST_CSV_URL, 'tiers') // Pre-fetch tier list as well
        ]);

        units = fetchedUnits;
        mods = fetchedMods;
        tierList = fetchedTierList;

        populateRarityFilter();
        populateClassFilter(); // Populate class filter after parsing
        filterAndRenderUnits(); // Initial render of units
        renderModTable(mods); // Initial render of mods (will be hidden initially)
        // No need to render tierList here, it will be rendered when its tab is clicked

        loadingSpinner.classList.add('hidden'); // Hide spinner
        unitTableContainer.classList.remove('hidden'); // Show unit table
    } catch (error) {
        console.error("Failed to load initial data:", error);
        loadingSpinner.classList.add('hidden');
        noResultsMessage.textContent = `Failed to load data: ${error.message}. Please check console for details.`;
        noResultsMessage.classList.remove('hidden');
    }


    // Search and Filter Events
    // Debounce the search input to improve performance
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
    tierListTab.addEventListener('click', () => switchTab('tierListTab')); // Event listener for new Tier List tab

    // Mod Effects Toggle Event (global)
    toggleModEffects.addEventListener('change', () => {
        modEffectsEnabled = toggleModEffects.checked;
        filterAndRenderUnits(); // Re-render units to apply/remove global mod effects
    });

    // Global Max Level Toggle Event
    toggleMaxLevel.addEventListener('change', () => {
        maxLevelGlobalEnabled = toggleMaxLevel.checked;
        // Re-render units to apply/remove global max level effects
        filterAndRenderUnits();
    });
};
