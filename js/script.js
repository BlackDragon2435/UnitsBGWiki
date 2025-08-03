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
const GOOGLE_SHEET_MOD_DATA_CSV_URL = GOOGLE_SHEET_BASE_URL + '&gid=1626019565&single=true'; // Mod Info (Sheet 3)

// Global variables to hold data
let allUnits = [];
let units = [];
let mods = [];
let tierList = [];
let modEffects = {}; // This will now be populated from the mods data
let currentSortColumn = null;
let sortDirection = 'asc';
let modEffectsEnabled = false;
let maxLevelGlobalEnabled = false;
let expandedUnitRowId = null; // Track the currently expanded unit row

// UI elements
const unitsTab = document.getElementById('unitsTab');
const modsTab = document.getElementById('modsTab');
const tierListTab = document.getElementById('tierListTab');
const unitsSection = document.getElementById('unitsSection');
const modsSection = document.getElementById('modsSection');
const tierListSection = document.getElementById('tierListSection');
const loadingSpinner = document.getElementById('loadingSpinner');
const unitTableContainer = document.getElementById('unitTableContainer');
const modTableContainer = document.getElementById('modTableContainer');
const tierListTableContainer = document.getElementById('tierListTableContainer');
const unitTableBody = document.getElementById('unitTableBody');
const modTableBody = document.getElementById('modTableBody');
const tierListTableBody = document.getElementById('tierListTableBody');
const noModsMessage = document.getElementById('noModsMessage');
const noTierListMessage = document.getElementById('noTierListMessage');
const searchInput = document.getElementById('searchInput');
const rarityFilter = document.getElementById('rarityFilter');
const classFilter = document.getElementById('classFilter');
const modSearchInput = document.getElementById('modSearchInput');
const tableHeaders = document.querySelectorAll('#unitTable thead th');
const darkModeToggle = document.getElementById('darkModeToggle');
const darkModeIcon = document.getElementById('darkModeIcon');
const toggleMaxLevel = document.getElementById('toggleMaxLevel');
const mainTitle = document.getElementById('mainTitle');
const toggleModEffects = document.getElementById('toggleModEffects');

// Helper function to handle fetching CSV data with error handling
const fetchData = async (url) => {
    try {
        const response = await fetch(url);
        // Check for non-2xx status codes
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.text();
    } catch (error) {
        console.error('Failed to fetch data:', error);
        // Show the user a message about the failure
        const activeTab = document.querySelector('.tab-button.active');
        if (activeTab) {
            if (activeTab.id === 'unitsTab') {
                document.getElementById('noUnitsMessage').textContent = 'Failed to load unit data. Please check the Google Sheet link and publish settings.';
                document.getElementById('noUnitsMessage').classList.remove('hidden');
                unitTableContainer.classList.add('hidden');
            } else if (activeTab.id === 'modsTab') {
                noModsMessage.textContent = 'Failed to load mods data. Please check the Google Sheet link and publish settings.';
                noModsMessage.classList.remove('hidden');
                modTableContainer.classList.add('hidden');
            } else if (activeTab.id === 'tierListTab') {
                noTierListMessage.textContent = 'Failed to load tier list data. Please check the Google Sheet link and publish settings.';
                noTierListMessage.classList.remove('hidden');
                tierListTableContainer.classList.add('hidden');
            }
        }
        return null;
    }
};

// Function to parse CSV data
const parseCSV = (csv) => {
    if (!csv) {
        console.warn('Attempted to parse null or empty CSV data.');
        return [];
    }
    const lines = csv.trim().split('\n');
    const headers = lines[0].split(',').map(header => header.trim());
    return lines.slice(1).map(line => {
        const values = line.split(',').map(value => value.trim());
        let obj = {};
        headers.forEach((header, i) => {
            obj[header] = values[i] || ''; // Handle potential missing values
        });
        return obj;
    }).filter(obj => obj.UnitName !== undefined && obj.UnitName !== ''); // Filter out empty or malformed rows
};

