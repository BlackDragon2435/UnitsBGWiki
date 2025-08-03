// js/script.js
// This script handles data fetching, filtering, sorting, and rendering for the Unit & Mod Compendium.

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
const GOOGLE_SHEET_MOD_DATA_CSV_URL = GOOGLE_SHEET_BASE_URL + '&gid=1626019565&single=true'; // Mod Info (Sheet 3)

// Global state variables
let units = [];
let mods = [];
let tierList = [];
let modEffectsEnabled = false;
let maxLevelGlobalEnabled = false;
let expandedUnitRowId = null;
let currentSort = { column: 'UnitName', order: 'asc' };
let currentActiveTab = 'unitsTab';

// DOM Elements
const unitsTab = document.getElementById('unitsTab');
const modsTab = document.getElementById('modsTab');
const tierListTab = document.getElementById('tierListTab');
const unitsSection = document.getElementById('unitsSection');
const modsSection = document.getElementById('modsSection');
const tierListSection = document.getElementById('tierListSection');
const searchInput = document.getElementById('searchInput');
const rarityFilter = document.getElementById('rarityFilter');
const classFilter = document.getElementById('classFilter');
const unitTableBody = document.getElementById('unitTableBody');
const loadingSpinner = document.getElementById('loadingSpinner');
const unitTableContainer = document.getElementById('unitTableContainer');
const modTableContainer = document.getElementById('modTableContainer');
const tierListTableContainer = document.getElementById('tierListTableContainer');
const noModsMessage = document.getElementById('noModsMessage');
const noTierListMessage = document.getElementById('noTierListMessage');
const modTableBody = document.getElementById('modTableBody');
const tierListTableBody = document.getElementById('tierListTableBody');
const tableHeaders = document.querySelectorAll('#unitTable thead th');
const darkModeToggle = document.getElementById('darkModeToggle');
const darkModeIcon = document.getElementById('darkModeIcon');
const toggleModEffects = document.getElementById('toggleModEffects');
const toggleMaxLevel = document.getElementById('toggleMaxLevel');

// Utility function to parse CSV text into a JSON array
const parseCSV = (csvText) => {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(header => header.trim());
    const data = lines.slice(1).map(line => {
        const values = line.split(',').map(value => value.trim());
        const row = {};
        headers.forEach((header, i) => {
            row[header] = values[i];
        });
        return row;
    });
    return data;
};

// Utility function to debounce a function call for performance
const debounce = (func, delay) => {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
};

// Function to fetch data from a Google Sheets URL
const fetchData = async (url) => {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const csvText = await response.text();
        return parseCSV(csvText);
    } catch (error) {
        console.error('Failed to fetch data:', error);
        return null;
    }
};

// Function to load all data from Google Sheets
const loadAllData = async () => {
    showLoading();
    try {
        // Fetch unit, mod, and tier list data
        units = await fetchData(GOOGLE_SHEET_UNIT_DATA_CSV_URL) || [];
        mods = await fetchData(GOOGLE_SHEET_MOD_DATA_CSV_URL) || [];
        tierList = await fetchData(GOOGLE_SHEET_TIER_LIST_CSV_URL) || [];

        // Pre-process data
        processUnitData();
        populateFilters();
        
        // Initial render for the active tab
        if (currentActiveTab === 'unitsTab') {
            filterAndRenderUnits();
        } else if (currentActiveTab === 'modsTab') {
            renderMods();
        } else if (currentActiveTab === 'tierListTab') {
            renderTierList();
        }

    } finally {
        hideLoading();
    }
};

const processUnitData = () => {
    units = units.map(unit => {
        // Ensure numerical stats are parsed correctly
        unit.Damage = parseFloat(unit.Damage);
        unit.HP = parseFloat(unit.HP);
        unit.AttackSpeed = parseFloat(unit.AttackSpeed);
        unit.Range = parseFloat(unit.Range);
        unit.DPS = unit.Damage / unit.AttackSpeed; // Calculate DPS
        // Map UnitName to an image URL if one exists
        const unitName = unit.UnitName.trim();
        unit.ImageUrl = unit.Image.trim(); // The URL is already in the sheet
        unit.id = unitName.replace(/\s+/g, '-'); // Create a slug for the ID
        return unit;
    });
};

