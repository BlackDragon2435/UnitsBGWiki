// js/script.js
// This script handles all the dynamic functionality of the compendium website,
// including data fetching, filtering, sorting, tab switching, and dark mode toggling.

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
// These GIDs correspond to the sheets you need to publish to the web.
const GOOGLE_SHEET_UNIT_DATA_CSV_URL = GOOGLE_SHEET_BASE_URL + '&gid=201310748'; // Unit Info
const GOOGLE_SHEET_TIER_LIST_CSV_URL = GOOGLE_SHEET_BASE_URL + '&gid=0'; // Tier List
const GOOGLE_SHEET_MOD_DATA_CSV_URL = GOOGLE_SHEET_BASE_URL + '&gid=1626019565'; // Mods

// Data storage and state variables
let units = [];
let mods = [];
let tierList = [];
let unitImages = {};
let modEffectsEnabled = false;
let maxLevelGlobalEnabled = false;
let expandedUnitRowId = null;
let currentSortColumn = 'unitName';
let sortDirection = 'asc';

// DOM Elements
let unitsTab, modsTab, tierListTab;
let unitsSection, modsSection, tierListSection;
let unitTableContainer, modTableContainer, tierListTableContainer;
let noUnitsMessage, noModsMessage, noTierListMessage;
let searchInput, rarityFilter, classFilter, modSearchInput;
let toggleModEffects, toggleMaxLevel;
let unitTableBody, modTableBody, tierListTableBody;
let tableHeaders;
let darkModeToggle;
let loadingSpinner;


// Helper function to parse CSV data
const parseCSV = (csv) => {
    const lines = csv.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(header => header.trim());
    const data = lines.slice(1).map(line => {
        const values = line.split(',');
        const obj = {};
        headers.forEach((header, i) => {
            let value = values[i] ? values[i].trim() : '';
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1);
            }
            obj[header] = value;
        });
        return obj;
    });
    return data;
};

// Function to fetch data from a Google Sheet CSV URL
const fetchData = async (url, sheetName) => {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text();
        return parseCSV(text);
    } catch (error) {
        console.error(`Failed to fetch data for ${sheetName}:`, error);
        return null;
    }
};

// Function to load all data from the Google Sheets
const loadAllData = async () => {
    loadingSpinner.classList.remove('hidden');

    // Fetch unit, mod, and tier list data in parallel
    const [unitData, modData, tierListData] = await Promise.all([
        fetchData(GOOGLE_SHEET_UNIT_DATA_CSV_URL, 'Units'),
        fetchData(GOOGLE_SHEET_MOD_DATA_CSV_URL, 'Mods'),
        fetchData(GOOGLE_SHEET_TIER_LIST_CSV_URL, 'Tier List')
    ]);

    // Handle potential fetch failures
    if (unitData) {
        units = unitData;
        // Populate rarity and class filters
        populateFilters();
        // Initial render
        filterAndRenderUnits();
    } else {
        unitTableContainer.classList.add('hidden');
        noUnitsMessage.textContent = 'Failed to load unit data. Please check the Google Sheet link and publish settings.';
        noUnitsMessage.classList.remove('hidden');
    }

    if (modData) {
        mods = modData;
        filterAndRenderMods();
    } else {
        modTableContainer.classList.add('hidden');
        noModsMessage.textContent = 'Failed to load mods data. Please check the Google Sheet link and publish settings.';
        noModsMessage.classList.remove('hidden');
    }

    if (tierListData) {
        tierList = tierListData;
        filterAndRenderTierList();
    } else {
        tierListTableContainer.classList.add('hidden');
        noTierListMessage.textContent = 'Failed to load tier list data. Please check the Google Sheet link and publish settings.';
        noTierListMessage.classList.remove('hidden');
    }
    
    loadingSpinner.classList.add('hidden');
};


// Function to apply mod effects to a unit
const applyModEffects = (unit) => {
    const modEffects = {
        'Health': 0, 'Damage': 0, 'AttackSpeed': 0, 'Range': 0
    };

    if (unit.mods) {
        const activeMods = unit.mods.split(';').map(modName => modName.trim());
        activeMods.forEach(modName => {
            const mod = mods.find(m => m.modName === modName);
            if (mod) {
                // Assuming modEffect is a string like "Damage: +10; AttackSpeed: +0.2"
                const effects = mod.modEffect.split(';').map(e => e.trim());
                effects.forEach(effect => {
                    const [stat, value] = effect.split(':').map(s => s.trim());
                    if (modEffects.hasOwnProperty(stat)) {
                        modEffects[stat] += parseFloat(value);
                    }
                });
            }
        });
    }

    return {
        unitName: unit.unitName,
        rarity: unit.rarity,
        class: unit.class,
        health: parseFloat(unit.maxHealth) + modEffects.Health,
        damage: parseFloat(unit.damage) + modEffects.Damage,
        attackSpeed: parseFloat(unit.attackSpeed) + modEffects.AttackSpeed,
        range: parseFloat(unit.range) + modEffects.Range,
        image: unit.image
    };
};

