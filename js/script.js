// js/script.js
import { rawUnitData } from './unitsData.js'; // Assuming this file exists and contains rawUnitData
import { rawModData } from './modsData.js';
import { unitImages } from './unitImages.js'; // Import unit images

let units = []; // Stores parsed unit data
let mods = [];  // Stores parsed mod data
let currentSortColumn = null;
let currentSortDirection = 'asc'; // 'asc' or 'desc'
let modEffectsEnabled = false; // State for global mod effects toggle

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
const modsTableBody = document.querySelector('#modsTable tbody');

let expandedUnitRowId = null; // To keep track of the currently expanded row

// Define the order of rarities for consistent filtering and display
const rarityOrder = ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic", "Demonic", "Ancient"];

// Define the order of columns for unit table display
const unitColumnOrder = [
    'Image', 'Label', 'Class', 'Rarity', 'HP', 'Damage', 'Cooldown', 'Distance',
    'CritChance', 'CritDamage', 'AttackEffect', 'AttackEffectType',
    'AttackEffectLifesteal', 'AttackEffectKey', 'Knockback', 'Accuracy',
    'EvadeChance', 'HPOffset', 'ShadowStepDistance', 'ShadowStepCooldown'
];

// --- Utility Functions ---

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

                if (Object.keys(effect).length > 0) {
                    mod.effects.push(effect);
                }

                // Generate a readable effect description
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
        if (modifiedUnit[stat] === undefined || modifiedUnit[stat] === 'N/A') {
            // If the stat is N/A but the mod provides an amount, initialize it.
            // This is a common case for CritChance, CritDamage, EvadeChance, Accuracy
            if (typeof amount === 'number' && ['CritChance', 'CritDamage', 'EvadeChance', 'Accuracy', 'HPOffset', 'ShadowStepDistance', 'ShadowStepCooldown', 'Knockback'].includes(stat)) {
                modifiedUnit[stat] = 0; // Initialize to 0 for addition
            } else if (stat === 'AttackEffectLifesteal' && typeof amount === 'number') {
                modifiedUnit[stat] = 0; // Initialize Lifesteal to 0 if N/A
            } else {
                return; // Cannot apply mod to non-numeric or non-relevant "N/A" stat
            }
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
            case "HPOffset":
            case "ShadowStepDistance":
            case "ShadowStepCooldown":
                if (typeof modifiedUnit[stat] === 'number' && typeof amount === 'number') {
                    modifiedUnit[stat] += amount;
                } else if (modifiedUnit[stat] === 'N/A' && typeof amount === 'number') {
                    modifiedUnit[stat] = amount;
                }
                break;
            // For effects like "Frost", "Fire", "Poison", "Mirror", we might just update
            // the AttackEffect or AttackEffectType fields, or add a new property for active effects.
            // For now, we'll just note their presence.
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
        row.classList.add(`rarity-${unitToDisplay.Rarity.replace(/\s/g, '')}`, 'cursor-pointer', 'unit-row');
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
 * @param {HTMLTableRowElement} row - The table row element that was clicked.
 * @param {number} index - The original index of the unit in the `units` array.
 */
function toggleUnitDetails(unit, row, index) {
    const nextRow = row.nextElementSibling;

    // If an existing detail row is open for this unit, close it
    if (nextRow && nextRow.classList.contains('unit-details-row') && nextRow.dataset.unitIndex === String(index)) {
        row.classList.remove('expanded');
        nextRow.remove();
        expandedUnitRowId = null;
        return;
    }

    // Close any other open detail rows
    if (expandedUnitRowId !== null && expandedUnitRowId !== index) {
        const prevExpandedRow = unitTableBody.querySelector(`[data-unit-index="${expandedUnitRowId}"]`);
        if (prevExpandedRow) {
            prevExpandedRow.classList.remove('expanded');
            if (prevExpandedRow.nextElementSibling && prevExpandedRow.nextElementSibling.classList.contains('unit-details-row')) {
                prevExpandedRow.nextElementSibling.remove();
            }
        }
    }

    // Set the new expanded row ID
    expandedUnitRowId = index;
    row.classList.add('expanded');

    // Create the new detail row
    const detailRow = unitTableBody.insertRow(row.rowIndex + 1);
    detailRow.classList.add('unit-details-row', 'bg-gray-50', 'dark:bg-gray-700', 'border-b', 'border-gray-200', 'dark:border-gray-600');
    detailRow.dataset.unitIndex = index; // Link to the unit row

    const detailCell = detailRow.insertCell(0);
    detailCell.colSpan = unitColumnOrder.length; // Span all columns
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
                             <div id="modCheckboxes" class="flex flex-wrap gap-x-4 gap-y-2 mb-4 text-gray-700 dark:text-gray-200"></div>
                             <h3 class="font-semibold text-lg mb-2 text-blue-800 dark:text-blue-200">Stats with Mods:</h3>
                             <ul id="appliedStatsList" class="space-y-1 text-gray-700 dark:text-gray-200"></ul>`;
    detailContent.appendChild(modApplyDiv);

    const modCheckboxesDiv = modApplyDiv.querySelector('#modCheckboxes');
    const appliedStatsList = modApplyDiv.querySelector('#appliedStatsList');

    // Store selected mods for this specific unit's detail view
    let selectedModsForUnit = [];

    // Populate mod checkboxes
    mods.forEach(mod => {
        const label = document.createElement('label');
        label.classList.add('inline-flex', 'items-center', 'cursor-pointer');
        label.title = mod.effectDescription; // Tooltip for effect description

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = mod.id; // Use mod.id to identify
        checkbox.classList.add('form-checkbox', 'h-4', 'w-4', 'text-blue-600', 'rounded', 'focus:ring-blue-500', 'dark:text-blue-400', 'dark:focus:ring-blue-400', 'mr-1');
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                selectedModsForUnit.push(mod);
            } else {
                selectedModsForUnit = selectedModsForUnit.filter(m => m.id !== mod.id);
            }
            updateAppliedStats(unit, selectedModsForUnit, appliedStatsList);
        });

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(mod.label));
        modCheckboxesDiv.appendChild(label);
    });

    // Initial display of applied stats (no mods applied yet)
    updateAppliedStats(unit, selectedModsForUnit, appliedStatsList);

    detailCell.appendChild(detailContent);
}

/**
 * Updates the displayed stats in the detailed unit view based on selected mods.
 * @param {Object} baseUnit - The original unit object.
 * @param {Array<Object>} selectedMods - The mods currently selected for this unit.
 * @param {HTMLElement} listElement - The UL element to render stats into.
 */
function updateAppliedStats(baseUnit, selectedMods, listElement) {
    listElement.innerHTML = ''; // Clear previous stats

    const modifiedUnit = applyModsToUnit(baseUnit, selectedMods);

    unitColumnOrder.slice(1).forEach(key => { // Skip 'Image'
        const li = document.createElement('li');
        let displayValue = modifiedUnit[key];
        if (key === 'CritChance' || key === 'EvadeChance' || key === 'Accuracy') {
            displayValue = typeof displayValue === 'number' ? (displayValue * 100).toFixed(2) + '%' : displayValue;
        } else if (key === 'Cooldown' || key === 'CritDamage' || key === 'AttackEffectLifesteal') {
            displayValue = typeof displayValue === 'number' ? displayValue.toFixed(2) : displayValue;
        }
        li.textContent = `${key}: ${displayValue !== undefined ? displayValue : 'N/A'}`;

        // Highlight changes from base stats
        if (baseUnit[key] !== modifiedUnit[key] && baseUnit[key] !== 'N/A' && modifiedUnit[key] !== 'N/A') {
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
    searchInput.addEventListener('input', filterAndRenderUnits);
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
};
