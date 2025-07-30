// js/script.js
import { rawUnitData } from './unitsData.js';
import { rawModData } from './modsData.js';
import { unitImages } from './unitImages.js';
import { gameData } from './gameData.js'; // Import gameData

// IMPORTANT: Replace this with the actual public CSV URL of your Google Sheet
// Go to your Google Sheet -> File -> Share -> Publish to web -> Select the sheet -> Choose CSV -> Copy the URL
const GOOGLE_SHEET_TIER_LIST_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQO78VJA7y_g5zHpzw1gTaJhLV2mjNdRxA33zcj1WPFj-QYxQS09nInTQXg6kXNJcjm4f7Gk7lPVZuV/pub?output=csv'; // <<< REPLACE THIS LINE with the actual CSV URL

let units = []; // Stores parsed unit data
let mods = [];  // Stores parsed mod data
let tierList = []; // Stores parsed tier list data
let currentSortColumn = null;
let currentSortDirection = 'asc'; // 'asc' or 'desc'
let modEffectsEnabled = false; // State for global mod effects toggle
let maxLevelGlobalEnabled = false; // Global state for max level toggle

// DOM Elements
const unitTableBody = document.getElementById('unitTableBody');
const searchInput = document.getElementById('searchInput');
const rarityFilter = document.getElementById('rarityFilter');
const classFilter = document.getElementById('classFilter');
const tableHeaders = document.querySelectorAll('#unitTable th[data-sort]');
const darkModeToggle = document.getElementById('darkModeToggle');
const unitsTab = document.getElementById('unitsTab');
const modsTab = document.getElementById('modsTab');
const tierListTab = document.getElementById('tierListTab'); // Get the new Tier List Tab
const toggleModEffects = document.getElementById('toggleModEffects');
const toggleMaxLevel = document.getElementById('toggleMaxLevel');

const unitsContent = document.getElementById('unitsContent');
const modsContent = document.getElementById('modsContent');
const tierListContent = document.getElementById('tierListContent'); // Get the new Tier List Content
const tierListTableBody = document.querySelector('#tierListTable tbody'); // Get the tier list table body

// Unit Detail Modal Elements
const unitDetailModal = document.getElementById('unitDetailModal');
const closeModalButton = document.getElementById('closeModal');
const modalUnitName = document.getElementById('modalUnitName');
const modalUnitImage = document.getElementById('modalUnitImage');
const modalUnitClass = document.getElementById('modalUnitClass');
const modalUnitRarity = document.getElementById('modalUnitRarity');
const modalUnitDescription = document.getElementById('modalUnitDescription');
const modalBaseStats = document.getElementById('modalBaseStats');
const modalMaxLevelStats = document.getElementById('modalMaxLevelStats');
const modalUnitSkills = document.getElementById('modalUnitSkills');
const modalRecommendedMods = document.getElementById('modalRecommendedMods');
const modCheckboxesContainer = document.getElementById('modCheckboxesContainer');
const modalAppliedModStats = document.getElementById('modalAppliedModStats');
const toggleMaxLevelUnit = document.getElementById('toggleMaxLevelUnit'); // Toggle for individual unit max level stats


// Utility function to debounce input for performance
const debounce = (func, delay) => {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
};