// Load all data from Google Sheets
const loadAllData = async () => {
    showLoadingSpinner();
    
    // Fetch all data in parallel
    const [unitCsv, modCsv, tierListCsv] = await Promise.all([
        fetchData(GOOGLE_SHEET_UNIT_DATA_CSV_URL),
        fetchData(GOOGLE_SHEET_MOD_DATA_CSV_URL),
        fetchData(GOOGLE_SHEET_TIER_LIST_CSV_URL)
    ]);

    // Process and store the data, gracefully handling potential null returns
    if (unitCsv) {
        allUnits = parseCSV(unitCsv).map(processUnitData); // Process data on load
        units = [...allUnits];
        populateFilters();
        filterAndRenderUnits();
    } else {
        allUnits = [];
        units = [];
        console.warn("Unit data could not be loaded. Displaying empty table.");
    }

    if (modCsv) {
        mods = parseCSV(modCsv);
        // Create the modEffects object from the mods array
        modEffects = mods.reduce((acc, mod) => {
            acc[mod.ModName] = mod.Effect;
            return acc;
        }, {});
        renderMods();
    } else {
        mods = [];
        modEffects = {};
        console.warn("Mod data could not be loaded. Displaying empty table.");
    }
    
    if (tierListCsv) {
        tierList = parseCSV(tierListCsv);
        renderTierList();
    } else {
        tierList = [];
        console.warn("Tier list data could not be loaded. Displaying empty table.");
    }

    hideLoadingSpinner();
};

// Function to process unit data
const processUnitData = (unit) => {
    // Trim string values
    for (const key in unit) {
        if (typeof unit[key] === 'string') {
            unit[key] = unit[key].trim();
        }
    }
    
    // Convert numeric fields to numbers
    unit.Damage = parseFloat(unit.Damage);
    unit.HP = parseFloat(unit.HP);
    unit.AttackSpeed = parseFloat(unit.AttackSpeed);
    unit.Range = parseFloat(unit.Range);
    unit.MaxHP = parseFloat(unit.MaxHP);
    unit.MaxDamage = parseFloat(unit.MaxDamage);
    unit.MaxAttackSpeed = parseFloat(unit.MaxAttackSpeed);

    // Calculate DPS and Max DPS
    unit.DPS = unit.AttackSpeed > 0 ? (unit.Damage / unit.AttackSpeed) : 0;
    unit.MaxDPS = unit.MaxAttackSpeed > 0 ? (unit.MaxDamage / unit.MaxAttackSpeed) : 0;
    
    return unit;
};

// Function to populate rarity and class filters
const populateFilters = () => {
    const uniqueRarities = [...new Set(allUnits.map(unit => unit.Rarity))].filter(r => r);
    const uniqueClasses = [...new Set(allUnits.map(unit => unit.Class))].filter(c => c);

    rarityFilter.innerHTML = '<option value="All">All Rarity</option>' + uniqueRarities.map(rarity => `<option value="${rarity}">${rarity}</option>`).join('');
    classFilter.innerHTML = '<option value="All">All Class</option>' + uniqueClasses.map(className => `<option value="${className}">${className}</option>`).join('');
};

// Function to filter and render units
const filterAndRenderUnits = () => {
    let filteredUnits = [...allUnits];

    // Filter by search input
    const searchTerm = searchInput.value.toLowerCase();
    if (searchTerm) {
        filteredUnits = filteredUnits.filter(unit => unit.UnitName.toLowerCase().includes(searchTerm));
    }

    // Filter by rarity
    const selectedRarity = rarityFilter.value;
    if (selectedRarity !== 'All') {
        filteredUnits = filteredUnits.filter(unit => unit.Rarity === selectedRarity);
    }

    // Filter by class
    const selectedClass = classFilter.value;
    if (selectedClass !== 'All') {
        filteredUnits = filteredUnits.filter(unit => unit.Class === selectedClass);
    }

    units = filteredUnits;
    sortData(currentSortColumn || 'UnitName'); // Re-sort after filtering
};

