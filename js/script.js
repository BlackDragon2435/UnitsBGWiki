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
    'Image', 'Label', 'Class', 'Rarity', 'CommunityRanking', 'HP', 'Damage', 'DPS'
];

// Define ALL possible unit stats for the detailed dropdown view
const allUnitStatsForDropdown = [
    'Label', 'Class', 'Rarity', 'HP', 'Damage', 'DPS', 'Distance',
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

    if (!headerFound) {
        console.error("Could not find a valid header row in the CSV data.");
        return [];
    }

    const data = [];
    for (let i = dataStartIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '') continue;

        const values = parseCSVLine(line);
        const rowObject = {};

        headers.forEach((header, index) => {
            let value = values[index];
            if (value === undefined) {
                value = ""; // Handle missing values gracefully
            }
            // Try to convert string values to numbers or booleans
            if (value.toLowerCase() === 'true') {
                value = true;
            } else if (value.toLowerCase() === 'false') {
                value = false;
            } else if (!isNaN(value) && value.trim() !== '') {
                value = Number(value);
            } else if (value === 'N/A' || value === 'n/a') {
                value = 'N/A';
            }
            rowObject[header.trim()] = value;
        });

        // Add a unique ID to each row for tracking purposes
        rowObject.id = `row-${data.length}`;
        data.push(rowObject);
    }
    return data;
}

// Function to handle complex CSV lines with commas inside quotes
function parseCSVLine(line) {
    const result = [];
    let inQuote = false;
    let currentField = '';

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1] || '';

        if (char === '"' && nextChar === '"') {
            currentField += '"';
            i++; // Skip the next quote
        } else if (char === '"') {
            inQuote = !inQuote;
        } else if (char === ',' && !inQuote) {
            result.push(currentField.trim());
            currentField = '';
        } else {
            currentField += char;
        }
    }
    result.push(currentField.trim());
    return result;
}

/**
 * Calculates DPS based on Damage and Cooldown.
 * Prevents division by zero.
 * @param {object} unit - The unit object.
 * @returns {number|string} The calculated DPS, or 'N/A' if cooldown is invalid.
 */
function calculateDPS(unit) {
    // If Cooldown is 0, Damage / 0 is Infinity. If Cooldown is N/A, Damage / N/A is NaN.
    // In both cases, we should display N/A.
    if (unit.Cooldown === 0 || unit.Cooldown === 'N/A' || typeof unit.Cooldown !== 'number') {
        return 'N/A';
    }
    const damage = typeof unit.Damage === 'number' ? unit.Damage : 0;
    return (damage / unit.Cooldown).toFixed(2);
}

/**
 * Handles toggling dark mode.
 */
function toggleDarkMode() {
    const isDarkMode = document.body.classList.toggle('dark');
    localStorage.setItem('darkMode', isDarkMode);
    if (isDarkMode) {
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
    } else {
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
    }
}

/**
 * Switches between content tabs.
 * @param {string} tabId - The ID of the tab to switch to.
 */
function switchTab(tabId) {
    // Hide all tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
        content.classList.remove('active');
    });
    // Remove active class from all tabs
    document.querySelectorAll('[id$="Tab"]').forEach(tab => {
        tab.classList.remove('active-tab');
    });

    // Show the selected tab's content
    const selectedContent = document.getElementById(`${tabId.replace('Tab', 'Content')}`);
    if (selectedContent) {
        selectedContent.classList.remove('hidden');
        selectedContent.classList.add('active');
        document.getElementById(tabId).classList.add('active-tab');
    }

    // Call render functions for the active tab
    if (tabId === 'unitsTab') {
        filterAndRenderUnits();
    } else if (tabId === 'modsTab') {
        renderMods();
    } else if (tabId === 'tierListTab') {
        renderTierList();
    }
}


/**
 * Renders the units table with the filtered and sorted data.
 * @param {Array<Object>} filteredUnits - The units to render.
 */
