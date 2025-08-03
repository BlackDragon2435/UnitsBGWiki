// js/script.js
// This file has been updated to include DPS (Damage Per Second) calculation and display.

// Import necessary game data.
import { unitImages } from './unitImages.js'; 
import { gameData } from './gameData.js'; 

// IMPORTANT: Base URL for your published Google Sheet
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
const modsTableBody = document.getElementById('modsTableBody');
const tierListTableBody = document.getElementById('tierListTableBody');
const noTierListMessage = document.getElementById('noTierListMessage');
const darkModeToggle = document.getElementById('darkModeToggle');
const unitsTab = document.getElementById('unitsTab');
const modsTab = document.getElementById('modsTab');
const tierListTab = document.getElementById('tierListTab');
const toggleModEffects = document.getElementById('toggleModEffects');
const toggleMaxLevel = document.getElementById('toggleMaxLevel');
const maxLevelInputContainer = document.getElementById('maxLevelInputContainer');
const maxLevelInput = document.getElementById('maxLevelInput');


/**
 * Helper function to debounce an input function.
 * @param {Function} func The function to debounce.
 * @param {number} delay The delay in milliseconds.
 * @returns {Function} The debounced function.
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
 * Parses CSV text into an array of objects.
 * @param {string} csvText The CSV data as a string.
 * @returns {Array<object>} An array of objects representing the CSV data.
 */
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',').map(header => header.trim().replace(/"/g, ''));
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(value => value.trim().replace(/"/g, ''));
    if (values.length === headers.length) {
      const entry = {};
      for (let j = 0; j < headers.length; j++) {
        entry[headers[j]] = values[j];
      }
      data.push(entry);
    }
  }
  return data;
}

/**
 * Fetches data from a Google Sheet published as CSV.
 * @param {string} url The URL of the published CSV.
 * @returns {Promise<Array<object>>} A promise that resolves with the parsed data.
 */
async function fetchDataFromGoogleSheet(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const csvText = await response.text();
    return parseCSV(csvText);
  } catch (error) {
    console.error(`Could not fetch data from Google Sheet URL: ${url}`, error);
    return [];
  }
}

/**
 * Loads all game data from the Google Sheet.
 */
async function loadGameData() {
  showLoadingSpinner();
  // We use Promise.all to fetch all data concurrently for better performance.
  const [unitData, modData, tierListData] = await Promise.all([
    fetchDataFromGoogleSheet(GOOGLE_SHEET_UNIT_DATA_CSV_URL),
    fetchDataFromGoogleSheet(GOOGLE_SHEET_MOD_DATA_CSV_URL),
    fetchDataFromGoogleSheet(GOOGLE_SHEET_TIER_LIST_CSV_URL)
  ]);

  // Clean and prepare the data for use.
  units = unitData.map(unit => cleanAndParseUnitData(unit));
  mods = modData.map(mod => cleanAndParseModData(mod));
  tierList = tierListData; // Tier list data is ready to use directly.

  hideLoadingSpinner();
  
  // Initialize the filters and render the units for the first time.
  populateFilters();
  filterAndRenderUnits();
  
  // Render the mods table and tier list table.
  renderModsTable();
  renderTierListTable();
}

/**
 * Cleans and parses a single unit data object, converting string values to numbers where appropriate.
 * @param {object} unit The raw unit object from the CSV.
 * @returns {object} The cleaned and parsed unit object.
 */
function cleanAndParseUnitData(unit) {
    const cleanedUnit = { ...unit
    };
    for (const key in cleanedUnit) {
        if (cleanedUnit.hasOwnProperty(key) && cleanedUnit[key] !== 'N/A') {
            const value = cleanedUnit[key];
            // Attempt to convert to number if it's a string representation of a number.
            if (!isNaN(value) && value.trim() !== '') {
                cleanedUnit[key] = parseFloat(value);
            }
        }
    }
    return cleanedUnit;
}

/**
 * Cleans and parses a single mod data object, converting string values to numbers where appropriate.
 * @param {object} mod The raw mod object from the CSV.
 * @returns {object} The cleaned and parsed mod object.
 */
function cleanAndParseModData(mod) {
    const cleanedMod = { ...mod
    };
    for (const key in cleanedMod) {
        if (cleanedMod.hasOwnProperty(key) && cleanedMod[key] !== 'N/A') {
            const value = cleanedMod[key];
            if (!isNaN(value) && value.trim() !== '') {
                cleanedMod[key] = parseFloat(value);
            }
        }
    }
    return cleanedMod;
}

/**
 * Populates the rarity and class filters from the loaded unit data.
 */
function populateFilters() {
    const allRarities = [...new Set(units.map(unit => unit.Rarity))];
    const allClasses = [...new Set(units.map(unit => unit.Class))];

    allRarities.forEach(rarity => {
        const option = document.createElement('option');
        option.value = rarity;
        option.textContent = rarity;
        rarityFilter.appendChild(option);
    });

    allClasses.forEach(unitClass => {
        const option = document.createElement('option');
        option.value = unitClass;
        option.textContent = unitClass;
        classFilter.appendChild(option);
    });
}

/**
 * Calculates the DPS for a unit.
 * @param {object} unit The unit object.
 * @param {number} level The current level of the unit.
 * @returns {number} The calculated DPS.
 */
function calculateDPS(unit, level) {
    const rarity = unit.Rarity;
    const unitClass = unit.Class;
    const statsCoeffs = gameData.StatsByClass[unitClass];
    const damageAttr = gameData.StatsByClass[unitClass].Damage['_attributes'];
    const cooldownAttr = gameData.StatsByClass[unitClass].Cooldown['_attributes'];

    // Get the base values from the unit data, ensuring they are numbers.
    const baseDamage = parseFloat(unit.Damage);
    const baseCooldown = parseFloat(unit.Cooldown);

    // Apply the rarity-based coefficient for damage and cooldown.
    const damageModifier = damageAttr[rarity] || 0;
    const cooldownModifier = cooldownAttr[rarity] || 0;

    const damage = baseDamage + (baseDamage * damageModifier * (level - 1));
    const cooldown = baseCooldown + (baseCooldown * cooldownModifier * (level - 1));

    if (cooldown > 0) {
        return (damage / cooldown).toFixed(2);
    }
    return 0;
}


/**
 * Renders the units in the table based on the current search, filters, and sort order.
 */
function filterAndRenderUnits() {
    let filteredUnits = [...units];
    const searchValue = searchInput.value.toLowerCase();
    const selectedRarity = rarityFilter.value;
    const selectedClass = classFilter.value;
    const currentLevel = maxLevelGlobalEnabled ? parseInt(maxLevelInput.value, 10) : 1;

    // Filter units based on search input
    if (searchValue) {
        filteredUnits = filteredUnits.filter(unit =>
            unit.Label.toLowerCase().includes(searchValue)
        );
    }

    // Filter units based on rarity
    if (selectedRarity) {
        filteredUnits = filteredUnits.filter(unit => unit.Rarity === selectedRarity);
    }

    // Filter units based on class
    if (selectedClass) {
        filteredUnits = filteredUnits.filter(unit => unit.Class === selectedClass);
    }
    
    // Sort units if a column is selected
    if (currentSortColumn) {
        filteredUnits.sort((a, b) => {
            const valA = a[currentSortColumn];
            const valB = b[currentSortColumn];
            
            if (typeof valA === 'string' && typeof valB === 'string') {
                return currentSortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            } else {
                return currentSortDirection === 'asc' ? valA - valB : valB - valA;
            }
        });
    }

    // Update the UI
    unitTableBody.innerHTML = '';
    if (filteredUnits.length === 0) {
        unitTableContainer.classList.add('hidden');
        noResultsMessage.classList.remove('hidden');
    } else {
        unitTableContainer.classList.remove('hidden');
        noResultsMessage.classList.add('hidden');

        // Dynamically create rows for each unit
        filteredUnits.forEach(unit => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200';
            const unitImage = unitImages[unit.Label] || `https://placehold.co/60x60/cccccc/333333?text=${unit.Label}`;
            
            // Calculate DPS for the current unit at the specified level
            const dps = calculateDPS(unit, currentLevel);
            
            row.innerHTML = `
                <td class="py-3 px-6 text-sm whitespace-nowrap text-center">
                    <div class="flex items-center space-x-3 justify-center">
                        <img src="${unitImage}" alt="${unit.Label}" class="w-10 h-10 rounded-full border-2 border-gray-300 dark:border-gray-600">
                        <span class="font-medium">${unit.Label}</span>
                    </div>
                </td>
                <td class="py-3 px-6 text-sm whitespace-nowrap text-center text-${getRarityColor(unit.Rarity)}-500">${unit.Rarity}</td>
                <td class="py-3 px-6 text-sm whitespace-nowrap text-center hidden md:table-cell">${unit.Class}</td>
                <td class="py-3 px-6 text-sm whitespace-nowrap text-center hidden sm:table-cell">${unit.Damage}</td>
                <td class="py-3 px-6 text-sm whitespace-nowrap text-center hidden lg:table-cell">${unit.Cooldown}</td>
                <td class="py-3 px-6 text-sm whitespace-nowrap text-center hidden sm:table-cell">${unit.HP}</td>
                <td class="py-3 px-6 text-sm whitespace-nowrap text-center font-bold text-green-500">${dps}</td> <!-- Display DPS -->
            `;
            unitTableBody.appendChild(row);
        });
    }
}

