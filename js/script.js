// js/script.js
import { gameData } from './gameData.js';
import { unitImages } from './unitImages.js';

// IMPORTANT: Base URL for your published Google Sheet
const GOOGLE_SHEET_BASE_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQO78VJA7y_g5zHpzw1gTaJhLV2mjNdRxA33zcj1WPFj-QYxQS09nInTQXg6kXNJcjm4f7Gk7lPVZuV/pub?output=csv';

// Specific URLs for each sheet using their GIDs
const GOOGLE_SHEET_UNIT_DATA_CSV_URL = GOOGLE_SHEET_BASE_URL + '&gid=201310748&single=true';
const GOOGLE_SHEET_TIER_LIST_CSV_URL = GOOGLE_SHEET_BASE_URL + '&gid=0&single=true';
const GOOGLE_SHEET_MOD_DATA_CSV_URL = GOOGLE_SHEET_BASE_URL + '&gid=1623869968&single=true';

// Global data stores
let allUnitData = [];
let allModData = [];
let allTierListData = [];
let currentSortColumn = 'Label';
let sortDirection = 'asc';
let modEffectsEnabled = false;
let maxLevelGlobalEnabled = false;

// DOM Elements
const body = document.body;
const darkModeToggle = document.getElementById('darkModeToggle');
const sunIcon = document.getElementById('sunIcon');
const moonIcon = document.getElementById('moonIcon');

// Loading spinner elements
const loadingSpinnerContainer = document.getElementById('loadingSpinnerContainer');

// Tab elements
const unitsTab = document.getElementById('unitsTab');
const modsTab = document.getElementById('modsTab');
const tierListTab = document.getElementById('tierListTab');
const unitsContent = document.getElementById('unitsContent');
const modsContent = document.getElementById('modsContent');
const tierListContent = document.getElementById('tierListContent');

// Unit tab elements
const searchInput = document.getElementById('searchInput');
const rarityFilter = document.getElementById('rarityFilter');
const classFilter = document.getElementById('classFilter');
const unitTableBody = document.getElementById('unitTableBody');
const tableHeaders = document.querySelectorAll('#unitTableContainer th');
const unitTableContainer = document.getElementById('unitTableContainer');
const noResultsMessage = document.getElementById('noResultsMessage');

// Mods tab elements
const modsTableContainer = document.getElementById('modsTableContainer');
const modsTableBody = document.getElementById('modsTableBody');
const noModsMessage = document.getElementById('noModsMessage');

// Tier List tab elements
const tierListTableContainer = document.getElementById('tierListTableContainer');
const tierListTableBody = document.getElementById('tierListTableBody');
const noTierListMessage = document.getElementById('noTierListMessage');

// Toggles
const toggleModEffects = document.getElementById('toggleModEffects');
const toggleMaxLevel = document.getElementById('toggleMaxLevel');


// Helper Functions
// =============================================================================

// CSV to JSON conversion
const csvToJSON = (csv) => {
    const lines = csv.split('\n');
    const result = [];
    const headers = lines[0].split(',').map(header => header.trim());

    for (let i = 1; i < lines.length; i++) {
        const obj = {};
        const currentline = lines[i].split(',');

        if (currentline.length === headers.length) {
            for (let j = 0; j < headers.length; j++) {
                let value = currentline[j].trim();
                // Attempt to convert numeric values
                if (!isNaN(value) && value !== '') {
                    obj[headers[j]] = Number(value);
                } else {
                    obj[headers[j]] = value;
                }
            }
            result.push(obj);
        }
    }
    return result;
};

// Fetch data from a given URL
const fetchData = async (url) => {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const csvText = await response.text();
        return csvToJSON(csvText);
    } catch (error) {
        console.error('Fetch data error:', error);
        return null;
    }
};

// Toggle Dark Mode
const toggleDarkMode = () => {
    body.classList.toggle('dark');
    if (body.classList.contains('dark')) {
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
        localStorage.setItem('theme', 'dark');
    } else {
        moonIcon.classList.remove('hidden');
        sunIcon.classList.add('hidden');
        localStorage.setItem('theme', 'light');
    }
};

