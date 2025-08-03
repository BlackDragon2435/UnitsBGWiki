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
const GOOGLE_SHEET_MOD_DATA_CSV_URL = GOOGLE_SHEET_BASE_URL + '&gid=1626017094&single=true'; // Mod Data (Sheet 3)

let units = [];
let mods = [];
let tierList = [];
let sortOrder = {};
let expandedUnitRowId = null;
let maxLevelGlobalEnabled = false;

// Caching fetched data to avoid multiple API calls on tab switches
const dataCache = {
    units: null,
    mods: null,
    tierList: null
};

// Map of unit image names to URLs
const unitImages = {
    "Unit 1": "https://tr.rbxcdn.com/180DAY-03e365f1fea92684ef841ae041d4677e/150/150/Image/Webp/noFilter",
    "Unit 2": "https://tr.rbxcdn.com/180DAY-03e365f1fea92684ef841ae041d4677e/150/150/Image/Webp/noFilter",
};

// Helper function to show/hide loading spinner
const showLoadingSpinner = () => {
    document.getElementById('loadingSpinner').classList.remove('hidden');
    document.getElementById('unitTableContainer').classList.add('hidden');
    document.getElementById('modsSection').classList.add('hidden');
    document.getElementById('tierListSection').classList.add('hidden');
};

const hideLoadingSpinner = () => {
    document.getElementById('loadingSpinner').classList.add('hidden');
};

// Helper function to fetch CSV data from Google Sheets
const fetchCsvData = async (url) => {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text();
        return parseCsv(text);
    } catch (error) {
        console.error("Could not fetch CSV data: ", error);
        return null;
    }
};

// Helper function to parse CSV text into an array of objects
const parseCsv = (csvText) => {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(header => header.trim());
    const data = lines.slice(1).map(line => {
        const values = line.split(',').map(value => value.trim());
        return headers.reduce((obj, header, index) => {
            obj[header] = values[index];
            return obj;
        }, {});
    });
    return data;
};

// Function to fetch all game data
const fetchAllData = async () => {
    showLoadingSpinner();

    // Fetch units, mods, and tier list data concurrently
    const [unitsData, modsData, tierListData] = await Promise.all([
        fetchCsvData(GOOGLE_SHEET_UNIT_DATA_CSV_URL),
        fetchCsvData(GOOGLE_SHEET_MOD_DATA_CSV_URL),
        fetchCsvData(GOOGLE_SHEET_TIER_LIST_CSV_URL)
    ]);

    // Store data in cache
    dataCache.units = unitsData;
    dataCache.mods = modsData;
    dataCache.tierList = tierListData;

    hideLoadingSpinner();
};

// Function to initialize the filters
const initializeFilters = () => {
    if (!dataCache.units) return;

    const rarityFilter = document.getElementById('rarityFilter');
    const classFilter = document.getElementById('classFilter');

    const rarities = [...new Set(dataCache.units.map(unit => unit.Rarity))];
    rarities.sort().forEach(rarity => {
        if (rarity) {
            const option = document.createElement('option');
            option.value = rarity;
            option.textContent = rarity;
            rarityFilter.appendChild(option);
        }
    });

    const classes = [...new Set(dataCache.units.map(unit => unit.Class))];
    classes.sort().forEach(unitClass => {
        if (unitClass) {
            const option = document.createElement('option');
            option.value = unitClass;
            option.textContent = unitClass;
            classFilter.appendChild(option);
        }
    });
};

// Function to parse a mod effect string into a number
const parseModEffect = (effect) => {
    if (effect.endsWith('%')) {
        return parseFloat(effect) / 100;
    }
    return parseFloat(effect);
};

// Function to apply mod effects to a unit's stats
const applyModEffects = (unit, modsToApply) => {
    let tempUnit = { ...unit }; // Create a copy to avoid modifying original data

    if (modsToApply && modsToApply.length > 0) {
        modsToApply.forEach(modName => {
            const mod = dataCache.mods.find(m => m.ModName === modName);
            if (mod) {
                // Apply the mod effect based on its stat type
                const effectValue = parseModEffect(mod.Effect);
                switch (mod.Stat) {
                    case 'Damage':
                        tempUnit.Damage = parseFloat(tempUnit.Damage) * (1 + effectValue);
                        break;
                    case 'HP':
                        tempUnit.HP = parseFloat(tempUnit.HP) * (1 + effectValue);
                        break;
                    case 'DPS':
                        tempUnit.DPS = parseFloat(tempUnit.DPS) * (1 + effectValue);
                        break;
                    case 'Range':
                        tempUnit.Range = parseFloat(tempUnit.Range) * (1 + effectValue);
                        break;
                    case 'Speed':
                        tempUnit.Speed = parseFloat(tempUnit.Speed) * (1 + effectValue);
                        break;
                    // Add more cases for other stats as needed
                }
            }
        });
    }

    return tempUnit;
};

