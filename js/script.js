// js/script.js
// why you looking here?
// import { rawUnitData } from './unitsData.js';
// import { rawModData } from './modsData.js';
import { gameData } from './gameData.js'; // Import gameData

// IMPORTANT: Base URL for your published Google Sheet
// This URL should point to your Google Sheet published to web as CSV.
// The specific sheets are then targeted using '&gid={sheet_id}'
const GOOGLE_SHEET_BASE_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQO78VJA7y_g5zHpzw1gTaJhLV2mjNdRxA33zcj1WPFj-QYxQS09nInTQXg6kXNJcjm4f7Gk7lPVZuV/pub?output=csv';

// Specific URLs for each sheet using their GIDs
const GOOGLE_SHEET_UNIT_DATA_CSV_URL = GOOGLE_SHEET_BASE_URL + '&gid=201310748'; // Unit Info (Sheet 1)
const GOOGLE_SHEET_TIER_LIST_CSV_URL = GOOGLE_SHEET_BASE_URL + '&gid=0'; // Tier List (Sheet 2)
const GOOGLE_SHEET_MOD_DATA_CSV_URL = GOOGLE_SHEET_BASE_URL + '&gid=331730679'; // Mod List (Sheet 3)

let units = []; // Stores parsed unit data
let mods = [];  // Stores parsed mod data
let tierList = []; // Stores parsed tier list data
const selectedMods = new Map(); // Stores the selected mod for each unit using its Label as key
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
const modsTableBody = document.getElementById('modsTableBody');
const tierListTableBody = document.getElementById('tierListTableBody');
const tierListTableContainer = document.getElementById('tierListTableContainer');
const noTierListMessage = document.getElementById('noTierListMessage');
const modsTableContainer = document.getElementById('modsTableContainer');
const noModsMessage = document.getElementById('noModsMessage');

// Helper function to debounce an event listener
const debounce = (func, delay) => {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
};