/**
 * Renders the mods in the table.
 */
function renderModsTable() {
    const modsTableBody = document.getElementById('modsTableBody');
    if (!modsTableBody) return;

    modsTableBody.innerHTML = '';
    mods.forEach(mod => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200';
        
        row.innerHTML = `
            <td class="py-3 px-6 text-sm whitespace-nowrap text-center font-medium">${mod.Title}</td>
            <td class="py-3 px-6 text-sm whitespace-nowrap text-center text-${getRarityColor(mod.Rarity)}-500">${mod.Rarity}</td>
            <td class="py-3 px-6 text-sm whitespace-nowrap text-center hidden md:table-cell">${mod.Stat}</td>
            <td class="py-3 px-6 text-sm whitespace-nowrap text-center">${mod.Amount}</td>
            <td class="py-3 px-6 text-sm whitespace-nowrap text-center">${(mod.Chance * 100).toFixed(2)}%</td>
            <td class="py-3 px-6 text-sm whitespace-normal text-left">${mod.Effect}</td>
        `;
        modsTableBody.appendChild(row);
    });
}

/**
 * Renders the tier list in the table.
 */
function renderTierListTable() {
    const tierListTableBody = document.getElementById('tierListTableBody');
    if (!tierListTableBody) return;

    tierListTableBody.innerHTML = '';
    if (tierList.length === 0) {
        document.getElementById('tierListTableContainer').classList.add('hidden');
        noTierListMessage.classList.remove('hidden');
    } else {
        document.getElementById('tierListTableContainer').classList.remove('hidden');
        noTierListMessage.classList.add('hidden');

        tierList.forEach(item => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200';

            row.innerHTML = `
                <td class="py-3 px-6 text-sm whitespace-nowrap text-center font-medium">${item.UnitName}</td>
                <td class="py-3 px-6 text-sm whitespace-nowrap text-center">${item.Tier}</td>
                <td class="py-3 px-6 text-sm whitespace-nowrap text-center">${item.NumericalRank}</td>
                <td class="py-3 px-6 text-sm whitespace-normal text-left">${item.Notes}</td>
            `;
            tierListTableBody.appendChild(row);
        });
    }
}


