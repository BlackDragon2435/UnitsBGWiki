// js/script.js
// This file has been updated to fetch data directly from the user's published Google Sheets.

import { unitImages } from './unitImages.js';
import { gameData } from './gameData.js';

// IMPORTANT: Base URL for your published Google Sheet
// To get this URL, go to File > Share > Publish to web > Publish to web > Link.
// Choose the sheet and format as "Comma-separated values (.csv)", then copy the URL.
const GOOGLE_SHEET_BASE_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQO78VJA7y_g5zHpzw1gTaJhLV2mjNdRxA33zcj1WPFj-QYxQS09nInTQXg6kXNJcjm4f7Gk7lPVZuV/pub?output=csv';

// Specific URLs for each sheet using their GIDs
// These URLs were provided by the user.
const GOOGLE_SHEET_UNIT_DATA_CSV_URL = GOOGLE_SHEET_BASE_URL + '&gid=201310748'; // Unit Info
const GOOGLE_SHEET_TIER_LIST_CSV_URL = GOOGLE_SHEET_BASE_URL + '&gid=0'; // Tier List
const GOOGLE_SHEET_MOD_DATA_CSV_URL = GOOGLE_SHEET_BASE_URL + '&gid=331730679'; // Mod Info

// ======================= Global State and Variables =======================
let unitsData = [];
let modsData = [];
let tierListData = [];
let modEffectsEnabled = false;
let maxLevelGlobalEnabled = false;
let currentSortColumn = 'Label';
let currentSortDirection = 'asc';

// Define the order of rarities for consistent sorting
const rarityOrder = {
    'Common': 1,
    'Uncommon': 2,
    'Rare': 3,
    'Epic': 4,
    'Legendary': 5,
    'Mythic': 6,
    'Demonic': 7,
    'Ancient': 8
};

// ======================= DOM Element References =======================
const loadingMessage = document.getElementById('loadingMessage');
const mainContent = document.getElementById('mainContent');
const unitTableBody = document.getElementById('unitTableBody');
const modsTableBody = document.getElementById('modsTableBody');
const tierListTableBody = document.getElementById('tierListTableBody');
const searchInput = document.getElementById('searchInput');
const rarityFilter = document.getElementById('rarityFilter');
const classFilter = document.getElementById('classFilter');
const tableHeaders = document.querySelectorAll('#unitTable th[data-sort]');
const darkModeToggle = document.getElementById('darkModeToggle');
const unitsTab = document.getElementById('unitsTab');
const modsTab = document.getElementById('modsTab');
const tierListTab = document.getElementById('tierListTab');
const unitsContainer = document.getElementById('unitsContainer');
const modsContainer = document.getElementById('modsContainer');
const tierListContainer = document.getElementById('tierListContainer');
const noUnitsMessage = document.getElementById('noUnitsMessage');
const noModsMessage = document.getElementById('noModsMessage');
const noTierListMessage = document.getElementById('noTierListMessage');
const toggleModEffects = document.getElementById('toggleModEffects');
const toggleMaxLevel = document.getElementById('toggleMaxLevel');
const totalCostInput = document.getElementById('totalCost');
const maxLevelRaritySelect = document.getElementById('maxLevelRarity');

// ======================= Data Fetching and Parsing Functions =======================

/**
 * Fetches CSV data from a URL and parses it into a JSON array of objects.
 * Assumes the first row of the CSV is the header.
 * @param {string} url The URL to the CSV file.
 * @returns {Promise<Array<Object>>} A promise that resolves with the parsed data.
 */