// Function to populate the rarity and class filters
const populateFilters = () => {
    const allRarities = ['All', ...new Set(units.map(unit => unit.rarity))];
    const allClasses = ['All', ...new Set(units.map(unit => unit.class))];

    rarityFilter.innerHTML = allRarities.map(r => `<option value="${r}">${r}</option>`).join('');
    classFilter.innerHTML = allClasses.map(c => `<option value="${c}">${c}</option>`).join('');
};

// Debounce function to limit function calls
const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(null, args);
        }, delay);
    };
};

// Function to render the unit data table
const renderUnits = (filteredUnits) => {
    unitTableBody.innerHTML = '';
    if (filteredUnits.length === 0) {
        noUnitsMessage.classList.remove('hidden');
        unitTableContainer.classList.add('hidden');
        return;
    }

    noUnitsMessage.classList.add('hidden');
    unitTableContainer.classList.remove('hidden');

    filteredUnits.forEach(unit => {
        const row = document.createElement('tr');
        row.classList.add('hover:bg-gray-100', 'dark:hover:bg-gray-700', 'cursor-pointer');
        row.dataset.id = unit.id; // Assuming units have a unique ID

        // Render unit image with fallback
        const unitImage = unitImages[unit.unitName] || "https://placehold.co/50x50/e2e8f0/1a202c?text=Unit";

        // Get rarity color
        const rarityColor = gameData.RarityColors[unit.rarity]?.color || '#FFFFFF';

        // Get class color
        const classColor = gameData.ClassesColors[unit.class]?.color || '#FFFFFF';

        // Apply global max level toggle
        let hpValue = parseFloat(unit.maxHealth);
        let dmgValue = parseFloat(unit.damage);
        let atkSpdValue = parseFloat(unit.attackSpeed);
        let rangeValue = parseFloat(unit.range);

        if (maxLevelGlobalEnabled) {
            hpValue = parseFloat(unit.maxHealth_MaxLevel);
            dmgValue = parseFloat(unit.damage_MaxLevel);
            atkSpdValue = parseFloat(unit.attackSpeed_MaxLevel);
            rangeValue = parseFloat(unit.range_MaxLevel);
        }

        // Apply global mod effects toggle
        if (modEffectsEnabled) {
            const boostedUnit = applyModEffects(unit);
            hpValue += boostedUnit.health - parseFloat(unit.maxHealth);
            dmgValue += boostedUnit.damage - parseFloat(unit.damage);
            atkSpdValue += boostedUnit.attackSpeed - parseFloat(unit.attackSpeed);
            rangeValue += boostedUnit.range - parseFloat(unit.range);
        }
        
        row.innerHTML = `
            <td class="col-image table-cell-hidden md:table-cell py-2 px-4"><img src="${unitImage}" alt="${unit.unitName}" class="w-10 h-10 rounded-full object-cover border-2" style="border-color: ${rarityColor};"></td>
            <td class="col-name py-2 px-4 font-semibold text-gray-900 dark:text-white">${unit.unitName}</td>
            <td class="col-rarity py-2 px-4"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full" style="background-color: ${rarityColor}; color: #1f2937;">${unit.rarity}</span></td>
            <td class="col-class py-2 px-4"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full" style="background-color: ${classColor}; color: #1f2937;">${unit.class}</span></td>
            <td class="col-hp table-cell-hidden sm:table-cell py-2 px-4">${hpValue.toFixed(0)}</td>
            <td class="col-dmg table-cell-hidden sm:table-cell py-2 px-4">${dmgValue.toFixed(0)}</td>
            <td class="col-atk-spd table-cell-hidden sm:table-cell py-2 px-4">${atkSpdValue.toFixed(2)}</td>
            <td class="col-range table-cell-hidden sm:table-cell py-2 px-4">${rangeValue.toFixed(0)}</td>
        `;
        unitTableBody.appendChild(row);
    });
};