function renderUnits(filteredUnits) {
    // Clear the existing table body
    unitTableBody.innerHTML = '';
    expandedUnitRowId = null; // Reset expanded row

    // Check if there are no results and display a message
    if (filteredUnits.length === 0) {
        noResultsMessage.classList.remove('hidden');
        unitTableContainer.classList.add('hidden');
        return;
    } else {
        noResultsMessage.classList.add('hidden');
        unitTableContainer.classList.remove('hidden');
    }

    filteredUnits.forEach(unit => {
        // Main unit row
        const row = document.createElement('tr');
        row.classList.add('border-b', 'border-gray-200', 'dark:border-gray-600', 'cursor-pointer', 'hover:bg-gray-100', 'dark:hover:bg-gray-600', 'transition-colors', 'duration-150');
        row.dataset.id = unit.id; // Store the unique ID

        // Create the cells based on the defined order
        unitColumnOrder.forEach(column => {
            const cell = document.createElement('td');
            cell.classList.add('p-3', 'text-sm', 'text-gray-900', 'dark:text-gray-100', 'whitespace-nowrap', 'text-center');

            if (column === 'Image') {
                const img = document.createElement('img');
                const imageUrl = unit.Image || unitImages[unit.Label] || 'https://placehold.co/50x50/e2e8f0/1a202c?text=IMG';
                img.src = imageUrl;
                img.alt = unit.Label;
                img.classList.add('w-12', 'h-12', 'object-contain', 'mx-auto', 'rounded-full', 'p-1', 'shadow-md', 'bg-white', 'dark:bg-gray-800');
                // Set a simple rarity border based on the unit's rarity
                const rarityColor = gameData.RarityColors[unit.Rarity]?.color || '#FFFFFF';
                img.style.borderColor = rarityColor;
                img.style.borderWidth = '2px';
                img.style.borderStyle = 'solid';
                cell.appendChild(img);
            } else if (column === 'Rarity') {
                const rarityText = document.createElement('span');
                rarityText.textContent = unit.Rarity;
                rarityText.classList.add('font-medium');
                const rarityColor = gameData.RarityColors[unit.Rarity]?.color || '#FFFFFF';
                rarityText.style.color = rarityColor;
                cell.appendChild(rarityText);
            } else if (column === 'Class') {
                const classText = document.createElement('span');
                classText.textContent = unit.Class;
                classText.classList.add('font-medium');
                const classColor = gameData.ClassesColors[unit.Class]?.color || '#FFFFFF';
                classText.style.color = classColor;
                cell.appendChild(classText);
            } else if (column === 'HP' || column === 'Damage' || column === 'DPS') {
                // Display the stat
                let value = unit[column];
                cell.textContent = value;
            } else {
                cell.textContent = unit[column] || 'N/A';
            }
            row.appendChild(cell);
        });

        unitTableBody.appendChild(row);
    });
}

/**
 * Renders the detailed dropdown row for a unit.
 * @param {Object} unit - The unit object.
 * @param {HTMLTableRowElement} parentRow - The main table row to append the details to.
 */
function renderUnitDetails(unit, parentRow) {
    const detailsRow = document.createElement('tr');
    detailsRow.classList.add('expanded-details-row', 'bg-gray-50', 'dark:bg-gray-800', 'border-b', 'border-gray-300', 'dark:border-gray-700');
    detailsRow.id = `details-${unit.id}`;

    const detailsCell = document.createElement('td');
    detailsCell.colSpan = unitColumnOrder.length; // Span across all columns
    detailsCell.classList.add('p-4');

    const detailsContent = document.createElement('div');
    detailsContent.classList.add('expanded-details-content');

    const title = document.createElement('h3');
    title.textContent = `${unit.Label} - Detailed Stats`;
    title.classList.add('text-lg', 'font-bold', 'mb-2', 'text-gray-900', 'dark:text-gray-100');
    detailsContent.appendChild(title);

    // Create a container for the stats
    const statsGrid = document.createElement('div');
    statsGrid.classList.add('grid', 'grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3', 'gap-4');

    // Display all detailed stats
    allUnitStatsForDropdown.forEach(statKey => {
        let value = unit[statKey] !== undefined ? unit[statKey] : 'N/A';
        
        // Custom formatting for specific stats
        if (statKey === 'DPS') {
             value = calculateDPS(unit);
        } else if (statKey === 'Cooldown' && unit.DPS !== 'N/A') {
             // We replaced Cooldown with DPS, so we can skip this here.
             return;
        } else if (statKey === 'Distance') {
            value = `${value} m`;
        } else if (statKey === 'CritChance' || statKey === 'CritDamage' || statKey === 'Accuracy' || statKey === 'EvadeChance') {
             value = `${value * 100}%`;
        } else if (statKey === 'AttackEffect') {
            const modTitle = unit.ModTitle || 'None';
            value = `${value} (${modTitle})`;
        } else if (statKey === 'Image' || statKey === 'Description' || statKey === 'AttackEffectType' || statKey === 'ModTitle' || statKey === 'ModRarity') {
            return; // Skip these as they are handled elsewhere or not needed
        }

        const statElement = document.createElement('p');
        statElement.innerHTML = `<strong>${statKey}:</strong> ${value}`;
        statsGrid.appendChild(statElement);
    });

    detailsContent.appendChild(statsGrid);
    detailsCell.appendChild(detailsContent);
    detailsRow.appendChild(detailsCell);

    // Insert the new row immediately after the parent row
    parentRow.insertAdjacentElement('afterend', detailsRow);
}

