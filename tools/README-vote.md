Local Vote Server & CLI

This project includes two small tools to apply tier-list votes to the `UnitTierList.xlsx` workbook.

1) vote_server.js
- Runs a local HTTP server (default port 3456) that accepts POST /vote with JSON { unit: "Unit Name", delta: 1|-1 }.
- The server will call the CLI script to update the "Tier List" sheet's `NumericalRank` column.

Run:

```pwsh
# from project root
node tools\vote_server.js
```

2) apply_vote_to_xlsx.js
- CLI script that updates `UnitTierList.xlsx`.

Run:

```pwsh
# Example: increase 'Goblin Axeman' rank by 1
node tools\apply_vote_to_xlsx.js UnitTierList.xlsx "Goblin Axeman" 1
```

Notes:
- A backup workbook is created before each write (suffix `.vote_backup.xlsx`).
- Front-end uses localStorage to prevent multiple votes per client and attempts to POST to the local vote server. If the server is unreachable, the front-end will prompt you to run the CLI manually.
- This is intentionally simple. For production you'd want authentication, rate limits, and server-side vote tracking.
