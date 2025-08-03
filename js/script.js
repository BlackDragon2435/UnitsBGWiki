// js/script.js
// This file has been rewritten to be more robust, handling data loading,
// DOM readiness, and preventing errors more gracefully.

import { unitImages } from './unitImages.js';
import { gameData } from './gameData.js';

// IMPORTANT: Base URL for your published Google Sheet
// This URL should point to your Google Sheet published to web as CSV.
// To get this URL, go to File > Share > Publish to web > Publish to web > Link.
// Choose the sheet and format as "Comma-separated values (.csv)", then copy the URL.
const GOOGLE_SHEET_BASE_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQO78VJA7y_g5zHpzw1gTaJhLV2mjNdRxA33zcj1WPFj-QYxQS09nInTQXg6kXNJcjm4f7Gk7lPVZuV/pub?output=csv';

// Specific URLs for each sheet using their GIDs
const GOOGLE_SHEET_UNIT_DATA_CSV_URL = GOOGLE_SHEET_BASE_URL + '&gid=201310748&single=true'; // Unit Info (Sheet 1)
const GOOGLE_SHEET_TIER_LIST_CSV_URL = GOOGLE_SHEET_BASE_URL + '&gid=0&single=true'; // Tier List (Sheet 2)
const GOOGLE_SHEET_MOD_DATA_CSV_URL = GOOGLE_SHEET_BASE_URL + '&gid=861113038&single=true'; // Mod List (Sheet 3)
const GOOGLE_SHEET_UNIT_IMAGES_CSV_URL = GOOGLE_SHEET_BASE_URL + '&gid=2135678370&single=true'; // Unit Images (Sheet 4)


// Global state
let allUnits = [];
let allMods = [];
let allTierList = [];
let allUnitImages = {};
let currentSortColumn = 'name';
let sortDirection = 'asc';
let modEffectsEnabled = false;
let maxLevelGlobalEnabled = false;

// Function to safely get a DOM element
const getElement = (id) => {
    const element = document.getElementById(id);
    if (!element) {
        console.error(`Error: Could not find element with ID "${id}".`);
    }
    return element;
};

