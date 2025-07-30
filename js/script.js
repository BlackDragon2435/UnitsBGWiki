// js/script.js
// Removed imports for rawUnitData and rawModData as data will now be fetched from Google Sheets.
// import { rawUnitData } from './unitsData.js';
// import { rawModData } from './modsData.js';

import { unitImages } from './unitImages.js';
import { gameData } from './gameData.js'; // Import gameData

// IMPORTANT: Google Sheet CSV URLs for Unit and Mod data
const GOOGLE_SHEET_UNIT_DATA_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQO78VJA7y_g5zHpzw1gTaJhLV2mjNdRxA33zcj1WPFj-QYxQS09nInTQXg6kXNJcjm4f7Gk7lPVZuV/pub?gid=201310748&single=true&output=csv';
const GOOGLE_SHEET_MOD_DATA_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQO78VJA7y_g5zHpzw1gTaJhLV2mjNdRxA33zcj1WPFj-QYxQS09nInTQXg6kXNJcjm4f7Gk7lPVZuV/pub?gid=331730679&single=true&output=csv';
// IMPORTANT: Updated URL for the Tier List Google Sheet
const GOOGLE_SHEET_TIER_LIST_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQO78VJA7y_g5zHpzw1gTaJhLV2mjNdRxA33zcj1WPFj-QYxQS09nInTQXg6kXNJcjm4f7Gk7lPVZuV/pub?gid=0&single=true&output=csv';

let units = []; // Stores parsed unit data
let mods = [];  // Stores parsed mod data
let tierListData = []; // Stores parsed tier list data
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
const modsTableBody = document.getElementById('modsTableBody');
const loadingSpinner = document.getElementById('loadingSpinner');
const toggleModEffects = document.getElementById('toggleModEffects');
const toggleMaxLevel = document.getElementById('toggleMaxLevel');
const unitTableContainer = document.getElementById('unitTableContainer');
const tierListTab = document.getElementById('tierListTab');
const tierListContent = document.getElementById('tierListContent');
const tierListSpinner = document.getElementById('tierListSpinner');
const tierListTableBody = document.getElementById('tierListTableBody');
const noTierListMessage = document.getElementById('noTierListMessage');


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
async function fetchAndParseCSV(url) {
    console.log(`Attempting to fetch CSV from: ${url}`);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`HTTP error! status: ${response.status} from ${url}`);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const csvText = await response.text();
        console.log(`Successfully fetched CSV text from ${url}. Length: ${csvText.length}`);

        const lines = csvText.trim().split('\n');
        if (lines.length === 0) {
            console.warn(`CSV from ${url} is empty.`);
            return [];
        }

        const headers = lines[0].split(',').map(header => header.trim());
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(value => value.trim());
            // Skip empty lines that might appear at the end of CSVs
            if (values.every(v => v === '')) {
                continue;
            }
            if (values.length !== headers.length) {
                console.warn(`Skipping malformed row ${i + 1} in ${url}: Expected ${headers.length} columns, got ${values.length}. Row: "${lines[i]}"`);
                continue; // Skip malformed rows
            }
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
        console.log(`Successfully parsed ${data.length} rows from ${url}.`);
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
 * @param {Array<Object>} tierData - The array of tier list objects.
 * @returns {Array<Object>} An array of unit objects with appropriate types and tier info.
 */