// Function to calculate DPS
const calculateDPS = (damage, attackSpeed) => {
    return parseFloat(damage) * (1 / parseFloat(attackSpeed));
};

// Function to filter and render the units table
const filterAndRenderUnits = () => {
    if (!dataCache.units) {
        document.getElementById('unitTableContainer').classList.add('hidden');
        document.getElementById('noUnitsMessage').classList.remove('hidden');
        return;
    }

    const searchValue = document.getElementById('searchInput').value.toLowerCase();
    const rarityValue = document.getElementById('rarityFilter').value;
    const classValue = document.getElementById('classFilter').value;

    let filteredUnits = dataCache.units.filter(unit => {
        const matchesSearch = unit.UnitName.toLowerCase().includes(searchValue);
        const matchesRarity = rarityValue === 'All' || unit.Rarity === rarityValue;
        const matchesClass = classValue === 'All' || unit.Class === classValue;
        return matchesSearch && matchesRarity && matchesClass;
    });

    // Apply global max level toggle if enabled
    if (maxLevelGlobalEnabled) {
        filteredUnits = filteredUnits.map(unit => {
            const maxLevelUnit = { ...unit };
            maxLevelUnit.Damage = parseFloat(maxLevelUnit.Damage) + (parseFloat(maxLevelUnit.LevelDamageGain) * 99);
            maxLevelUnit.HP = parseFloat(maxLevelUnit.HP) + (parseFloat(maxLevelUnit.LevelHPGain) * 99);
            maxLevelUnit.DPS = calculateDPS(maxLevelUnit.Damage, maxLevelUnit.AttackSpeed);
            return maxLevelUnit;
        });
    }


    units = filteredUnits; // Update the global units array

    const unitTableBody = document.getElementById('unitTableBody');
    unitTableBody.innerHTML = '';
    if (units.length === 0) {
        document.getElementById('noUnitsMessage').classList.remove('hidden');
        document.getElementById('unitTableContainer').classList.add('hidden');
    } else {
        document.getElementById('noUnitsMessage').classList.add('hidden');
        document.getElementById('unitTableContainer').classList.remove('hidden');
        units.forEach(unit => {
            const row = document.createElement('tr');
            row.dataset.id = unit.UnitName;
            row.classList.add('hover:bg-gray-100', 'dark:hover:bg-gray-600', 'cursor-pointer', 'transition-colors', 'duration-200', 'border-b', 'border-gray-200', 'dark:border-gray-600');
            row.innerHTML = `
                <td class="unit-name py-4 px-6 font-medium whitespace-nowrap flex items-center space-x-2 text-center sm:text-left">
                    <img src="${unitImages[unit.UnitName] || 'https://placehold.co/40x40/png'}" alt="${unit.UnitName}" class="w-10 h-10 rounded-full object-cover responsive-hide-sm">
                    <span>${unit.UnitName}</span>
                </td>
                <td class="responsive-hide">${unit.Rarity}</td>
                <td class="responsive-hide-sm">${unit.Class}</td>
                <td>${parseFloat(unit.Damage).toFixed(2)}</td>
                <td>${parseFloat(unit.HP).toFixed(2)}</td>
                <td class="responsive-hide">${parseFloat(unit.DPS).toFixed(2)}</td>
                <td class="responsive-hide">${unit.Range}</td>
                <td>${unit.AttackSpeed}</td>
            `;
            unitTableBody.appendChild(row);
        });
    }
};

