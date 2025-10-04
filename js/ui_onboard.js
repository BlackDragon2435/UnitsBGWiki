// Lightweight onboarding & modal behavior
const openHowItWorks = document.getElementById('openHowItWorks');
const openQuickTour = document.getElementById('openQuickTour');

function createModal(title, html) {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    const panel = document.createElement('div');
    panel.className = 'w-full max-w-2xl p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg';
    panel.innerHTML = `
    <div class="flex justify-between items-start">
      <h3 class="text-xl font-semibold">${title}</h3>
      <button id="closeModal" class="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">✕</button>
    </div>
    <div class="mt-4">${html}</div>
  `;
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    panel.querySelector('#closeModal').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    return { overlay, close };
}

if (openHowItWorks) openHowItWorks.addEventListener('click', () => {
    createModal('How it works', `
    <p class="text-gray-700 dark:text-gray-200">This site mirrors the in-game calculations: stats are level-scaled, HP/Damage/Cooldown mods apply multiplicatively, crit multipliers add, and periodic effects (DOT) are included in DPS estimation.</p>
    <ul class="mt-3 list-disc pl-5 text-sm text-gray-600 dark:text-gray-300">
      <li>Data source: your UnitTierList workbook (Mod List sheet) or Google Sheet when published.</li>
      <li>Open unit detail and select mods to preview outcomes (DPS, HP, cooldown deltas).</li>
      <li>Hover mod names to view effect descriptions.</li>
    </ul>
  `);
});

if (openQuickTour) openQuickTour.addEventListener('click', () => {
    createModal('Quick tour', `
    <ol class="list-decimal pl-5 text-sm text-gray-600 dark:text-gray-300">
      <li>Use the search to find a unit.</li>
      <li>Click the unit row to open details.</li>
      <li>Toggle mods in the right panel to see stat deltas and DPS changes.</li>
      <li>Use the "Show Global Mod Effects" toggle to preview site-wide influences.</li>
    </ol>
  `);
});

// Small first-time hint using localStorage
if (!localStorage.getItem('ubg_seen_onboard')) {
    setTimeout(() => {
        const m = createModal('Welcome', `<p class="text-gray-700 dark:text-gray-200">Welcome — this wiki simulates in-game stats. Try searching "Goblin" and open the unit details to apply mods.</p>`);
        localStorage.setItem('ubg_seen_onboard', '1');
    }, 800);
}