// Renders the detailed view of a unit
const renderUnitDetails = (unit, targetRow) => {
    // Apply global max level toggle
    let hpValue = parseFloat(unit.maxHealth);
    let dmgValue = parseFloat(unit.damage);
    let atkSpdValue = parseFloat(unit.attackSpeed);
    let rangeValue = parseFloat(unit.range);

    if (maxLevelGlobalEnabled) {
        hpValue = parseFloat(unit.maxLevel_MaxLevel);
        dmgValue = parseFloat(unit.damage_MaxLevel);
        atkSpdValue = parseFloat(unit.attackSpeed_MaxLevel);
        rangeValue = parseFloat(unit.range_MaxLevel);
    }
    
    const detailsRow = document.createElement('tr');
    detailsRow.id = `details-${unit.id}`;
    detailsRow.classList.add('expanded-details-row');
    
    detailsRow.innerHTML = `
        <td colspan="8" class="p-4 bg-gray-50 dark:bg-gray-800 rounded-b-xl">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700 dark:text-gray-300">
                <div class="space-y-2">
                    <p><strong>Max Health:</strong> ${hpValue.toFixed(0)}</p>
                    <p><strong>Damage:</strong> ${dmgValue.toFixed(0)}</p>
                    <p><strong>Attack Speed:</strong> ${atkSpdValue.toFixed(2)}</p>
                    <p><strong>Range:</strong> ${rangeValue.toFixed(0)}</p>
                    <p><strong>Abilities:</strong> ${unit.abilities || 'N/A'}</p>
                </div>
                <div class="space-y-2">
                    <p><strong>Cost:</strong> ${unit.cost || 'N/A'}</p>
                    <p><strong>Mod Slots:</strong> ${unit.modSlots || 'N/A'}</p>
                    <p><strong>Mods:</strong> ${unit.mods || 'N/A'}</p>
                    <p><strong>Notes:</strong> ${unit.notes || 'N/A'}</p>
                </div>
            </div>
        </td>
    `;
    targetRow.after(detailsRow);
};


// Function to render the mod data table
const renderMods = (filteredMods) => {
    modTableBody.innerHTML = '';
    if (filteredMods.length === 0) {
        noModsMessage.classList.remove('hidden');
        modTableContainer.classList.add('hidden');
        return;
    }

    noModsMessage.classList.add('hidden');
    modTableContainer.classList.remove('hidden');

    filteredMods.forEach(mod => {
        const row = document.createElement('tr');
        row.classList.add('hover:bg-gray-100', 'dark:hover:bg-gray-700');
        row.innerHTML = `
            <td class="col-mod-name py-2 px-4 font-semibold text-gray-900 dark:text-white">${mod.modName}</td>
            <td class="col-mod-tier py-2 px-4">${mod.modTier}</td>
            <td class="col-mod-effect py-2 px-4">${mod.modEffect}</td>
        `;
        modTableBody.appendChild(row);
    });
};

// Function to render the tier list table
const renderTierList = (filteredTierList) => {
    tierListTableBody.innerHTML = '';
    if (filteredTierList.length === 0) {
        noTierListMessage.classList.remove('hidden');
        tierListTableContainer.classList.add('hidden');
        return;
    }

    noTierListMessage.classList.add('hidden');
    tierListTableContainer.classList.remove('hidden');

    filteredTierList.forEach(item => {
        const row = document.createElement('tr');
        row.classList.add('hover:bg-gray-100', 'dark:hover:bg-gray-700');
        row.innerHTML = `
            <td class="col-name py-2 px-4 font-semibold text-gray-900 dark:text-white">${item.UnitName}</td>
            <td class="col-tier py-2 px-4">${item.Tier}</td>
            <td class="col-rank py-2 px-4">${item.NumericalRank}</td>
            <td class="col-notes py-2 px-4">${item.Notes}</td>
        `;
        tierListTableBody.appendChild(row);
    });
};

// Function to filter and re-render units based on current filters and search
const filterAndRenderUnits = () => {
    const searchTerm = searchInput.value.toLowerCase();
    const selectedRarity = rarityFilter.value;
    const selectedClass = classFilter.value;

    let filteredUnits = units.filter(unit => {
        const matchesSearch = unit.unitName.toLowerCase().includes(searchTerm);
        const matchesRarity = selectedRarity === 'All' || unit.rarity === selectedRarity;
        const matchesClass = selectedClass === 'All' || unit.class === selectedClass;
        return matchesSearch && matchesRarity && matchesClass;
    });

    // Sort the filtered data before rendering
    sortData(currentSortColumn);
    renderUnits(filteredUnits);
};

// Function to filter and re-render mods
const filterAndRenderMods = () => {
    const searchTerm = modSearchInput.value.toLowerCase();
    const filteredMods = mods.filter(mod => {
        return mod.modName.toLowerCase().includes(searchTerm) || mod.modEffect.toLowerCase().includes(searchTerm);
    });
    renderMods(filteredMods);
};