// Function to switch tabs
const switchTab = async (tabId) => {
    // Hide all tab contents
    unitsContent.classList.add('hidden');
    modsContent.classList.add('hidden');
    tierListContent.classList.add('hidden'); // Hide tier list content

    // Deactivate all tab buttons
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active-tab');
        button.classList.remove('border-blue-500', 'text-blue-500');
        button.classList.add('border-transparent', 'text-gray-600', 'dark:text-gray-400');
    });

    // Show the selected tab content and activate its button
    let selectedContent;
    let selectedButton;
    if (tabId === 'unitsTab') {
        selectedContent = unitsContent;
        selectedButton = unitsTab;
        filterAndRenderUnits(); // Re-render units when units tab is clicked
    } else if (tabId === 'modsTab') {
        selectedContent = modsContent;
        selectedButton = modsTab;
        renderModsTable(); // Render mods when mods tab is clicked
    } else if (tabId === 'tierListTab') { // Handle Tier List tab
        selectedContent = tierListContent;
        selectedButton = tierListTab;
        await fetchAndParseTierList(); // Fetch and parse tier list data when tab is clicked
        renderTierList(); // Render tier list
    }

    if (selectedContent) {
        selectedContent.classList.remove('hidden');
    }
    if (selectedButton) {
        selectedButton.classList.add('active-tab');
        selectedButton.classList.remove('border-transparent', 'text-gray-600', 'dark:text-gray-400');
        selectedButton.classList.add('border-blue-500', 'text-blue-500');
    }
};


// Function to fetch and parse the Tier List CSV
const fetchAndParseTierList = async () => {
    try {
        const response = await fetch(GOOGLE_SHEET_TIER_LIST_CSV_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const csvText = await response.text();
        tierList = parseCSV(csvText); // Assuming you have a parseCSV function
        console.log('Tier List Data:', tierList); // For debugging
    } catch (error) {
        console.error('Error fetching or parsing tier list CSV:', error);
        tierList = []; // Clear data on error
        // Optionally display an error message to the user
        tierListTableBody.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-red-500">Failed to load tier list. Please ensure the Google Sheet is published to web as CSV and the URL is correct.</td></tr>`;
    }
};


// Simple CSV Parser (you might need a more robust one depending on your CSV complexity)
const parseCSV = (csv) => {
    const lines = csv.split('\n').filter(line => line.trim() !== ''); // Filter out empty lines
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(header => header.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        if (values.length !== headers.length) {
            console.warn(`Skipping malformed row: ${lines[i]} - column count mismatch.`);
            continue; // Skip rows that don't match header count
        }
        const row = {};
        headers.forEach((header, index) => {
            row[header] = values[index].trim();
        });
        data.push(row);
    }
    return data;
};


// Function to render the Tier List table
const renderTierList = () => {
    tierListTableBody.innerHTML = ''; // Clear existing table rows

    if (tierList.length === 0) {
        tierListTableBody.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-gray-500 dark:text-gray-400">No tier list data available.</td></tr>`;
        return;
    }

    tierList.forEach(item => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors duration-150';

        // Assuming your CSV has 'Unit', 'Tier', and 'Notes' columns
        // Adjust these to match your actual CSV column headers
        row.innerHTML = `
            <td class="py-3 px-6 text-sm text-gray-900 dark:text-gray-200 whitespace-nowrap">${item.Unit || 'N/A'}</td>
            <td class="py-3 px-6 text-sm text-gray-900 dark:text-gray-200 whitespace-nowrap">${item.Tier || 'N/A'}</td>
            <td class="py-3 px-6 text-sm text-gray-900 dark:text-gray-200">${item.Notes || ''}</td>
        `;
        tierListTableBody.appendChild(row);
    });
};


// --- Placeholder Functions (Assume these exist in your original script.js) ---
// These functions are critical for the rest of your app and are included here
// as empty shells to ensure the new code integrates without errors.
// You should ensure your actual implementations are present.

const parseUnitData = () => {
    // Your existing parseUnitData logic
    // This function should populate the 'units' array from rawUnitData
    units = rawUnitData.map(unit => ({
        ...unit,
        // Ensure all necessary fields are parsed and available
        base_hp: parseFloat(unit.base_hp),
        base_attack: parseFloat(unit.base_attack),
        base_defense: parseFloat(unit.base_defense),
        base_speed: parseFloat(unit.base_speed),
        base_crit_rate: parseFloat(unit.base_crit_rate),
        base_crit_damage: parseFloat(unit.base_crit_damage),
        base_accuracy: parseFloat(unit.base_accuracy),
        base_resistance: parseFloat(unit.base_resistance),
        max_hp: parseFloat(unit.max_hp),
        max_attack: parseFloat(unit.max_attack),
        max_defense: parseFloat(unit.max_defense),
        max_speed: parseFloat(unit.max_speed),
        max_crit_rate: parseFloat(unit.max_crit_rate),
        max_crit_damage: parseFloat(unit.max_crit_damage),
        max_accuracy: parseFloat(unit.max_accuracy),
        max_resistance: parseFloat(unit.max_resistance),
        // Initialize an array to hold currently applied mods for this unit instance
        appliedMods: []
    }));
    console.log("Units data parsed:", units);
};