// Function to render the mods table
const renderModsTable = () => {
    if (!dataCache.mods) {
        document.getElementById('modsSection').classList.remove('hidden');
        document.getElementById('modTableContainer').classList.add('hidden');
        document.getElementById('noModsMessage').classList.remove('hidden');
        return;
    }

    const modTableBody = document.getElementById('modTableBody');
    modTableBody.innerHTML = '';

    // Filter mods based on search input
    const modSearchInput = document.getElementById('modSearchInput').value.toLowerCase();
    const filteredMods = dataCache.mods.filter(mod => {
        return mod.ModName.toLowerCase().includes(modSearchInput) ||
               mod.Description.toLowerCase().includes(modSearchInput) ||
               mod.Effect.toLowerCase().includes(modSearchInput);
    });

    if (filteredMods.length === 0) {
        document.getElementById('modTableContainer').classList.add('hidden');
        document.getElementById('noModsMessage').classList.remove('hidden');
    } else {
        document.getElementById('modTableContainer').classList.remove('hidden');
        document.getElementById('noModsMessage').classList.add('hidden');
        filteredMods.forEach(mod => {
            const row = document.createElement('tr');
            row.classList.add('hover:bg-gray-100', 'dark:hover:bg-gray-600', 'transition-colors', 'duration-200', 'border-b', 'border-gray-200', 'dark:border-gray-600');
            row.innerHTML = `
                <td class="py-4 px-6 font-medium whitespace-nowrap">${mod.ModName}</td>
                <td class="py-4 px-6">${mod.Effect}</td>
                <td class="py-4 px-6">${mod.Description}</td>
            `;
            modTableBody.appendChild(row);
        });
    }
};

// Function to render the tier list table
const renderTierListTable = () => {
    if (!dataCache.tierList) {
        document.getElementById('tierListTableContainer').classList.add('hidden');
        document.getElementById('noTierListMessage').classList.remove('hidden');
        return;
    }

    const tierListTableBody = document.getElementById('tierListTableBody');
    tierListTableBody.innerHTML = '';

    if (dataCache.tierList.length === 0) {
        document.getElementById('tierListTableContainer').classList.add('hidden');
        document.getElementById('noTierListMessage').classList.remove('hidden');
    } else {
        document.getElementById('tierListTableContainer').classList.remove('hidden');
        document.getElementById('noTierListMessage').classList.add('hidden');
        dataCache.tierList.forEach(item => {
            const row = document.createElement('tr');
            row.classList.add('hover:bg-gray-100', 'dark:hover:bg-gray-600', 'transition-colors', 'duration-200', 'border-b', 'border-gray-200', 'dark:border-gray-600');
            row.innerHTML = `
                <td class="py-4 px-6 font-medium whitespace-nowrap">${item.UnitName}</td>
                <td class="py-4 px-6">${item.Tier}</td>
                <td class="py-4 px-6">${item.NumericalRank}</td>
                <td class="py-4 px-6">${item.Notes}</td>
            `;
            tierListTableBody.appendChild(row);
        });
    }
};

