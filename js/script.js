// js/script.js
import { rawUnitData } from './unitsData.js';
import { rawModData } from './modsData.js';

let units = []; // Stores parsed unit data
let mods = [];  // Stores parsed mod data
let currentSortColumn = null;
let currentSortDirection = 'asc'; // 'asc' or 'desc'
let modEffectsEnabled = false; // State for mod effects toggle

// DOM Elements
const unitTableBody = document.getElementById('unitTableBody');
const searchInput = document.getElementById('searchInput');
const rarityFilter = document.getElementById('rarityFilter');
const classFilter = document.getElementById('classFilter');
const tableHeaders = document.querySelectorAll('#unitTable th');
const loadingSpinner = document.getElementById('loadingSpinner');
const unitTableContainer = document.getElementById('unitTableContainer');
const noResultsMessage = document.getElementById('noResultsMessage');
const darkModeToggle = document.getElementById('darkModeToggle');
const sunIcon = document.getElementById('sunIcon');
const moonIcon = document.getElementById('moonIcon');
const unitsTab = document.getElementById('unitsTab');
const modsTab = document.getElementById('modsTab');
const unitsContent = document.getElementById('unitsContent');
const modsContent = document.getElementById('modsContent');
const toggleModEffects = document.getElementById('toggleModEffects');
const modsTableBody = document.querySelector('#modsTable tbody');


// --- Utility Functions ---

/**
 * Parses the raw string data into an array of objects.
 * Handles "N/A" conversion to null and number parsing.
 * @param {string} dataString - The raw string data from the text file.
 * @returns {Array<Object>} An array of parsed unit/mod objects.
 */
function parseData(dataString) {
    const parsedItems = [];
    const itemBlocks = dataString.match(/\["([^"]+)"\] = \{([^}]+)\},/g);

    if (!itemBlocks) {
        console.warn("No item blocks found in the provided data string.");
        return parsedItems;
    }

    itemBlocks.forEach(block => {
        const itemNameMatch = block.match(/\["([^"]+)"\] = \{/);
        if (!itemNameMatch) return;

        const itemName = itemNameMatch[1];
        const propertiesString = block.match(/\{([^}]+)\}/)[1];

        const item = {};
        const propertyMatches = propertiesString.matchAll(/\["([^"]+)"\] = (.+?),/g);

        for (const match of propertyMatches) {
            const key = match[1];
            let value = match[2].trim();

            if (value === '"N/A"') {
                value = 'N/A'; // Keep "N/A" as string for display
            } else if (value === 'true') {
                value = true;
            } else if (value === 'false') {
                value = false;
            } else if (!isNaN(parseFloat(value)) && isFinite(value)) {
                value = parseFloat(value);
            } else {
                value = value.replace(/^"|"$/g, ''); // Remove quotes from string values
            }
            item[key] = value;
        }
        parsedItems.push(item);
    });
    return parsedItems;
}

/**
 * Applies mod effects to a unit. This is a placeholder for actual mod logic.
 * @param {Object} unit - The unit object to apply mods to.
 * @param {Array<Object>} mods - The array of mod objects.
 * @returns {Object} A new unit object with mod effects applied.
 */
function applyModEffects(unit, mods) {
    // Create a deep copy of the unit to avoid modifying the original data
    const modifiedUnit = { ...unit };

    mods.forEach(mod => {
        // Simple example: apply mod if unit class matches mod's 'AppliesTo'
        // In a real scenario, you'd have more complex logic (e.g., specific unit names, multiple effects)
        const appliesToClasses = mod.AppliesTo ? mod.AppliesTo.split(', ').map(c => c.trim()) : [];

        if (appliesToClasses.includes("All") || appliesToClasses.includes(unit.Class)) {
            switch (mod.Type) {
                case "HP":
                    if (typeof modifiedUnit.HP === 'number' && typeof mod.Value === 'number') {
                        modifiedUnit.HP = Math.round(modifiedUnit.HP * (1 + mod.Value));
                    }
                    break;
                case "Damage":
                    if (typeof modifiedUnit.Damage === 'number' && typeof mod.Value === 'number') {
                        modifiedUnit.Damage = Math.round(modifiedUnit.Damage * (1 + mod.Value));
                    }
                    break;
                case "Cooldown":
                    if (typeof modifiedUnit.Cooldown === 'number' && typeof mod.Value === 'number') {
                        modifiedUnit.Cooldown = Math.max(0.1, modifiedUnit.Cooldown + mod.Value); // Ensure cooldown doesn't go below 0.1
                    }
                    break;
                case "CritChance":
                    if (typeof modifiedUnit.CritChance === 'number' && typeof mod.Value === 'number') {
                        modifiedUnit.CritChance = Math.min(1, modifiedUnit.CritChance + mod.Value); // Cap crit chance at 1
                    } else if (modifiedUnit.CritChance === 'N/A' && typeof mod.Value === 'number') {
                        modifiedUnit.CritChance = mod.Value;
                    }
                    break;
                // Add more cases for other mod types (e.g., CritDamage, EvadeChance, etc.)
            }
        }
    });
    return modifiedUnit;
}


