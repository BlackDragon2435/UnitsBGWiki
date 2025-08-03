// gameData.js
// This file contains all the game-related data, including rarity prices, XP requirements,
// and stat modifiers by class and rarity.

export const gameData = {
    // Defines the price for units based on their rarity.
    // This can be used to calculate the cost of a unit.
    "PriceByRarity": {
        "Ancient": 30000,
        "Legendary": 1500,
        "Mythic": 5000,
        "Common": 25,
        "Epic": 700,
        "Demonic": 15000,
        "Uncommon": 50,
        "Rare": 150
    },
    // Defines the experience points (XP) required for units based on their rarity.
    // This can be used to calculate how much XP a unit provides or requires for leveling.
    "XPByRarity": {
        "Ancient": 50000,
        "Legendary": 5000,
        "Demonic": 25000,
        "Common": 25,
        "Epic": 1500,
        "Mythic": 10000,
        "Uncommon": 50,
        "Rare": 300
    },
    // Defines stat modifiers (HP, Cooldown, Damage) for each unit class,
    // further modified by rarity.
    // The '_value' is a base value (often 0, indicating it's purely additive/multiplicative
    // based on rarity attributes), and '_attributes' contain the percentage modifiers
    // for each rarity. These percentages should be applied to the base unit stats.
    "StatsByClass": {
        "Warrior": {
            "HP": {
                "_value": 0,
                "_attributes": {
                    "Ancient": 0.23, "Legendary": 0.18, "Mythic": 0.18, "Common": 0.18,
                    "Epic": 0.18, "Demonic": 0.22, "Uncommon": 0.18, "Rare": 0.18
                }
            },
            "Cooldown": {
                "_value": 0,
                "_attributes": {
                    "Ancient": -0.03, "Legendary": -0.02, "Mythic": -0.02, "Common": -0.05,
                    "Epic": -0.02, "Demonic": -0.03, "Uncommon": -0.02, "Rare": -0.02
                }
            },
            "Damage": {
                "_value": 0,
                "_attributes": {
                    "Ancient": 0.15, "Legendary": 0.1, "Mythic": 0.1, "Common": 0.1,
                    "Epic": 0.1, "Demonic": 0.15, "Uncommon": 0.1, "Rare": 0.1
                }
            }
        },
        "Tank": {
            "HP": {
                "_value": 0,
                "_attributes": {
                    "Ancient": 0, "Legendary": 0.15, "Mythic": 0.15, "Common": 0.15,
                    "Epic": 0.15, "Demonic": 0.15, "Uncommon": 0.15, "Rare": 0.15
                }
            },
            "Cooldown": {
                "_value": 0,
                "_attributes": {
                    "Ancient": 0, "Legendary": -0.01, "Mythic": -0.01, "Common": -0.01,
                    "Epic": -0.01, "Demonic": -0.01, "Uncommon": -0.01, "Rare": -0.01
                }
            },
            "Damage": {
                "_value": 0,
                "_attributes": {
                    "Ancient": 0, "Legendary": 0.05, "Mythic": 0.05, "Common": 0.05,
                    "Epic": 0.05, "Demonic": 0.05, "Uncommon": 0.05, "Rare": 0.05
                }
            }
        },
        "Support": {
            "HP": {
                "_value": 0,
                "_attributes": {
                    "Ancient": 0, "Legendary": 0.03, "Mythic": 0.03, "Common": 0.03,
                    "Epic": 0.03, "Demonic": 0.03, "Uncommon": 0.03, "Rare": 0.03
                }
            },
            "Cooldown": {
                "_value": 0,
                "_attributes": {
                    "Ancient": 0, "Legendary": -0.03, "Mythic": -0.03, "Common": -0.03,
                    "Epic": -0.03, "Demonic": -0.03, "Uncommon": -0.03, "Rare": -0.03
                }
            },
            "Damage": {
                "_value": 0,
                "_attributes": {
                    "Ancient": 0, "Legendary": 0.15, "Mythic": 0.15, "Common": 0.15,
                    "Epic": 0.15, "Demonic": 0.15, "Uncommon": 0.15, "Rare": 0.15
                }
            }
        },
        "Healer": {
            "HP": {
                "_value": 0,
                "_attributes": {
                    "Ancient": 0.1, "Legendary": 0.08, "Mythic": 0.08, "Common": 0.08,
                    "Epic": 0.08, "Demonic": 0.1, "Uncommon": 0.08, "Rare": 0.08
                }
            },
            "Cooldown": {
                "_value": 0,
                "_attributes": {
                    "Ancient": -0.02, "Legendary": -0.02, "Mythic": -0.02, "Common": -0.02,
                    "Epic": -0.02, "Demonic": -0.025, "Uncommon": -0.02, "Rare": -0.02
                }
            },
            "Damage": {
                "_value": 0,
                "_attributes": {
                    "Ancient": 0.18, "Legendary": 0.15, "Mythic": 0.15, "Common": 0.15,
                    "Epic": 0.15, "Demonic": 0.18, "Uncommon": 0.15, "Rare": 0.15
                }
            }
        },
        "Summoner": {
            "HP": {
                "_value": 0,
                "_attributes": {
                    "Ancient": 0, "Legendary": 0.03, "Common": 0.03, "Epic": 0.03,
                    "Mythic": 0.03, "Uncommon": 0.03, "Rare": 0.03
                }
            },
            "Cooldown": {
                "_value": 0,
                "_attributes": {
                    "Ancient": 0, "Legendary": -0.03, "Common": -0.03, "Epic": -0.03,
                    "Mythic": -0.03, "Uncommon": -0.03, "Rare": -0.03
                }
            },
            "Damage": {
                "_value": 0,
                "_attributes": {
                    "Ancient": 0, "Legendary": 0.15, "Common": 0.15, "Epic": 0.15,
                    "Mythic": 0.15, "Uncommon": 0.15, "Rare": 0.15
                }
            }
        },
        "Ranger": {
            "HP": {
                "_value": 0,
                "_attributes": {
                    "Ancient": 0, "Legendary": 0.03, "Mythic": 0.03, "Common": 0.03,
                    "Epic": 0.03, "Demonic": 0.04, "Uncommon": 0.03, "Rare": 0.03
                }
            },
            "Cooldown": {
                "_value": 0,
                "_attributes": {
                    "Ancient": 0, "Legendary": -0.03, "Mythic": -0.03, "Common": -0.03,
                    "Epic": -0.03, "Demonic": -0.04, "Uncommon": -0.03, "Rare": -0.03
                }
            },
            "Damage": {
                "_value": 0,
                "_attributes": {
                    "Ancient": 0, "Legendary": 0.15, "Mythic": 0.15, "Common": 0.15,
                    "Epic": 0.15, "Demonic": 0.2, "Uncommon": 0.15, "Rare": 0.15
                }
            }
        },
        "Wizard": {
            "HP": {
                "_value": 0,
                "_attributes": {
                    "Ancient": 0.16, "Legendary": 0.03, "Mythic": 0.03, "Common": 0.03,
                    "Epic": 0.03, "Demonic": 0.15, "Uncommon": 0.03, "Rare": 0.03
                }
            },
            "Cooldown": {
                "_value": 0,
                "_attributes": {
                    "Ancient": -0.04, "Legendary": -0.03, "Mythic": -0.03, "Common": -0.03,
                    "Epic": -0.03, "Demonic": -0.035, "Uncommon": -0.03, "Rare": -0.03
                }
            },
            "Damage": {
                "_value": 0,
                "_attributes": {
                    "Ancient": 0.23, "Legendary": 0.15, "Mythic": 0.15, "Common": 0.15,
                    "Epic": 0.15, "Demonic": 0.2, "Uncommon": 0.15, "Rare": 0.15
                }
            }
        },
        "Assassin": {
            "HP": {
                "_value": 0,
                "_attributes": {
                    "Ancient": 0.1, "Legendary": 0.1, "Mythic": 0.1, "Common": 0.1,
                    "Epic": 0.1, "Demonic": 0.1, "Uncommon": 0.1, "Rare": 0.1
                }
            },
            "Cooldown": {
                "_value": 0,
                "_attributes": {
                    "Ancient": -0.04, "Legendary": -0.04, "Mythic": -0.04, "Common": -0.04,
                    "Epic": -0.04, "Demonic": -0.04, "Uncommon": -0.04, "Rare": -0.04
                }
            },
            "Damage": {
                "_value": 0,
                "_attributes": {
                    "Ancient": 0.1, "Legendary": 0.1, "Mythic": 0.1, "Common": 0.1,
                    "Epic": 0.1, "Demonic": 0.1, "Uncommon": 0.1, "Rare": 0.1
                }
            }
        }
    },
    // Defines the cost to "roll" for units based on their rarity.
    // 'IsForGems' indicates if the roll is for gems instead of another currency.
    "RollByRarity": {
        "Ancient": { "_value": 350, "_attributes": { "IsForGems": true } },
        "Legendary": 4000,
        "Demonic": { "_value": 250, "_attributes": { "IsForGems": true } },
        "Common": 25,
        "Epic": 800,
        "Mythic": { "_value": 50, "_attributes": { "IsForGems": true } },
        "Uncommon": 50,
        "Rare": 150
    },
    // This array is currently empty. If you have data for "LevelToChance",
    // you can populate it here.
    "LevelToChance": []
};
