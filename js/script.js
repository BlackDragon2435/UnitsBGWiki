// js/script.js
// why you looking here?
// import { rawUnitData } from './unitsData.js';
// import { rawModData } from './modsData.js';
import { unitImages } from './unitImages.js'; // Keep this for potential fallback or if user wants to keep it
import { gameData } from './gameData.js'; // Import gameData

// IMPORTANT: Base URL for your published Google Sheet
// This URL should point to your Google Sheet published to web as CSV.
// The specific sheets are then targeted using '&gid={sheet_id}'
const GOOGLE_SHEET_BASE_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQO78VJA7y_g5zHpzw1gTaJhLV2mjNdRxA33zcj1WPFj-QYxQS09nInTQXg6kXNJcjm4f7Gk7lPVZuV/pub?output=csv';

// Specific URLs for each sheet using their GIDs
const GOOGLE_SHEET_UNIT_DATA_CSV_URL = GOOGLE_SHEET_BASE_URL + '&gid=201310748&single=true'; // Unit Info (Sheet 1)
const GOOGLE_SHEET_TIER_LIST_CSV_URL = GOOGLE_SHEET_BASE_URL + '&gid=0&single=true'; // Tier List (Sheet 2)
const GOOGLE_SHEET_MOD_DATA_CSV_URL = GOOGLE_SHEET_BASE_URL + '&gid=331730679&single=true'; // Mod List (Sheet 3)


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
const loadingSpinner = document.getElementById('loadingSpinner'); // Spinner for units
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
    'Image', 'Label', 'Class', 'Rarity', 'CommunityRanking', 'HP', 'Damage', 'Cooldown', 'DPS' // Added DPS
];