const parseModData = () => {
    // Your existing parseModData logic
    // This function should populate the 'mods' array from rawModData
    mods = rawModData.map(mod => ({
        ...mod,
        // Ensure numerical values are parsed
        value: parseFloat(mod.value)
    }));
    console.log("Mods data parsed:", mods);
};

const filterAndRenderUnits = () => {
    // Your existing filterAndRenderUnits logic
    // This function should filter units based on search/filters and render them to unitTableBody
    let filteredUnits = units;

    const searchTerm = searchInput.value.toLowerCase();
    if (searchTerm) {
        filteredUnits = filteredUnits.filter(unit =>
            unit.label.toLowerCase().includes(searchTerm) ||
            unit.class.toLowerCase().includes(searchTerm) ||
            unit.rarity.toLowerCase().includes(searchTerm)
        );
    }

    const selectedRarity = rarityFilter.value;
    if (selectedRarity) {
        filteredUnits = filteredUnits.filter(unit => unit.rarity === selectedRarity);
    }

    const selectedClass = classFilter.value;
    if (selectedClass) {
        filteredUnits = filteredUnits.filter(unit => unit.class === selectedClass);
    }

    // Apply global max level toggle
    let unitsToDisplay = filteredUnits.map(unit => {
        let displayUnit = { ...unit }; // Create a copy to modify
        if (maxLevelGlobalEnabled) {
            displayUnit.display_hp = unit.max_hp;
            displayUnit.display_attack = unit.max_attack;
            displayUnit.display_defense = unit.max_defense;
            displayUnit.display_speed = unit.max_speed;
            displayUnit.display_crit_rate = unit.max_crit_rate;
            displayUnit.display_crit_damage = unit.max_crit_damage;
            displayUnit.display_accuracy = unit.max_accuracy;
            displayUnit.display_resistance = unit.max_resistance;
        } else {
            displayUnit.display_hp = unit.base_hp;
            displayUnit.display_attack = unit.base_attack;
            displayUnit.display_defense = unit.base_defense;
            displayUnit.display_speed = unit.base_speed;
            displayUnit.display_crit_rate = unit.base_crit_rate;
            displayUnit.display_crit_damage = unit.base_crit_damage;
            displayUnit.display_accuracy = unit.base_accuracy;
            displayUnit.display_resistance = unit.base_resistance;
        }

        // Apply global mod effects if enabled
        if (modEffectsEnabled) {
            const tempAppliedMods = unit.recommended_mods.map(modName => mods.find(m => m.name === modName)).filter(Boolean);
            const calculatedStats = calculateModdedStats(displayUnit, tempAppliedMods);
            displayUnit.display_hp = calculatedStats.hp;
            displayUnit.display_attack = calculatedStats.attack;
            displayUnit.display_defense = calculatedStats.defense;
            displayUnit.display_speed = calculatedStats.speed;
            displayUnit.display_crit_rate = calculatedStats.crit_rate;
            displayUnit.display_crit_damage = calculatedStats.crit_crit_damage;
            displayUnit.display_accuracy = calculatedStats.accuracy;
            displayUnit.display_resistance = calculatedStats.resistance;
        }
        return displayUnit;
    });


    // Sorting logic
    if (currentSortColumn) {
        unitsToDisplay.sort((a, b) => {
            const aValue = a[currentSortColumn];
            const bValue = b[currentSortColumn];

            if (typeof aValue === 'string') {
                return currentSortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
            } else {
                return currentSortDirection === 'asc' ? aValue - bValue : bValue - aValue;
            }
        });
    }

    unitTableBody.innerHTML = ''; // Clear existing rows

    if (unitsToDisplay.length === 0) {
        unitTableBody.innerHTML = `<tr><td colspan="12" class="text-center py-4 text-gray-500 dark:text-gray-400">No units found matching your criteria.</td></tr>`;
        return;
    }

    unitsToDisplay.forEach(unit => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors duration-150 cursor-pointer';
        row.dataset.unitId = unit.id; // Store unit ID for modal

        const unitImage = unitImages[unit.id] || `https://placehold.co/50x50/cccccc/000000?text=NoImg`;

        row.innerHTML = `
            <td class="py-2 px-4 whitespace-nowrap"><img src="${unitImage}" alt="${unit.label}" class="w-10 h-10 rounded-full object-cover"></td>
            <td class="py-2 px-4 font-medium text-gray-900 dark:text-gray-200 whitespace-nowrap">${unit.label}</td>
            <td class="py-2 px-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">${unit.class}</td>
            <td class="py-2 px-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">${unit.rarity}</td>
            <td class="py-2 px-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">${unit.display_hp.toFixed(0)}</td>
            <td class="py-2 px-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">${unit.display_attack.toFixed(0)}</td>
            <td class="py-2 px-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">${unit.display_defense.toFixed(0)}</td>
            <td class="py-2 px-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">${unit.display_speed.toFixed(0)}</td>
            <td class="py-2 px-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">${(unit.display_crit_rate * 100).toFixed(1)}%</td>
            <td class="py-2 px-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">${(unit.display_crit_damage * 100).toFixed(1)}%</td>
            <td class="py-2 px-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">${(unit.display_accuracy * 100).toFixed(1)}%</td>
            <td class="py-2 px-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">${(unit.display_resistance * 100).toFixed(1)}%</td>
        `;
        unitTableBody.appendChild(row);

        // Add event listener to open modal on row click
        row.addEventListener('click', () => openUnitDetailModal(unit.id));
    });
    console.log("Units table rendered.");
};

