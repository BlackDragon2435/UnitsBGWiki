// js/script.js
// This file has been updated to fix the DPS calculation and handle the MultiAttack value.
// It also includes more robust error handling for DOM element access.

// import { rawUnitData } from './unitsData.js';
// import { rawModData } from './modsData.js';
import { unitImages } from './unitImages.js'; // Keep this for potential fallback or if user wants to keep it
import { gameData } from './gameData.js'; // Import gameData

// IMPORTANT: Base URL for your published Google Sheet
// This URL should point to your Google Sheet published to web as CSV.
// To get this URL, go to File > Share > Publish to web > Publish to web > Link.
// Choose the sheet and format as "Comma-separated values (.csv)", then copy the URL.
// The URL should not contain "docs.googleusercontent.com/pub" - it must be a direct
// publish link.
const GOOGLE_SHEET_BASE_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQO78VJA7y_g5zHpzw1gTaJhLV2mjNdRxA33zcj1WPFj-QYxQS09nInTQXg6kXNJcjm4f7Gk7lPVZuV/pub?output=csv';

// Specific URLs for each sheet using their GIDs
const GOOGLE_SHEET_UNIT_DATA_CSV_URL = GOOGLE_SHEET_BASE_URL + '&gid=201310748&single=true'; // Unit Info (Sheet 1)
const GOOGLE_SHEET_TIER_LIST_CSV_URL = GOOGLE_SHEET_BASE_URL + '&gid=0&single=true'; // Tier List (Sheet 2)
const GOOGLE_SHEET_MOD_DATA_CSV_URL = GOOGLE_SHEET_BASE_URL + '&gid=729050965&single=true'; // Mod Info (Sheet 3)

let allUnits = [];
let allMods = {}; // Changed to an object for easier lookup
let tierListData = [];
let modEffectsEnabled = false; // Global toggle for mod effects
let maxLevelGlobalEnabled = false; // Global toggle for Max Level effects

// DOM elements - defined globally for easy access
const unitsTab = document.getElementById('units-tab-btn');
const modsTab = document.getElementById('mods-tab-btn');
const tierListTab = document.getElementById('tier-list-tab-btn');
const unitsContent = document.getElementById('units-content');
const modsContent = document.getElementById('mods-content');
const tierListContent = document.getElementById('tier-list-content');
const searchInput = document.getElementById('search-input');
const rarityFilter = document.getElementById('rarity-filter');
const classFilter = document.getElementById('class-filter');
const unitTableBody = document.getElementById('unitTableBody');
const modsTableBody = document.getElementById('modsTableBody');
const tableHeaders = document.querySelectorAll('#unitsTable th[data-sort]');
const tierListTableBody = document.getElementById('tierListTableBody');
const loadingSpinner = document.getElementById('loadingSpinner');
const darkModeToggle = document.getElementById('darkModeToggle');
const toggleModEffects = document.getElementById('toggleModEffects');
const toggleMaxLevel = document.getElementById('toggleMaxLevel');

const defaultMaxLevel = 25; // Default max level for calculations

// Function to fetch and parse CSV data
const fetchAndParseCSV = async (url) => {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text();
        const lines = text.split('\n').filter(line => line.trim() !== '');
        const headers = lines[0].split(',').map(header => header.trim());
        const data = lines.slice(1).map(line => {
            const values = line.split(',').map(value => value.trim());
            return headers.reduce((obj, header, index) => {
                obj[header] = values[index] || ''; // Handle potential missing values
                return obj;
            }, {});
        });
        return data;
    } catch (error) {
        console.error('Failed to fetch or parse CSV:', url, error);
        return [];
    }
};