/**
 * Main function to filter and render units based on current filters and search.
 */
function filterAndRenderUnits() {
    const searchTerm = normalizeString(searchInput.value);
    const selectedRarity = rarityFilter.value;
    const selectedClass = classFilter.value;

    const filtered = units.filter(unit => {
        const matchesSearch = searchTerm === '' || normalizeString(unit.Label).includes(searchTerm);
        const matchesRarity = selectedRarity === 'all' || unit.Rarity === selectedRarity;
        const matchesClass = selectedClass === 'all' || unit.Class === selectedClass;
        return matchesSearch && matchesRarity && matchesClass;
    });

    // Apply global max level if enabled
    const unitsToRender = filtered.map(unit => {
        if (maxLevelGlobalEnabled) {
            return {
                ...unit,
                HP: unit.MaxLevelHP,
                Damage: unit.MaxLevelDamage,
                DPS: calculateDPS({ ...unit, Damage: unit.MaxLevelDamage }),
            };
        }
        return unit;
    });

    sortData(currentSortColumn, unitsToRender);
}


/**
 * Renders the Mods table.
 */
function renderMods() {
    modsTableBody.innerHTML = '';
    const modsToRender = mods;

    if (modsToRender.length === 0) {
        document.getElementById('noModsMessage').classList.remove('hidden');
        document.getElementById('modsTableContainer').classList.add('hidden');
        return;
    } else {
        document.getElementById('noModsMessage').classList.add('hidden');
        document.getElementById('modsTableContainer').classList.remove('hidden');
    }

    modsToRender.forEach(mod => {
        const row = document.createElement('tr');
        row.classList.add('bg-white', 'border-b', 'border-gray-200', 'dark:bg-gray-700', 'dark:border-gray-600', 'hover:bg-gray-100', 'dark:hover:bg-gray-600', 'transition-colors', 'duration-150');

        // Name
        const nameCell = document.createElement('td');
        nameCell.classList.add('p-3', 'text-sm', 'text-gray-900', 'dark:text-gray-100', 'text-center');
        nameCell.textContent = mod.Title;
        row.appendChild(nameCell);

        // Rarity
        const rarityCell = document.createElement('td');
        rarityCell.classList.add('p-3', 'text-sm', 'text-gray-900', 'dark:text-gray-100', 'text-center');
        const rarityText = document.createElement('span');
        rarityText.textContent = mod.Rarity;
        rarityText.classList.add('font-medium');
        const rarityColor = gameData.RarityColors[mod.Rarity]?.color || '#FFFFFF';
        rarityText.style.color = rarityColor;
        rarityCell.appendChild(rarityText);
        row.appendChild(rarityCell);
        
        // Effect
        const effectCell = document.createElement('td');
        effectCell.classList.add('p-3', 'text-sm', 'text-gray-900', 'dark:text-gray-100');
        effectCell.textContent = mod.Effect;
        row.appendChild(effectCell);

        modsTableBody.appendChild(row);
    });
}

/**
 * Renders the Tier List table.
 */
function renderTierList() {
    tierListTableBody.innerHTML = '';
    const tierListToRender = tierList;

    if (tierListToRender.length === 0) {
        noTierListMessage.classList.remove('hidden');
        tierListTableContainer.classList.add('hidden');
        return;
    } else {
        noTierListMessage.classList.add('hidden');
        tierListTableContainer.classList.remove('hidden');
    }

    tierListToRender.forEach(item => {
        const row = document.createElement('tr');
        row.classList.add('bg-white', 'border-b', 'border-gray-200', 'dark:bg-gray-700', 'dark:border-gray-600', 'hover:bg-gray-100', 'dark:hover:bg-gray-600', 'transition-colors', 'duration-150');

        const unitNameCell = document.createElement('td');
        unitNameCell.classList.add('p-3', 'text-sm', 'text-gray-900', 'dark:text-gray-100', 'text-center');
        unitNameCell.textContent = item.UnitName;
        row.appendChild(unitNameCell);

        const tierCell = document.createElement('td');
        tierCell.classList.add('p-3', 'text-sm', 'text-gray-900', 'dark:text-gray-100', 'text-center');
        tierCell.textContent = item.Tier;
        row.appendChild(tierCell);

        const rankCell = document.createElement('td');
        rankCell.classList.add('p-3', 'text-sm', 'text-gray-900', 'dark:text-gray-100', 'text-center');
        rankCell.textContent = item.NumericalRank;
        row.appendChild(rankCell);

        const notesCell = document.createElement('td');
        notesCell.classList.add('p-3', 'text-sm', 'text-gray-900', 'dark:text-gray-100');
        notesCell.textContent = item.Notes;
        row.appendChild(notesCell);

        tierListTableBody.appendChild(row);
    });
}