const sortData = (column) => {
    // Your existing sortData logic
    if (currentSortColumn === column) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = column;
        currentSortDirection = 'asc';
    }
    filterAndRenderUnits(); // Re-render with new sort order
    console.log(`Sorted by ${column}, direction: ${currentSortDirection}`);
};

const renderModsTable = () => {
    // Your existing renderModsTable logic
    const modsTableBody = document.querySelector('#modsTable tbody');
    modsTableBody.innerHTML = ''; // Clear existing rows

    if (mods.length === 0) {
        modsTableBody.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-gray-500 dark:text-gray-400">No mod data available.</td></tr>`;
        return;
    }

    mods.forEach(mod => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors duration-150';
        row.innerHTML = `
            <td class="py-3 px-6 text-sm text-gray-900 dark:text-gray-200 whitespace-nowrap">${mod.name}</td>
            <td class="py-3 px-6 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">${mod.rarity}</td>
            <td class="py-3 px-6 text-sm text-gray-700 dark:text-gray-300">${mod.description}</td>
        `;
        modsTableBody.appendChild(row);
    });
    console.log("Mods table rendered.");
};

const toggleDarkMode = () => {
    // Your existing toggleDarkMode logic
    document.body.classList.toggle('dark');
    console.log("Dark mode toggled.");
};

// Function to populate class filter options
const populateClassFilter = () => {
    const classes = [...new Set(rawUnitData.map(unit => unit.class))].sort();
    classFilter.innerHTML = '<option value="">All Classes</option>';
    classes.forEach(cls => {
        const option = document.createElement('option');
        option.value = cls;
        option.textContent = cls;
        classFilter.appendChild(option);
    });
};