// Function to render the expanded unit details
const renderUnitDetails = (unit, row) => {
    const detailsRow = document.createElement('tr');
    detailsRow.id = `details-${unit.UnitName}`;
    detailsRow.classList.add('expanded-details-row', 'bg-gray-50', 'dark:bg-gray-800');
    detailsRow.innerHTML = `
        <td colspan="8" class="p-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <!-- Left Column: Mod and Max Level Toggles -->
                <div class="flex flex-col space-y-4">
                    <div class="flex items-center space-x-2 p-2 rounded-lg bg-gray-200 dark:bg-gray-700">
                        <label for="toggleModEffects-${unit.UnitName}" class="text-sm font-medium text-gray-900 dark:text-gray-100">Simulate Mod Effects</label>
                        <input type="checkbox" id="toggleModEffects-${unit.UnitName}" class="toggle-switch">
                    </div>
                    <div class="flex items-center space-x-2 p-2 rounded-lg bg-gray-200 dark:bg-gray-700">
                        <label for="toggleMaxLevel-${unit.UnitName}" class="text-sm font-medium text-gray-900 dark:text-gray-100">Simulate Max Level</label>
                        <input type="checkbox" id="toggleMaxLevel-${unit.UnitName}" class="toggle-switch">
                    </div>
                    <!-- Dropdown for Mods -->
                    <div class="mod-dropdown-container">
                        <label for="mod-select-${unit.UnitName}" class="block text-sm font-medium text-gray-700 dark:text-gray-200">Select a Mod:</label>
                        <select id="mod-select-${unit.UnitName}" class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md dark:bg-gray-700 dark:text-white">
                            <option value="">-- No Mod --</option>
                            ${dataCache.mods.map(mod => `<option value="${mod.ModName}">${mod.ModName}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <!-- Right Column: Stats and Info -->
                <div id="unit-stats-${unit.UnitName}" class="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg shadow-inner">
                    <h4 class="text-lg font-bold mb-2">Detailed Stats:</h4>
                    <p><strong>Rarity:</strong> <span class="rarity-badge">${unit.Rarity}</span></p>
                    <p><strong>Class:</strong> <span class="class-badge">${unit.Class}</span></p>
                    <p><strong>Damage:</strong> ${unit.Damage}</p>
                    <p><strong>HP:</strong> ${unit.HP}</p>
                    <p><strong>DPS:</strong> ${unit.DPS}</p>
                    <p><strong>Range:</strong> ${unit.Range}</p>
                    <p><strong>Attack Speed:</strong> ${unit.AttackSpeed}</p>
                    <p><strong>Cost:</strong> ${unit.Cost}</p>
                    <p><strong>Ability:</strong> ${unit.Ability}</p>
                    <p><strong>Level Damage Gain:</strong> ${unit.LevelDamageGain}</p>
                    <p><strong>Level HP Gain:</strong> ${unit.LevelHPGain}</p>
                </div>
            </div>
        </td>
    `;
    row.parentNode.insertBefore(detailsRow, row.nextSibling);

    // Event listener for the mod select dropdown
    const modSelect = document.getElementById(`mod-select-${unit.UnitName}`);
    modSelect.addEventListener('change', () => {
        updateUnitStats(unit, unit.UnitName);
    });

    // Event listener for the individual max level toggle
    const toggleMaxLevelUnit = document.getElementById(`toggleMaxLevel-${unit.UnitName}`);
    toggleMaxLevelUnit.addEventListener('change', () => {
        updateUnitStats(unit, unit.UnitName);
    });
};

// Function to update unit stats in the expanded view
const updateUnitStats = (originalUnit, unitId) => {
    let currentUnit = { ...originalUnit };
    const modSelect = document.getElementById(`mod-select-${unitId}`);
    const toggleMaxLevelUnit = document.getElementById(`toggleMaxLevel-${unitId}`);
    const statsContainer = document.getElementById(`unit-stats-${unitId}`);

    // Apply max level effect if toggled
    if (toggleMaxLevelUnit.checked) {
        currentUnit.Damage = parseFloat(currentUnit.Damage) + (parseFloat(currentUnit.LevelDamageGain) * 99);
        currentUnit.HP = parseFloat(currentUnit.HP) + (parseFloat(currentUnit.LevelHPGain) * 99);
        currentUnit.DPS = calculateDPS(currentUnit.Damage, currentUnit.AttackSpeed);
    }

    // Apply mod effect if a mod is selected
    const selectedModName = modSelect.value;
    if (selectedModName) {
        const mod = dataCache.mods.find(m => m.ModName === selectedModName);
        if (mod) {
            const effectValue = parseModEffect(mod.Effect);
            switch (mod.Stat) {
                case 'Damage':
                    currentUnit.Damage = parseFloat(currentUnit.Damage) + (parseFloat(currentUnit.Damage) * effectValue);
                    break;
                case 'HP':
                    currentUnit.HP = parseFloat(currentUnit.HP) + (parseFloat(currentUnit.HP) * effectValue);
                    break;
                case 'DPS':
                    currentUnit.DPS = parseFloat(currentUnit.DPS) + (parseFloat(currentUnit.DPS) * effectValue);
                    break;
                case 'Range':
                    currentUnit.Range = parseFloat(currentUnit.Range) + (parseFloat(currentUnit.Range) * effectValue);
                    break;
                case 'Speed':
                    currentUnit.AttackSpeed = parseFloat(currentUnit.AttackSpeed) - (parseFloat(currentUnit.AttackSpeed) * effectValue);
                    break;
            }
        }
    }

    statsContainer.innerHTML = `
        <h4 class="text-lg font-bold mb-2">Detailed Stats:</h4>
        <p><strong>Rarity:</strong> <span class="rarity-badge">${currentUnit.Rarity}</span></p>
        <p><strong>Class:</strong> <span class="class-badge">${currentUnit.Class}</span></p>
        <p><strong>Damage:</strong> ${parseFloat(currentUnit.Damage).toFixed(2)}</p>
        <p><strong>HP:</strong> ${parseFloat(currentUnit.HP).toFixed(2)}</p>
        <p><strong>DPS:</strong> ${parseFloat(currentUnit.DPS).toFixed(2)}</p>
        <p><strong>Range:</strong> ${parseFloat(currentUnit.Range).toFixed(2)}</p>
        <p><strong>Attack Speed:</strong> ${parseFloat(currentUnit.AttackSpeed).toFixed(2)}</p>
        <p><strong>Cost:</strong> ${currentUnit.Cost}</p>
        <p><strong>Ability:</strong> ${currentUnit.Ability}</p>
        <p><strong>Level Damage Gain:</strong> ${currentUnit.LevelDamageGain}</p>
        <p><strong>Level HP Gain:</strong> ${currentUnit.LevelHPGain}</p>
    `;
};


// Function to render the unit's rarity color in the table
const renderUnitRarity = (rarity) => {
    const rarityColor = gameData.RarityColors[rarity] ? gameData.RarityColors[rarity].color : '#000000';
    return `<td style="color: ${rarityColor};">${rarity}</td>`;
};

// Function to render the unit's class color in the table
const renderUnitClass = (unitClass) => {
    const classColor = gameData.ClassesColors[unitClass] ? gameData.ClassesColors[unitClass].color : '#000000';
    return `<td style="color: ${classColor};">${unitClass}</td>`;
};

// Function to sort the data
const sortData = (column) => {
    const isAsc = sortOrder[column] === 'asc';
    sortOrder[column] = isAsc ? 'desc' : 'asc';

    units.sort((a, b) => {
        const aValue = a[column];
        const bValue = b[column];

        // Handle numeric and string sorting
        if (!isNaN(aValue) && !isNaN(bValue)) {
            return isAsc ? aValue - bValue : bValue - aValue;
        } else {
            return isAsc ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }
    });

    filterAndRenderUnits(); // Re-render the table with sorted data
};

// Function to toggle dark mode
const toggleDarkMode = () => {
    const body = document.body;
    const darkModeIcon = document.getElementById('darkModeIcon');
    if (body.classList.contains('dark')) {
        body.classList.remove('dark');
        darkModeIcon.classList.replace('fa-sun', 'fa-moon');
    } else {
        body.classList.add('dark');
        darkModeIcon.classList.replace('fa-moon', 'fa-sun');
    }
};

// Function to handle tab switching
const switchTab = (tabId) => {
    // Hide all tab contents and remove active class from all tabs
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
    document.querySelectorAll('.tab-button').forEach(button => button.classList.remove('active'));

    // Show the selected tab content and add active class to the selected tab
    const selectedSection = document.getElementById(tabId.replace('Tab', 'Section'));
    if (selectedSection) {
        selectedSection.classList.remove('hidden');
    }
    document.getElementById(tabId).classList.add('active');

    // Trigger rendering for the selected tab
    if (tabId === 'unitsTab') {
        filterAndRenderUnits();
    } else if (tabId === 'modsTab') {
        renderModsTable();
    } else if (tabId === 'tierListTab') {
        renderTierListTable();
    }
};

// Debounce function to limit function calls
const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
};

window.onload = async () => {
    await fetchAllData();
    initializeFilters();
    filterAndRenderUnits();
    renderModsTable(); // Initial render for mods section
    renderTierListTable(); // Initial render for tier list section

    // Element selectors
    const searchInput = document.getElementById('searchInput');
    const rarityFilter = document.getElementById('rarityFilter');
    const classFilter = document.getElementById('classFilter');
    const tableHeaders = document.querySelectorAll('#unitTable thead th');
    const darkModeToggle = document.getElementById('darkModeToggle');
    const unitsTab = document.getElementById('unitsTab');
    const modsTab = document.getElementById('modsTab');
    const tierListTab = document.getElementById('tierListTab');
    const unitTableBody = document.getElementById('unitTableBody');
    const modSearchInput = document.getElementById('modSearchInput');
    const toggleMaxLevel = document.getElementById('toggleMaxLevel');

    // Debounce the search input to improve performance
    const debouncedFilterAndRenderUnits = debounce(filterAndRenderUnits, 300);
    searchInput.addEventListener('input', debouncedFilterAndRenderUnits);
    rarityFilter.addEventListener('change', filterAndRenderUnits);
    classFilter.addEventListener('change', filterAndRenderUnits);

    // Debounce the mod search input
    modSearchInput.addEventListener('input', debounce(renderModsTable, 300));

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
            const unit = units.find(u => u.UnitName === unitId);
            if (unit) {
                renderUnitDetails(unit, row);
                expandedUnitRowId = unitId;
            }
        }
    });
};