/**
 * A helper function to map rarity strings to Tailwind color classes.
 * @param {string} rarity The rarity string (e.g., 'Common', 'Rare').
 * @returns {string} The corresponding Tailwind color class prefix.
 */
function getRarityColor(rarity) {
  const rarityColors = {
    'Common': 'gray',
    'Uncommon': 'green',
    'Rare': 'blue',
    'Epic': 'purple',
    'Legendary': 'yellow',
    'Mythic': 'pink',
    'Demonic': 'red',
    'Ancient': 'indigo'
  };
  return rarityColors[rarity] || 'gray';
}


/**
 * Sorts the unit data and re-renders the table.
 * @param {string} column The column to sort by.
 */
function sortData(column) {
    if (currentSortColumn === column) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = column;
        currentSortDirection = 'asc';
    }
    filterAndRenderUnits();
}


/**
 * Toggles dark mode on the site.
 */
function toggleDarkMode() {
    document.documentElement.classList.toggle('dark');
    const isDarkMode = document.documentElement.classList.contains('dark');
    localStorage.setItem('darkMode', isDarkMode);
}

/**
 * Sets the initial dark mode state based on local storage or system preference.
 */
function setInitialDarkMode() {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDarkMode = localStorage.getItem('darkMode') === 'true' || (localStorage.getItem('darkMode') === null && prefersDark);
    if (isDarkMode) {
        document.documentElement.classList.add('dark');
    }
}


/**
 * Manages the visibility of the different tabs.
 * @param {string} activeTabId The ID of the tab to make active.
 */
function switchTab(activeTabId) {
    // Hide all main content sections
    document.querySelectorAll('.tab-content').forEach(section => {
        section.classList.add('hidden');
    });

    // Deactivate all tab buttons
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('border-b-2', 'border-blue-500', 'text-blue-500', 'dark:border-blue-400', 'dark:text-blue-400');
        button.classList.add('hover:text-gray-700', 'dark:hover:text-gray-300');
    });

    // Show the active content section
    const activeSection = document.getElementById(activeTabId.replace('Tab', 'Section'));
    if (activeSection) {
        activeSection.classList.remove('hidden');
    }

    // Activate the clicked tab button
    const activeTabButton = document.getElementById(activeTabId);
    if (activeTabButton) {
        activeTabButton.classList.add('border-b-2', 'border-blue-500', 'text-blue-500', 'dark:border-blue-400', 'dark:text-blue-400');
        activeTabButton.classList.remove('hover:text-gray-700', 'dark:hover:text-gray-300');
    }
}


/**
 * Shows the loading spinner.
 */
function showLoadingSpinner() {
    if (loadingSpinner) {
        loadingSpinner.classList.remove('hidden');
        unitTableContainer.classList.add('hidden');
    }
}

/**
 * Hides the loading spinner.
 */
function hideLoadingSpinner() {
    if (loadingSpinner) {
        loadingSpinner.classList.add('hidden');
    }
}


// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Set up initial dark mode
    setInitialDarkMode();
    
    // Load all data from the Google Sheet
    loadGameData();

    // Use a debounced function for the search input to improve performance
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
        maxLevelInputContainer.classList.toggle('hidden', !maxLevelGlobalEnabled);
        filterAndRenderUnits();
    });
    
    // Max Level Input Event
    maxLevelInput.addEventListener('input', debounce(filterAndRenderUnits, 300));

    // Set default tab
    switchTab('unitsTab');
});