// Function to calculate modded stats
const calculateModdedStats = (unit, appliedMods) => {
    let hp = unit.display_hp || unit.base_hp;
    let attack = unit.display_attack || unit.base_attack;
    let defense = unit.display_defense || unit.base_defense;
    let speed = unit.display_speed || unit.base_speed;
    let crit_rate = unit.display_crit_rate || unit.base_crit_rate;
    let crit_damage = unit.display_crit_damage || unit.base_crit_damage;
    let accuracy = unit.display_accuracy || unit.base_accuracy;
    let resistance = unit.display_resistance || unit.base_resistance;

    appliedMods.forEach(mod => {
        if (!mod) return; // Skip if mod not found

        switch (mod.stat) {
            case 'hp': hp *= (1 + mod.value); break;
            case 'attack': attack *= (1 + mod.value); break;
            case 'defense': defense *= (1 + mod.value); break;
            case 'speed': speed += mod.value; break; // Speed is usually flat
            case 'crit_rate': crit_rate += mod.value; break;
            case 'crit_damage': crit_damage += mod.value; break;
            case 'accuracy': accuracy += mod.value; break;
            case 'resistance': resistance += mod.value; break;
        }
    });

    return { hp, attack, defense, speed, crit_rate, crit_damage, accuracy, resistance };
};