async function fetchAndParseCSV(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const csvText = await response.text();
        const lines = csvText.split('\n');
        const headers = lines[0].split(',').map(header => header.trim().replace(/"/g, ''));
        const data = [];
        for (let i = 1; i < lines.length; i++) {
            const currentLine = lines[i];
            if (currentLine.trim() === '') continue; // Skip empty lines
            const values = currentLine.split(',').map(value => value.trim().replace(/"/g, ''));
            const entry = {};
            for (let j = 0; j < headers.length; j++) {
                entry[headers[j]] = values[j];
            }
            data.push(entry);
        }
        return data;
    } catch (error) {
        console.error(`Error fetching or parsing CSV from ${url}:`, error);
        return [];
    }
}

// ======================= Unit Calculation and Data Processing =======================

/**
 * Calculates the final stat for a unit based on its base value, class, rarity, and level.
 * @param {number} baseValue The initial stat value.
 * @param {string} unitClass The class of the unit.
 * @param {string} rarity The rarity of the unit.
 * @param {string} statName The name of the stat (HP, Cooldown, Damage).
 * @param {number} level The level of the unit.
 * @returns {number} The calculated final stat value.
 */
function calculateFinalStat(baseValue, unitClass, rarity, statName, level) {
    // If the base value is not a number, return it as-is (e.g., for 'N/A' values)
    if (isNaN(baseValue)) return baseValue;

    // The provided gameData seems to have a slightly different structure.
    // I will adjust the logic to handle the `_value` and `_attributes` properties.
    const statData = gameData.UnitStatModifiers[unitClass]?.[statName];
    if (!statData) return baseValue;

    const baseModifier = statData._value;
    const rarityModifier = statData._attributes[rarity] || 0;

    // Max level bonus is applied if the global toggle is on and the unit is max level.
    const isMaxLevel = maxLevelGlobalEnabled && level === 10;
    const maxLevelBonus = isMaxLevel ? 1.5 : 1; // Assuming a 50% max level bonus

    // The formula in the original game is likely more complex, but this is a reasonable
    // approximation based on the available data.
    let finalValue = (parseFloat(baseValue) + baseModifier) * (1 + rarityModifier) * maxLevelBonus;

    if (statName === 'Cooldown') {
        // Cooldown is reduced, so a negative modifier is a good thing.
        // We'll calculate a final cooldown reduction.
        const cooldownReduction = rarityModifier;
        finalValue = parseFloat(baseValue) * (1 + cooldownReduction);
        // Ensure cooldown doesn't go below 0.1
        finalValue = Math.max(finalValue, 0.1);
    }

    return parseFloat(finalValue.toFixed(2));
}

// ======================= Rendering Functions =======================

/**
 * Renders the units table with the given data.
 * @param {Array<Object>} data The array of unit data to render.
 */
function renderUnitsTable(data) {
    unitTableBody.innerHTML = '';
    if (data.length === 0) {
        noUnitsMessage.classList.remove('hidden');
        return;
    }
    noUnitsMessage.classList.add('hidden');

    data.forEach(unit => {
        const row = document.createElement('tr');
        row.className = `border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors duration-200`;

        // Get the unit's image or a placeholder
        const unitImage = unitImages[unit.Label] || 'https://placehold.co/60x60/374151/9ca3af?text=NA';

        // Get the current level of the unit (from the input field for this unit)
        const unitLevelInput = document.getElementById(`level-input-${unit.Label.replace(/\s/g, '-')}`);
        const unitLevel = unitLevelInput ? parseInt(unitLevelInput.value) || 1 : 1;

        // Apply a global mod if the toggle is on and a mod is selected
        let unitDamage = unit.Damage;
        let unitHP = unit.HP;
        let unitCooldown = unit.Cooldown;

        if (modEffectsEnabled && totalCostInput.value > 0) {
            // This is a simplified example. A more complex system would apply specific mod effects.
            const totalModEffect = parseFloat(totalCostInput.value);
            unitDamage = parseFloat(unitDamage) * (1 + totalModEffect);
            unitHP = parseFloat(unitHP) * (1 + totalModEffect);
        }

        // Apply global max level bonus if enabled
        if (maxLevelGlobalEnabled) {
            const selectedRarity = maxLevelRaritySelect.value;
            if (selectedRarity === 'All' || selectedRarity === unit.Rarity) {
                // Assuming a simplified max level effect for this example
                unitDamage = parseFloat(unitDamage) * 1.5; // 50% damage bonus at max level
                unitHP = parseFloat(unitHP) * 1.5; // 50% HP bonus at max level
                unitCooldown = parseFloat(unitCooldown) * 0.5; // 50% cooldown reduction
            }
        }

        // Format the numbers for display
        const formattedDamage = parseFloat(unitDamage).toFixed(2);
        const formattedHP = parseFloat(unitHP).toFixed(2);
        const formattedCooldown = parseFloat(unitCooldown).toFixed(2);
        const formattedCritDamage = unit.CritDamage && !isNaN(unit.CritDamage) ? `${(parseFloat(unit.CritDamage) * 100).toFixed(0)}%` : 'N/A';
        const formattedCritChance = unit.CritChance && !isNaN(unit.CritChance) ? `${(parseFloat(unit.CritChance) * 100).toFixed(0)}%` : 'N/A';

        row.innerHTML = `
            <td class="py-3 px-2 sm:px-4 flex items-center justify-start whitespace-nowrap">
                <img src="${unitImage}" alt="${unit.Label}" class="w-10 h-10 rounded-full mr-2 sm:mr-4 border-2 border-gray-200 dark:border-gray-600">
                <span class="font-medium text-gray-900 dark:text-gray-100">${unit.Label}</span>
            </td>
            <td class="py-3 px-2 sm:px-4 text-gray-700 dark:text-gray-300 text-center">${unit.Rarity}</td>
            <td class="py-3 px-2 sm:px-4 text-gray-700 dark:text-gray-300 text-center">${unit.Class}</td>
            <td class="py-3 px-2 sm:px-4 text-gray-700 dark:text-gray-300 text-center">${formattedDamage}</td>
            <td class="py-3 px-2 sm:px-4 text-gray-700 dark:text-gray-300 text-center">${formattedHP}</td>
            <td class="py-3 px-2 sm:px-4 text-gray-700 dark:text-gray-300 text-center">${formattedCooldown}s</td>
            <td class="py-3 px-2 sm:px-4 text-gray-700 dark:text-gray-300 text-center">${formattedCritChance}</td>
            <td class="py-3 px-2 sm:px-4 text-gray-700 dark:text-gray-300 text-center">${formattedCritDamage}</td>
            <td class="py-3 px-2 sm:px-4 text-gray-700 dark:text-gray-300 text-center">
                <input type="number" id="level-input-${unit.Label.replace(/\s/g, '-')}" value="${unitLevel}" min="1" max="10" 
                       class="w-16 p-1 text-center bg-gray-200 dark:bg-gray-800 rounded-md border border-gray-300 dark:border-gray-600">
            </td>
        `;

        // Add event listener to the newly created level input
        const newLevelInput = row.querySelector(`#level-input-${unit.Label.replace(/\s/g, '-')}`);
        if (newLevelInput) {
            newLevelInput.addEventListener('input', () => {
                filterAndRenderUnits(); // Re-render the table on level change
            });
        }
        unitTableBody.appendChild(row);
    });
}


/**
 * Renders the mods table with the given data.
 * @param {Array<Object>} data The array of mod data to render.
 */
function renderModsTable(data) {
    modsTableBody.innerHTML = '';
    if (data.length === 0) {
        noModsMessage.classList.remove('hidden');
        return;
    }
    noModsMessage.classList.add('hidden');

    data.forEach(mod => {
        const row = document.createElement('tr');
        row.className = 'bg-white border-b last:border-b-0 dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600';
        row.innerHTML = `
            <td class="py-4 px-6 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">${mod.Title}</td>
            <td class="py-4 px-6 text-gray-700 dark:text-gray-300">${mod.Rarity}</td>
            <td class="py-4 px-6 text-gray-700 dark:text-gray-300">${mod.Stat || 'N/A'}</td>
            <td class="py-4 px-6 text-gray-700 dark:text-gray-300">${mod.Effect}</td>
            <td class="py-4 px-6 text-gray-700 dark:text-gray-300">${mod.Chance}</td>
        `;
        modsTableBody.appendChild(row);
    });
}

/**
 * Renders the tier list table with the given data.
 * @param {Array<Object>} data The array of tier list data to render.
 */
function renderTierListTable(data) {
    tierListTableBody.innerHTML = '';
    if (data.length === 0) {
        noTierListMessage.classList.remove('hidden');
        return;
    }
    noTierListMessage.classList.add('hidden');

    data.forEach(item => {
        const row = document.createElement('tr');
        row.className = 'bg-white border-b last:border-b-0 dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600';
        row.innerHTML = `
            <td class="py-4 px-6 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">${item.UnitName}</td>
            <td class="py-4 px-6 text-gray-700 dark:text-gray-300">${item.Tier}</td>
            <td class="py-4 px-6 text-gray-700 dark:text-gray-300">${item.NumericalRank}</td>
            <td class="py-4 px-6 text-gray-700 dark:text-gray-300">${item.Notes}</td>
        `;
        tierListTableBody.appendChild(row);
    });
}


// ======================= Filtering, Sorting, and Debouncing =======================

/**
 * Filters the units data based on search and filter inputs and then renders the table.
 */
function filterAndRenderUnits() {
    let filteredData = [...unitsData];
    const searchTerm = searchInput.value.toLowerCase();
    const selectedRarity = rarityFilter.value;
    const selectedClass = classFilter.value;

    // Filter by search term
    if (searchTerm) {
        filteredData = filteredData.filter(unit =>
            unit.Label.toLowerCase().includes(searchTerm)
        );
    }

    // Filter by rarity
    if (selectedRarity && selectedRarity !== 'All') {
        filteredData = filteredData.filter(unit => unit.Rarity === selectedRarity);
    }

    // Filter by class
    if (selectedClass && selectedClass !== 'All') {
        filteredData = filteredData.filter(unit => unit.Class === selectedClass);
    }

    // Sort the filtered data
    sortData(currentSortColumn, filteredData);

    renderUnitsTable(filteredData);
}

/**
 * Sorts the data based on the column and direction.
 * @param {string} column The column to sort by.
 * @param {Array<Object>} data The data array to sort. Defaults to unitsData.
 */
function sortData(column, data = unitsData) {
    if (!column) return;

    // Determine the direction
    const newSortDirection = (currentSortColumn === column && currentSortDirection === 'asc') ? 'desc' : 'asc';

    // Sort logic
    data.sort((a, b) => {
        const aValue = a[column];
        const bValue = b[column];

        // Handle numeric sorting
        if (!isNaN(parseFloat(aValue)) && !isNaN(parseFloat(bValue))) {
            const result = parseFloat(aValue) - parseFloat(bValue);
            return newSortDirection === 'asc' ? result : -result;
        }

        // Handle rarity sorting
        if (column === 'Rarity') {
            const aRarity = rarityOrder[aValue] || 99;
            const bRarity = rarityOrder[bValue] || 99;
            const result = aRarity - bRarity;
            return newSortDirection === 'asc' ? result : -result;
        }

        // Handle string sorting
        const result = aValue.localeCompare(bValue);
        return newSortDirection === 'asc' ? result : -result;
    });

    // Update global state
    currentSortColumn = column;
    currentSortDirection = newSortDirection;

    // Update table header icons (visual feedback)
    tableHeaders.forEach(header => {
        const icon = header.querySelector('span.sort-icon');
        if (icon) {
            icon.classList.toggle('hidden', header.dataset.sort !== column);
            icon.textContent = newSortDirection === 'asc' ? '▲' : '▼';
        }
    });

    renderUnitsTable(data);
}


/**
 * A debounce function to limit how often an event listener fires.
 * @param {Function} func The function to debounce.
 * @param {number} delay The delay in milliseconds.
 * @returns {Function} The debounced function.
 */
function debounce(func, delay) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), delay);
    };
}