// --- Rendering Functions ---

/**
 * Renders the unit table rows based on the provided data.
 * @param {Array<Object>} dataToRender - The array of unit objects to display.
 */
function renderUnitTable(dataToRender) {
    unitTableBody.innerHTML = ''; // Clear existing rows
    if (dataToRender.length === 0) {
        noResultsMessage.classList.remove('hidden');
        unitTableContainer.classList.add('hidden');
        return;
    } else {
        noResultsMessage.classList.add('hidden');
        unitTableContainer.classList.remove('hidden');
    }

    const unitsToDisplay = modEffectsEnabled ? dataToRender.map(unit => applyModEffects(unit, mods)) : dataToRender;

    unitsToDisplay.forEach(unit => {
        const row = unitTableBody.insertRow();
        // Add rarity class for styling, ensuring it's a valid CSS class name
        row.classList.add(`rarity-${unit.Rarity.replace(/\s/g, '')}`);

        // Define the order of columns as in the table header
        const columnOrder = [
            'Label', 'Class', 'Rarity', 'HP', 'Damage', 'Cooldown', 'Distance',
            'CritChance', 'CritDamage', 'AttackEffect', 'AttackEffectType',
            'AttackEffectLifesteal', 'AttackEffectKey', 'Knockback', 'Accuracy',
            'EvadeChance', 'HPOffset', 'ShadowStepDistance', 'ShadowStepCooldown'
        ];

        columnOrder.forEach(key => {
            const cell = row.insertCell();
            let displayValue = unit[key];
            // Format numbers to 2 decimal places if they are floats
            if (typeof displayValue === 'number' && !Number.isInteger(displayValue)) {
                displayValue = displayValue.toFixed(2);
            }
            cell.textContent = displayValue !== undefined ? displayValue : 'N/A';
        });
    });
}

/**
 * Renders the mod table rows.
 * @param {Array<Object>} dataToRender - The array of mod objects to display.
 */
function renderModTable(dataToRender) {
    modsTableBody.innerHTML = ''; // Clear existing rows
    if (dataToRender.length === 0) {
        modsTableBody.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-gray-600 dark:text-gray-400">No mod data available.</td></tr>';
        return;
    }

    dataToRender.forEach(mod => {
        const row = modsTableBody.insertRow();
        row.classList.add('bg-white', 'dark:bg-gray-700'); // Apply base row styling

        // Define the order of columns for mods
        const columnOrder = ['Label', 'Effect', 'AppliesTo'];

        columnOrder.forEach(key => {
            const cell = row.insertCell();
            cell.classList.add('py-4', 'px-6', 'whitespace-nowrap', 'text-sm');
            if (key === 'Label') {
                cell.classList.add('font-medium', 'text-gray-900', 'dark:text-gray-100');
            } else {
                cell.classList.add('text-gray-500', 'dark:text-gray-300');
            }
            cell.textContent = mod[key] !== undefined ? mod[key] : 'N/A';
        });
    });
}


// --- Sorting and Filtering ---

/**
 * Sorts the units array based on the given column and current sort direction.
 * @param {string} column - The column key to sort by.
 */
function sortData(column) {
    if (currentSortColumn === column) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = column;
        currentSortDirection = 'asc'; // Default to ascending for new column
    }

    // Sort units (original data)
    units.sort((a, b) => {
        const valA = a[column];
        const valB = b[column];

        // Handle "N/A" values by treating them as lowest/highest for sorting
        if (valA === 'N/A' && valB === 'N/A') return 0;
        if (valA === 'N/A') return currentSortDirection === 'asc' ? 1 : -1;
        if (valB === 'N/A') return currentSortDirection === 'asc' ? -1 : 1;

        // Numeric comparison
        if (typeof valA === 'number' && typeof valB === 'number') {
            return currentSortDirection === 'asc' ? valA - valB : valB - valA;
        }
        // String comparison
        return currentSortDirection === 'asc' ?
            String(valA).localeCompare(String(valB)) :
            String(valB).localeCompare(String(valA));
    });
    filterAndRenderUnits(); // Re-render after sorting
}