// Function to populate rarity and class filters from the fetched data
const populateFilters = () => {
    const rarities = [...new Set(units.map(unit => unit.Rarity))];
    rarityFilter.innerHTML = '<option value="All">All Rarity</option>';
    rarities.forEach(rarity => {
        if (rarity) {
            rarityFilter.innerHTML += `<option value="${rarity}">${rarity}</option>`;
        }
    });

    const classes = [...new Set(units.map(unit => unit.Class))];
    classFilter.innerHTML = '<option value="All">All Class</option>';
    classes.forEach(cls => {
        if (cls) {
            classFilter.innerHTML += `<option value="${cls}">${cls}</option>`;
        }
    });
};

// Render units based on current filters and sort order
const filterAndRenderUnits = () => {
    const searchTerm = searchInput.value.toLowerCase();
    const selectedRarity = rarityFilter.value;
    const selectedClass = classFilter.value;

    const filteredUnits = units.filter(unit => {
        const matchesSearch = unit.UnitName.toLowerCase().includes(searchTerm);
        const matchesRarity = selectedRarity === 'All' || unit.Rarity === selectedRarity;
        const matchesClass = selectedClass === 'All' || unit.Class === selectedClass;
        return matchesSearch && matchesRarity && matchesClass;
    });

    // Apply sorting
    const sortedUnits = sortData(filteredUnits, currentSort.column, currentSort.order);

    unitTableBody.innerHTML = '';
    if (sortedUnits.length > 0) {
        sortedUnits.forEach(unit => {
            const row = document.createElement('tr');
            row.dataset.id = unit.id;
            row.classList.add('cursor-pointer');
            
            // Get rarity and class colors
            const rarityColor = gameData.RarityColors[unit.Rarity]?.color || '#FFFFFF';
            const classColor = gameData.ClassesColors[unit.Class]?.color || '#FFFFFF';

            // Use the unit's image URL if available, otherwise a placeholder
            // The ImageUrl is expected to be a full URL now based on your feedback
            const unitImage = unit.ImageUrl || `https://placehold.co/50x50/${rarityColor.substring(1)}/000000?text=${unit.UnitName.charAt(0)}`;
            
            row.innerHTML = `
                <td class="flex items-center space-x-3 unit-name">
                    <img src="${unitImage}" alt="${unit.UnitName}" class="w-10 h-10 rounded-full border-2" style="border-color: ${rarityColor};">
                    <div>
                        <div class="font-semibold text-gray-900 dark:text-gray-100">${unit.UnitName}</div>
                        <div class="text-sm text-gray-500 dark:text-gray-400 responsive-hide">${unit.UnitNameShort}</div>
                    </div>
                </td>
                <td class="responsive-hide">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full" style="background-color: ${rarityColor}; color: ${isLight(rarityColor) ? '#000' : '#FFF'};">${unit.Rarity}</span>
                </td>
                <td class="responsive-hide-sm">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full" style="background-color: ${classColor}; color: ${isLight(classColor) ? '#000' : '#FFF'};">${unit.Class}</span>
                </td>
                <td>${formatNumber(unit.Damage)}</td>
                <td>${formatNumber(unit.HP)}</td>
                <td class="responsive-hide">${formatNumber(unit.DPS)}</td>
                <td class="responsive-hide">${formatNumber(unit.Range)}</td>
                <td>${formatNumber(unit.AttackSpeed)}</td>
            `;
            unitTableBody.appendChild(row);
        });
        unitTableContainer.classList.remove('hidden');
    } else {
        unitTableBody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-gray-500 dark:text-gray-400">No units found.</td></tr>';
    }
};