// Function to parse raw string data into a structured object
const parseRawData = (rawData) => {
    const lines = rawData.split('\n').map(line => line.trim()).filter(line => line !== '');
    const data = {};
    let currentKey = '';
    lines.forEach(line => {
        const match = line.match(/^\["([^"]+)"\] = \{/);
        if (match) {
            currentKey = match[1];
            data[currentKey] = {};
        } else if (line.startsWith('["')) {
            const propMatch = line.match(/^\["([^"]+)"\] = (.+),?$/);
            if (propMatch && currentKey) {
                const propKey = propMatch[1];
                let propValue = propMatch[2].replace(/["`]/g, '').trim();
                if (propValue === 'N/A') {
                    propValue = null;
                } else if (!isNaN(parseFloat(propValue)) && isFinite(propValue)) {
                    propValue = Number(propValue);
                }
                data[currentKey][propKey] = propValue;
            }
        }
    });
    return data;
};

// =========================================================================
// Core Calculation Logic
// =========================================================================

// Function to calculate a stat based on a unit's level, class, and rarity
const calculateStat = (baseStat, unit, statKey, level) => {
    if (baseStat === null || baseStat === undefined || baseStat === 'N/A') {
        return null;
    }

    // Get the modifier data from gameData.js
    const classData = gameData.StatModifiersByClass[unit.Class];
    if (!classData || !classData[statKey]) {
        return parseFloat(baseStat);
    }

    const modifier = classData[statKey];
    let levelModifier = parseFloat(modifier._value);

    // Apply rarity-specific modifier from gameData.js if it exists
    if (modifier._attributes && modifier._attributes[unit.Rarity] !== undefined) {
        levelModifier = parseFloat(modifier._attributes[unit.Rarity]);
    }

    // Calculate the total modifier percentage
    const totalModifier = levelModifier * (level - 1);

    // The formula is Stat = BaseStat * (1 + Modifier * (Level - 1))
    return parseFloat(baseStat) * (1 + totalModifier);
};

// Function to calculate all stats for a given unit and level
const calculateStats = (unit, level) => {
    const calculatedHP = calculateStat(unit.HP, unit, 'HP', level);
    const calculatedDamage = calculateStat(unit.Damage, unit, 'Damage', level);
    const calculatedCooldown = calculateStat(unit.Cooldown, unit, 'Cooldown', level);

    // Account for multi-attack. Assumes a new column in the sheet called "MultiAttack".
    // If not present, it defaults to 1.
    const multiAttack = parseFloat(unit.MultiAttack) || 1;
    
    // Calculate DPS, multiplying damage by the multi-attack value
    const calculatedDPS = (calculatedDamage && calculatedCooldown) ? ((calculatedDamage * multiAttack) / calculatedCooldown).toFixed(2) : 'N/A';

    return {
        hp: calculatedHP ? calculatedHP.toFixed(0) : 'N/A',
        damage: calculatedDamage ? calculatedDamage.toFixed(2) : 'N/A',
        cooldown: calculatedCooldown ? calculatedCooldown.toFixed(2) : 'N/A',
        dps: calculatedDPS
    };
};

// =========================================================================
// Rendering and Display Functions
// =========================================================================

// Function to render the units table
const renderUnits = (units) => {
    if (!unitTableBody) return;
    unitTableBody.innerHTML = '';
    const fragment = document.createDocumentFragment();

    units.forEach(unit => {
        const row = document.createElement('tr');
        row.className = 'border-b hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-150';

        const unitImage = unitImages[unit.Label] || 'https://placehold.co/60x60/1f2937/d1d5db?text=No+Img';
        const level = maxLevelGlobalEnabled ? defaultMaxLevel : 1;

        const { hp, damage, cooldown, dps } = calculateStats(unit, level);
        
        row.innerHTML = `
            <td class="py-2 px-4 text-center">
                <img src="${unitImage}" alt="${unit.Label}" class="w-12 h-12 rounded-lg mx-auto object-cover border-2 border-blue-500">
                <span class="mt-1 text-xs text-gray-500 dark:text-gray-400 block">${unit.Label}</span>
            </td>
            <td class="py-2 px-4 text-center">${unit.Rarity}</td>
            <td class="py-2 px-4 text-center">${unit.Class}</td>
            <td class="py-2 px-4 text-center font-bold">${hp}</td>
            <td class="py-2 px-4 text-center">${damage}</td>
            <td class="py-2 px-4 text-center">${cooldown}s</td>
            <td class="py-2 px-4 text-center hidden md:table-cell">${dps}</td>
            <td class="py-2 px-4 text-center hidden lg:table-cell">${unit.Range || 'N/A'}</td>
        `;
        fragment.appendChild(row);
    });

    unitTableBody.appendChild(fragment);
};

// Function to filter and render units
const filterAndRenderUnits = () => {
    try {
        if (!searchInput || !rarityFilter || !classFilter) {
            console.warn('Filter elements not found. Skipping filter and render.');
            return;
        }
        
        const searchTerm = searchInput.value.toLowerCase();
        const selectedRarity = rarityFilter.value;
        const selectedClass = classFilter.value;

        const filteredUnits = allUnits.filter(unit => {
            const matchesSearch = !searchTerm || (unit.Label && unit.Label.toLowerCase().includes(searchTerm));
            const matchesRarity = selectedRarity === 'All' || unit.Rarity === selectedRarity;
            const matchesClass = selectedClass === 'All' || unit.Class === selectedClass;
            return matchesSearch && matchesRarity && matchesClass;
        });

        renderUnits(filteredUnits);
    } catch (error) {
        console.error('Error during filterAndRenderUnits:', error);
    }
};

// Simple debounce function to limit how often a function is called
const debounce = (func, delay) => {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
};

// Function to render the mods table
const renderMods = (mods) => {
    if (!modsTableBody) return;
    modsTableBody.innerHTML = '';
    const fragment = document.createDocumentFragment();

    Object.keys(mods).forEach(modKey => {
        const mod = mods[modKey];
        const row = document.createElement('tr');
        row.className = 'border-b hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-150';
        row.innerHTML = `
            <td class="py-2 px-4">${mod.Title || 'N/A'}</td>
            <td class="py-2 px-4">${mod.Rarity || 'N/A'}</td>
            <td class="py-2 px-4">${mod.Stat || 'N/A'}</td>
            <td class="py-2 px-4">${mod.Amount !== null ? mod.Amount : 'N/A'}</td>
            <td class="py-2 px-4">${mod.Chance !== null ? `${(mod.Chance * 100).toFixed(2)}%` : 'N/A'}</td>
            <td class="py-2 px-4">${mod.Effect || 'N/A'}</td>
        `;
        fragment.appendChild(row);
    });

    modsTableBody.appendChild(fragment);
};

// Function to render the tier list table
const renderTierList = (tierList) => {
    const tierListTableBody = document.getElementById('tierListTableBody');
    const noTierListMessage = document.getElementById('noTierListMessage');
    const tierListTableContainer = document.getElementById('tierListTableContainer');

    if (!tierListTableBody || !noTierListMessage || !tierListTableContainer) {
        console.warn('Tier list DOM elements not found. Skipping render.');
        return;
    }
    
    tierListTableBody.innerHTML = '';

    if (!tierList || tierList.length === 0) {
        tierListTableContainer.classList.add('hidden');
        noTierListMessage.classList.remove('hidden');
        return;
    }

    tierListTableContainer.classList.remove('hidden');
    noTierListMessage.classList.add('hidden');

    const fragment = document.createDocumentFragment();
    tierList.forEach(item => {
        const row = document.createElement('tr');
        row.className = 'bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600';
        row.innerHTML = `
            <td class="py-4 px-6 font-medium text-gray-900 whitespace-nowrap dark:text-white">${item.UnitName || 'N/A'}</td>
            <td class="py-4 px-6 text-gray-500 dark:text-gray-400">${item.Tier || 'N/A'}</td>
            <td class="py-4 px-6 text-gray-500 dark:text-gray-400">${item.NumericalRank || 'N/A'}</td>
            <td class="py-4 px-6 text-gray-500 dark:text-gray-400">${item.Notes || 'N/A'}</td>
        `;
        fragment.appendChild(row);
    });
    tierListTableBody.appendChild(fragment);
};

// Function for table sorting
let sortDirection = {};
const sortData = (column) => {
    const isNumber = ['HP', 'Damage', 'Cooldown', 'DPS', 'Range'].includes(column);
    const sortMultiplier = (sortDirection[column] === 'asc') ? 1 : -1;

    let dataToSort = allUnits;

    dataToSort.sort((a, b) => {
        let valueA, valueB;
        if (isNumber) {
            if (maxLevelGlobalEnabled) {
                const statsA = calculateStats(a, defaultMaxLevel);
                const statsB = calculateStats(b, defaultMaxLevel);
                // Use the calculated stat value from the returned object
                valueA = parseFloat(statsA[column.toLowerCase()] || 0);
                valueB = parseFloat(statsB[column.toLowerCase()] || 0);
            } else {
                valueA = parseFloat(a[column] || 0);
                valueB = parseFloat(b[column] || 0);
            }
        } else {
            valueA = a[column] || '';
            valueB = b[column] || '';
        }

        if (valueA < valueB) return -1 * sortMultiplier;
        if (valueA > valueB) return 1 * sortMultiplier;
        return 0;
    });

    sortDirection[column] = (sortDirection[column] === 'asc') ? 'desc' : 'asc';
    renderUnits(dataToSort);
};

// Function to toggle dark mode
const toggleDarkMode = () => {
    document.documentElement.classList.toggle('dark');
};

// Function to switch tabs
const switchTab = (tabId) => {
    if (unitsContent) unitsContent.classList.add('hidden');
    if (modsContent) modsContent.classList.add('hidden');
    if (tierListContent) tierListContent.classList.add('hidden');

    if (unitsTab) unitsTab.classList.remove('active-tab');
    if (modsTab) modsTab.classList.remove('active-tab');
    if (tierListTab) tierListTab.classList.remove('active-tab');

    if (tabId === 'unitsTab' && unitsContent && unitsTab) {
        unitsContent.classList.remove('hidden');
        unitsTab.classList.add('active-tab');
        filterAndRenderUnits();
    } else if (tabId === 'modsTab' && modsContent && modsTab) {
        modsContent.classList.remove('hidden');
        modsTab.classList.add('active-tab');
        // No need to render mods again, they are static
    } else if (tabId === 'tierListTab' && tierListContent && tierListTab) {
        tierListContent.classList.remove('hidden');
        tierListTab.classList.add('active-tab');
    }
};

// Main initialization function
const init = async () => {
    if (loadingSpinner) {
      loadingSpinner.classList.remove('hidden');
    }

    try {
        const [unitDataCSV, modDataCSV, tierListCSV] = await Promise.all([
            fetchAndParseCSV(GOOGLE_SHEET_UNIT_DATA_CSV_URL),
            fetchAndParseCSV(GOOGLE_SHEET_MOD_DATA_CSV_URL),
            fetchAndParseCSV(GOOGLE_SHEET_TIER_LIST_CSV_URL)
        ]);

        if (unitDataCSV.length > 0) {
            allUnits = unitDataCSV;
            console.log('Units loaded from Google Sheet.');
        } else {
            console.warn('Could not load units from Google Sheet. Using fallback method if available.');
        }

        if (modDataCSV.length > 0) {
            allMods = modDataCSV.reduce((acc, mod) => {
                if (mod.Title) {
                    acc[mod.Title] = mod;
                }
                return acc;
            }, {});
            console.log('Mods loaded from Google Sheet.');
        } else {
            console.warn('Could not load mods from Google Sheet. Using fallback method if available.');
        }

        if (tierListCSV.length > 0) {
            tierListData = tierListCSV;
            console.log('Tier list loaded from Google Sheet.');
        } else {
            console.warn('Could not load tier list from Google Sheet.');
        }
    } catch (error) {
        console.error('An error occurred during data fetching:', error);
    }

    if (loadingSpinner) {
      loadingSpinner.classList.add('hidden');
    }

    // Initial render and setup
    if (document.readyState === 'complete') {
        filterAndRenderUnits();
        renderMods(allMods);
        renderTierList(tierListData);
        switchTab('unitsTab'); // Set default tab
    } else {
        window.onload = () => {
            filterAndRenderUnits();
            renderMods(allMods);
            renderTierList(tierListData);
            switchTab('unitsTab'); // Set default tab
        };
    }
    
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
    }
    
    // Event listeners
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
};

init();
