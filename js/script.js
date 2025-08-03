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
const GOOGLE_SHEET_MOD_DATA_CSV_URL = GOOGLE_SHEET_BASE_URL + '&gid=1626084661&single=true'; // Mod Info (Sheet 3)

// Global state variables
let units = [];
let mods = [];
let tierList = [];
let expandedUnitRowId = null;
let currentSortColumn = 'UnitName';
let currentSortDirection = 'asc';
let modEffectsEnabled = false; // Initial state for the mod effects toggle
let maxLevelGlobalEnabled = false; // Initial state for the global max level toggle

// Helper function to show/hide the loading spinner
function showLoadingSpinner() {
    document.getElementById('loadingSpinner').classList.remove('hidden');
}

function hideLoadingSpinner() {
    document.getElementById('loadingSpinner').classList.add('hidden');
}

// Helper function for debouncing
function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

// Function to parse CSV text into a JSON object
function parseCSV(csvText) {
    const [headerLine, ...dataLines] = csvText.trim().split('\n');
    const headers = headerLine.split(',').map(header => header.trim());

    return dataLines.map(line => {
        const values = line.split(',');
        return headers.reduce((obj, header, index) => {
            // Handle potential missing values
            obj[header] = values[index] ? values[index].trim() : '';
            return obj;
        }, {});
    });
}