/**
 * Filters the units data based on search input, rarity, and class filters, then renders the table.
 */
function filterAndRenderUnits() {
    const searchTerm = searchInput.value.toLowerCase();
    const selectedRarity = rarityFilter.value;
    const selectedClass = classFilter.value;

    const filteredUnits = units.filter(unit => {
        const matchesSearch = Object.values(unit).some(value =>
            String(value).toLowerCase().includes(searchTerm)
        );
        const matchesRarity = selectedRarity === '' || unit.Rarity === selectedRarity;
        const matchesClass = selectedClass === '' || unit.Class === selectedClass;

        return matchesSearch && matchesRarity && matchesClass;
    });

    renderUnitTable(filteredUnits);
}

/**
 * Populates the rarity filter dropdown.
 */
function populateRarityFilter() {
    const rarityOrder = ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic", "Demonic", "Ancient"];
    rarityFilter.innerHTML = '<option value="">All Rarity</option>'; // Reset
    rarityOrder.forEach(rarity => {
        const option = document.createElement('option');
        option.value = rarity;
        option.textContent = rarity;
        rarityFilter.appendChild(option);
    });
}

/**
 * Populates the class filter dropdown.
 */
function populateClassFilter() {
    const classes = new Set();
    units.forEach(unit => {
        if (unit.Class) {
            classes.add(unit.Class);
        }
    });
    const sortedClasses = Array.from(classes).sort();
    classFilter.innerHTML = '<option value="">All Classes</option>'; // Reset
    sortedClasses.forEach(cls => {
        const option = document.createElement('option');
        option.value = cls;
        option.textContent = cls;
        classFilter.appendChild(option);
    });
}


// --- Dark Mode Toggle ---

/**
 * Toggles dark mode on/off and saves preference to localStorage.
 */
function toggleDarkMode() {
    document.documentElement.classList.toggle('dark');
    document.body.classList.toggle('dark'); // Toggle for body as well for custom CSS
    document.body.classList.toggle('light'); // Toggle light class for custom CSS
    const isDarkMode = document.documentElement.classList.contains('dark');
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    updateDarkModeIcons(isDarkMode);
}

/**
 * Updates the sun/moon icons based on the current dark mode state.
 * @param {boolean} isDarkMode - True if dark mode is active, false otherwise.
 */
function updateDarkModeIcons(isDarkMode) {
    if (isDarkMode) {
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
    } else {
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
    }
}

/**
 * Initializes dark mode based on user's system preference or saved setting.
 */
function initializeDarkMode() {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
        document.body.classList.remove('light');
        updateDarkModeIcons(true);
    } else {
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('dark');
        document.body.classList.add('light');
        updateDarkModeIcons(false);
    }
}


// --- Tab Switching ---

/**
 * Switches between unit and mod tabs.
 * @param {string} tabId - The ID of the tab to activate ('unitsTab' or 'modsTab').
 */
function switchTab(tabId) {
    // Deactivate all tab buttons and hide all tab contents
    document.querySelectorAll('.tab-button').forEach(button => button.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));

    // Activate the clicked tab button and show its content
    document.getElementById(tabId).classList.add('active');
    if (tabId === 'unitsTab') {
        unitsContent.classList.remove('hidden');
        filterAndRenderUnits(); // Re-render units when switching back
    } else if (tabId === 'modsTab') {
        modsContent.classList.remove('hidden');
        renderModTable(mods); // Render mods when switching to mods tab
    }
}


// --- Initialization ---

// Event Listeners
window.onload = function() {
    initializeDarkMode(); // Set initial dark mode state

    loadingSpinner.classList.remove('hidden'); // Show spinner
    unitTableContainer.classList.add('hidden'); // Hide unit table
    modsContent.classList.add('hidden'); // Ensure mods content is hidden initially

    // Simulate a delay for parsing data
    setTimeout(() => {
        units = parseData(rawUnitData);
        mods = parseData(rawModData); // Parse mod data
        populateRarityFilter();
        populateClassFilter(); // Populate class filter after parsing
        filterAndRenderUnits(); // Initial render of units
        renderModTable(mods); // Initial render of mods (will be hidden initially)

        loadingSpinner.classList.add('hidden'); // Hide spinner
        unitTableContainer.classList.remove('hidden'); // Show unit table
    }, 500); // Small delay to show spinner

    // Search and Filter Events
    searchInput.addEventListener('input', filterAndRenderUnits);
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

    // Mod Effects Toggle Event
    toggleModEffects.addEventListener('change', () => {
        modEffectsEnabled = toggleModEffects.checked;
        filterAndRenderUnits(); // Re-render units to apply/remove mod effects
    });
};