// Function to filter and re-render tier list
const filterAndRenderTierList = () => {
    // Tier list currently has no filters, just render all
    renderTierList(tierList);
};

// Sorting function
const sortData = (sortColumn) => {
    if (sortColumn === currentSortColumn) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = sortColumn;
        sortDirection = 'asc';
    }

    // Sort the units array directly
    units.sort((a, b) => {
        const aValue = a[sortColumn];
        const bValue = b[sortColumn];

        if (aValue === bValue) return 0;

        // Numeric sort for stats, text sort for others
        const isNumeric = ['maxHealth', 'damage', 'attackSpeed', 'range'].includes(sortColumn);
        if (isNumeric) {
            const aNum = parseFloat(aValue);
            const bNum = parseFloat(bValue);
            return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
        } else {
            return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }
    });

    filterAndRenderUnits(); // Re-render with the sorted data
};

// Function to toggle dark mode
const toggleDarkMode = () => {
    document.body.classList.toggle('dark');
    // Save state to local storage
    if (document.body.classList.contains('dark')) {
        localStorage.setItem('theme', 'dark');
    } else {
        localStorage.setItem('theme', 'light');
    }
};

// Function to switch between tabs
const switchTab = (activeTabId) => {
    const tabs = [unitsTab, modsTab, tierListTab];
    const sections = [unitsSection, modsSection, tierListSection];
    
    // Deactivate all tabs and hide all sections
    tabs.forEach(tab => tab.classList.remove('active'));
    sections.forEach(section => section.classList.add('hidden'));

    // Activate the clicked tab and show the corresponding section
    document.getElementById(activeTabId).classList.add('active');
    document.getElementById(activeTabId.replace('Tab', 'Section')).classList.remove('hidden');

    // Trigger re-render for the active tab to ensure fresh data
    if (activeTabId === 'unitsTab') {
        filterAndRenderUnits();
    } else if (activeTabId === 'modsTab') {
        filterAndRenderMods();
    } else if (activeTabId === 'tierListTab') {
        filterAndRenderTierList();
    }
};

// Event listeners and initial setup
window.addEventListener('DOMContentLoaded', () => {
    // DOM Element selections
    unitsTab = document.getElementById('unitsTab');
    modsTab = document.getElementById('modsTab');
    tierListTab = document.getElementById('tierListTab');
    unitsSection = document.getElementById('unitsSection');
    modsSection = document.getElementById('modsSection');
    tierListSection = document.getElementById('tierListSection');
    unitTableContainer = document.getElementById('unitTableContainer');
    modTableContainer = document.getElementById('modTableContainer');
    tierListTableContainer = document.getElementById('tierListTableContainer');
    noUnitsMessage = document.getElementById('noUnitsMessage');
    noModsMessage = document.getElementById('noModsMessage');
    noTierListMessage = document.getElementById('noTierListMessage');
    searchInput = document.getElementById('searchInput');
    rarityFilter = document.getElementById('rarityFilter');
    classFilter = document.getElementById('classFilter');
    modSearchInput = document.getElementById('modSearchInput');
    toggleModEffects = document.getElementById('toggleModEffects');
    toggleMaxLevel = document.getElementById('toggleMaxLevel');
    unitTableBody = document.getElementById('unitTableBody');
    modTableBody = document.getElementById('modTableBody');
    tierListTableBody = document.getElementById('tierListTableBody');
    tableHeaders = document.querySelectorAll('#unitTable thead th[data-sort]');
    darkModeToggle = document.getElementById('darkModeToggle');
    loadingSpinner = document.getElementById('loadingSpinner');

    // Check for saved dark mode preference
    if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.body.classList.add('dark');
    }

    // Load data and render the initial view
    loadAllData();

    // Event listeners
    // Debounce the search input to improve performance
    const debouncedFilterAndRenderUnits = debounce(filterAndRenderUnits, 300);
    searchInput.addEventListener('input', debouncedFilterAndRenderUnits);
    rarityFilter.addEventListener('change', filterAndRenderUnits);
    classFilter.addEventListener('change', filterAndRenderUnits);
    modSearchInput.addEventListener('input', debounce(filterAndRenderMods, 300));

    // Table Header Sorting Events for Units
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
            const unit = units.find(u => u.id === unitId);
            if (unit) {
                renderUnitDetails(unit, row);
                expandedUnitRowId = unitId;
            }
        }
    });

    // Initial tab load
    switchTab('unitsTab');
});