// Fetch data from a given URL and parse it as CSV
async function fetchData(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch data from ${url}: ${response.statusText}`);
        }
        const csvText = await response.text();
        return parseCSV(csvText);
    } catch (error) {
        console.error('Error fetching data:', error);
        return null;
    }
}

// Data fetching and initialization
async function init() {
    showLoadingSpinner();
    try {
        // Fetch all data concurrently
        const [unitData, modData, tierListData] = await Promise.all([
            fetchData(GOOGLE_SHEET_UNIT_DATA_CSV_URL),
            fetchData(GOOGLE_SHEET_MOD_DATA_CSV_URL),
            fetchData(GOOGLE_SHEET_TIER_LIST_CSV_URL)
        ]);

        if (unitData) {
            units = unitData;
            // Clean up unit data, converting relevant fields to numbers
            units = units.map(unit => ({
                ...unit,
                BaseHP: parseInt(unit.BaseHP, 10) || 0,
                BaseDamage: parseInt(unit.BaseDamage, 10) || 0,
                AttackSpeed: parseFloat(unit.AttackSpeed) || 0,
                Range: parseInt(unit.Range, 10) || 0,
                AbilityDamage: parseInt(unit.AbilityDamage, 10) || 0,
                LevelDamageMultiplier: parseFloat(unit.LevelDamageMultiplier) || 0,
                LevelHPMultiplier: parseFloat(unit.LevelHPMultiplier) || 0,
            }));
            filterAndRenderUnits();
            setupUnitLevelSliders();
            document.getElementById('noUnitsMessage').classList.add('hidden');
            document.getElementById('unitTableContainer').classList.remove('hidden');
        } else {
            document.getElementById('noUnitsMessage').classList.remove('hidden');
        }

        if (modData) {
            mods = modData;
            filterAndRenderMods();
            document.getElementById('noModsMessage').classList.add('hidden');
            document.getElementById('modTableContainer').classList.remove('hidden');
        } else {
            document.getElementById('noModsMessage').classList.remove('hidden');
        }
        
        if (tierListData) {
            tierList = tierListData;
            renderTierList();
            document.getElementById('noTierListMessage').classList.add('hidden');
            document.getElementById('tierListTableContainer').classList.remove('hidden');
        } else {
            document.getElementById('noTierListMessage').classList.remove('hidden');
        }

    } catch (error) {
        console.error('Initialization error:', error);
        // Show a generic error message
        document.getElementById('noUnitsMessage').textContent = 'Failed to load data. Please check the network connection and try again.';
        document.getElementById('noUnitsMessage').classList.remove('hidden');
    } finally {
        // Always hide the loading spinner once all fetching is done
        hideLoadingSpinner();
    }
}

// Function to handle tab switching
function switchTab(tabId) {
    // Hide all sections
    document.querySelectorAll('main > section').forEach(section => {
        section.classList.add('hidden');
    });

    // Deactivate all tabs
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('tab-active');
        button.classList.add('tab-inactive');
    });

    // Show the selected section
    document.getElementById(tabId.replace('Tab', 'Section')).classList.remove('hidden');

    // Activate the selected tab
    document.getElementById(tabId).classList.remove('tab-inactive');
    document.getElementById(tabId).classList.add('tab-active');
}

// Function to handle dark mode toggle
function toggleDarkMode() {
    document.body.classList.toggle('dark');
    const isDarkMode = document.body.classList.contains('dark');
    // Save the user's preference
    localStorage.setItem('darkMode', isDarkMode);

    // Update the button icon
    const icon = document.getElementById('darkModeToggleIcon');
    if (isDarkMode) {
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
    } else {
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
    }
}

// Apply mod effects to a unit
function applyModEffects(unit, mods) {
    let finalHP = unit.BaseHP;
    let finalDamage = unit.BaseDamage;
    let finalRange = unit.Range;
    let finalAbilityDamage = unit.AbilityDamage;

    mods.forEach(mod => {
        if (mod.ModdedUnit === unit.UnitName) {
            if (mod.StatAffected === 'HP') {
                if (mod.Method === 'Addition') {
                    finalHP += parseFloat(mod.Value);
                } else if (mod.Method === 'Multiplication') {
                    finalHP *= parseFloat(mod.Value);
                }
            } else if (mod.StatAffected === 'Damage') {
                if (mod.Method === 'Addition') {
                    finalDamage += parseFloat(mod.Value);
                } else if (mod.Method === 'Multiplication') {
                    finalDamage *= parseFloat(mod.Value);
                }
            } else if (mod.StatAffected === 'Range') {
                if (mod.Method === 'Addition') {
                    finalRange += parseFloat(mod.Value);
                } else if (mod.Method === 'Multiplication') {
                    finalRange *= parseFloat(mod.Value);
                }
            } else if (mod.StatAffected === 'Ability Damage') {
                if (mod.Method === 'Addition') {
                    finalAbilityDamage += parseFloat(mod.Value);
                } else if (mod.Method === 'Multiplication') {
                    finalAbilityDamage *= parseFloat(mod.Value);
                }
            }
        }
    });

    return {
        ...unit,
        CurrentHP: finalHP,
        CurrentDamage: finalDamage,
        CurrentRange: finalRange,
        CurrentAbilityDamage: finalAbilityDamage
    };
}

// Function to render the unit data table
function renderUnitTable(data) {
    const tbody = document.getElementById('unitTableBody');
    tbody.innerHTML = '';
    const tableContainer = document.getElementById('unitTableContainer');
    const noResultsMessage = document.getElementById('noUnitsMessage');

    if (data.length === 0) {
        tableContainer.classList.add('hidden');
        noResultsMessage.textContent = 'No units found matching your criteria.';
        noResultsMessage.classList.remove('hidden');
        return;
    } else {
        tableContainer.classList.remove('hidden');
        noResultsMessage.classList.add('hidden');
    }

    data.forEach(unit => {
        let currentUnit = { ...unit
        };

        // Apply global max level effects if enabled
        if (maxLevelGlobalEnabled) {
            currentUnit.CurrentHP = currentUnit.BaseHP + (20 * currentUnit.LevelHPMultiplier);
            currentUnit.CurrentDamage = currentUnit.BaseDamage + (20 * currentUnit.LevelDamageMultiplier);
            currentUnit.CurrentAbilityDamage = currentUnit.AbilityDamage + (20 * currentUnit.LevelDamageMultiplier);
        } else {
            currentUnit.CurrentHP = currentUnit.BaseHP;
            currentUnit.CurrentDamage = currentUnit.BaseDamage;
            currentUnit.CurrentAbilityDamage = currentUnit.AbilityDamage;
        }

        // Apply mod effects if enabled
        if (modEffectsEnabled) {
            currentUnit = applyModEffects(currentUnit, mods);
        }

        const unitClassColor = gameData.ClassesColors[unit.Class]?.color || '#FFFFFF';
        const unitRarityColor = gameData.RarityColors[unit.Rarity]?.color || '#FFFFFF';

        const row = document.createElement('tr');
        row.dataset.id = unit.id;
        row.classList.add('hover:bg-gray-200', 'dark:hover:bg-gray-600', 'cursor-pointer', 'transition-colors', 'duration-200');
        row.innerHTML = `
            <td class="unit-cell p-2 md:p-3 xl:p-4 text-center border-b dark:border-gray-600">
                <div class="flex items-center justify-start sm:justify-center lg:justify-start space-x-2">
                    <img src="${unit.Image}" alt="${unit.UnitName}" class="w-10 h-10 md:w-12 md:h-12 rounded-full border-2 border-transparent" onerror="this.onerror=null;this.src='https://placehold.co/48x48/2196f3/ffffff?text=Unit';">
                    <span class="font-semibold text-sm sm:text-base">${unit.UnitName}</span>
                </div>
            </td>
            <td class="unit-cell p-2 md:p-3 xl:p-4 text-center border-b dark:border-gray-600">
                <span class="font-medium px-2 py-1 rounded-full text-xs" style="background-color: ${unitRarityColor}; color: ${isColorDark(unitRarityColor) ? '#FFF' : '#000'};">
                    ${unit.Rarity}
                </span>
            </td>
            <td class="unit-cell p-2 md:p-3 xl:p-4 text-center border-b dark:border-gray-600 hidden sm:table-cell">
                <span class="font-medium px-2 py-1 rounded-full text-xs" style="background-color: ${unitClassColor}; color: ${isColorDark(unitClassColor) ? '#FFF' : '#000'};">
                    ${unit.Class}
                </span>
            </td>
            <td class="unit-cell p-2 md:p-3 xl:p-4 text-center border-b dark:border-gray-600">
                <span class="text-sm font-medium">${currentUnit.CurrentDamage.toFixed(0)}</span>
            </td>
            <td class="unit-cell p-2 md:p-3 xl:p-4 text-center border-b dark:border-gray-600 hidden md:table-cell">
                <span class="text-sm font-medium">${currentUnit.AttackSpeed}</span>
            </td>
            <td class="unit-cell p-2 md:p-3 xl:p-4 text-center border-b dark:border-gray-600 hidden lg:table-cell">
                <span class="text-sm font-medium">${currentUnit.CurrentHP.toFixed(0)}</span>
            </td>
            <td class="unit-cell p-2 md:p-3 xl:p-4 text-center border-b dark:border-gray-600">
                <span class="text-sm font-medium">${currentUnit.CurrentRange.toFixed(0)}</span>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Function to render the detailed view of a unit
function renderUnitDetails(unit, row) {
    const detailsRow = document.createElement('tr');
    detailsRow.id = `details-${unit.id}`;
    detailsRow.classList.add('bg-gray-100', 'dark:bg-gray-800', 'expanded-details-row');
    detailsRow.innerHTML = `
        <td colspan="7" class="p-4 md:p-6 border-t border-b dark:border-gray-600">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 items-start">
                <!-- Unit Image and Stats -->
                <div class="flex flex-col items-center p-4 bg-white dark:bg-gray-700 rounded-lg shadow-md">
                    <img src="${unit.Image}" alt="${unit.UnitName}" class="w-24 h-24 mb-4 rounded-full border-4 border-blue-500" onerror="this.onerror=null;this.src='https://placehold.co/96x96/2196f3/ffffff?text=Unit';">
                    <h3 class="text-xl font-bold mb-2">${unit.UnitName}</h3>
                    <div class="w-full text-center space-y-2">
                        <div class="flex justify-between items-center bg-gray-100 dark:bg-gray-900 p-2 rounded-md">
                            <span class="font-medium text-gray-700 dark:text-gray-300">Base HP:</span>
                            <span class="font-bold text-lg">${unit.BaseHP}</span>
                        </div>
                        <div class="flex justify-between items-center bg-gray-100 dark:bg-gray-900 p-2 rounded-md">
                            <span class="font-medium text-gray-700 dark:text-gray-300">Base Damage:</span>
                            <span class="font-bold text-lg">${unit.BaseDamage}</span>
                        </div>
                        <div class="flex justify-between items-center bg-gray-100 dark:bg-gray-900 p-2 rounded-md">
                            <span class="font-medium text-gray-700 dark:text-gray-300">Ability Damage:</span>
                            <span class="font-bold text-lg">${unit.AbilityDamage}</span>
                        </div>
                        <div class="flex justify-between items-center bg-gray-100 dark:bg-gray-900 p-2 rounded-md">
                            <span class="font-medium text-gray-700 dark:text-gray-300">Attack Speed:</span>
                            <span class="font-bold text-lg">${unit.AttackSpeed}</span>
                        </div>
                        <div class="flex justify-between items-center bg-gray-100 dark:bg-gray-900 p-2 rounded-md">
                            <span class="font-medium text-gray-700 dark:text-gray-300">Range:</span>
                            <span class="font-bold text-lg">${unit.Range}</span>
                        </div>
                    </div>
                </div>

                <!-- Unit Modifiers & Leveling -->
                <div class="flex flex-col p-4 bg-white dark:bg-gray-700 rounded-lg shadow-md md:col-span-1 lg:col-span-2">
                    <h4 class="text-xl font-bold mb-4 border-b pb-2">Leveling & Mods</h4>
                    <div class="space-y-4">
                        <!-- Leveling Section -->
                        <div>
                            <div class="flex justify-between items-center mb-2">
                                <label for="level-slider-${unit.id}" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Current Level: <span id="level-value-${unit.id}">1</span>
                                </label>
                                <input type="checkbox" id="toggle-max-level-${unit.id}" class="form-checkbox h-4 w-4 text-blue-600 transition duration-150 ease-in-out">
                                <label for="toggle-max-level-${unit.id}" class="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">Max Level (20)</label>
                            </div>
                            <input type="range" id="level-slider-${unit.id}" min="1" max="20" value="1" class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700">
                        </div>
                        <!-- Modifiers Section -->
                        <div>
                            <div class="flex justify-between items-center mb-2">
                                <h5 class="text-md font-semibold">Unit-Specific Mods</h5>
                                <input type="checkbox" id="toggle-mod-effects-${unit.id}" class="form-checkbox h-4 w-4 text-blue-600 transition duration-150 ease-in-out">
                                <label for="toggle-mod-effects-${unit.id}" class="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">Apply Mods</label>
                            </div>
                            <div id="mods-list-${unit.id}" class="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                                <!-- Mods will be dynamically inserted here -->
                                ${mods.filter(mod => mod.ModdedUnit === unit.UnitName).map(mod => `
                                    <div class="p-2 bg-gray-50 dark:bg-gray-900 rounded-md">
                                        <p class="font-medium">${mod.StatAffected}: ${mod.Method} by ${mod.Value}</p>
                                        <p class="text-xs italic">${mod.Description}</p>
                                    </div>
                                `).join('') || `<p>No specific mods found for this unit.</p>`}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </td>
    `;
    row.after(detailsRow);

    // Get the slider and its value display
    const levelSlider = document.getElementById(`level-slider-${unit.id}`);
    const levelValue = document.getElementById(`level-value-${unit.id}`);
    const maxLevelToggle = document.getElementById(`toggle-max-level-${unit.id}`);
    const modEffectsToggle = document.getElementById(`toggle-mod-effects-${unit.id}`);

    // Initial state check for toggles
    maxLevelToggle.checked = maxLevelGlobalEnabled;
    modEffectsToggle.checked = modEffectsEnabled;

    // Listen for changes on the slider
    levelSlider.addEventListener('input', () => {
        levelValue.textContent = levelSlider.value;
        const newUnit = applyLeveling(unit, levelSlider.value);
        // Re-render the main row with updated stats
        updateUnitRow(newUnit, row);
    });

    // Listen for max level toggle
    maxLevelToggle.addEventListener('change', () => {
        if (maxLevelToggle.checked) {
            levelSlider.value = 20;
        } else {
            levelSlider.value = 1;
        }
        levelValue.textContent = levelSlider.value;
        const newUnit = applyLeveling(unit, levelSlider.value);
        updateUnitRow(newUnit, row);
    });
    
    // Listen for mod effects toggle
    modEffectsToggle.addEventListener('change', () => {
        let newUnit = applyLeveling(unit, levelSlider.value);
        if (modEffectsToggle.checked) {
            newUnit = applyModEffects(newUnit, mods);
        }
        updateUnitRow(newUnit, row);
    });
}

// Function to render the mod data table
function renderModTable(data) {
    const tbody = document.getElementById('modTableBody');
    tbody.innerHTML = '';
    data.forEach(mod => {
        const row = document.createElement('tr');
        row.classList.add('hover:bg-gray-200', 'dark:hover:bg-gray-600', 'transition-colors', 'duration-200');
        row.innerHTML = `
            <td class="p-2 md:p-3 xl:p-4 text-sm md:text-base border-b dark:border-gray-600">${mod.ModdedUnit}</td>
            <td class="p-2 md:p-3 xl:p-4 text-sm md:text-base border-b dark:border-gray-600">${mod.StatAffected}</td>
            <td class="p-2 md:p-3 xl:p-4 text-sm md:text-base border-b dark:border-gray-600">${mod.Method}</td>
            <td class="p-2 md:p-3 xl:p-4 text-sm md:text-base border-b dark:border-gray-600">${mod.Value}</td>
            <td class="p-2 md:p-3 xl:p-4 text-sm md:text-base border-b dark:border-gray-600 hidden md:table-cell">${mod.Description}</td>
        `;
        tbody.appendChild(row);
    });
}

// Function to render the tier list table
function renderTierList() {
    const tbody = document.getElementById('tierListTableBody');
    tbody.innerHTML = '';
    const tableContainer = document.getElementById('tierListTableContainer');
    const noResultsMessage = document.getElementById('noTierListMessage');
    
    if (tierList.length === 0) {
        tableContainer.classList.add('hidden');
        noResultsMessage.textContent = 'No tier list data available.';
        noResultsMessage.classList.remove('hidden');
        return;
    } else {
        tableContainer.classList.remove('hidden');
        noResultsMessage.classList.add('hidden');
    }

    tierList.forEach(item => {
        const row = document.createElement('tr');
        row.classList.add('hover:bg-gray-200', 'dark:hover:bg-gray-600', 'transition-colors', 'duration-200');
        row.innerHTML = `
            <td class="p-2 md:p-3 xl:p-4 text-sm md:text-base border-b dark:border-gray-600">${item.UnitName}</td>
            <td class="p-2 md:p-3 xl:p-4 text-sm md:text-base border-b dark:border-gray-600">${item.Tier}</td>
            <td class="p-2 md:p-3 xl:p-4 text-sm md:text-base border-b dark:border-gray-600">${item.NumericalRank}</td>
            <td class="p-2 md:p-3 xl:p-4 text-sm md:text-base border-b dark:border-gray-600">${item.Notes}</td>
        `;
        tbody.appendChild(row);
    });
}


// Function to filter and render units based on user input
function filterAndRenderUnits() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const rarity = document.getElementById('rarityFilter').value;
    const unitClass = document.getElementById('classFilter').value;

    let filteredUnits = units.filter(unit => {
        const matchesSearch = unit.UnitName.toLowerCase().includes(searchTerm);
        const matchesRarity = rarity === 'All' || unit.Rarity === rarity;
        const matchesClass = unitClass === 'All' || unit.Class === unitClass;
        return matchesSearch && matchesRarity && matchesClass;
    });

    renderUnitTable(filteredUnits);
}

