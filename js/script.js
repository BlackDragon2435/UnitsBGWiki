// js/script.js
// why you looking here?

// Define game data with colors directly in this file
const gameData = {
    RarityColors: {
        'Common': { color: '#4CAF50' }, // Green
        'Uncommon': { color: '#A5D6A7' }, // Light Green
        'Rare': { color: '#2196F3' }, // Blue
        'Legendary': { color: '#FFEB3B' }, // Yellow
        'Mythic': { color: '#F44336' }, // Red
        'Demonic': { color: '#9C27B0' }, // Purple
        'Ancient': { color: '#FFFFFF' } // White
    },
    ClassesColors: {
        'Tank': { color: '#FF7043' },
        'Melee DPS': { color: '#FBC02D' },
        'Ranged DPS': { color: '#03A9F4' },
        'Healer': { color: '#4CAF50' },
        'Support': { color: '#9575CD' },
        'Ranged Dps': { color: '#03A9F4' }, // Account for potential spelling variations
        'Mage': { color: '#5C6BC0' },
        'Fighter': { color: '#FFB74D' },
    }
};

// IMPORTANT: Base URL for your published Google Sheet
// This URL should point to your Google Sheet published to web as CSV.
// The specific sheets are then targeted using '&gid={sheet_id}'
const GOOGLE_SHEET_BASE_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQO78VJA7y_g5zHpzw1gTaJhLV2mjNdRxA33zcj1WPFj-QYxQS09nInTQXg6kXNJcjm4f7Gk7lPVZuV/pub?output=csv';

// Specific URLs for each sheet using their GIDs
const GOOGLE_SHEET_UNIT_DATA_CSV_URL = GOOGLE_SHEET_BASE_URL + '&gid=201310748&single=true'; // Unit Info (Sheet 1)
const GOOGLE_SHEET_TIER_LIST_CSV_URL = GOOGLE_SHEET_BASE_URL + '&gid=0&single=true'; // Tier List (Sheet 2)
const GOOGLE_SHEET_MOD_DATA_CSV_URL = GOOGLE_SHEET_BASE_URL + '&gid=331730679&single=true'; // Mod Info (Sheet 3)

// Global variables to store fetched data
let allUnits = []; // All units from the data source
let filteredAndSortedUnits = []; // Units that have been filtered and sorted
let allMods = [];
let tierList = [];

// DOM elements
const loadingSpinner = document.getElementById('loadingSpinner');
const unitTableBody = document.getElementById('unitTableBody');
const modTableBody = document.getElementById('modTableBody');
const tierListTableBody = document.getElementById('tierListTableBody');
const searchInput = document.getElementById('searchInput');
const rarityFilter = document.getElementById('rarityFilter');
const classFilter = document.getElementById('classFilter');
const tableHeaders = document.querySelectorAll('#unitsTable th[data-sort]');
const unitsTab = document.getElementById('unitsTab');
const modsTab = document.getElementById('modsTab');
const tierListTab = document.getElementById('tierListTab');
const unitsSection = document.getElementById('unitsSection');
const modsSection = document.getElementById('modsSection');
const tierListSection = document.getElementById('tierListSection');
const noUnitsMessage = document.getElementById('noUnitsMessage');
const noModsMessage = document.getElementById('noModsMessage');
const noTierListMessage = document.getElementById('noTierListMessage');
const darkModeToggle = document.getElementById('darkModeToggle');
const toggleModEffects = document.getElementById('toggleModEffects');
const toggleMaxLevel = document.getElementById('toggleMaxLevel');

// State variables
let currentSortColumn = 'UnitName';
let sortDirection = 'asc';
let expandedUnitRowId = null;
let modEffectsEnabled = false; // Flag to enable/disable mod effects
let maxLevelGlobalEnabled = false; // Flag to enable/disable global max level effects

// Utility functions
const debounce = (func, delay) => {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
};

// Function to safely get image URLs
const getUnitImage = (unitName) => {
    // Replace spaces and special characters with underscores and lowercase the string
    const formattedName = unitName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    // Use a placeholder image for units not found
    // Using a reliable placeholder service with a default color and text
    const placeholderUrl = `https://placehold.co/100x100/1e40af/ffffff?text=${encodeURIComponent(unitName)}`;
    // The placeholder text is generated with the unit's name
    return `https://dummyimage.com/100x100/1e40af/fff&text=${formattedName}` || placeholderUrl;
};

