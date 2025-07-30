// js/script.js
import { rawUnitData } from './unitsData.js';
import { rawModData } from './modsData.js';
import { unitImages } from './unitImages.js';
import { gameData } from './gameData.js'; // Import gameData

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
const tableHeaders = document.querySelectorAll('#unitTable th');
const loadingSpinner = document.getElementById('loadingSpinner');
const unitTableContainer = document.getElementById('unitTableContainer');
const noResultsMessage = document.getElementById('noResultsMessage');
const darkModeToggle = document.getElementById('darkModeToggle');
const sunIcon = document.getElementById('sunIcon');
const moonIcon = document.getElementById('moonIcon');
const unitsTab = document.getElementById('unitsTab');
const modsTab = document.getElementById('modsTab');
const unitsContent = document.getElementById('unitsContent');
const modsContent = document.getElementById('modsContent');
const toggleModEffects = document.getElementById('toggleModEffects');
const toggleMaxLevel = document.getElementById('toggleMaxLevel'); // Global Max Level toggle
const modsTableBody = document.querySelector('#modsTable tbody');

let expandedUnitRowId = null; // To keep track of the currently expanded row

// Define the order of rarities for consistent filtering and display
const rarityOrder = ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic", "Demonic", "Ancient"];

// Define the order of columns for unit table display (HP Offset and Shadow Step removed)
const unitColumnOrder = [
    'Image', 'Label', 'Class', 'Rarity', 'HP', 'Damage', 'Cooldown', 'Distance',
    'CritChance', 'CritDamage', 'AttackEffect', 'AttackEffectType',
    'AttackEffectLifesteal', 'AttackEffectKey', 'Knockback', 'Accuracy',
    'EvadeChance' // HPOffset, ShadowStepDistance, ShadowStepCooldown removed
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
 * Parses the raw string data into an array of objects.
 * Handles "N/A" conversion to actual null for easier numeric operations,
 * and number parsing.
 * For mod data, it groups properties by their "Title" to form complete mod objects.
 * @param {string} dataString - The raw string data from the text file.
 * @param {string} dataType - 'units' or 'mods' to determine parsing logic.
 * @returns {Array<Object>} An array of parsed objects.
 */
function parseData(dataString, dataType) {
    const parsedItems = [];
    const itemLines = dataString.split(/[\r\n]+/).filter(line => line.trim() !== '');

    if (dataType === 'units') {
        const unitBlocks = dataString.match(/\["([^"]+)"\] = \{([^}]+)\},/g);

        if (!unitBlocks) {
            console.warn("No unit blocks found in the provided data string.");
            return parsedItems;
        }

        unitBlocks.forEach(block => {
            const unitNameMatch = block.match(/\["([^"]+)"\] = \{/);
            if (!unitNameMatch) return;

            const unitName = unitNameMatch[1];
            const propertiesString = block.match(/\{([^}]+)\}/)[1];

            const unit = {};
            const propertyMatches = propertiesString.matchAll(/\["([^"]+)"\] = (.+?),/g);

            for (const match of propertyMatches) {
                const key = match[1];
                let value = match[2].trim();

                if (value === '"N/A"') {
                    value = 'N/A'; // Keep "N/A" as string for display
                } else if (value === 'true') {
                    value = true;
                } else if (value === 'false') {
                    value = false;
                } else if (!isNaN(parseFloat(value)) && isFinite(value)) {
                    value = parseFloat(value);
                } else {
                    value = value.replace(/^"|"$/g, ''); // Remove quotes from string values
                }
                unit[key] = value;
            }
            parsedItems.push(unit);
        });

    } else if (dataType === 'mods') {
        const tempModGroups = {}; // Group properties by their "prefix" like "SmallPoison"

        itemLines.forEach(line => {
            const match = line.match(/\["([^"]+)"\] = (.+?),/);
            if (!match) return;

            const fullKey = match[1]; // e.g., "SmallPoison/Chance" or "Default/Title"
            let value = match[2].trim();

            if (value === '"N/A"') {
                value = 'N/A';
            } else if (value === 'true') {
                value = true;
            } else if (value === 'false') {
                value = false;
            } else if (!isNaN(parseFloat(value)) && isFinite(value)) {
                value = parseFloat(value);
            } else {
                value = value.replace(/^"|"$/g, '');
            }

            const keyParts = fullKey.split('/');
            if (keyParts.length === 2) {
                const groupName = keyParts[0]; // e.g., "SmallPoison"
                const propertyName = keyParts[1]; // e.g., "Chance", "Title", "Stat"

                tempModGroups[groupName] = tempModGroups[groupName] || {};
                tempModGroups[groupName][propertyName] = value;
            } else if (keyParts.length === 1 && keyParts[0] === "Default") {
                // Handle "Default" specific properties if needed, e.g., Default/Title
                // This assumes "Default" is a special mod group
                tempModGroups["Default"] = tempModGroups["Default"] || {};
                tempModGroups["Default"][fullKey] = value; // Store as "Default/Title" directly
            }
        });

        // Now, iterate through the grouped data to create final mod objects
        for (const groupName in tempModGroups) {
            const modGroup = tempModGroups[groupName];

            // Only create a mod if it has a Title
            if (modGroup.Title) {
                const mod = {
                    id: groupName, // e.g., "SmallPoison" - used for internal tracking
                    label: modGroup.Title,
                    rarity: modGroup.Rarity || 'Common', // Default if not specified
                    effects: []
                };

                // Construct the effect object based on available properties in the group
                const effect = {};
                if (modGroup.Stat) effect.stat = modGroup.Stat;
                if (modGroup.Amount !== undefined) effect.amount = modGroup.Amount;
                if (modGroup.Chance !== undefined) effect.chance = modGroup.Chance;
                if (modGroup.Effect) effect.description = modGroup.Effect; // Add effect description from raw data

                if (Object.keys(effect).length > 0) {
                    mod.effects.push(effect);
                }

                // Generate a readable effect description if not already provided
                let effectDescParts = [];
                if (modGroup.Effect) {
                    effectDescParts.push(modGroup.Effect);
                } else {
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
                            } else if (typeof chance === 'number') { // Special case for Lifesteal with chance
                                desc += `Adds ${(chance * 100).toFixed(0)}% Lifesteal`;
                            }
                        } else if (stat === "Frost" || stat === "Fire" || stat === "Poison" || stat === "Mirror") {
                            if (typeof chance === 'number') {
                                desc += `Applies ${stat} with ${(chance * 100).toFixed(0)}% chance`;
                            }
                        } else if (mod.label === "Default") { // Handle the "Default" mod specifically
                            desc += "Default unit properties";
                        }

                        // Add chance if it's not already part of the main description for certain effects
                        if (typeof chance === 'number' && !["Frost", "Fire", "Poison", "Mirror", "Lifesteal"].includes(stat) && desc) {
                            desc += ` (Chance: ${(chance * 100).toFixed(0)}%)`;
                        }
                        if (desc) effectDescParts.push(desc);
                    });
                }
                mod.effectDescription = effectDescParts.join('; ') || 'No defined effect';
                mod.appliesTo = "All"; // Default, as not specified in the mod data

                parsedItems.push(mod);
            }
        }
    }
    return parsedItems;
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

        // Initialize N/A stats if a mod applies a numeric amount to them
        if (modifiedUnit[stat] === 'N/A' && typeof amount === 'number') {
            if (['CritChance', 'CritDamage', 'EvadeChance', 'Accuracy', 'Knockback'].includes(stat)) {
                modifiedUnit[stat] = 0; // Initialize to 0 for addition
            } else if (stat === 'AttackEffectLifesteal') {
                modifiedUnit[stat] = 0; // Initialize Lifesteal to 0 if N/A
            }
        } else if (modifiedUnit[stat] === 'N/A' && typeof chance === 'number' && stat === 'Lifesteal') {
             modifiedUnit.AttackEffectLifesteal = 0; // Initialize Lifesteal if N/A and mod has chance
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
        // Determine which unit data to display (base or mod-affected)
        const unitToDisplay = modEffectsEnabled ? applyModsToUnit(unit, mods) : unit;

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
            // Custom formatting for specific keys
            if (key === 'CritChance' || key === 'EvadeChance' || key === 'Accuracy') {
                displayValue = typeof displayValue === 'number' ? (displayValue * 100).toFixed(2) + '%' : displayValue;
            } else if (key === 'Cooldown' || key === 'CritDamage' || key === 'AttackEffectLifesteal') {
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
    unitColumnOrder.slice(1).forEach(key => { // Skip 'Image'
        const li = document.createElement('li');
        let displayValue = unit[key];
        if (key === 'CritChance' || key === 'EvadeChance' || key === 'Accuracy') {
            displayValue = typeof displayValue === 'number' ? (displayValue * 100).toFixed(2) + '%' : displayValue;
        } else if (key === 'Cooldown' || key === 'CritDamage' || key === 'AttackEffectLifesteal') {
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
                             <ul id="appliedStatsList" class="space-y-1 text-gray-700 dark:text-gray-200"></ul>`;
    detailContent.appendChild(modApplyDiv);

    const toggleMaxStats = modApplyDiv.querySelector('#toggleMaxStats');
    const toggleMaxLevelUnit = modApplyDiv.querySelector('#toggleMaxLevelUnit'); // New DOM element for Max Level
    const levelInput = modApplyDiv.querySelector('#levelInput'); // New DOM element for Level Input
    const modCheckboxesContainer = modApplyDiv.querySelector('#modCheckboxesContainer');
    const appliedStatsList = modApplyDiv.querySelector('#appliedStatsList');

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
                    updateAppliedStats(unit, selectedModsForUnit, appliedStatsList, toggleMaxStats.checked, toggleMaxLevelUnit.checked, parseInt(levelInput.value));
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
            toggleMaxLevelUnit.checked = false; // Uncheck Max Level
        }
        updateAppliedStats(unit, selectedModsForUnit, appliedStatsList, toggleMaxStats.checked, toggleMaxLevelUnit.checked, parseInt(levelInput.value));
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
        updateAppliedStats(unit, selectedModsForUnit, appliedStatsList, toggleMaxStats.checked, toggleMaxLevelUnit.checked, parseInt(levelInput.value));
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
        updateAppliedStats(unit, selectedModsForUnit, appliedStatsList, toggleMaxStats.checked, toggleMaxLevelUnit.checked, level);
    });


    // Initial display of applied stats (no mods applied yet)
    updateAppliedStats(unit, selectedModsForUnit, appliedStatsList, false, false, parseInt(levelInput.value));

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
 */
function updateAppliedStats(baseUnit, selectedMods, listElement, showMaxStats, showMaxLevel, currentLevel) {
    listElement.innerHTML = ''; // Clear previous stats

    let unitToDisplay = { ...baseUnit };

    // Determine the level for calculation
    const levelForCalculation = showMaxLevel ? 25 : currentLevel;

    // Calculate stats at the determined level, then apply mods
    unitToDisplay = getUnitStatsAtLevel(baseUnit, levelForCalculation, selectedMods);


    unitColumnOrder.slice(1).forEach(key => { // Skip 'Image'
        const li = document.createElement('li');
        let displayValue = unitToDisplay[key];
        if (key === 'CritChance' || key === 'EvadeChance' || key === 'Accuracy') {
            displayValue = typeof displayValue === 'number' ? (displayValue * 100).toFixed(2) + '%' : displayValue;
        } else if (key === 'Cooldown' || key === 'CritDamage' || key === 'AttackEffectLifesteal') {
            displayValue = typeof displayValue === 'number' ? displayValue.toFixed(2) : displayValue;
        }
        li.textContent = `${key}: ${displayValue !== undefined ? displayValue : 'N/A'}`;

        // Highlight changes from base stats
        // This logic needs to consider the 'TBD' state from Max Level
        const baseValue = baseUnit[key];
        const currentDisplayedValue = unitToDisplay[key];

        if (baseValue !== currentDisplayedValue && baseValue !== 'N/A' && currentDisplayedValue !== 'N/A') {
            const baseNum = parseFloat(baseValue);
            const currentNum = parseFloat(currentDisplayedValue);

            if (!isNaN(baseNum) && !isNaN(currentNum) && baseNum !== currentNum) {
                li.classList.add('font-bold', 'text-blue-600', 'dark:text-blue-300');
            } else if (typeof baseValue === 'string' && typeof currentDisplayedValue === 'string' && baseValue !== currentDisplayedValue) {
                li.classList.add('font-bold', 'text-blue-600', 'dark:text-blue-300');
            }
        } else if (showMaxLevel && String(currentDisplayedValue).includes('TBD')) { // This TBD logic should no longer be needed if calculations are active
             li.classList.add('font-bold', 'text-blue-600', 'dark:text-blue-300');
        }
        listElement.appendChild(li);
    });
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
 * Switches between unit and mod tabs.
 * @param {string} tabId - The ID of the tab to activate ('unitsTab' or 'modsTab').
 */
function switchTab(tabId) {
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
window.onload = function() {
    initializeDarkMode(); // Set initial dark mode state

    loadingSpinner.classList.remove('hidden'); // Show spinner
    unitTableContainer.classList.add('hidden'); // Hide unit table
    modsContent.classList.add('hidden'); // Ensure mods content is hidden initially

    // Simulate a delay for parsing data
    setTimeout(() => {
        units = parseData(rawUnitData, 'units');
        mods = parseData(rawModData, 'mods'); // Parse mod data
        populateRarityFilter();
        populateClassFilter(); // Populate class filter after parsing
        filterAndRenderUnits(); // Initial render of units
        renderModTable(mods); // Initial render of mods (will be hidden initially)

        loadingSpinner.classList.add('hidden'); // Hide spinner
        unitTableContainer.classList.remove('hidden'); // Show unit table
    }, 500); // Small delay to show spinner

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