// Function to sort the data
function sortData(column) {
    // Check if the current sort column is the same as the new one
    if (currentSortColumn === column) {
        // If so, reverse the direction
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        // Otherwise, set the new column and default to ascending
        currentSortColumn = column;
        currentSortDirection = 'asc';
    }

    // Sort the units array
    units.sort((a, b) => {
        let aValue = a[column];
        let bValue = b[column];

        // Handle numeric values
        if (!isNaN(aValue) && !isNaN(bValue)) {
            aValue = parseFloat(aValue);
            bValue = parseFloat(bValue);
        }

        if (aValue < bValue) {
            return currentSortDirection === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
            return currentSortDirection === 'asc' ? 1 : -1;
        }
        return 0;
    });
    
    // Re-render the table with the sorted data
    filterAndRenderUnits();
}

// Function to render mod table
function filterAndRenderMods() {
    renderModTable(mods);
}

// Function to set up unit level sliders
function setupUnitLevelSliders() {
    const sliders = document.querySelectorAll('.level-slider');
    sliders.forEach(slider => {
        const unitId = slider.dataset.unitId;
        const unit = units.find(u => u.id === unitId);
        const levelValue = document.getElementById(`level-value-${unitId}`);
        slider.addEventListener('input', (event) => {
            const level = parseInt(event.target.value, 10);
            levelValue.textContent = level;
            updateUnitStats(unit, level);
        });
    });
}