// Function to fetch CSV data from Google Sheets
const fetchCsvData = async (url) => {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text();
        return parseCsv(text);
    } catch (error) {
        console.error('Failed to fetch CSV data:', error);
        return null;
    }
};

// Function to parse CSV text into an array of objects
const parseCsv = (csvText) => {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(header => header.trim().replace(/"/g, ''));
    const data = lines.slice(1).map(line => {
        const values = line.split(',').map(value => value.trim().replace(/"/g, ''));
        const obj = {};
        headers.forEach((header, i) => {
            let value = values[i];
            // Attempt to convert to number if possible
            if (!isNaN(value) && value !== '') {
                value = Number(value);
            }
            obj[header] = value;
        });
        // Add a unique ID for each unit based on its name
        if (obj.UnitName) {
            obj.id = obj.UnitName.replace(/\s+/g, '-').toLowerCase();
        }
        return obj;
    });
    return data;
};

// Functions to apply mod effects to a unit's stats
const applyModEffects = (unit, mods) => {
    const unitMods = mods.filter(mod => mod.UnitName === unit.UnitName);
    let modifiedUnit = { ...unit };

    unitMods.forEach(mod => {
        const effect = mod.EffectType;
        const value = mod.EffectValue;

        switch (effect) {
            case 'HP':
                modifiedUnit.HP += value;
                break;
            case 'Attack':
                modifiedUnit.Attack += value;
                break;
            case 'Defense':
                modifiedUnit.Defense += value;
                break;
            case 'SpecialAttack':
                modifiedUnit.SpecialAttack += value;
                break;
            case 'SpecialDefense':
                modifiedUnit.SpecialDefense += value;
                break;
            case 'Speed':
                modifiedUnit.Speed += value;
                break;
            default:
                break;
        }
    });

    return modifiedUnit;
};

// Function to apply max level stats
const applyMaxLevelStats = (unit) => {
    let modifiedUnit = { ...unit };
    // This is a placeholder for a more complex max level calculation
    // For now, let's assume a simple multiplication or a fixed value for demonstration
    // You would replace this with your actual game logic
    modifiedUnit.HP = Math.round(unit.HP * 2.5);
    modifiedUnit.Attack = Math.round(unit.Attack * 2.5);
    modifiedUnit.Defense = Math.round(unit.Defense * 2.5);
    modifiedUnit.SpecialAttack = Math.round(unit.SpecialAttack * 2.5);
    modifiedUnit.SpecialDefense = Math.round(unit.SpecialDefense * 2.5);
    modifiedUnit.Speed = Math.round(unit.Speed * 2.5);
    return modifiedUnit;
};

// Function to filter and render units
const filterAndRenderUnits = () => {
    // Get filter values from the DOM
    const searchTerm = searchInput.value.toLowerCase();
    const rarity = rarityFilter.value;
    const unitClass = classFilter.value;

    // Filter units based on the current criteria
    let filteredUnits = allUnits.filter(unit => {
        // Safe access to unit properties to avoid TypeError
        const unitName = unit.UnitName ? unit.UnitName.toLowerCase() : '';
        const unitRarity = unit.Rarity ? unit.Rarity.toLowerCase() : '';
        const unitType = unit.Class ? unit.Class.toLowerCase() : '';
        
        const matchesSearch = unitName.includes(searchTerm);
        const matchesRarity = rarity === 'All' || unitRarity === rarity.toLowerCase();
        const matchesClass = unitClass === 'All' || unitType === unitClass.toLowerCase();

        return matchesSearch && matchesRarity && matchesClass;
    });

    // Apply mod effects if enabled
    if (modEffectsEnabled) {
        filteredUnits = filteredUnits.map(unit => applyModEffects(unit, allMods));
    }

    // Apply max level stats if enabled
    if (maxLevelGlobalEnabled) {
        filteredUnits = filteredUnits.map(unit => applyMaxLevelStats(unit));
    }

    filteredAndSortedUnits = filteredUnits;

    // Call sortData with the current sort column to re-sort the new filtered list
    // This prevents the infinite loop by not calling filterAndRenderUnits again
    sortData(currentSortColumn);
};

// Function to render the units to the table
const renderUnits = (unitsToRender) => {
    unitTableBody.innerHTML = ''; // Clear existing rows
    expandedUnitRowId = null; // Reset expanded row on re-render

    if (unitsToRender.length === 0) {
        noUnitsMessage.classList.remove('hidden');
        return;
    } else {
        noUnitsMessage.classList.add('hidden');
    }

    unitsToRender.forEach(unit => {
        const unitRow = document.createElement('tr');
        unitRow.dataset.id = unit.id;
        unitRow.classList.add('bg-white', 'border-b', 'hover:bg-gray-50', 'cursor-pointer', 'transition-colors', 'duration-200', 'dark:bg-gray-800', 'dark:border-gray-700', 'dark:hover:bg-gray-700');

        // Dynamically create a color indicator based on rarity
        const rarityColor = (gameData.RarityColors[unit.Rarity] || { color: '#ccc' }).color;
        const classColor = (gameData.ClassesColors[unit.Class] || { color: '#ccc' }).color;

        unitRow.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center">
                <img src="${getUnitImage(unit.UnitName)}" alt="${unit.UnitName}" class="h-10 w-10 rounded-full mr-4 object-cover border-2" style="border-color: ${rarityColor};">
                <span>${unit.UnitName}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                <span style="color: ${rarityColor};" class="font-bold">${unit.Rarity || 'N/A'}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                <span class="inline-block px-2 py-1 text-xs font-semibold rounded-full" style="background-color: ${classColor}; color: white;">
                    ${unit.Class || 'N/A'}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 responsive-hidden-sm">${unit.HP || 0}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 responsive-hidden-sm">${unit.Attack || 0}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 responsive-hidden-md">${unit.Defense || 0}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 responsive-hidden-md">${unit.SpecialAttack || 0}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 responsive-hidden-lg">${unit.SpecialDefense || 0}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 responsive-hidden-lg">${unit.Speed || 0}</td>
        `;
        unitTableBody.appendChild(unitRow);
    });
};

// Function to render the unit details row
const renderUnitDetails = (unit, targetRow) => {
    const detailsRow = document.createElement('tr');
    detailsRow.id = `details-${unit.id}`;
    detailsRow.classList.add('expanded-details-row', 'bg-gray-50', 'dark:bg-gray-700');
    detailsRow.innerHTML = `
        <td colspan="9" class="p-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700 dark:text-gray-200">
                <div>
                    <h4 class="font-bold mb-2">Abilities</h4>
                    <p>${unit.Abilities || 'N/A'}</p>
                </div>
                <div>
                    <h4 class="font-bold mb-2">Description</h4>
                    <p>${unit.Description || 'N/A'}</p>
                </div>
                <div>
                    <h4 class="font-bold mb-2">Stats Explained</h4>
                    <p>
                        HP: ${unit.HP || 'N/A'}<br>
                        Attack: ${unit.Attack || 'N/A'}<br>
                        Defense: ${unit.Defense || 'N/A'}<br>
                        Special Attack: ${unit.SpecialAttack || 'N/A'}<br>
                        Special Defense: ${unit.SpecialDefense || 'N/A'}<br>
                        Speed: ${unit.Speed || 'N/A'}
                    </p>
                </div>
                <div>
                    <h4 class="font-bold mb-2">Best Mods</h4>
                    <p>${unit.BestMods || 'N/A'}</p>
                </div>
            </div>
        </td>
    `;
    targetRow.after(detailsRow);
};


// Function to sort the data
const sortData = (sortColumn) => {
    // If clicking the same column, toggle the sort direction
    if (currentSortColumn === sortColumn) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        // If clicking a new column, reset the direction to ascending
        currentSortColumn = sortColumn;
        sortDirection = 'asc';
    }

    filteredAndSortedUnits.sort((a, b) => {
        const aValue = a[sortColumn];
        const bValue = b[sortColumn];

        // Handle numeric sorting
        if (typeof aValue === 'number' && typeof bValue === 'number') {
            return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }

        // Handle string sorting
        if (typeof aValue === 'string' && typeof bValue === 'string') {
            return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }

        // Fallback for mixed or non-comparable types
        return 0;
    });

    // Re-render the units after sorting
    renderUnits(filteredAndSortedUnits);
};


// Function to render the mods table
const renderMods = (mods) => {
    modTableBody.innerHTML = '';
    if (mods.length === 0) {
        noModsMessage.classList.remove('hidden');
        return;
    } else {
        noModsMessage.classList.add('hidden');
    }

    mods.forEach(mod => {
        const modRow = document.createElement('tr');
        modRow.classList.add('bg-white', 'border-b', 'hover:bg-gray-50', 'transition-colors', 'duration-200', 'dark:bg-gray-800', 'dark:border-gray-700', 'dark:hover:bg-gray-700');
        modRow.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">${mod.UnitName || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${mod.ModName || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${mod.EffectType || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${mod.EffectValue || 0}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${mod.Notes || 'N/A'}</td>
        `;
        modTableBody.appendChild(modRow);
    });
};

// Function to render the tier list
const renderTierList = (tiers) => {
    tierListTableBody.innerHTML = '';
    if (tiers.length === 0) {
        noTierListMessage.classList.remove('hidden');
        return;
    } else {
        noTierListMessage.classList.add('hidden');
    }

    tiers.forEach(tier => {
        const tierRow = document.createElement('tr');
        tierRow.classList.add('bg-white', 'border-b', 'hover:bg-gray-50', 'transition-colors', 'duration-200', 'dark:bg-gray-800', 'dark:border-gray-700', 'dark:hover:bg-gray-700');
        tierRow.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">${tier.UnitName || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${tier.Tier || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${tier.NumericalRank || 'N/A'}</td>
            <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">${tier.Notes || 'N/A'}</td>
        `;
        tierListTableBody.appendChild(tierRow);
    });
};

// Function to toggle dark mode
const toggleDarkMode = () => {
    document.documentElement.classList.toggle('dark');
    const isDarkMode = document.documentElement.classList.contains('dark');
    localStorage.setItem('darkMode', isDarkMode);
    // Update the toggle button icon
    const icon = darkModeToggle.querySelector('i');
    if (isDarkMode) {
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
    } else {
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
    }
};

// Function to switch tabs
const switchTab = (tabId) => {
    // Hide all sections
    unitsSection.classList.add('hidden');
    modsSection.classList.add('hidden');
    tierListSection.classList.add('hidden');

    // Deactivate all tab buttons
    unitsTab.classList.remove('bg-blue-500');
    modsTab.classList.remove('bg-blue-500');
    tierListTab.classList.remove('bg-blue-500');

    // Show the selected section and activate its button
    switch (tabId) {
        case 'unitsTab':
            unitsSection.classList.remove('hidden');
            unitsTab.classList.add('bg-blue-500');
            break;
        case 'modsTab':
            modsSection.classList.remove('hidden');
            modsTab.classList.add('bg-blue-500');
            break;
        case 'tierListTab':
            tierListSection.classList.remove('hidden');
            tierListTab.classList.add('bg-blue-500');
            break;
        default:
            break;
    }
};

// Main initialization function
const loadAllData = async () => {
    loadingSpinner.classList.remove('hidden');
    const unitDataPromise = fetchCsvData(GOOGLE_SHEET_UNIT_DATA_CSV_URL);
    const modDataPromise = fetchCsvData(GOOGLE_SHEET_MOD_DATA_CSV_URL);
    const tierListDataPromise = fetchCsvData(GOOGLE_SHEET_TIER_LIST_CSV_URL);

    const [unitData, modData, tierListData] = await Promise.all([unitDataPromise, modDataPromise, tierListDataPromise]);

    if (unitData) {
        allUnits = unitData;
        filterAndRenderUnits();
    } else {
        noUnitsMessage.classList.remove('hidden');
    }

    if (modData) {
        allMods = modData;
        // No initial rendering of mods, it's done when the tab is switched
    } else {
        noModsMessage.classList.remove('hidden');
    }

    if (tierListData) {
        tierList = tierListData;
    } else {
        noTierListMessage.classList.remove('hidden');
    }

    loadingSpinner.classList.add('hidden');
};

// Event Listeners
window.onload = () => {
    // Load dark mode preference from localStorage
    if (localStorage.getItem('darkMode') === 'true' || (!('darkMode' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
        const icon = darkModeToggle.querySelector('i');
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
    }

    loadAllData();

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
    modsTab.addEventListener('click', () => {
        switchTab('modsTab');
        // Render mods only when the tab is switched to
        renderMods(allMods);
    });
    tierListTab.addEventListener('click', () => {
        switchTab('tierListTab');
        // Render tier list only when the tab is switched to
        renderTierList(tierList);
    });

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
            const unit = filteredAndSortedUnits.find(u => u.id === unitId);
            if (unit) {
                renderUnitDetails(unit, row);
                expandedUnitRowId = unitId;
            }
        }
    });
};