// Set dark mode based on user preference
const setDarkMode = () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        body.classList.add('dark');
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
    } else {
        body.classList.remove('dark');
        moonIcon.classList.remove('hidden');
        sunIcon.classList.add('hidden');
    }
};

// Display loading spinner
const showLoadingSpinner = () => {
    loadingSpinnerContainer.classList.remove('hidden');
};

// Hide loading spinner
const hideLoadingSpinner = () => {
    loadingSpinnerContainer.classList.add('hidden');
};

// Apply mod effects to a unit's stats
const applyModEffects = (unit, mods) => {
    let newUnit = { ...unit };

    // Apply any general mods first
    mods.forEach(mod => {
        if (mod.Target === 'All' || mod.Target === newUnit.Class) {
            if (mod.Stat === 'HP') {
                newUnit.HP = Math.round(newUnit.HP * (1 + mod.Value));
            } else if (mod.Stat === 'Damage') {
                newUnit.Damage = Math.round(newUnit.Damage * (1 + mod.Value));
            } else if (mod.Stat === 'DPS') {
                newUnit.DPS = Math.round(newUnit.DPS * (1 + mod.Value));
            }
        }
    });

    return newUnit;
};

// Render Functions
// =============================================================================

// Populate filter dropdowns
const populateFilters = (data) => {
    const rarities = [...new Set(data.map(unit => unit.Rarity))].filter(Boolean);
    const classes = [...new Set(data.map(unit => unit.Class))].filter(Boolean);

    rarityFilter.innerHTML = '<option value="all">All Rarities</option>';
    rarities.sort().forEach(rarity => {
        const option = document.createElement('option');
        option.value = rarity;
        option.textContent = rarity;
        rarityFilter.appendChild(option);
    });

    classFilter.innerHTML = '<option value="all">All Classes</option>';
    classes.sort().forEach(unitClass => {
        const option = document.createElement('option');
        option.value = unitClass;
        option.textContent = unitClass;
        classFilter.appendChild(option);
    });
};

// Calculate and render mod effects for a specific unit
const renderUnitMods = (unit, row) => {
    // Check if a mod details row is already open and close it if it is
    const existingModRow = row.nextElementSibling;
    if (existingModRow && existingModRow.classList.contains('mod-details-row')) {
        existingModRow.remove();
        return;
    }

    // Close any other open mod detail rows
    document.querySelectorAll('.mod-details-row').forEach(r => r.remove());

    const modDetailsRow = document.createElement('tr');
    modDetailsRow.className = 'mod-details-row';
    const modDetailsCell = document.createElement('td');
    modDetailsCell.colSpan = 8;
    modDetailsCell.className = 'py-4 px-6';

    let modsHtml = `
        <h4 class="text-lg font-bold mb-2">Mod Effects on ${unit.Label}</h4>
        <div class="stats-container">
    `;

    // Loop through each mod and calculate the effect
    allModData.forEach(mod => {
        const originalHP = unit.HP;
        const originalDamage = unit.Damage;
        const originalDPS = unit.DPS;
        let newHP = originalHP;
        let newDamage = originalDamage;
        let newDPS = originalDPS;

        if (mod.Target === 'All' || mod.Target === unit.Class) {
            if (mod.Stat === 'HP') {
                newHP = Math.round(originalHP * (1 + mod.Value));
            } else if (mod.Stat === 'Damage') {
                newDamage = Math.round(originalDamage * (1 + mod.Value));
            } else if (mod.Stat === 'DPS') {
                newDPS = Math.round(originalDPS * (1 + mod.Value));
            }
        }

        modsHtml += `
            <div class="stat-item bg-gray-200 dark:bg-gray-800 p-4 rounded-lg shadow-md">
                <p class="font-semibold text-blue-500">${mod['Mod Name']}</p>
                <p><strong>Original HP:</strong> ${originalHP}</p>
                <p><strong>Modified HP:</strong> ${newHP}</p>
                <p><strong>Original Damage:</strong> ${originalDamage}</p>
                <p><strong>Modified Damage:</strong> ${newDamage}</p>
                <p><strong>Original DPS:</strong> ${originalDPS}</p>
                <p><strong>Modified DPS:</strong> ${newDPS}</p>
            </div>
        `;
    });

    modsHtml += `</div>`;
    modDetailsCell.innerHTML = modsHtml;
    modDetailsRow.appendChild(modDetailsCell);
    row.parentNode.insertBefore(modDetailsRow, row.nextSibling);
};