// Function to open the unit detail modal
const openUnitDetailModal = (unitId) => {
    const unit = units.find(u => u.id === unitId);
    if (!unit) return;

    // Reset applied mods for the modal instance
    unit.appliedMods = [];

    // Set initial max level toggle state for the modal
    toggleMaxLevelUnit.checked = false; // Default to base stats in modal

    modalUnitName.textContent = unit.label;
    modalUnitImage.src = unitImages[unit.id] || `https://placehold.co/96x96/cccccc/000000?text=NoImg`;
    modalUnitImage.alt = unit.label;
    modalUnitClass.textContent = unit.class;
    modalUnitRarity.textContent = unit.rarity;
    modalUnitDescription.textContent = unit.description;

    // Render base and max level stats
    const renderStats = (element, hp, attack, defense, speed, crit_rate, crit_damage, accuracy, resistance) => {
        element.innerHTML = `
            <li>HP: ${hp.toFixed(0)}</li>
            <li>Attack: ${attack.toFixed(0)}</li>
            <li>Defense: ${defense.toFixed(0)}</li>
            <li>Speed: ${speed.toFixed(0)}</li>
            <li>Crit Rate: ${(crit_rate * 100).toFixed(1)}%</li>
            <li>Crit Damage: ${(crit_damage * 100).toFixed(1)}%</li>
            <li>Accuracy: ${(accuracy * 100).toFixed(1)}%</li>
            <li>Resistance: ${(resistance * 100).toFixed(1)}%</li>
        `;
    };

    renderStats(modalBaseStats, unit.base_hp, unit.base_attack, unit.base_defense, unit.base_speed,
                unit.base_crit_rate, unit.base_crit_damage, unit.base_accuracy, unit.base_resistance);

    renderStats(modalMaxLevelStats, unit.max_hp, unit.max_attack, unit.max_defense, unit.max_speed,
                unit.max_crit_rate, unit.max_crit_damage, unit.max_accuracy, unit.max_resistance);

    // Initial display of applied mod stats (should be base stats initially)
    const updateAppliedModStats = () => {
        let currentUnitStats = {
            hp: toggleMaxLevelUnit.checked ? unit.max_hp : unit.base_hp,
            attack: toggleMaxLevelUnit.checked ? unit.max_attack : unit.base_attack,
            defense: toggleMaxLevelUnit.checked ? unit.max_defense : unit.base_defense,
            speed: toggleMaxLevelUnit.checked ? unit.max_speed : unit.base_speed,
            crit_rate: toggleMaxLevelUnit.checked ? unit.max_crit_rate : unit.base_crit_rate,
            crit_damage: toggleMaxLevelUnit.checked ? unit.max_crit_damage : unit.base_crit_damage,
            accuracy: toggleMaxLevelUnit.checked ? unit.max_accuracy : unit.base_accuracy,
            resistance: toggleMaxLevelUnit.checked ? unit.max_resistance : unit.base_resistance,
        };
        const calculatedStats = calculateModdedStats(currentUnitStats, unit.appliedMods);
        renderStats(modalAppliedModStats, calculatedStats.hp, calculatedStats.attack, calculatedStats.defense,
                    calculatedStats.speed, calculatedStats.crit_rate, calculatedStats.crit_damage,
                    calculatedStats.accuracy, calculatedStats.resistance);
    };

    // Toggle max level for individual unit in modal
    toggleMaxLevelUnit.onchange = updateAppliedModStats;

    // Skills
    modalUnitSkills.innerHTML = unit.skills.map(skill => `<li><strong>${skill.name}:</strong> ${skill.description}</li>`).join('');

    // Recommended Mods
    if (unit.recommended_mods && unit.recommended_mods.length > 0) {
        modalRecommendedMods.innerHTML = unit.recommended_mods.map(modName => `<li>${modName}</li>`).join('');
    } else {
        modalRecommendedMods.innerHTML = '<li>No specific recommendations.</li>';
    }

    // Mod Checkboxes
    modCheckboxesContainer.innerHTML = '';
    const groupedMods = mods.reduce((acc, mod) => {
        (acc[mod.rarity] = acc[mod.rarity] || []).push(mod);
        return acc;
    }, {});

    const sortedRarities = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];
    sortedRarities.forEach(rarity => {
        if (groupedMods[rarity]) {
            const rarityHeader = document.createElement('h4');
            rarityHeader.className = 'text-base font-bold mt-3 mb-2 text-gray-900 dark:text-gray-100'; // Tailwind classes
            rarityHeader.textContent = `${rarity} Mods`;
            modCheckboxesContainer.appendChild(rarityHeader);

            groupedMods[rarity].forEach(mod => {
                const div = document.createElement('div');
                div.className = 'flex items-center space-x-2';
                const checkboxId = `mod-${mod.id}`;
                div.innerHTML = `
                    <input type="checkbox" id="${checkboxId}" class="form-checkbox h-4 w-4 text-blue-600 transition duration-150 ease-in-out dark:bg-gray-600 dark:border-gray-500">
                    <label for="${checkboxId}" class="text-gray-700 dark:text-gray-300 text-sm">${mod.name} (${(mod.value * 100).toFixed(0)}% ${mod.stat})</label>
                `;
                modCheckboxesContainer.appendChild(div);

                const checkbox = div.querySelector(`#${checkboxId}`);
                checkbox.addEventListener('change', () => {
                    if (checkbox.checked) {
                        unit.appliedMods.push(mod);
                    } else {
                        unit.appliedMods = unit.appliedMods.filter(m => m.id !== mod.id);
                    }
                    updateAppliedModStats();
                });
            });
        }
    });

    updateAppliedModStats(); // Initial calculation for applied mods

    unitDetailModal.classList.remove('hidden');
    unitDetailModal.classList.add('flex'); // Use flex to center
};

// Function to close the unit detail modal
const closeUnitDetailModal = () => {
    unitDetailModal.classList.add('hidden');
    unitDetailModal.classList.remove('flex');
};


// Initial setup and event listeners
document.addEventListener('DOMContentLoaded', () => {
    parseUnitData(); // Parse unit data on load
    parseModData();  // Parse mod data on load
    populateClassFilter(); // Populate class filter on load

    // Initial rendering of units table
    filterAndRenderUnits();

    // Debounce search input to improve performance
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
    tierListTab.addEventListener('click', () => switchTab('tierListTab')); // New Tier List Tab Listener

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

    // Modal close event
    closeModalButton.addEventListener('click', closeUnitDetailModal);
    unitDetailModal.addEventListener('click', (e) => {
        if (e.target === unitDetailModal) { // Close if clicked outside the modal content
            closeUnitDetailModal();
        }
    });

    // Set initial tab to Units (or whichever you prefer)
    switchTab('unitsTab'); // This will also trigger the initial rendering of units
});