const renderMods = () => {
    modTableBody.innerHTML = '';
    modTableContainer.classList.add('hidden');
    noModsMessage.classList.add('hidden');

    if (!mods || mods.length === 0) {
        noModsMessage.classList.remove('hidden');
        return;
    }

    const searchTerm = document.getElementById('modSearchInput').value.toLowerCase();
    const filteredMods = mods.filter(mod => {
        const matchesSearch = mod.ModName.toLowerCase().includes(searchTerm) || mod.Effect.toLowerCase().includes(searchTerm) || mod.Description.toLowerCase().includes(searchTerm);
        return matchesSearch;
    });

    if (filteredMods.length > 0) {
        filteredMods.forEach(mod => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="font-semibold text-gray-900 dark:text-gray-100">${mod.ModName}</td>
                <td>${mod.Effect}</td>
                <td>${mod.Description}</td>
            `;
            modTableBody.appendChild(row);
        });
        modTableContainer.classList.remove('hidden');
    } else {
        modTableBody.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-gray-500 dark:text-gray-400">No mods found.</td></tr>';
        modTableContainer.classList.remove('hidden');
    }
};

const renderTierList = () => {
    tierListTableBody.innerHTML = '';
    tierListTableContainer.classList.add('hidden');
    noTierListMessage.classList.add('hidden');

    if (!tierList || tierList.length === 0) {
        noTierListMessage.classList.remove('hidden');
        return;
    }

    // Sort by NumericalRank
    const sortedTierList = tierList.sort((a, b) => parseFloat(a.NumericalRank) - parseFloat(b.NumericalRank));

    if (sortedTierList.length > 0) {
        sortedTierList.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="font-semibold text-gray-900 dark:text-gray-100">${item.UnitName}</td>
                <td>${item.Tier}</td>
                <td>${item.NumericalRank}</td>
                <td>${item.Notes}</td>
            `;
            tierListTableBody.appendChild(row);
        });
        tierListTableContainer.classList.remove('hidden');
    } else {
        tierListTableBody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500 dark:text-gray-400">No tier list data available.</td></tr>';
        tierListTableContainer.classList.remove('hidden');
    }
};


const renderUnitDetails = (unit, row) => {
    const detailRow = document.createElement('tr');
    detailRow.id = `details-${unit.id}`;
    detailRow.classList.add('expanded-details-row', 'bg-gray-50', 'dark:bg-gray-800');
    
    // Check if mod effects are enabled globally
    const modEffectsEnabled = document.getElementById('toggleModEffects')?.checked;

    // Build the details content
    let detailsHtml = `
        <td colspan="8" class="px-6 py-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700 dark:text-gray-300">
                <div class="space-y-2">
                    <p><strong>Description:</strong> ${unit.Description}</p>
                    <p><strong>Cost:</strong> ${unit.Cost}</p>
                    <p><strong>Ability:</strong> ${unit.Ability}</p>
                    <p><strong>Ability Description:</strong> ${unit.AbilityDescription}</p>
                    <p><strong>Level 1 Stats:</strong> Damage: ${unit.Damage}, HP: ${unit.HP}</p>
                    <p><strong>Max Level Stats:</strong> Damage: ${unit.DamageMax}, HP: ${unit.HPMax}</p>
                </div>
                <div class="space-y-2">
                    <p><strong>Mod Effects:</strong></p>
                    <ul class="list-disc list-inside">
    `;

    // Filter and display mods relevant to the unit's class
    const unitMods = mods.filter(mod => mod.Class === unit.Class);
    if (unitMods.length > 0) {
        unitMods.forEach(mod => {
            detailsHtml += `<li><strong>${mod.ModName}:</strong> ${mod.Description}</li>`;
        });
    } else {
        detailsHtml += `<li>No specific mods found for this class.</li>`;
    }

    detailsHtml += `
                    </ul>
                </div>
            </div>
        </td>
    `;
    detailRow.innerHTML = detailsHtml;
    row.after(detailRow);
};