// Filter and render units table
const filterAndRenderUnits = () => {
    const searchTerm = searchInput.value.toLowerCase();
    const selectedRarity = rarityFilter.value;
    const selectedClass = classFilter.value;
    const maxLevelEnabled = toggleMaxLevel.checked;
    const modEffectsEnabled = toggleModEffects.checked;

    let filteredUnits = allUnitData.filter(unit => {
        const matchesSearch = unit.Label.toLowerCase().includes(searchTerm) ||
                              unit.Class.toLowerCase().includes(searchTerm);
        const matchesRarity = selectedRarity === 'all' || unit.Rarity === selectedRarity;
        const matchesClass = selectedClass === 'all' || unit.Class === selectedClass;
        return matchesSearch && matchesRarity && matchesClass;
    });

    // Apply max level stats if the toggle is checked
    if (maxLevelEnabled) {
        filteredUnits = filteredUnits.map(unit => {
            return {
                ...unit,
                HP: unit.MaxLevelHP,
                Damage: unit.MaxLevelDamage,
                DPS: unit.MaxLevelDPS
            };
        });
    }

    // Apply mod effects if the toggle is checked
    if (modEffectsEnabled && allModData.length > 0) {
        filteredUnits = filteredUnits.map(unit => applyModEffects(unit, allModData));
    }

    // Sort the filtered data
    if (currentSortColumn) {
        filteredUnits.sort((a, b) => {
            const aValue = a[currentSortColumn];
            const bValue = b[currentSortColumn];

            // Handle string and number comparison
            if (typeof aValue === 'string') {
                return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
            } else {
                return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
            }
        });
    }

    unitTableBody.innerHTML = '';
    if (filteredUnits.length > 0) {
        unitTableContainer.classList.remove('hidden');
        noResultsMessage.classList.add('hidden');

        filteredUnits.forEach(unit => {
            const row = document.createElement('tr');
            row.className = 'unit-row border-b border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer';
            row.innerHTML = `
                <td class="py-3 px-6 text-center whitespace-nowrap">
                    <img src="${unitImages[unit.Label] || 'https://placehold.co/40x40/e2e8f0/e2e8f0?text=IMG'}" alt="${unit.Label}" class="w-10 h-10 rounded-full mx-auto">
                </td>
                <td class="py-3 px-6 text-center whitespace-nowrap">${unit.Label}</td>
                <td class="py-3 px-6 text-center whitespace-nowrap">${unit.Class}</td>
                <td class="py-3 px-6 text-center whitespace-nowrap">${unit.Rarity}</td>
                <td class="py-3 px-6 text-center whitespace-nowrap">${unit.CommunityRanking || 'N/A'}</td>
                <td class="py-3 px-6 text-center whitespace-nowrap">${unit.HP}</td>
                <td class="py-3 px-6 text-center whitespace-nowrap">${unit.Damage}</td>
                <td class="py-3 px-6 text-center whitespace-nowrap">${unit.DPS}</td>
            `;

            row.addEventListener('click', () => renderUnitMods(unit, row));
            unitTableBody.appendChild(row);
        });
    } else {
        unitTableContainer.classList.add('hidden');
        noResultsMessage.classList.remove('hidden');
    }
};