// Function to render the unit table
const renderUnits = () => {
    if (units.length === 0) {
        unitTableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-gray-500 dark:text-gray-400">No units found.</td></tr>`;
        return;
    }
    
    unitTableBody.innerHTML = units.map(unit => {
        const rarityColor = gameData.RarityColors[unit.Rarity]?.color || '#FFFFFF';
        const classColor = gameData.ClassesColors[unit.Class]?.color || '#FFFFFF';
        
        // Determine which stats to display based on the toggle
        const damage = maxLevelGlobalEnabled ? unit.MaxDamage : unit.Damage;
        const hp = maxLevelGlobalEnabled ? unit.MaxHP : unit.HP;
        const dps = maxLevelGlobalEnabled ? unit.MaxDPS : unit.DPS;
        const attackSpeed = maxLevelGlobalEnabled ? unit.MaxAttackSpeed : unit.AttackSpeed;
        
        return `
            <tr data-id="${unit.UnitName}" class="bg-white border-b hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-600">
                <td class="flex items-center space-x-2 p-2">
                    <img src="${unit.ImageUrl || `https://placehold.co/40x40/1f2937/d1d5db?text=${unit.UnitName.substring(0, 2)}`}"
                         alt="${unit.UnitName}"
                         class="w-10 h-10 object-cover rounded-md"
                         onerror="this.onerror=null;this.src='https://placehold.co/40x40/1f2937/d1d5db?text=${unit.UnitName.substring(0, 2)}';">
                    <div class="font-medium text-gray-900 dark:text-white">${unit.UnitName}</div>
                </td>
                <td class="responsive-hide text-center p-2">
                    <span class="inline-block rounded-full px-3 py-1 text-xs font-semibold text-white"
                          style="background-color: ${rarityColor};">
                        ${unit.Rarity}
                    </span>
                </td>
                <td class="responsive-hide-sm text-center p-2">
                    <span class="inline-block rounded-full px-3 py-1 text-xs font-semibold text-white"
                          style="background-color: ${classColor};">
                        ${unit.Class}
                    </span>
                </td>
                <td class="text-center p-2">${damage.toFixed(2)}</td>
                <td class="text-center p-2">${hp.toFixed(2)}</td>
                <td class="responsive-hide text-center p-2">${dps.toFixed(2)}</td>
                <td class="responsive-hide text-center p-2">${unit.Range}</td>
                <td class="text-center p-2">${attackSpeed.toFixed(2)}</td>
            </tr>
        `;
    }).join('');
};

// Function to apply mod effects to a unit
const applyModEffects = (unit, activeMods) => {
    let newStats = { ...unit };

    // Find all mod effects that can be applied to the unit.
    const unitMods = unit.Mods.split(',').map(mod => mod.trim());
    
    // Check if a mod is in the activeMods array and also a valid mod for this unit.
    const modsToApply = activeMods.filter(modName => unitMods.includes(modName));

    modsToApply.forEach(modName => {
        const effectString = modEffects[modName];
        if (effectString) {
            // Simple parsing of effect string (e.g., "+10% Damage", "-5 AttackSpeed")
            const parts = effectString.match(/([+-])(\d+)(\%?)\s*([A-Za-z\s]+)/);
            if (parts) {
                const operator = parts[1];
                const value = parseFloat(parts[2]);
                const isPercentage = parts[3] === '%';
                const statName = parts[4].trim();

                // Apply effect to corresponding stat
                if (statName === 'Damage' && newStats.Damage !== undefined) {
                    newStats.Damage = isPercentage ? (operator === '+' ? newStats.Damage * (1 + value / 100) : newStats.Damage * (1 - value / 100)) : (operator === '+' ? newStats.Damage + value : newStats.Damage - value);
                } else if (statName === 'HP' && newStats.HP !== undefined) {
                    newStats.HP = isPercentage ? (operator === '+' ? newStats.HP * (1 + value / 100) : newStats.HP * (1 - value / 100)) : (operator === '+' ? newStats.HP + value : newStats.HP - value);
                } else if (statName === 'AttackSpeed' && newStats.AttackSpeed !== undefined) {
                    newStats.AttackSpeed = isPercentage ? (operator === '+' ? newStats.AttackSpeed * (1 + value / 100) : newStats.AttackSpeed * (1 - value / 100)) : (operator === '+' ? newStats.AttackSpeed + value : newStats.AttackSpeed - value);
                }
            }
        }
    });

    // Re-calculate DPS with new stats
    newStats.DPS = newStats.AttackSpeed > 0 ? (newStats.Damage / newStats.AttackSpeed) : 0;
    
    return newStats;
};

// Function to render unit details in an expandable row
const renderUnitDetails = (unit, row, activeMods = []) => {
    const detailsRow = document.createElement('tr');
    detailsRow.id = `details-${unit.UnitName}`;
    detailsRow.classList.add('expanded-details-row');

    // Get the modified stats based on active mods
    const modifiedUnit = applyModEffects(unit, activeMods);

    // Create the HTML for the stats comparison
    const statComparisonHtml = `
        <div class="flex flex-col space-y-2 mt-4">
            <h4 class="font-bold text-lg text-gray-900 dark:text-white">Stats</h4>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <p class="text-sm font-semibold text-gray-700 dark:text-gray-300">Damage</p>
                    <p class="text-gray-600 dark:text-gray-400">Base: ${unit.Damage.toFixed(2)}</p>
                    <p class="font-bold ${modifiedUnit.Damage !== unit.Damage ? 'text-green-500' : 'text-gray-600 dark:text-gray-400'}">Modified: ${modifiedUnit.Damage.toFixed(2)}</p>
                </div>
                <div>
                    <p class="text-sm font-semibold text-gray-700 dark:text-gray-300">HP</p>
                    <p class="text-gray-600 dark:text-gray-400">Base: ${unit.HP.toFixed(2)}</p>
                    <p class="font-bold ${modifiedUnit.HP !== unit.HP ? 'text-green-500' : 'text-gray-600 dark:text-gray-400'}">Modified: ${modifiedUnit.HP.toFixed(2)}</p>
                </div>
                <div>
                    <p class="text-sm font-semibold text-gray-700 dark:text-gray-300">Attack Speed</p>
                    <p class="text-gray-600 dark:text-gray-400">Base: ${unit.AttackSpeed.toFixed(2)}</p>
                    <p class="font-bold ${modifiedUnit.AttackSpeed !== unit.AttackSpeed ? 'text-green-500' : 'text-gray-600 dark:text-gray-400'}">Modified: ${modifiedUnit.AttackSpeed.toFixed(2)}</p>
                </div>
                <div>
                    <p class="text-sm font-semibold text-gray-700 dark:text-gray-300">DPS</p>
                    <p class="text-gray-600 dark:text-gray-400">Base: ${unit.DPS.toFixed(2)}</p>
                    <p class="font-bold ${modifiedUnit.DPS !== unit.DPS ? 'text-green-500' : 'text-gray-600 dark:text-gray-400'}">Modified: ${modifiedUnit.DPS.toFixed(2)}</p>
                </div>
            </div>
        </div>
    `;

    // Create the HTML for the mod list with checkboxes
    const modsHtml = unit.Mods.split(',').map(modName => {
        const modNameTrimmed = modName.trim();
        const effect = modEffects[modNameTrimmed] || 'No description available.';
        const isChecked = activeMods.includes(modNameTrimmed) ? 'checked' : '';
        
        return `<label class="flex items-center p-2 bg-gray-200 dark:bg-gray-700 rounded-lg text-sm cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                    <input type="checkbox" data-mod-name="${modNameTrimmed}" class="form-checkbox text-blue-600 rounded mr-2" ${isChecked}>
                    <div class="flex-grow">
                        <span class="font-bold">${modNameTrimmed}:</span> ${effect}
                    </div>
                </label>`;
    }).join('');

    detailsRow.innerHTML = `
        <td colspan="8" class="p-4">
            <div class="flex flex-col md:flex-row md:space-x-4 space-y-4 md:space-y-0">
                <!-- Left Column: Image and basic stats -->
                <div class="flex-shrink-0 flex flex-col items-center">
                    <img src="${unit.ImageUrl || `https://placehold.co/100x100/1f2937/d1d5db?text=${unit.UnitName.substring(0, 2)}`}"
                         alt="${unit.UnitName}"
                         class="w-24 h-24 object-cover rounded-md mb-2">
                    <div class="font-bold text-lg text-gray-900 dark:text-white">${unit.UnitName}</div>
                    <div class="text-sm text-gray-600 dark:text-gray-400">Class: ${unit.Class}</div>
                    <div class="text-sm text-gray-600 dark:text-gray-400">Rarity: ${unit.Rarity}</div>
                    ${statComparisonHtml}
                </div>
                <!-- Right Column: Mods and description -->
                <div class="flex-grow">
                    <h4 class="font-bold text-gray-900 dark:text-white mb-2">Description</h4>
                    <p class="text-gray-600 dark:text-gray-400 mb-4">${unit.Description || 'No description available.'}</p>
                    <h4 class="font-bold text-gray-900 dark:text-white mb-2">Mods</h4>
                    <div id="modCheckboxes-${unit.UnitName}" class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        ${modsHtml}
                    </div>
                </div>
            </div>
        </td>
    `;
    row.parentNode.insertBefore(detailsRow, row.nextSibling);

    // Add event listeners for the new checkboxes
    const modCheckboxesContainer = document.getElementById(`modCheckboxes-${unit.UnitName}`);
    modCheckboxesContainer.addEventListener('change', (event) => {
        if (event.target.type === 'checkbox') {
            const newActiveMods = Array.from(modCheckboxesContainer.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.dataset.modName);
            // Re-render the details row with the new active mods
            row.parentNode.removeChild(detailsRow); // Remove old row
            renderUnitDetails(unit, row, newActiveMods); // Render new row with updated stats
        }
    });
};

// Function to sort the data
const sortData = (column) => {
    // If the same column is clicked, reverse the direction
    if (currentSortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = column;
        sortDirection = 'asc'; // Default to ascending for a new column
    }

    units.sort((a, b) => {
        const valA = a[column];
        const valB = b[column];

        // Handle numeric and string sorting
        if (typeof valA === 'number' && typeof valB === 'number') {
            return sortDirection === 'asc' ? valA - valB : valB - valA;
        } else {
            const strA = String(valA).toLowerCase();
            const strB = String(valB).toLowerCase();
            if (strA < strB) return sortDirection === 'asc' ? -1 : 1;
            if (strA > strB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        }
    });

    // Update sort icons in table headers
    tableHeaders.forEach(header => {
        const icon = header.querySelector('i');
        if (icon) {
            icon.classList.remove('fa-sort-up', 'fa-sort-down', 'fa-sort-alpha-up-alt', 'fa-sort-alpha-down-alt');
            if (header.dataset.sort === currentSortColumn) {
                if (sortDirection === 'asc') {
                    icon.classList.add('fa-sort-up', 'fa-sort-alpha-up-alt');
                } else {
                    icon.classList.add('fa-sort-down', 'fa-sort-alpha-down-alt');
                }
            } else {
                icon.classList.add('fa-sort-alpha-down-alt');
            }
        }
    });
    
    renderUnits();
};

// Function to render the mods table
const renderMods = () => {
    if (mods.length === 0) {
        modTableBody.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-gray-500 dark:text-gray-400">No mods found.</td></tr>`;
        return;
    }
    modTableBody.innerHTML = mods.map(mod => `
        <tr class="bg-white border-b hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-600">
            <td class="p-2">${mod.ModName}</td>
            <td class="p-2">${mod.Effect}</td>
            <td class="p-2">${mod.Description}</td>
        </tr>
    `).join('');
};

// Function to render the tier list table
const renderTierList = () => {
    if (tierList.length === 0) {
        tierListTableBody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-gray-500 dark:text-gray-400">No tier list data found.</td></tr>`;
        return;
    }
    tierListTableBody.innerHTML = tierList.map(item => `
        <tr class="bg-white border-b hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-600">
            <td class="p-2">${item.UnitName}</td>
            <td class="p-2">${item.Tier}</td>
            <td class="p-2">${item.NumericalRank}</td>
            <td class="p-2">${item.Notes}</td>
        </tr>
    `).join('');
};

// Tab switching logic
const switchTab = (activeTabId) => {
    // Hide all sections
    unitsSection.classList.add('hidden');
    modsSection.classList.add('hidden');
    tierListSection.classList.add('hidden');

    // Remove active class from all buttons
    document.querySelectorAll('.tab-button').forEach(button => button.classList.remove('active'));

    // Show the selected section and add active class to the button
    const activeTab = document.getElementById(activeTabId);
    activeTab.classList.add('active');

    if (activeTabId === 'unitsTab') {
        unitsSection.classList.remove('hidden');
        if (units.length > 0) {
            unitTableContainer.classList.remove('hidden');
        } else {
            document.getElementById('noUnitsMessage').classList.remove('hidden');
        }
    } else if (activeTabId === 'modsTab') {
        modsSection.classList.remove('hidden');
        if (mods.length > 0) {
            modTableContainer.classList.remove('hidden');
        } else {
            noModsMessage.classList.remove('hidden');
        }
    } else if (activeTabId === 'tierListTab') {
        tierListSection.classList.remove('hidden');
        if (tierList.length > 0) {
            tierListTableContainer.classList.remove('hidden');
        } else {
            noTierListMessage.classList.remove('hidden');
        }
    }
};

// Dark mode toggle
const toggleDarkMode = () => {
    document.body.classList.toggle('dark');
    const isDarkMode = document.body.classList.contains('dark');
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    
    // Update the icon
    if (isDarkMode) {
        darkModeIcon.classList.remove('fa-moon');
        darkModeIcon.classList.add('fa-sun');
    } else {
        darkModeIcon.classList.remove('fa-sun');
        darkModeIcon.classList.add('fa-moon');
    }
};

// Check for user's preferred theme on page load
const initializeTheme = () => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        document.body.classList.add('dark');
        darkModeIcon.classList.remove('fa-moon');
        darkModeIcon.classList.add('fa-sun');
    } else {
        document.body.classList.remove('dark');
        darkModeIcon.classList.remove('fa-sun');
        darkModeIcon.classList.add('fa-moon');
    }
};

// Show/Hide loading spinner
const showLoadingSpinner = () => {
    loadingSpinner.classList.remove('hidden');
};

const hideLoadingSpinner = () => {
    loadingSpinner.classList.add('hidden');
};

// Debounce function to limit how often a function is called
const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(null, args);
        }, delay);
    };
};

// Entry point
window.onload = () => {
    initializeTheme();
    loadAllData();

    // Event listeners
    
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
