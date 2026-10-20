// Generates data/mock-data.xlsx — a deterministic mock roster with two sheets.
// Run: npm run mock
import writeExcelFile from 'write-excel-file/node'
import { mkdirSync } from 'node:fs'

// Small seeded PRNG so the file is identical on every run.
let seed = 2077
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32)
const pick = (arr) => arr[Math.floor(rand() * arr.length)]
const int = (min, max) => min + Math.floor(rand() * (max - min + 1))

const first = ['Vik', 'Judy', 'Panam', 'Jackie', 'River', 'Kerry', 'Rogue', 'Dex', 'Misty', 'Takemura', 'Claire', 'Mitch', 'Nix', 'Wakako', 'Hanako', 'Saul', 'Lizzy', 'Brick', 'Goro', 'Evelyn', 'Mox', 'Kai', 'Rhea', 'Zane']
const last = ['Vektor', 'Alvarez', 'Palmer', 'Welles', 'Ward', 'Eurodyne', 'Amendiares', 'DeShawn', 'Olszewski', 'Okada', 'Russo', 'Anderson', 'Parker', 'Kuroda', 'Novak', 'Reyes', 'Sato', 'Kowalski']
const handles = ['Glitch', 'Neon', 'Chrome', 'Static', 'Wraith', 'Byte', 'Razor', 'Spike', 'Ghost', 'Volt', 'Hex', 'Cipher', 'Rust', 'Echo', 'Pulse', 'Shard']
const factions = ['Arasaka', 'Militech', 'Valentinos', 'Maelstrom', 'Tyger Claws', '6th Street', 'Voodoo Boys', 'Aldecaldos', 'NCPD', 'Mox', 'Independent']
const districts = ['Watson', 'Westbrook', 'City Center', 'Heywood', 'Pacifica', 'Santo Domingo', 'Badlands', 'Dogtown']
const roles = ['Netrunner', 'Solo', 'Techie', 'Fixer', 'Nomad', 'Medtech', 'Media', 'Corpo', 'Lawman', 'Rockerboy']
const cyberware = ['Mantis Blades', 'Sandevistan', 'Kerenzikov', 'Gorilla Arms', 'Optical Camo', 'Kiroshi Optics', 'Projectile Launcher', 'Berserk', 'Monowire', 'Cyberdeck']
const statuses = ['Active', 'Active', 'Active', 'Missing', 'Flatlined', 'Incarcerated']

const header = ['ID', 'Handle', 'Name', 'Faction', 'District', 'Role', 'Cyberware', 'Street Cred', 'Eddies', 'Last Seen', 'Status']
const roster = [header]
for (let i = 1; i <= 2500; i++) {
  roster.push([
    `NC-${String(i).padStart(5, '0')}`,
    `${pick(handles)}${int(1, 99)}`,
    `${pick(first)} ${pick(last)}`,
    pick(factions),
    pick(districts),
    pick(roles),
    pick(cyberware),
    int(1, 50),
    { value: int(50, 250000) + int(0, 99) / 100, format: '#,##0.00' },
    { value: new Date(Date.UTC(2077, int(0, 11), int(1, 28), int(0, 23), int(0, 59))), format: 'yyyy-mm-dd' },
    pick(statuses),
  ])
}

const gigHeader = ['Gig ID', 'Title', 'District', 'Fixer', 'Payout', 'Difficulty', 'Completed']
const gigs = [gigHeader]
const verbs = ['Retrieve', 'Eliminate', 'Escort', 'Sabotage', 'Hack', 'Extract', 'Smuggle', 'Protect']
const objects = ['the Relic', 'a Militech convoy', 'an Arasaka exec', 'the data shard', 'a Tyger Claws cache', 'the AV', 'a ripperdoc', 'the cyberpsycho']
for (let i = 1; i <= 600; i++) {
  gigs.push([
    `GIG-${String(i).padStart(4, '0')}`,
    `${pick(verbs)} ${pick(objects)}`,
    pick(districts),
    pick(['Regina', 'Wakako', 'Dino', 'Padre', 'Rogue', 'Mr. Hands', 'El Capitán', 'Muamar']),
    int(1000, 90000),
    pick(['Low', 'Moderate', 'High', 'Very High']),
    rand() > 0.4,
  ])
}

mkdirSync('data', { recursive: true })
await writeExcelFile([{ sheet: 'Roster', data: roster }, { sheet: 'Gigs', data: gigs }]).toFile('data/mock-data.xlsx')
console.log(`Wrote data/mock-data.xlsx (${roster.length - 1} roster rows, ${gigs.length - 1} gigs)`)