// Define ALL possible unit stats for the detailed dropdown view
const allUnitStatsForDropdown = [
    'Label', 'Class', 'Rarity', 'HP', 'Damage', 'Cooldown', 'DPS', 'Distance', // DPS moved
    'CritChance', 'CritDamage', 'AttackEffect', 'AttackEffectType',
    'AttackEffectLifesteal', 'AttackEffectKey', 'Knockback', 'Accuracy',
    'EvadeChance', 'HPOffset', 'ShadowStepDistance', 'ShadowStepCooldown'
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
 * Normalizes a string for comparison (e.g., removes spaces, converts to lowercase).
 * @param {string} str - The input string.
 * @returns {string} The normalized string.
 */
function normalizeString(str) {
    return String(str).toLowerCase().replace(/\s/g, '');
}

/**
 * Fetches and parses CSV data from a Google Sheet CSV URL.
 * Displays loading spinner and error messages as needed.
 * @param {string} url - The URL of the CSV data.
 * @param {HTMLElement} spinnerElement - The spinner element to show/hide.
 * @param {HTMLElement} tableContainerElement - The table container to show/hide.
 * @param {HTMLElement} noDataMessageElement - The element to display error/no data messages.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of parsed objects.
 */
async function fetchGoogleSheetCSVData(url, spinnerElement, tableContainerElement, noDataMessageElement) {
    if (spinnerElement) spinnerElement.classList.remove('hidden');
    if (tableContainerElement) tableContainerElement.classList.add('hidden');
    if (noDataMessageElement) noDataMessageElement.classList.add('hidden');

    try {
        if (!url || url.includes('YOUR_GOOGLE_SHEET_PUBLIC_CSV_URL_HERE')) {
            throw new Error("Google Sheet URL is not configured. Please update script.js with your public CSV URL.");
        }

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const csvText = await response.text();
        return parseGoogleSheetCSV(csvText);
    } catch (error) {
        console.error("Error fetching data:", error);
        if (noDataMessageElement) {
            noDataMessageElement.textContent = `Failed to load data: ${error.message}`;
            noDataMessageElement.classList.remove('hidden');
        }
        return [];
    } finally {
        if (spinnerElement) spinnerElement.classList.add('hidden');
    }
}

/**
 * Parses CSV text into an array of objects.
 * It intelligently finds the header row and handles commas within quoted fields.
 * Converts values to numbers/booleans where appropriate, and standardizes "N/A".
 * @param {string} csvText - The CSV data as a string.
 * @returns {Array<Object>} An array of objects, where each object represents a row.
 */
function parseGoogleSheetCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length === 0) return [];

    let headers = [];
    let headerFound = false;
    let dataStartIndex = 0;

    // Find the actual header row by looking for known column names
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // Check for headers specific to each sheet type
        if (line.includes('UnitName') && line.includes('Tier') && line.includes('NumericalRank')) {
            // This is likely the Tier List header
            headers = line.split(',').map(header => header.trim());
            headerFound = true;
            dataStartIndex = i + 1;
            break;
        } else if (line.includes('ModName') && line.includes('Title') && line.includes('Rarity')) {
            // This is likely the Mod List header
            headers = line.split(',').map(header => header.trim());
            headerFound = true;
            dataStartIndex = i + 1;
            break;
        } else if (line.includes('Label') && line.includes('Class') && line.includes('Rarity') && line.includes('HP')) {
            // This is likely the Unit Info header
            headers = line.split(',').map(header => header.trim());
            headerFound = true;
            dataStartIndex = i + 1;
            break;
        }
    }

    if (!headerFound || headers.length === 0) {
        console.error("Could not find a valid header row in the CSV data.");
        return [];
    }

    const data = [];
    // Regex to split by comma, but not if the comma is inside double quotes
    // This regex is a common approach for basic CSV parsing.
    const csvSplitRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;

    for (let i = dataStartIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '') continue; // Skip empty lines

        // Split by comma, respecting quotes, and remove surrounding quotes
        const values = line.split(csvSplitRegex).map(value => {
            // Remove surrounding quotes if present
            if (value.startsWith('"') && value.endsWith('"')) {
                return value.substring(1, value.length - 1).trim();
            }
            return value.trim();
        });

        if (values.length !== headers.length) {
            console.warn(`Skipping malformed CSV row: "${line}" (Expected ${headers.length} columns, got ${values.length})`);
            continue;
        }

        const rowObject = {};
        headers.forEach((header, index) => {
            let value = values[index];

            // Handle "N/A" and empty strings consistently
            if (value.toLowerCase() === 'n/a' || value === '') {
                rowObject[header] = 'N/A';
                return; // Move to next header
            }

            // Specific type conversions based on expected data
            switch (header) {
                case 'HP':
                case 'Damage':
                case 'Cooldown':
                case 'Distance':
                case 'CritChance':
                case 'CritDamage':
                case 'AttackEffectLifesteal':
                case 'Knockback':
                case 'Accuracy':
                case 'EvadeChance':
                case 'HPOffset':
                case 'ShadowStepDistance':
                case 'ShadowStepCooldown':
                case 'Amount': // For Mod data
                case 'Chance': // For Mod data
                case 'NumericalRank': // For Tier List data
                case 'DPS': // Added DPS for numerical parsing
                case 'Money': // Added Money for numerical parsing
                case 'XP': // Added XP for numerical parsing
                    // Attempt to parse as float for numerical stats
                    rowObject[header] = parseFloat(value);
                    if (isNaN(rowObject[header])) { // If it's not a valid number, keep as original string
                        rowObject[header] = value;
                    }
                    break;
                case 'IsBossUnit': // Example boolean field
                    rowObject[header] = value.toLowerCase() === 'true';
                    break;
                default:
                    // For all other headers, keep as string
                    rowObject[header] = value;
                    break;
            }
        });

        // Add normalized labels for easier matching
        if (rowObject['Label']) { // For Unit Info sheet
            rowObject.NormalizedLabel = normalizeString(rowObject['Label']);
        }
        if (rowObject['UnitName']) { // For Tier List sheet
            rowObject.NormalizedUnitName = normalizeString(rowObject['UnitName']);
        }
        data.push(rowObject);
    }
    return data;
}