function parseUnitData(csvData, tierData) {
    const tierMap = new Map();
    tierData.forEach(item => {
        tierMap.set(item.UnitName, {
            Tier: item.Tier,
            NumericalRank: item.NumericalRank !== 'N/A' ? Number(item.NumericalRank) : Infinity // Use Infinity for unranked to sort at bottom
        });
    });

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

        // Integrate Community Ranking (Tier) and a sortable numerical rank
        const tierInfo = tierMap.get(unit.UnitName);
        unit.CommunityRanking = tierInfo ? tierInfo.Tier : 'N/A';
        unit._communityRankSortValue = tierInfo ? tierInfo.NumericalRank : Infinity; // Use Infinity for unranked to sort at bottom


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
function renderUnitsTable() {
    console.log('Rendering units table...');
    if (!unitTableBody) {
        console.error("unitTableBody element not found. Cannot render units table.");
        return;
    }
    unitTableBody.innerHTML = ''; // Clear existing rows
    if (unitDetailsContainer) { // Check if element exists before clearing
        unitDetailsContainer.innerHTML = ''; // Clear unit details
    }


    const searchQuery = searchInput.value.toLowerCase();
    const selectedRarity = rarityFilter.value;
    const selectedClass = classFilter.value;

    let filteredUnits = units.filter(unit => {
        const matchesSearch = unit.Label.toLowerCase().includes(searchQuery);
        const matchesRarity = selectedRarity === '' || unit.Rarity === selectedRarity; // Changed 'All' to '' for filter value
        const matchesClass = selectedClass === '' || unit.Class === selectedClass; // Changed 'All' to '' for filter value
        return matchesSearch && matchesRarity && matchesClass;
    });

    // Apply sorting
    if (currentSortColumn) {
        filteredUnits.sort((a, b) => {
            let valA = a[currentSortColumn];
            let valB = b[currentSortColumn];

            // Special handling for CommunityRanking to sort by numerical rank
            if (currentSortColumn === 'CommunityRanking') {
                valA = a._communityRankSortValue;
                valB = b._communityRankSortValue;
            }

            // Handle 'N/A' values for numerical sorts, push them to end
            if (typeof valA === 'number' && typeof valB === 'number') {
                if (valA === Infinity && valB !== Infinity) return 1;
                if (valA !== Infinity && valB === Infinity) return -1;
                if (valA === Infinity && valB === Infinity) return 0;
            }

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

    if (unitsToRender.length === 0) {
        document.getElementById('noResultsMessage').classList.remove('hidden');
        unitTableContainer.classList.add('hidden'); // Hide table if no results
    } else {
        document.getElementById('noResultsMessage').classList.add('hidden');
        unitTableContainer.classList.remove('hidden'); // Show table if results
    }

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
            <td class="py-3 px-6 whitespace-nowrap">${unit.CommunityRanking !== 'N/A' ? unit.CommunityRanking : 'N/A'}</td>
            <td class="py-3 px-6 whitespace-nowrap">${unit.HP !== 'N/A' ? unit.HP.toFixed(2) : 'N/A'}</td>
            <td class="py-3 px-6 whitespace-nowrap">${unit.Damage !== 'N/A' ? unit.Damage.toFixed(2) : 'N/A'}</td>
            <td class="py-3 px-6 whitespace-nowrap">${unit.Cooldown !== 'N/A' ? unit.Cooldown.toFixed(2) : 'N/A'}</td>
            <!-- Add other unit properties as needed -->
        `;
        // Check if CritChance, CritDamage, Accuracy, EvadeChance, Distance, Knockback exist before adding
        // This makes the table dynamic based on available data, though for now, keeping fixed columns for simplicity.
        // If you want to add these back, ensure the <thead> also has corresponding <th> elements.
        /*
            <td class="py-3 px-6 whitespace-nowrap">${unit.CritChance !== 'N/A' ? (unit.CritChance * 100).toFixed(2) + '%' : 'N/A'}</td>
            <td class="py-3 px-6 whitespace-nowrap">${unit.CritDamage !== 'N/A' ? unit.CritDamage.toFixed(2) : 'N/A'}</td>
            <td class="py-3 px-6 whitespace-nowrap">${unit.Accuracy !== 'N/A' ? unit.Accuracy.toFixed(2) : 'N/A'}</td>
            <td class="py-3 px-6 whitespace-nowrap">${unit.EvadeChance !== 'N/A' ? (unit.EvadeChance * 100).toFixed(2) + '%' : 'N/A'}</td>
            <td class="py-3 px-6 whitespace-nowrap">${unit.Distance !== 'N/A' ? unit.Distance.toFixed(2) : 'N/A'}</td>
            <td class="py-3 px-6 whitespace-nowrap">${unit.Knockback !== 'N/A' ? unit.Knockback.toFixed(2) : 'N/A'}</td>
        */
        row.addEventListener('click', () => displayUnitDetails(unit.id)); // Use unit.id for details
        unitTableBody.appendChild(row);
    });
    console.log('Finished rendering units table.');
}

/**
 * Displays detailed information for a selected unit, including mod effects.
 * @param {string} unitId - The ID of the unit to display details for.
 */
function displayUnitDetails(unitId) {
    console.log(`Displaying details for unit ID: ${unitId}`);
    const originalUnit = units.find(u => u.id === unitId);
    if (!originalUnit) {
        console.error(`Unit with ID ${unitId} not found.`);
        if (unitDetailsContainer) {
            unitDetailsContainer.innerHTML = '<p class="text-red-500">Unit not found.</p>';
        }
        return;
    }

    // Get selected mods for calculation
    const selectedModIds = Array.from(modCheckboxesContainer.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
    const modifiedUnit = applyModsAndLevelEffects(originalUnit, selectedModIds, maxLevelGlobalEnabled);


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
    if (unitDetailsContainer) { // Check if element exists before setting innerHTML
        unitDetailsContainer.innerHTML = detailsHtml;
    }
}


/**
 * Renders the mod checkboxes for filtering.
 */
function renderModCheckboxes() {
    console.log('Rendering mod checkboxes...');
    if (!modCheckboxesContainer) {
        console.error("modCheckboxesContainer element not found. Cannot render mod checkboxes.");
        return;
    }
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
    console.log('Finished rendering mod checkboxes.');
}

/**
 * Renders the mods table.
 */
function renderModsTable() {
    console.log('Rendering mods table...');
    if (!modsTableBody) {
        console.error("modsTableBody element not found. Cannot render mods table.");
        return;
    }
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
    console.log('Finished rendering mods table.');
}

/**
 * Renders the tier list table.
 */
function renderTierListTable() {
    console.log('Rendering tier list table...');
    if (!tierListTableBody) {
        console.error("tierListTableBody element not found. Cannot render tier list table.");
        return;
    }
    tierListTableBody.innerHTML = ''; // Clear existing rows

    if (tierListData.length === 0) {
        noTierListMessage.classList.remove('hidden');
        tierListTableContainer.classList.add('hidden');
        console.log('No tier list data to render.');
        return;
    } else {
        noTierListMessage.classList.add('hidden');
        tierListTableContainer.classList.remove('hidden');
    }

    tierListData.forEach(tierItem => {
        const row = document.createElement('tr');
        row.className = 'bg-white dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600';
        row.innerHTML = `
            <td class="py-3 px-6 whitespace-nowrap font-medium text-gray-900 dark:text-gray-100">${tierItem.UnitName}</td>
            <td class="py-3 px-6 whitespace-nowrap">${tierItem.Tier}</td>
            <td class="py-3 px-6 whitespace-nowrap">${tierItem.NumericalRank !== 'N/A' ? tierItem.NumericalRank : 'N/A'}</td>
            <td class="py-3 px-6">${tierItem.Notes}</td>
        `;
        tierListTableBody.appendChild(row);
    });
    console.log('Finished rendering tier list table.');
}

/**
 * Filters and re-renders units based on current search and filter criteria.
 */
function filterAndRenderUnits() {
    console.log('Starting filterAndRenderUnits...');
    // Small delay to show spinner for a moment even if data loads fast
    loadingSpinner.classList.remove('hidden');
    setTimeout(() => {
        renderUnitsTable();
        loadingSpinner.classList.add('hidden');
        console.log('Finished filterAndRenderUnits.');
    }, 50); // Reduced delay for faster feedback
}

/**
 * Sorts the units data by the specified column.
 * @param {string} column - The column to sort by.
 */
function sortData(column) {
    console.log(`Sorting by column: ${column}, current direction: ${currentSortDirection}`);
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
    console.log(`Dark mode toggled to: ${isDarkMode}`);
    // Update icons immediately
    if (isDarkMode) {
        document.getElementById('moonIcon').classList.remove('hidden');
        document.getElementById('sunIcon').classList.add('hidden');
    } else {
        document.getElementById('moonIcon').classList.add('hidden');
        document.getElementById('sunIcon').classList.remove('hidden');
    }
}

/**
 * Switches between unit and mod tabs.
 * @param {string} activeTabId - The ID of the tab to activate ('unitsTab' or 'modsTab' or 'tierListTab').
 */
function switchTab(activeTabId) {
    console.log(`Switching to tab: ${activeTabId}`);
    // Deactivate all tabs and hide all content sections
    unitsTab.classList.remove('border-blue-500', 'text-blue-500');
    modsTab.classList.remove('border-blue-500', 'text-blue-500');
    tierListTab.classList.remove('border-blue-500', 'text-blue-500'); // Deactivate tier list tab

    unitsContent.classList.add('hidden');
    modsContent.classList.add('hidden');
    tierListContent.classList.add('hidden'); // Hide tier list content

    // Activate the selected tab and show its content
    if (activeTabId === 'unitsTab') {
        unitsTab.classList.add('border-blue-500', 'text-blue-500');
        unitsContent.classList.remove('hidden');
    } else if (activeTabId === 'modsTab') {
        modsTab.classList.add('border-blue-500', 'text-blue-500');
        modsContent.classList.remove('hidden');
    } else if (activeTabId === 'tierListTab') {
        tierListTab.classList.add('border-blue-500', 'text-blue-500');
        tierListContent.classList.remove('hidden');
        loadTierListData(); // Load tier list data when the tab is activated
    }
}

/**
 * Loads tier list data from the Google Sheet.
 */
async function loadTierListData() {
    console.log('Loading tier list data...');
    if (tierListSpinner) tierListSpinner.classList.remove('hidden');
    if (noTierListMessage) noTierListMessage.classList.add('hidden'); // Hide message while loading
    if (tierListTableContainer) tierListTableContainer.classList.add('hidden'); // Hide table while loading

    try {
        const fetchedTierData = await fetchAndParseCSV(GOOGLE_SHEET_TIER_LIST_CSV_URL);
        tierListData = fetchedTierData;
        console.log('Tier list data loaded:', tierListData.length, 'entries');
        renderTierListTable();
    } catch (error) {
        console.error('Failed to load tier list data:', error);
        if (noTierListMessage) {
            noTierListMessage.textContent = 'Failed to load tier list data. Please check console for details.';
            noTierListMessage.classList.remove('hidden');
        }
    } finally {
        if (tierListSpinner) tierListSpinner.classList.add('hidden');
        console.log('Tier list loading complete. Spinner hidden.');
    }
}


/**
 * Initializes the application by fetching data and setting up event listeners.
 */
async function init() {
    console.log('Initializing application...');
    if (loadingSpinner) loadingSpinner.classList.remove('hidden'); // Show spinner on init

    try {
        // Fetch and parse tier list data first, as unit data depends on it
        const fetchedTierData = await fetchAndParseCSV(GOOGLE_SHEET_TIER_LIST_CSV_URL);
        tierListData = fetchedTierData;
        console.log('Initial Tier list data loaded:', tierListData.length, 'entries');

        // Fetch and parse unit data from Google Sheet, passing tierListData
        const fetchedUnitData = await fetchAndParseCSV(GOOGLE_SHEET_UNIT_DATA_CSV_URL);
        units = parseUnitData(fetchedUnitData, tierListData); // Pass tierListData here
        console.log('Units data loaded:', units.length, 'units');

        // Fetch and parse mod data from Google Sheet
        const fetchedModData = await fetchAndParseCSV(GOOGLE_SHEET_MOD_DATA_CSV_URL);
        mods = parseModData(fetchedModData);
        console.log('Mods data loaded:', mods.length, 'mods');

        // Populate filters (only if data is available)
        if (units.length > 0) {
            const rarities = [...new Set(units.map(unit => unit.Rarity))].sort(); // Sort rarities
            if (rarityFilter) {
                rarityFilter.innerHTML = '<option value="">All Rarity</option>'; // Reset and add default
                rarities.forEach(rarity => {
                    const option = document.createElement('option');
                    option.value = rarity;
                    option.textContent = rarity;
                    rarityFilter.appendChild(option);
                });
            }


            const classes = [...new Set(units.map(unit => unit.Class))].sort(); // Sort classes
            if (classFilter) {
                classFilter.innerHTML = '<option value="">All Classes</option>'; // Reset and add default
                classes.forEach(unitClass => {
                    const option = document.createElement('option');
                    option.value = unitClass;
                    option.textContent = unitClass;
                    classFilter.appendChild(option);
                });
            }
            console.log('Filters populated.');
        } else {
            console.warn('No units data loaded, filters will not be populated.');
        }

        // Render initial tables and checkboxes
        renderModCheckboxes();
        renderModsTable();
        filterAndRenderUnits(); // Initial render of units table

    } catch (error) {
        console.error('Initialization failed:', error);
        // Display a user-friendly message if initialization fails
        if (unitTableBody) {
            unitTableBody.innerHTML = '<tr><td colspan="8" class="text-center text-red-500 py-4">Failed to load data. Please check console for details.</td></tr>';
        }
        if (document.getElementById('noResultsMessage')) {
            document.getElementById('noResultsMessage').classList.remove('hidden'); // Show no results message
        }
    } finally {
        // Ensure spinner is hidden regardless of success or failure
        if (loadingSpinner) loadingSpinner.classList.add('hidden');
        console.log('Initialization complete. Spinner hidden.');
    }


    // Set initial theme based on localStorage or system preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
        if (document.getElementById('moonIcon')) document.getElementById('moonIcon').classList.remove('hidden');
        if (document.getElementById('sunIcon')) document.getElementById('sunIcon').classList.add('hidden');
    } else {
        if (document.getElementById('moonIcon')) document.getElementById('moonIcon').classList.add('hidden');
        if (document.getElementById('sunIcon')) document.getElementById('sunIcon').classList.remove('hidden');
    }


    // Event Listeners
    // Search and Filter Events (debounced for performance)
    const debouncedFilterAndRenderUnits = debounce(filterAndRenderUnits, 300);
    if (searchInput) searchInput.addEventListener('input', debouncedFilterAndRenderUnits);
    if (rarityFilter) rarityFilter.addEventListener('change', filterAndRenderUnits);
    if (classFilter) classFilter.addEventListener('change', filterAndRenderUnits);

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
    if (darkModeToggle) darkModeToggle.addEventListener('click', toggleDarkMode);

    // Tab Switching Events
    if (unitsTab) unitsTab.addEventListener('click', () => switchTab('unitsTab'));
    if (modsTab) modsTab.addEventListener('click', () => switchTab('modsTab'));
    if (tierListTab) {
        tierListTab.addEventListener('click', () => {
            switchTab('tierListTab');
        });
    }

    // Mod Effects Toggle Event (global)
    if (toggleModEffects) {
        toggleModEffects.addEventListener('change', () => {
            modEffectsEnabled = toggleModEffects.checked;
            filterAndRenderUnits(); // Re-render units to apply/remove global mod effects
        });
    }

    // Global Max Level Toggle Event
    if (toggleMaxLevel) {
        toggleMaxLevel.addEventListener('change', () => {
            maxLevelGlobalEnabled = toggleMaxLevel.checked;
            filterAndRenderUnits(); // Re-render units to apply/remove global max level effects
        });
    }

    // Initial switch to units tab to ensure correct display
    switchTab('unitsTab');
}

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);