/**
 * Sorts the data array and re-renders the table.
 * @param {string} column - The column to sort by.
 * @param {Array<Object>} [data=units] - The data array to sort. Defaults to the global `units` array.
 */
function sortData(column, data = units) {
    if (!column) {
        renderUnits(data);
        return;
    }

    // Toggle sort direction
    if (currentSortColumn === column) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = column;
        currentSortDirection = 'asc';
    }

    // Sort the units array based on the column and direction
    data.sort((a, b) => {
        const valA = a[column];
        const valB = b[column];

        // Handle string vs. number comparison
        if (typeof valA === 'string' && typeof valB === 'string') {
            return currentSortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else {
            // Treat 'N/A' as a special case for sorting
            const numA = (valA === 'N/A' || isNaN(valA)) ? (currentSortDirection === 'asc' ? Infinity : -Infinity) : valA;
            const numB = (valB === 'N/A' || isNaN(valB)) ? (currentSortDirection === 'asc' ? Infinity : -Infinity) : valB;
            return currentSortDirection === 'asc' ? numA - numB : numB - numA;
        }
    });

    renderUnits(data);
}


// --- Event Listeners and Initialization ---

// Initialization function to fetch data and set up the app
async function init() {
    // Check for dark mode preference
    if (localStorage.getItem('darkMode') === 'true' || window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.body.classList.add('dark');
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
    }

    // Fetch all data concurrently
    const [unitsData, modsData, tierListData] = await Promise.all([
        fetchGoogleSheetCSVData(GOOGLE_SHEET_UNIT_DATA_CSV_URL, loadingSpinner, unitTableContainer, noResultsMessage),
        fetchGoogleSheetCSVData(GOOGLE_SHEET_MOD_DATA_CSV_URL, document.getElementById('modsSpinner'), document.getElementById('modsTableContainer'), document.getElementById('noModsMessage')),
        fetchGoogleSheetCSVData(GOOGLE_SHEET_TIER_LIST_CSV_URL, document.getElementById('tierListSpinner'), document.getElementById('tierListTableContainer'), document.getElementById('noTierListMessage')),
    ]);

    // Process and store the data
    if (unitsData) {
        units = unitsData;
        // Calculate DPS for each unit and add it to the object
        units.forEach(unit => {
            unit.DPS = calculateDPS(unit);
        });
        filterAndRenderUnits();
        populateFilters();
    }
    if (modsData) {
        mods = modsData;
    }
    if (tierListData) {
        tierList = tierListData;
    }
    
    // Switch to the default units tab
    switchTab('unitsTab');
}

/**
 * Populates the rarity and class filter dropdowns based on the fetched data.
 */
function populateFilters() {
    // Populate rarity filter
    const uniqueRarities = [...new Set(units.map(unit => unit.Rarity))];
    rarityOrder.forEach(rarity => {
        if (uniqueRarities.includes(rarity)) {
            const option = document.createElement('option');
            option.value = rarity;
            option.textContent = rarity;
            rarityFilter.appendChild(option);
        }
    });

    // Populate class filter
    const uniqueClasses = [...new Set(units.map(unit => unit.Class))].sort();
    uniqueClasses.forEach(unitClass => {
        const option = document.createElement('option');
        option.value = unitClass;
        option.textContent = unitClass;
        classFilter.appendChild(option);
    });
}

// Global Event Listeners
window.onload = init;

window.addEventListener('load', () => {
    // Units Tab filters and search
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

    // Global Max Level Toggle Event
    toggleMaxLevel.addEventListener('change', () => {
        maxLevelGlobalEnabled = toggleMaxLevel.checked;
        filterAndRenderUnits(); // Re-render units to apply/remove global max level effects
    });

    // Event Delegation for expanding/collapsing table rows
    unitTableBody.addEventListener('click', (event) => {
        const row = event.target.closest('tr');
        if (!row || row.classList.contains('expanded-details-row')) return;

        const unitId = row.dataset.id;
        const existingDetailsRow = document.getElementById(`details-${unitId}`);

        // If a row is already expanded, collapse it
        if (expandedUnitRowId && expandedUnitRowId !== unitId) {
            const oldDetailsRow = document.getElementById(`details-${expandedUnitRowId}`);
            if (oldDetailsRow) oldDetailsRow.remove();
        }

        // Toggle the current row's details
        if (existingDetailsRow) {
            existingDetailsRow.remove();
            expandedUnitRowId = null;
        } else {
            const unit = units.find(u => u.id === unitId);
            if (unit) {
                renderUnitDetails(unit, row);
                expandedUnitRowId = unitId;
            }
        }
    });
});