// Data parsing and fetching functions
const parseCSV = (csvText) => {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(header => header.trim().replace(/"/g, ''));
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(value => value.trim().replace(/"/g, ''));
        if (values.length === headers.length) {
            const entry = {};
            headers.forEach((header, index) => {
                entry[header] = values[index];
            });
            data.push(entry);
        }
    }
    return data;
};

const fetchData = async (url) => {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const csvText = await response.text();
        return parseCSV(csvText);
    } catch (error) {
        console.error(`Could not fetch data from ${url}:`, error);
        return null;
    }
};

const parseUnitData = (data) => {
    return data.map(unit => {
        const parsedUnit = {
            ...unit,
            HP: parseFloat(unit.HP) || 0,
            Damage: parseFloat(unit.Damage) || 0,
            Cooldown: parseFloat(unit.Cooldown) || 0,
            Distance: parseFloat(unit.Distance) || 0,
            Knockback: parseFloat(unit.Knockback) || 0,
            Accuracy: parseFloat(unit.Accuracy) || 0,
            EvadeChance: parseFloat(unit.EvadeChance) || 0,
            CritChance: parseFloat(unit.CritChance) || 0,
            CritDamage: parseFloat(unit.CritDamage) || 0,
            Price: gameData.PriceByRarity[unit.Rarity] || 0,
            XP: gameData.XPByRarity[unit.Rarity] || 0
        };
        return parsedUnit;
    });
};

const applyGameDataModifiers = (units) => {
  return units.map(unit => {
    // If the max level toggle is enabled, apply max level stats
    const unitWithMods = { ...unit };

    if (maxLevelGlobalEnabled) {
      // Find the rarity of the unit to get the modifiers from gameData
      const rarity = unit.Rarity;
      const classType = unit.Class;

      // Get the base stat modifiers for the class
      const classModifiers = gameData.StatsByClassAndRarity[classType];

      if (classModifiers) {
        // Apply modifiers for each stat if they exist
        ['HP', 'Cooldown', 'Damage'].forEach(stat => {
          if (classModifiers[stat]) {
            const baseValue = classModifiers[stat]._value;
            const rarityModifier = classModifiers[stat]._attributes[rarity];
            if (rarityModifier !== undefined) {
              // Note: The logic for Cooldown seems to be a negative modifier
              // The original logic just added the values. We'll follow that.
              const calculatedValue = (unitWithMods[stat] || 0) + (baseValue + rarityModifier);
              unitWithMods[stat] = calculatedValue;
            }
          }
        });
      }
    }

    // Apply global mod effects if enabled (this part is more of a placeholder,
    // as the actual mod effects would depend on which mod is selected, but
    // we can use a simplified logic for now).
    if (modEffectsEnabled) {
      // Example: A global "mod" that increases all damage by 10%
      unitWithMods.Damage = (unitWithMods.Damage * 1.1).toFixed(2);
    }

    return unitWithMods;
  });
};

const loadGameData = async () => {
    try {
        const unitsData = await fetchData(GOOGLE_SHEET_UNIT_DATA_CSV_URL);
        const modsData = await fetchData(GOOGLE_SHEET_MOD_DATA_CSV_URL);
        const tierListData = await fetchData(GOOGLE_SHEET_TIER_LIST_CSV_URL);
        const unitImagesData = await fetchData(GOOGLE_SHEET_UNIT_IMAGES_CSV_URL);

        if (unitsData) {
            allUnits = parseUnitData(unitsData);
        } else {
            const noUnitsMessage = getElement('noUnitsMessage');
            if (noUnitsMessage) noUnitsMessage.classList.remove('hidden');
        }

        if (modsData) {
            allMods = modsData;
        } else {
            const noModsMessage = getElement('noModsMessage');
            if (noModsMessage) noModsMessage.classList.remove('hidden');
        }
        
        if (tierListData) {
            allTierList = tierListData;
        } else {
            const noTierListMessage = getElement('noTierListMessage');
            if (noTierListMessage) noTierListMessage.classList.remove('hidden');
        }

        if (unitImagesData) {
            allUnitImages = unitImagesData.reduce((acc, current) => {
                acc[current.Name] = current.ImageURL;
                return acc;
            }, {});
        } else {
          console.warn("Could not fetch unit images from Google Sheet. Using local fallbacks if available.");
          allUnitImages = unitImages;
        }
    } catch (error) {
        console.error("Failed to load game data:", error);
        const noUnitsMessage = getElement('noUnitsMessage');
        const noModsMessage = getElement('noModsMessage');
        const noTierListMessage = getElement('noTierListMessage');
        if (noUnitsMessage) noUnitsMessage.classList.remove('hidden');
        if (noModsMessage) noModsMessage.classList.remove('hidden');
        if (noTierListMessage) noTierListMessage.classList.remove('hidden');
    }
};

const renderUnitsTable = (units) => {
    const tableBody = getElement('unitTableBody');
    const tableContainer = getElement('unitTableContainer');
    const noUnitsMessage = getElement('noUnitsMessage');
    
    if (!tableBody || !tableContainer || !noUnitsMessage) {
        console.error("Required DOM elements for units table not found.");
        return;
    }

    tableBody.innerHTML = ''; // Clear existing data

    if (units.length === 0) {
        tableContainer.classList.add('hidden');
        noUnitsMessage.classList.remove('hidden');
        return;
    }

    const unitsWithMods = applyGameDataModifiers(units);

    unitsWithMods.forEach(unit => {
        const row = document.createElement('tr');
        row.classList.add('hover:bg-gray-50', 'dark:hover:bg-gray-600', 'unit-table-row');
        
        row.innerHTML = `
            <td class="py-3 px-6 text-sm whitespace-nowrap font-medium text-gray-900 dark:text-gray-200">
                <div class="flex items-center">
                    <img src="${allUnitImages[unit.Label] || 'https://placehold.co/60x60/1f2937/d1d5db?text=N/A'}" onerror="this.onerror=null; this.src='https://placehold.co/60x60/1f2937/d1d5db?text=N/A'" alt="${unit.Label}" class="w-10 h-10 rounded-full mr-4">
                    <span>${unit.Label}</span>
                </div>
            </td>
            <td class="unit-class-cell py-3 px-6 text-sm text-gray-500 dark:text-gray-400">${unit.Class}</td>
            <td class="py-3 px-6 text-sm text-gray-500 dark:text-gray-400">${unit.Rarity}</td>
            <td class="unit-hp-cell py-3 px-6 text-sm text-gray-500 dark:text-gray-400">${unit.HP.toFixed(2)}</td>
            <td class="unit-damage-cell py-3 px-6 text-sm text-gray-500 dark:text-gray-400">${unit.Damage.toFixed(2)}</td>
            <td class="unit-cooldown-cell py-3 px-6 text-sm text-gray-500 dark:text-gray-400">${unit.Cooldown.toFixed(2)}</td>
            <td class="unit-crit-chance-cell py-3 px-6 text-sm text-gray-500 dark:text-gray-400">${unit.CritChance.toFixed(2)}</td>
            <td class="unit-crit-damage-cell py-3 px-6 text-sm text-gray-500 dark:text-gray-400">${unit.CritDamage.toFixed(2)}</td>
            <td class="unit-accuracy-cell py-3 px-6 text-sm text-gray-500 dark:text-gray-400">${unit.Accuracy.toFixed(2)}</td>
            <td class="unit-evade-cell py-3 px-6 text-sm text-gray-500 dark:text-gray-400">${unit.EvadeChance.toFixed(2)}</td>
            <td class="unit-distance-cell py-3 px-6 text-sm text-gray-500 dark:text-gray-400">${unit.Distance.toFixed(2)}</td>
            <td class="unit-knockback-cell py-3 px-6 text-sm text-gray-500 dark:text-gray-400">${unit.Knockback.toFixed(2)}</td>
        `;
        tableBody.appendChild(row);
    });

    tableContainer.classList.remove('hidden');
    noUnitsMessage.classList.add('hidden');
};

const renderModsTable = (mods) => {
    const tableBody = getElement('modTableBody');
    const tableContainer = getElement('modTableContainer');
    const noModsMessage = getElement('noModsMessage');

    if (!tableBody || !tableContainer || !noModsMessage) {
        console.error("Required DOM elements for mods table not found.");
        return;
    }

    tableBody.innerHTML = '';
    if (mods.length === 0) {
        tableContainer.classList.add('hidden');
        noModsMessage.classList.remove('hidden');
        return;
    }

    mods.forEach(mod => {
        const row = document.createElement('tr');
        row.classList.add('hover:bg-gray-50', 'dark:hover:bg-gray-600');
        row.innerHTML = `
            <td class="py-3 px-6 text-sm font-medium text-gray-900 dark:text-gray-200">${mod.Title}</td>
            <td class="py-3 px-6 text-sm text-gray-500 dark:text-gray-400">${mod.Rarity}</td>
            <td class="py-3 px-6 text-sm text-gray-500 dark:text-gray-400">${mod.Stat}</td>
            <td class="py-3 px-6 text-sm text-gray-500 dark:text-gray-400">${mod.Amount}</td>
            <td class="py-3 px-6 text-sm text-gray-500 dark:text-gray-400">${mod.Chance}</td>
            <td class="py-3 px-6 text-sm text-gray-500 dark:text-gray-400">${mod.Effect}</td>
        `;
        tableBody.appendChild(row);
    });

    tableContainer.classList.remove('hidden');
    noModsMessage.classList.add('hidden');
};

const renderTierListTable = (tierList) => {
    const tableBody = getElement('tierListTableBody');
    const tableContainer = getElement('tierListTableContainer');
    const noTierListMessage = getElement('noTierListMessage');

    if (!tableBody || !tableContainer || !noTierListMessage) {
        console.error("Required DOM elements for tier list table not found.");
        return;
    }

    tableBody.innerHTML = '';
    if (tierList.length === 0) {
        tableContainer.classList.add('hidden');
        noTierListMessage.classList.remove('hidden');
        return;
    }
    
    tierList.forEach(item => {
        const row = document.createElement('tr');
        row.classList.add('hover:bg-gray-50', 'dark:hover:bg-gray-600');
        row.innerHTML = `
            <td class="py-3 px-6 text-sm font-medium text-gray-900 dark:text-gray-200">${item.UnitName}</td>
            <td class="py-3 px-6 text-sm text-gray-500 dark:text-gray-400">${item.Tier}</td>
            <td class="py-3 px-6 text-sm text-gray-500 dark:text-gray-400">${item.NumericalRank}</td>
            <td class="py-3 px-6 text-sm text-gray-500 dark:text-gray-400">${item.Notes}</td>
        `;
        tableBody.appendChild(row);
    });

    tableContainer.classList.remove('hidden');
    noTierListMessage.classList.add('hidden');
};

// Filtering logic
const filterAndRenderUnits = () => {
    const searchInput = getElement('searchInput');
    const rarityFilter = getElement('rarityFilter');
    const classFilter = getElement('classFilter');
    if (!searchInput || !rarityFilter || !classFilter) {
      console.error("Filter elements not found.");
      return;
    }

    const searchTerm = searchInput.value.toLowerCase();
    const selectedRarity = rarityFilter.value;
    const selectedClass = classFilter.value;

    let filteredUnits = allUnits.filter(unit => {
        const matchesSearch = searchTerm === '' || 
            unit.Label.toLowerCase().includes(searchTerm) || 
            unit.Class.toLowerCase().includes(searchTerm) || 
            unit.Rarity.toLowerCase().includes(searchTerm);
        
        const matchesRarity = selectedRarity === 'all' || unit.Rarity === selectedRarity;
        const matchesClass = selectedClass === 'all' || unit.Class === selectedClass;
        
        return matchesSearch && matchesRarity && matchesClass;
    });

    // Sort the filtered data before rendering
    filteredUnits = sortData(currentSortColumn, filteredUnits);

    renderUnitsTable(filteredUnits);
};

// Sorting logic
const sortData = (column, data) => {
    const dataToSort = data || [...allUnits]; // Use the provided data or allUnits if none provided

    if (currentSortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = column;
        sortDirection = 'asc';
    }

    const sortedData = dataToSort.sort((a, b) => {
        const valA = a[column];
        const valB = b[column];

        // Handle numeric and string sorting
        if (typeof valA === 'number' && typeof valB === 'number') {
            return sortDirection === 'asc' ? valA - valB : valB - valA;
        } else {
            return sortDirection === 'asc' ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
        }
    });

    // If sorting a new column on the units table, re-render it
    if (!data) {
        renderUnitsTable(sortedData);
    }
    
    return sortedData;
};

// Dark mode toggle logic
const toggleDarkMode = () => {
    document.body.classList.toggle('dark');
    const isDarkMode = document.body.classList.contains('dark');
    localStorage.setItem('darkMode', isDarkMode);
};

// Tab switching logic
const switchTab = (tabId) => {
    const tabs = ['unitsTab', 'modsTab', 'tierListTab'];
    const contents = ['unitsContent', 'modsContent', 'tierListContent'];
    
    // Deactivate all tabs and hide all content
    tabs.forEach(id => {
        const tab = getElement(id);
        if (tab) tab.classList.remove('tab-btn-active');
    });
    contents.forEach(id => {
        const content = getElement(id);
        if (content) content.classList.add('hidden');
    });
    
    // Activate the clicked tab and show its content
    const activeTab = getElement(tabId);
    const activeContent = getElement(tabId.replace('Tab', 'Content'));
    
    if (activeTab) activeTab.classList.add('tab-btn-active');
    if (activeContent) activeContent.classList.remove('hidden');

    // Render the correct content for the tab
    if (tabId === 'unitsTab') {
        filterAndRenderUnits();
    } else if (tabId === 'modsTab') {
        renderModsTable(allMods);
    } else if (tabId === 'tierListTab') {
        renderTierListTable(allTierList);
    }
};

// Helper function for debouncing
const debounce = (func, delay) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
};

// Main initialization function
const initialize = async () => {
    await loadGameData();
    filterAndRenderUnits();
    renderModsTable(allMods);
    renderTierListTable(allTierList);
    populateFilters();

    // Check for dark mode preference
    const darkModePref = localStorage.getItem('darkMode');
    if (darkModePref === 'true' || (darkModePref === null && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.body.classList.add('dark');
    }

    // Event listeners
    const searchInput = getElement('searchInput');
    const rarityFilter = getElement('rarityFilter');
    const classFilter = getElement('classFilter');
    const tableHeaders = document.querySelectorAll('#unitTable thead th[data-sort]');
    const darkModeToggle = getElement('darkModeToggle');
    const unitsTab = getElement('unitsTab');
    const modsTab = getElement('modsTab');
    const tierListTab = getElement('tierListTab');
    const toggleModEffects = getElement('toggleModEffects');
    const toggleMaxLevel = getElement('toggleMaxLevel');

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

    // Set default tab
    switchTab('unitsTab');
};

const populateFilters = () => {
    const rarityFilter = getElement('rarityFilter');
    const classFilter = getElement('classFilter');
    if (!rarityFilter || !classFilter) return;

    // Populate rarity filter
    const uniqueRarities = [...new Set(allUnits.map(unit => unit.Rarity))];
    uniqueRarities.forEach(rarity => {
        const option = document.createElement('option');
        option.value = rarity;
        option.textContent = rarity;
        rarityFilter.appendChild(option);
    });

    // Populate class filter
    const uniqueClasses = [...new Set(allUnits.map(unit => unit.Class))];
    uniqueClasses.forEach(unitClass => {
        const option = document.createElement('option');
        option.value = unitClass;
        option.textContent = unitClass;
        classFilter.appendChild(option);
    });
};

// Initialize the app when the DOM is ready
document.addEventListener('DOMContentLoaded', initialize);