// Render mods table
const renderMods = () => {
    modsTableBody.innerHTML = '';
    if (allModData.length > 0) {
        modsTableContainer.classList.remove('hidden');
        noModsMessage.classList.add('hidden');
        allModData.forEach(mod => {
            const row = document.createElement('tr');
            row.className = 'border-b border-gray-200 dark:border-gray-700';
            row.innerHTML = `
                <td class="py-3 px-6">${mod['Mod Name']}</td>
                <td class="py-3 px-6">${mod.Rarity}</td>
                <td class="py-3 px-6">${mod.Effect}</td>
            `;
            modsTableBody.appendChild(row);
        });
    } else {
        modsTableContainer.classList.add('hidden');
        noModsMessage.classList.remove('hidden');
    }
};

// Render tier list table
const renderTierList = () => {
    tierListTableBody.innerHTML = '';
    if (allTierListData.length > 0) {
        tierListTableContainer.classList.remove('hidden');
        noTierListMessage.classList.add('hidden');
        allTierListData.forEach(item => {
            const row = document.createElement('tr');
            row.className = 'border-b border-gray-200 dark:border-gray-700';
            row.innerHTML = `
                <td class="py-3 px-6">${item.UnitName}</td>
                <td class="py-3 px-6">${item.Tier}</td>
                <td class="py-3 px-6">${item.NumericalRank || ''}</td>
                <td class="py-3 px-6">${item.Notes || ''}</td>
            `;
            tierListTableBody.appendChild(row);
        });
    } else {
        tierListTableContainer.classList.add('hidden');
        noTierListMessage.classList.remove('hidden');
    }
};

// Tab switching logic
const switchTab = (tabId) => {
    // Hide all content sections
    unitsContent.classList.add('hidden');
    modsContent.classList.add('hidden');
    tierListContent.classList.add('hidden');

    // Deactivate all tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active-tab'));

    // Show the selected tab content and activate its button
    switch (tabId) {
        case 'unitsTab':
            unitsContent.classList.remove('hidden');
            unitsTab.classList.add('active-tab');
            filterAndRenderUnits(); // Render units when the tab is shown
            break;
        case 'modsTab':
            modsContent.classList.remove('hidden');
            modsTab.classList.add('active-tab');
            renderMods(); // Render mods when the tab is shown
            break;
        case 'tierListTab':
            tierListContent.classList.remove('hidden');
            tierListTab.classList.add('active-tab');
            renderTierList(); // Render tier list when the tab is shown
            break;
    }
};

// Sorting logic
const sortData = (sortColumn) => {
    if (currentSortColumn === sortColumn) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = sortColumn;
        sortDirection = 'asc';
    }

    filterAndRenderUnits();
};

// Debounce function to limit expensive calls (like filtering)
const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
};

// Event Listeners
// =============================================================================

// Attach event listeners after the DOM is fully loaded
window.onload = async () => {
    setDarkMode();
    showLoadingSpinner();

    // Fetch all data concurrently
    const [unitData, modData, tierListData] = await Promise.all([
        fetchData(GOOGLE_SHEET_UNIT_DATA_CSV_URL),
        fetchData(GOOGLE_SHEET_MOD_DATA_CSV_URL),
        fetchData(GOOGLE_SHEET_TIER_LIST_CSV_URL)
    ]);

    if (unitData) {
        allUnitData = unitData;
        populateFilters(allUnitData);
        filterAndRenderUnits();
    }
    
    if (modData) {
        allModData = modData;
    }

    if (tierListData) {
        allTierListData = tierListData;
    }

    // Hide the loading spinner once all data is loaded (or attempted)
    hideLoadingSpinner();
    
    // Wire up event listeners
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
    tierListTab.addEventListener('click', () => switchTab('tierListTab'));

    // Mod Effects Toggle Event (global)
    toggleModEffects.addEventListener('change', () => {
        modEffectsEnabled = toggleModEffects.checked;
        filterAndRenderUnits();
    });

    // Global Max Level Toggle Event
    toggleMaxLevel.addEventListener('change', () => {
        maxLevelGlobalEnabled = toggleMaxLevel.checked;
        filterAndRenderUnits();
    });
};