// ======================= UI Functions =======================

/**
 * Toggles dark mode on or off.
 */
function toggleDarkMode() {
    document.body.classList.toggle('dark');
    const isDarkMode = document.body.classList.contains('dark');
    localStorage.setItem('darkMode', isDarkMode);
}

/**
 * Switches the active tab and shows the corresponding content.
 * @param {string} tabId The ID of the tab to activate ('unitsTab', 'modsTab', 'tierListTab').
 */
function switchTab(tabId) {
    // Remove active state from all tabs and hide all containers
    [unitsTab, modsTab, tierListTab].forEach(tab => tab.classList.remove('active-tab'));
    [unitsContainer, modsContainer, tierListContainer].forEach(container => container.classList.add('hidden'));

    // Add active state to the clicked tab and show its container
    const selectedTab = document.getElementById(tabId);
    if (selectedTab) {
        selectedTab.classList.add('active-tab');
        const targetContainerId = tabId.replace('Tab', 'Container');
        const targetContainer = document.getElementById(targetContainerId);
        if (targetContainer) {
            targetContainer.classList.remove('hidden');
        }
    }
}

// ======================= Initialization and Event Listeners =======================

/**
 * The main initialization function for the app.
 */
window.onload = async () => {
    // Show loading message while data is being fetched
    if (loadingMessage) loadingMessage.classList.remove('hidden');
    if (mainContent) mainContent.classList.add('hidden');

    // Fetch all data concurrently
    const [unitsDataFromCSV, modsDataFromCSV, tierListDataFromCSV] = await Promise.all([
        fetchAndParseCSV(GOOGLE_SHEET_UNIT_DATA_CSV_URL),
        fetchAndParseCSV(GOOGLE_SHEET_MOD_DATA_CSV_URL),
        fetchAndParseCSV(GOOGLE_SHEET_TIER_LIST_CSV_URL)
    ]);

    // Assign fetched data to global variables
    unitsData = unitsDataFromCSV;
    modsData = modsDataFromCSV;
    tierListData = tierListDataFromCSV;

    // Hide loading message and show main content
    if (loadingMessage) loadingMessage.classList.add('hidden');
    if (mainContent) mainContent.classList.remove('hidden');

    // Initial rendering of all tables
    filterAndRenderUnits();
    renderModsTable(modsData);
    renderTierListTable(tierListData);

    // Apply dark mode preference on load
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark');
    }

    // Set up event listeners for filters, sorting, and toggles
    // Use optional chaining to prevent errors if elements are not found
    if (searchInput) {
        const debouncedFilterAndRenderUnits = debounce(filterAndRenderUnits, 300);
        searchInput.addEventListener('input', debouncedFilterAndRenderUnits);
    }
    if (rarityFilter) rarityFilter.addEventListener('change', filterAndRenderUnits);
    if (classFilter) classFilter.addEventListener('change', filterAndRenderUnits);
    
    if (tableHeaders) {
        tableHeaders.forEach(header => {
            header.addEventListener('click', () => {
                const sortColumn = header.dataset.sort;
                if (sortColumn) {
                    sortData(sortColumn);
                }
            });
        });
    }

    if (darkModeToggle) darkModeToggle.addEventListener('click', toggleDarkMode);
    if (unitsTab) unitsTab.addEventListener('click', () => switchTab('unitsTab'));
    if (modsTab) modsTab.addEventListener('click', () => switchTab('modsTab'));
    if (tierListTab) tierListTab.addEventListener('click', () => switchTab('tierListTab'));

    if (toggleModEffects) {
      toggleModEffects.addEventListener('change', () => {
        modEffectsEnabled = toggleModEffects.checked;
        filterAndRenderUnits();
      });
    }
    if (toggleMaxLevel) {
      toggleMaxLevel.addEventListener('change', () => {
        maxLevelGlobalEnabled = toggleMaxLevel.checked;
        filterAndRenderUnits();
      });
    }

    // Set default tab
    switchTab('unitsTab');
};