// Helper function to parse CSV text into an array of objects
const parseCSV = (csvText) => {
    // Split the text into lines and handle potential carriage returns
    const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) return [];

    // Split the first line to get headers, trimming whitespace and removing quotes
    const headers = lines[0].split(',').map(header => header.trim().replace(/"/g, ''));

    // Map the remaining lines to an array of objects
    return lines.slice(1).map(line => {
        const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(value => value.trim().replace(/"/g, ''));
        return headers.reduce((obj, header, index) => {
            const value = values[index];
            // Convert numerical strings to numbers, and "N/A" to null
            obj[header] = !isNaN(value) && value !== '' ? Number(value) : (value === 'N/A' ? null : value);
            return obj;
        }, {});
    });
};

// Function to calculate final stats based on mods and level
const calculateFinalStats = (unit, isMaxLevel, selectedModTitle) => {
    const finalStats = { ...unit };
    
    // Apply level modifiers
    if (isMaxLevel) {
        const levelModifier = gameData.Leveling[3]; // Assuming max level is 3
        if (levelModifier) {
            if (finalStats.HP && levelModifier.HP) {
                finalStats.HP += finalStats.HP * levelModifier.HP._value;
            }
            if (finalStats.Damage && levelModifier.Damage) {
                finalStats.Damage += finalStats.Damage * levelModifier.Damage._value;
            }
        }
    }

    // Apply selected mod effect
    if (selectedModTitle && selectedModTitle !== 'None') {
        const selectedMod = mods.find(mod => mod.Title === selectedModTitle);
        if (selectedMod && selectedMod.Stat && selectedMod.Amount) {
            if (finalStats[selectedMod.Stat] !== null && finalStats[selectedMod.Stat] !== undefined) {
                // Apply the mod effect to the relevant stat
                finalStats[selectedMod.Stat] += finalStats[selectedMod.Stat] * selectedMod.Amount;
            }
        }
    }
    
    // Calculate DPS
    if (finalStats.Damage !== null && finalStats.Cooldown !== null && finalStats.Cooldown > 0) {
        finalStats.DPS = finalStats.Damage / finalStats.Cooldown;
    } else {
        finalStats.DPS = null;
    }

    // Round numerical values for display
    for (const key in finalStats) {
        if (typeof finalStats[key] === 'number') {
            finalStats[key] = parseFloat(finalStats[key].toFixed(2));
        }
    }

    return finalStats;
};


// Function to fetch data from a CSV URL
const fetchData = async (url) => {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const csvText = await response.text();
        return parseCSV(csvText);
    } catch (e) {
        console.error(`Could not fetch data from ${url}:`, e);
        return null;
    }
};

// Function to render the units table
const renderUnitsTable = (unitsToRender) => {
    unitTableBody.innerHTML = '';
    if (unitsToRender.length === 0) {
        unitTableContainer.classList.add('hidden');
        noResultsMessage.classList.remove('hidden');
        return;
    }
    noResultsMessage.classList.add('hidden');
    unitTableContainer.classList.remove('hidden');

    unitsToRender.forEach(unit => {
        const selectedModTitle = selectedMods.get(unit.Label) || 'None';
        const finalStats = calculateFinalStats(unit, maxLevelGlobalEnabled, selectedModTitle);
        const row = document.createElement('tr');
        row.classList.add('hover:bg-gray-100', 'dark:hover:bg-gray-700', 'transition-colors', 'duration-200');
        
        // Handle "Community Rank" display
        const communityRank = unit.Tier && unit.NumericalRank ? `${unit.Tier} (${unit.NumericalRank})` : 'N/A';

        // Create the mod dropdown
        const modDropdown = document.createElement('select');
        modDropdown.classList.add('bg-gray-200', 'dark:bg-gray-700', 'px-2', 'py-1', 'rounded-md', 'text-sm', 'cursor-pointer');
        modDropdown.innerHTML = `<option value="None">None</option>` + mods.map(mod => `<option value="${mod.Title}" ${selectedModTitle === mod.Title ? 'selected' : ''}>${mod.Title}</option>`).join('');

        // Add event listener to update stats when a new mod is selected
        modDropdown.addEventListener('change', (e) => {
            const newModTitle = e.target.value;
            selectedMods.set(unit.Label, newModTitle);
            updateUnitRow(row, unit, newModTitle);
        });

        // Set up the row content
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-center">
                ${unit.ImageURL ? `<img src="${unit.ImageURL}" alt="${unit.Label}" class="w-10 h-10 rounded-full mx-auto object-cover">` : `<div class="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 mx-auto flex items-center justify-center text-xs text-gray-500">No Img</div>`}
            </td>
            <td class="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-gray-100">${unit.Label}</td>
            <td class="px-6 py-4 whitespace-nowrap text-center">${unit.Rarity}</td>
            <td class="px-6 py-4 whitespace-nowrap text-center">${unit.Class}</td>
            <td class="px-6 py-4 whitespace-nowrap text-center">${finalStats.HP}</td>
            <td class="px-6 py-4 whitespace-nowrap text-center">${finalStats.Damage}</td>
            <td class="px-6 py-4 whitespace-nowrap text-center">${finalStats.DPS !== null ? finalStats.DPS : 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-center" id="mod-dropdown-${unit.Label.replace(/\s+/g, '-')}"></td>
            <td class="px-6 py-4 whitespace-nowrap text-center">${communityRank}</td>
        `;

        unitTableBody.appendChild(row);
        document.getElementById(`mod-dropdown-${unit.Label.replace(/\s+/g, '-')}`).appendChild(modDropdown);
    });
};

// Function to update a single unit row with new stats
const updateUnitRow = (row, unit, selectedModTitle) => {
    const finalStats = calculateFinalStats(unit, maxLevelGlobalEnabled, selectedModTitle);
    
    // Find the correct cells and update their content
    const cells = row.querySelectorAll('td');
    cells[4].textContent = finalStats.HP;
    cells[5].textContent = finalStats.Damage;
    cells[6].textContent = finalStats.DPS !== null ? finalStats.DPS : 'N/A';
};

// Function to render the mods table
const renderModsTable = (modsToRender) => {
    modsTableBody.innerHTML = '';
    if (!modsToRender || modsToRender.length === 0) {
        modsTableContainer.classList.add('hidden');
        noModsMessage.classList.remove('hidden');
        return;
    }
    noModsMessage.classList.add('hidden');
    modsTableContainer.classList.remove('hidden');

    modsToRender.forEach(mod => {
        const row = document.createElement('tr');
        row.classList.add('hover:bg-gray-100', 'dark:hover:bg-gray-700', 'transition-colors', 'duration-200');
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-gray-100">${mod.Title}</td>
            <td class="px-6 py-4 whitespace-nowrap">${mod.Rarity}</td>
            <td class="px-6 py-4 whitespace-nowrap">${mod.Effect}</td>
            <td class="px-6 py-4 whitespace-nowrap">${mod.Stat}</td>
            <td class="px-6 py-4 whitespace-nowrap">${mod.Amount}</td>
            <td class="px-6 py-4 whitespace-nowrap">${mod.Chance}</td>
        `;
        modsTableBody.appendChild(row);
    });
};

// Function to render the tier list table
const renderTierListTable = (tierListToRender) => {
    tierListTableBody.innerHTML = '';
    if (!tierListToRender || tierListToRender.length === 0) {
        tierListTableContainer.classList.add('hidden');
        noTierListMessage.classList.remove('hidden');
        return;
    }
    noTierListMessage.classList.add('hidden');
    tierListTableContainer.classList.remove('hidden');

    tierListToRender.forEach(tierItem => {
        const row = document.createElement('tr');
        row.classList.add('hover:bg-gray-100', 'dark:hover:bg-gray-700', 'transition-colors', 'duration-200');
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-gray-100">${tierItem.UnitName}</td>
            <td class="px-6 py-4 whitespace-nowrap">${tierItem.Tier}</td>
            <td class="px-6 py-4 whitespace-nowrap">${tierItem.NumericalRank}</td>
            <td class="px-6 py-4">${tierItem.Notes}</td>
        `;
        tierListTableBody.appendChild(row);
    });
};

// Function to populate filter options
const populateFilters = () => {
    const allRarities = [...new Set(units.map(unit => unit.Rarity))].sort();
    const allClasses = [...new Set(units.map(unit => unit.Class))].sort();

    rarityFilter.innerHTML = '<option value="">All Rarities</option>';
    allRarities.forEach(rarity => {
        const option = document.createElement('option');
        option.value = rarity;
        option.textContent = rarity;
        rarityFilter.appendChild(option);
    });

    classFilter.innerHTML = '<option value="">All Classes</option>';
    allClasses.forEach(unitClass => {
        const option = document.createElement('option');
        option.value = unitClass;
        option.textContent = unitClass;
        classFilter.appendChild(option);
    });
};

// Main function to filter and render units
const filterAndRenderUnits = () => {
    let filteredUnits = [...units];
    const searchValue = searchInput.value.toLowerCase();
    const selectedRarity = rarityFilter.value;
    const selectedClass = classFilter.value;

    // Filter by search input
    if (searchValue) {
        filteredUnits = filteredUnits.filter(unit =>
            unit.Label.toLowerCase().includes(searchValue)
        );
    }

    // Filter by rarity
    if (selectedRarity) {
        filteredUnits = filteredUnits.filter(unit => unit.Rarity === selectedRarity);
    }

    // Filter by class
    if (selectedClass) {
        filteredUnits = filteredUnits.filter(unit => unit.Class === selectedClass);
    }

    // Apply sorting
    if (currentSortColumn) {
        // Create a copy to sort and apply calculated stats for sorting
        const unitsWithStats = filteredUnits.map(unit => {
            const selectedModTitle = selectedMods.get(unit.Label) || 'None';
            return { ...unit, ...calculateFinalStats(unit, maxLevelGlobalEnabled, selectedModTitle) };
        });

        unitsWithStats.sort((a, b) => {
            const aValue = a[currentSortColumn];
            const bValue = b[currentSortColumn];

            // Handle "N/A" and null as a low value for sorting
            const valA = aValue === "N/A" || aValue === null ? (currentSortDirection === 'asc' ? -Infinity : Infinity) : aValue;
            const valB = bValue === "N/A" || bValue === null ? (currentSortDirection === 'asc' ? -Infinity : Infinity) : bValue;

            if (valA < valB) return currentSortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return currentSortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        // Re-order the original filtered units array to match the sort
        filteredUnits = unitsWithStats.map(sortedUnit => units.find(unit => unit.Label === sortedUnit.Label));
    }
    
    renderUnitsTable(filteredUnits);
};

// Sorting function
const sortData = (column) => {
    if (currentSortColumn === column) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = column;
        currentSortDirection = 'asc';
    }
    filterAndRenderUnits();
};

// Dark Mode Toggling
const toggleDarkMode = () => {
    const isDarkMode = document.body.classList.toggle('dark');
    localStorage.setItem('darkMode', isDarkMode);
    sunIcon.classList.toggle('hidden', !isDarkMode);
    moonIcon.classList.toggle('hidden', isDarkMode);
};

// Tab Switching
const switchTab = (tabId) => {
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });

    const activeTabContent = document.getElementById(tabId.replace('Tab', 'Content'));
    const activeTabButton = document.getElementById(tabId);
    if (activeTabContent) {
        activeTabContent.classList.remove('hidden');
    }
    if (activeTabButton) {
        activeTabButton.classList.add('active');
    }

    // Render tables when their tab is switched to
    if (tabId === 'unitsTab') {
        filterAndRenderUnits();
    } else if (tabId === 'modsTab') {
        renderModsTable(mods);
    } else if (tabId === 'tierListTab') {
        renderTierListTable(tierList);
    }
};

// Initialize the app on window load
window.onload = async () => {
    // Check for dark mode preference
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark');
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
    } else {
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
    }

    loadingSpinner.classList.remove('hidden');

    // Fetch all data concurrently
    const [unitData, modData, tierListData] = await Promise.all([
        fetchData(GOOGLE_SHEET_UNIT_DATA_CSV_URL),
        fetchData(GOOGLE_SHEET_MOD_DATA_CSV_URL),
        fetchData(GOOGLE_SHEET_TIER_LIST_CSV_URL)
    ]);

    if (unitData) {
        units = unitData;
        
        // Merge tier list data into units
        if (tierListData) {
            units = units.map(unit => {
                const matchingTier = tierListData.find(tierItem => tierItem.UnitName === unit.Label);
                return { ...unit, Tier: matchingTier?.Tier || 'N/A', NumericalRank: matchingTier?.NumericalRank || 'N/A' };
            });
        }
        
        populateFilters();
        filterAndRenderUnits(); // Initial render of units
    }

    if (modData) {
        mods = modData;
    }

    if (tierListData) {
        tierList = tierListData;
    }

    loadingSpinner.classList.add('hidden');

    // Filter, Search, and Sort Events
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

    // Global Max Level Toggle Event
    toggleMaxLevel.addEventListener('change', () => {
        maxLevelGlobalEnabled = toggleMaxLevel.checked;
        // Re-render units to apply/remove global max level effects
        filterAndRenderUnits();
    });
};