function applyLeveling(unit, level) {
    const finalHP = unit.BaseHP + ((level - 1) * unit.LevelHPMultiplier);
    const finalDamage = unit.BaseDamage + ((level - 1) * unit.LevelDamageMultiplier);
    const finalAbilityDamage = unit.AbilityDamage + ((level - 1) * unit.LevelDamageMultiplier);
    return {
        ...unit,
        CurrentHP: finalHP,
        CurrentDamage: finalDamage,
        CurrentAbilityDamage: finalAbilityDamage
    };
}

function updateUnitRow(unit, row) {
    row.querySelector('.unit-cell:nth-child(4) span').textContent = unit.CurrentDamage.toFixed(0);
    row.querySelector('.unit-cell:nth-child(6) span').textContent = unit.CurrentHP.toFixed(0);
}

// Helper to check if a color is dark
function isColorDark(hex) {
    if (!hex) return false;
    const color = (hex.charAt(0) === '#') ? hex.substring(1, 7) : hex;
    const r = parseInt(color.substring(0, 2), 16); // hexToR
    const g = parseInt(color.substring(2, 4), 16); // hexToG
    const b = parseInt(color.substring(4, 6), 16); // hexToB
    const uicolors = [r / 255, g / 255, b / 255];
    const c = uicolors.map((col) => {
        if (col <= 0.03928) {
            return col / 12.92;
        }
        return Math.pow((col + 0.055) / 1.055, 2.4);
    });
    const L = (0.2126 * c[0]) + (0.7152 * c[1]) + (0.0722 * c[2]);
    return L <= 0.179;
}


// Event listeners
window.onload = () => {
    init();

    // Get DOM elements
    const searchInput = document.getElementById('searchInput');
    const rarityFilter = document.getElementById('rarityFilter');
    const classFilter = document.getElementById('classFilter');
    const darkModeToggle = document.getElementById('darkModeToggle');
    const unitsTab = document.getElementById('unitsTab');
    const modsTab = document.getElementById('modsTab');
    const tierListTab = document.getElementById('tierListTab');
    const unitTableBody = document.getElementById('unitTableBody');
    const tableHeaders = document.querySelectorAll('#unitsTable th[data-sort]');
    const toggleModEffects = document.getElementById('toggleModEffects');
    const toggleMaxLevel = document.getElementById('toggleMaxLevel');


    // Load dark mode preference from local storage
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark');
        document.getElementById('darkModeToggleIcon').classList.remove('fa-sun');
        document.getElementById('darkModeToggleIcon').classList.add('fa-moon');
    } else {
        document.body.classList.remove('dark');
        document.getElementById('darkModeToggleIcon').classList.remove('fa-moon');
        document.getElementById('darkModeToggleIcon').classList.add('fa-sun');
    }

    // Filters and search input to improve performance
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