// Function to handle sorting
const sortData = (data, column, order) => {
    const sortedData = [...data].sort((a, b) => {
        const valA = a[column];
        const valB = b[column];
        
        // Handle number and string sorting
        const isNumber = !isNaN(parseFloat(valA)) && isFinite(valA);
        if (isNumber) {
            return order === 'asc' ? parseFloat(valA) - parseFloat(valB) : parseFloat(valB) - parseFloat(valA);
        } else {
            return order === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
    });

    // Update sort icons
    const allIcons = document.querySelectorAll('#unitTable thead th i');
    allIcons.forEach(icon => icon.classList.remove('fa-sort-up', 'fa-sort-down'));
    const activeHeader = document.querySelector(`th[data-sort="${column}"] i`);
    if (activeHeader) {
        activeHeader.classList.add(order === 'asc' ? 'fa-sort-up' : 'fa-sort-down');
    }

    return sortedData;
};

// Function to format numbers with commas
const formatNumber = (num) => {
    if (num === null || num === undefined) return '';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

// Function to check if a color is light or dark (for text contrast)
const isLight = (hexColor) => {
    const r = parseInt(hexColor.substring(1, 3), 16);
    const g = parseInt(hexColor.substring(3, 5), 16);
    const b = parseInt(hexColor.substring(5, 7), 16);
    const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b);
    return luma > 128;
};

// Function to show/hide loading spinner
const showLoading = () => {
    unitsTab.disabled = true;
    modsTab.disabled = true;
    tierListTab.disabled = true;
    loadingSpinner.classList.remove('hidden');
    unitTableContainer.classList.add('hidden');
    modTableContainer.classList.add('hidden');
    tierListTableContainer.classList.add('hidden');
};

const hideLoading = () => {
    unitsTab.disabled = false;
    modsTab.disabled = false;
    tierListTab.disabled = false;
    loadingSpinner.classList.add('hidden');
};

// Function to toggle dark mode
const toggleDarkMode = () => {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    localStorage.setItem('darkMode', isDark);
    darkModeIcon.classList.toggle('fa-moon', !isDark);
    darkModeIcon.classList.toggle('fa-sun', isDark);
};

// Function to switch between tabs
const switchTab = (tabId) => {
    // Hide all sections
    unitsSection.classList.add('hidden');
    modsSection.classList.add('hidden');
    tierListSection.classList.add('hidden');

    // Deactivate all buttons
    unitsTab.classList.remove('active');
    modsTab.classList.remove('active');
    tierListTab.classList.remove('active');
    
    // Show the selected section and activate its button
    if (tabId === 'unitsTab') {
        unitsSection.classList.remove('hidden');
        unitsTab.classList.add('active');
        filterAndRenderUnits();
    } else if (tabId === 'modsTab') {
        modsSection.classList.remove('hidden');
        modsTab.classList.add('active');
        renderMods();
    } else if (tabId === 'tierListTab') {
        tierListSection.classList.remove('hidden');
        tierListTab.classList.add('active');
        renderTierList();
    }
    currentActiveTab = tabId;
};

// Main initialization function
window.onload = () => {
    // Check for dark mode preference
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark');
        darkModeIcon.classList.remove('fa-moon');
        darkModeIcon.classList.add('fa-sun');
    }

    // Load data from Google Sheets
    loadAllData();

    // Event listeners for units tab
    const debouncedFilterAndRenderUnits = debounce(filterAndRenderUnits, 300);
    searchInput.addEventListener('input', debouncedFilterAndRenderUnits);
    rarityFilter.addEventListener('change', debouncedFilterAndRenderUnits);
    classFilter.addEventListener('change', debouncedFilterAndRenderUnits);

    // Event listener for mods tab search
    const modSearchInput = document.getElementById('modSearchInput');
    if (modSearchInput) {
        modSearchInput.addEventListener('input', debounce(renderMods, 300));
    }

    // Table Header Sorting Events
    tableHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const sortColumn = header.dataset.sort;
            if (sortColumn) {
                // Toggle sort order
                if (currentSort.column === sortColumn) {
                    currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
                } else {
                    currentSort.column = sortColumn;
                    currentSort.order = 'asc';
                }
                filterAndRenderUnits();
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
    if (toggleModEffects) {
        toggleModEffects.addEventListener('change', () => {
            modEffectsEnabled = toggleModEffects.checked;
            filterAndRenderUnits(); // Re-render units to apply/remove global mod effects
        });
    }

    // Global Max Level Toggle Event
    if (toggleMaxLevel) {
        toggleMaxLevel.addEventListener('change', () => {
            maxLevelGlobalEnabled = toggleMaxLevel.checked;
            filterAndRenderUnits(); // Re-render units to apply/remove global max level effects
        });
    }

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
};