/**
 * Transforms flat mod data fetched from CSV into the structured format
 * expected by the application's mod application logic.
 * @param {Array<Object>} fetchedMods - Array of mod objects directly from CSV parsing.
 * @returns {Array<Object>} Transformed mod objects.
 */
function transformFetchedModData(fetchedMods) {
    const transformedMods = [];
    fetchedMods.forEach(modRow => {
        // Assuming the CSV headers are: ModName, Title, Rarity, Amount, Chance, Stat, Effect
        // The existing code expects: id, label, rarity, effects: [{ stat, amount, chance, description }], effectDescription
        const mod = {
            id: modRow.ModName, // Use ModName as ID
            label: modRow.Title || modRow.ModName, // Use Title if available, otherwise ModName
            rarity: modRow.Rarity || 'Common',
            effects: [],
            effectDescription: modRow.Effect || 'No defined effect' // Use Effect column for description
        };

        const effect = {};
        if (modRow.Stat && modRow.Stat !== 'N/A') effect.stat = modRow.Stat;
        if (modRow.Amount !== 'N/A' && modRow.Amount !== undefined) effect.amount = modRow.Amount; // Amount is already parsed by parseGoogleSheetCSV
        if (modRow.Chance !== 'N/A' && modRow.Chance !== undefined) effect.chance = modRow.Chance; // Chance is already parsed by parseGoogleSheetCSV

        if (Object.keys(effect).length > 0) {
            mod.effects.push(effect);
        }

        // If the 'Effect' column from CSV is empty, try to generate a description
        if (mod.effectDescription === 'No defined effect' && mod.effects.length > 0) {
            let descParts = [];
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
                        desc += `Adds ${amount}% Lifesteal`;
                    } else if (typeof chance === 'number') {
                        desc += `Adds ${(chance * 100).toFixed(0)}% Lifesteal`;
                    }
                } else if (stat === "Knockback") {
                    if (typeof amount === 'number') {
                        desc += `Increases Knockback by ${amount.toFixed(2)}`;
                    }
                } else if (stat === "Frost" || stat === "Fire" || stat === "Poison" || stat === "Mirror") {
                    if (typeof chance === 'number') {
                        desc += `Applies ${stat} with ${(chance * 100).toFixed(0)}% chance`;
                    }
                }

                if (desc) descParts.push(desc);
            });
            mod.effectDescription = descParts.join('; ') || 'No defined effect';
        }
        transformedMods.push(mod);
    });
    return transformedMods;
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
        if (modifiedUnit[stat] === undefined) {
             return; // Stat does not exist on the unit, skip applying mod
        }

        // Initialize N/A stats if a mod applies a numerical amount to them
        // This is handled by getUnitStatsAtLevel ensuring numerical values (0 for N/A)
        // So, we can directly work with modifiedUnit[stat] as a number here.

        switch (stat) {
            case "HP":
            case "Damage":
            case "DPS": // Added DPS calculation
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
            // Removed HPOffset, ShadowStepDistance, ShadowStepCooldown from here
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
 * Handles 'N/A' values by treating them as 0 for calculations, and reverting back if needed.
 * @param {Object} baseUnit - The original unit object (level 1 stats).
 * @param {number} level - The target level for the unit.
 * @param {Array<Object>} selectedMods - An array of mod objects to apply.
 * @returns {Object} A new unit object with calculated stats.
 */
function getUnitStatsAtLevel(baseUnit, level, selectedMods) {
    let calculatedUnit = { ...baseUnit }; // Start with base stats

    // Store original N/A status for numerical stats
    const originalNAStatus = {};
    const numericalStats = ['HP', 'Damage', 'Cooldown', 'Distance', 'CritChance', 'CritDamage',
                            'AttackEffectLifesteal', 'Knockback', 'Accuracy', 'EvadeChance', 'DPS'];

    numericalStats.forEach(statKey => {
        if (calculatedUnit[statKey] === 'N/A' || calculatedUnit[statKey] === null || calculatedUnit[statKey] === undefined) {
            originalNAStatus[statKey] = true;
            calculatedUnit[statKey] = 0; // Treat N/A as 0 for calculations
        } else {
            calculatedUnit[statKey] = parseFloat(calculatedUnit[statKey]); // Ensure it's a number
            if (isNaN(calculatedUnit[statKey])) { // If it's still not a number after parsing, treat as 0
                originalNAStatus[statKey] = true; // Mark as originally N/A if it couldn't be parsed
                calculatedUnit[statKey] = 0;
            }
        }
    });

    const unitClass = calculatedUnit.Class;
    const unitRarity = calculatedUnit.Rarity;

    // Apply StatsByClass modifiers based on unit's class and rarity
    if (gameData.StatsByClass[unitClass]) {
        const classStats = gameData.StatsByClass[unitClass];
        for (const statKey in classStats) {
            // Ensure the stat is one we want to scale and has a numeric value
            if (numericalStats.includes(statKey) && typeof calculatedUnit[statKey] === 'number' &&
                classStats[statKey]._attributes &&
                classStats[statKey]._attributes[unitRarity] !== undefined) {

                const modifier = classStats[statKey]._attributes[unitRarity];
                // Apply level scaling: (base_stat * (1 + modifier * (level - 1)))
                if (statKey === 'Cooldown') {
                    calculatedUnit[statKey] = Math.max(0.1, calculatedUnit[statKey] + (modifier * (level - 1)));
                } else {
                    calculatedUnit[statKey] = calculatedUnit[statKey] * (1 + modifier * (level - 1));
                }
            }
        }
    }

    // Apply selected mods on top of the class/rarity modified stats
    calculatedUnit = applyModsToUnit(calculatedUnit, selectedMods);

    // Calculate DPS after all other relevant stats have been updated
    if (typeof calculatedUnit.Damage === 'number' && typeof calculatedUnit.Cooldown === 'number' && calculatedUnit.Cooldown > 0) {
        calculatedUnit.DPS = calculatedUnit.Damage / calculatedUnit.Cooldown;
    } else {
        calculatedUnit.DPS = 0; // Set to 0 if calculation is not possible or results in non-positive cooldown
    }


    // After all calculations, if a stat was originally 'N/A' and is now 0, revert to 'N/A' for display
    numericalStats.forEach(statKey => {
        if (originalNAStatus[statKey] && calculatedUnit[statKey] === 0) {
            calculatedUnit[statKey] = 'N/A';
        }
    });

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
        if (['CritChance', 'EvadeChance', 'Accuracy'].includes(currentSortColumn)) { // This check is not ideal for general formatting
            return (value * 100).toFixed(2) + '%';
        }
        // Format Cooldown to 2 decimal places
        if (['Cooldown'].includes(currentSortColumn)) {
            return value.toFixed(2);
        }
        // General number formatting
        if (!Number.isInteger(value)) {
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
        // Determine the level for calculation based on global toggle
        const levelForDisplay = maxLevelGlobalEnabled ? 25 : 1;

        // Calculate unit stats at the determined level (level 1 or max level)
        // Pass the original unit to getUnitStatsAtLevel to preserve N/A status for display logic
        let unitToDisplay = getUnitStatsAtLevel(unit, levelForDisplay, []); // No mods applied yet for this base calculation

        // Apply global mod effects if enabled, on top of the leveled stats
        if (modEffectsEnabled) {
            unitToDisplay = applyModsToUnit(unitToDisplay, mods);
        }

        const row = unitTableBody.insertRow();
        row.classList.add('cursor-pointer', 'unit-row'); // Add base classes

        row.dataset.unitIndex = index; // Store original index for detail lookup

        // Add image cell
        const imgCell = row.insertCell();
        imgCell.classList.add('py-2', 'px-4');
        const img = document.createElement('img');
        // Prefer ImageURL from Google Sheet, fallback to unitImages.js, then generic placeholder
        img.src = unitToDisplay.ImageURL || unitImages[unitToDisplay.Label] || 'https://placehold.co/60x60/cccccc/333333?text=N/A';
        img.alt = unitToDisplay.Label;
        img.classList.add('w-12', 'h-12', 'rounded-full', 'object-cover', 'shadow-sm');
        imgCell.appendChild(img);


        unitColumnOrder.slice(1).forEach(key => { // Skip 'Image' as it's handled above
            const cell = row.insertCell();
            let displayValue = unitToDisplay[key];

            if (key === 'CommunityRanking') {
                // Use normalized labels for matching
                const normalizedUnitLabel = normalizeString(unitToDisplay.Label);
                const tierInfo = tierList.find(tierUnit => tierUnit.NormalizedUnitName === normalizedUnitLabel);
                displayValue = tierInfo ? tierInfo.Tier : 'N/A'; // Corrected key to 'TIER'
                cell.classList.add('font-semibold', 'text-center'); // Center align tier
            }
            // Custom formatting for specific keys (only HP, Damage, Cooldown, DPS remain here)
            else if (['Cooldown', 'HP', 'Damage', 'DPS'].includes(key)) { // Added DPS here
                displayValue = typeof displayValue === 'number' ? displayValue.toFixed(2) : displayValue;
            }

            // Apply specific styling for the 'Label' column
            if (key === 'Label') {
                // Apply rarity class to the cell itself for background color and text color
                cell.classList.add('font-semibold', 'text-lg', `rarity-${unitToDisplay.Rarity.replace(/\s/g, '')}`);
            } else if (['Class', 'Rarity'].includes(key)) {
                cell.classList.add('font-medium', 'text-base'); // Make Class and Rarity slightly bolder and clearer
            } else {
                cell.classList.add('text-base'); // Default size for other stats
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
 * Renders the tier list table.
 * This function now iterates through all units and finds their corresponding tier data.
 * @param {Array<Object>} dataToRender - The array of tier list objects (from tierList sheet).
 */
function renderTierListTable(dataToRender) {
    tierListTableBody.innerHTML = ''; // Clear existing rows
    if (units.length === 0) { // Check if units data is available
        noTierListMessage.textContent = 'No unit data available to build the tier list.';
        noTierListMessage.classList.remove('hidden');
        tierListTableContainer.classList.add('hidden');
        return;
    } else {
        noTierListMessage.classList.add('hidden');
        tierListTableContainer.classList.remove('hidden');
    }

    // Define the order of columns for the tier list table
    const tierListColumnOrder = ['UnitName', 'Tier', 'NumericalRank', 'Notes'];

    // Iterate through all units to ensure every unit from Unit Info is listed
    units.forEach(unit => {
        const row = tierListTableBody.insertRow();
        row.classList.add('bg-white', 'dark:bg-gray-700');

        // Find the corresponding tier info for the current unit
        const normalizedUnitLabel = normalizeString(unit.Label);
        const tierInfo = dataToRender.find(tierItem => tierItem.NormalizedUnitName === normalizedUnitLabel);

        tierListColumnOrder.forEach(key => {
            const cell = row.insertCell();
            cell.classList.add('py-4', 'px-6', 'text-sm');

            let displayValue = 'N/A';

            if (key === 'UnitName') {
                displayValue = unit.Label; // Always use the unit's Label from Unit Info
                cell.classList.add('font-medium', 'text-gray-900', 'dark:text-gray-100', 'whitespace-nowrap');
            } else if (tierInfo) {
                // If tier info exists for this unit, use its values
                displayValue = tierInfo[key] !== undefined ? tierInfo[key] : 'N/A';
                if (key === 'Tier') {
                    cell.classList.add('font-medium', 'text-gray-900', 'dark:text-gray-100', 'whitespace-nowrap');
                } else {
                    cell.classList.add('text-gray-500', 'dark:text-gray-300', 'text-wrap');
                }
            } else {
                // If no tier info found, display N/A
                cell.classList.add('text-gray-500', 'dark:text-gray-400');
            }
            cell.textContent = displayValue;
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
        if (['Cooldown', 'HP', 'Damage', 'Distance', 'CritChance', 'CritDamage', 'AttackEffectLifesteal', 'Knockback', 'Accuracy', 'EvadeChance', 'DPS'].includes(key)) { // Added DPS here
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

    // Removed toggleMaxStats as requested
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

                    // Ensure max level toggle is off if individual mods are being selected
                    toggleMaxLevelUnit.checked = false; // Uncheck max level if a specific mod is chosen
                    updateAppliedStats(unit, selectedModsForUnit, appliedStatsList, false, toggleMaxLevelUnit.checked, parseInt(levelInput.value), activeModEffectsList);
                });

                label.appendChild(checkbox);
                label.appendChild(document.createTextNode(mod.label));
                rarityColumn.appendChild(label);
            });
            modCheckboxesContainer.appendChild(rarityColumn);
        }
    });

    // Event listener for Max Level toggle
    toggleMaxLevelUnit.addEventListener('change', () => {
        if (toggleMaxLevelUnit.checked) {
            levelInput.value = 25; // Set level to 25 when max level is toggled
            // Uncheck all individual mod checkboxes if Max Level is enabled
            modCheckboxesContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
            selectedModsForUnit = []; // Clear selected mods
        } else {
            levelInput.value = 1; // Reset level to 1 when max level is untoggled
        }
        updateAppliedStats(unit, selectedModsForUnit, appliedStatsList, false, toggleMaxLevelUnit.checked, parseInt(levelInput.value), activeModEffectsList);
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
        updateAppliedStats(unit, selectedModsForUnit, appliedStatsList, false, toggleMaxLevelUnit.checked, level, activeModEffectsList);
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
 * @param {boolean} showMaxStats - This parameter is now unused but kept for function signature consistency.
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

    // Calculate stats at the determined level, then apply mods
    unitToDisplay = getUnitStatsAtLevel(baseUnit, levelForCalculation, selectedMods);

    // Render allUnitStatsForDropdown in the dropdown's "Stats with Mods" section
    allUnitStatsForDropdown.forEach(key => {
        const li = document.createElement('li');
        let displayValue = unitToDisplay[key];
        // Apply specific formatting for percentages and numbers
        if (['Cooldown', 'HP', 'Damage', 'Distance', 'CritChance', 'CritDamage', 'AttackEffectLifesteal', 'Knockback', 'Accuracy', 'EvadeChance', 'DPS'].includes(key)) { // Added DPS here
            displayValue = typeof displayValue === 'number' ? displayValue.toFixed(2) : displayValue;
        }
        // Special formatting for percentage values
        if (['CritChance', 'EvadeChance', 'Accuracy'].includes(key) && typeof displayValue === 'number') {
            displayValue = (displayValue * 100).toFixed(2) + '%';
        }
        li.textContent = `${key}: ${displayValue !== undefined ? displayValue : 'N/A'}`;

        // Highlight changes from base stats (considering the level calculation)
        // This logic needs to compare against the original baseUnit, not the one processed by getUnitStatsAtLevel
        const originalBaseValue = baseUnit[key];

        // Only highlight if the original base value was a number or N/A, and the current displayed value is different
        if (
            (typeof originalBaseValue === 'number' || originalBaseValue === 'N/A') &&
            (typeof displayValue === 'number' || displayValue === 'N/A') &&
            originalBaseValue !== displayValue // Compare directly
        ) {
            li.classList.add('font-bold', 'text-blue-600', 'dark:text-blue-300');
        } else if (typeof originalBaseValue === 'string' && typeof displayValue === 'string' && originalBaseValue !== displayValue) {
            // For string changes (like AttackEffect becoming 'Fire, Frost')
            li.classList.add('font-bold', 'text-blue-600', 'dark:text-blue-300');
        }
        listElement.appendChild(li);
    });

    // Populate Active Mod Effects
    if (selectedMods.length > 0) {
        selectedMods.forEach(mod => {
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

        // Custom sort for CommunityRanking (sort by NumericalRank)
        if (column === 'CommunityRanking') {
            const tierInfoA = tierList.find(tierUnit => tierUnit.NormalizedUnitName === a.NormalizedLabel);
            const tierInfoB = tierList.find(tierUnit => tierUnit.NormalizedUnitName === b.NormalizedLabel);

            // Get NumericalRank. Treat 'N/A' or missing as 0 to push them to the appropriate end.
            const rankA = tierInfoA && typeof tierInfoA.NumericalRank === 'number' ? tierInfoA.NumericalRank : 0;
            const rankB = tierInfoB && typeof tierInfoB.NumericalRank === 'number' ? tierInfoB.NumericalRank : 0;

            if (currentSortDirection === 'asc') {
                // For ascending (S on top), we want HIGHER NumericalRank to come first.
                // So, if rankA is 900 (S) and rankB is 700 (B), we want A before B.
                // rankB - rankA will be 700 - 900 = -200, which correctly places A before B.
                // If rankA is 0 (N/A) and rankB is 700, 700 - 0 = 700, B comes after A (N/A at bottom).
                return rankB - rankA;
            } else {
                // For descending (F on top), we want LOWER NumericalRank to come first.
                // So, if rankA is 900 (S) and rankB is 500 (D), we want D before S.
                // rankA - rankB will be 900 - 500 = 400, which incorrectly places S before D.
                // We need rankA - rankB to put lower values first in "descending" visual order.
                // If rankA is 0 (N/A) and rankB is 700, 0 - 700 = -700, A comes before B (N/A at top).
                return rankA - rankB;
            }
        }

        // Handle "N/A" values by treating them as lowest/highest for sorting
        // This general N/A handling is now less critical for CommunityRanking
        // because it's handled specifically above, but good to keep for other columns.
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

    // Default to dark mode if no preference is saved or if system prefers dark
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
 * Switches between unit and mod tabs.
 * @param {string} tabId - The ID of the tab to activate ('unitsTab' or 'modsTab').
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
    }
    else if (tabId === 'tierListTab') { // Handle new Tier List tab
        tierListContent.classList.remove('hidden');
        // Re-render the tier list table to ensure it's up-to-date with units data
        renderTierListTable(tierList);
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
window.onload = async function() { // Made onload async
    initializeDarkMode(); // Set initial dark mode state

    loadingSpinner.classList.remove('hidden'); // Show spinner for units
    unitTableContainer.classList.add('hidden'); // Hide unit table
    modsContent.classList.add('hidden'); // Ensure mods content is hidden initially
    tierListContent.classList.add('hidden'); // Ensure tier list content is hidden initially

    // Fetch all data concurrently
    const [fetchedUnits, fetchedModsRaw, fetchedTierList] = await Promise.all([
        fetchGoogleSheetCSVData(GOOGLE_SHEET_UNIT_DATA_CSV_URL, loadingSpinner, unitTableContainer, noResultsMessage),
        fetchGoogleSheetCSVData(GOOGLE_SHEET_MOD_DATA_CSV_URL, null, null, null), // No specific spinner/message for mods during initial load
        fetchGoogleSheetCSVData(GOOGLE_SHEET_TIER_LIST_CSV_URL, tierListSpinner, tierListTableContainer, noTierListMessage)
    ]);

    units = fetchedUnits;
    // Transform raw fetched mod data to the expected structured format
    mods = transformFetchedModData(fetchedModsRaw);
    tierList = fetchedTierList;

    populateRarityFilter();
    populateClassFilter(); // Populate class filter after parsing
    filterAndRenderUnits(); // Initial render of units (now with tierList available)
    renderModTable(mods); // Initial render of mods (will be hidden initially)

    loadingSpinner.classList.add('hidden'); // Hide spinner
    unitTableContainer.classList.remove('hidden'); // Show unit table

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
    tierListTab.addEventListener('click', () => switchTab('tierListTab')); // Tier List Tab event

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
