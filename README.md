<h1 align="center">Plural Star — Desktop</h1>

<p align="center">
  <strong>Front tracking, system journal & history for plural systems.</strong><br>
  Private. Offline-first. No accounts. No servers.
</p>

<p align="center">
  <a href="https://github.com/TheHanyou/Plural-Star-Desktop/releases/latest">
    <img src="https://img.shields.io/badge/Download-Latest%20Release-DAA520?style=for-the-badge&logo=windows&logoColor=white" alt="Download Latest Release" />
  </a>
  &nbsp;
   <a href="https://www.buymeacoffee.com/PluralStar">
    <img src="https://img.buymeacoffee.com/button-api/?text=Support+PS&amp;emoji=%E2%98%95&amp;slug=PluralStar&amp;button_colour=151929&amp;font_colour=ffffff&amp;font_family=Cookie&amp;outline_colour=ffffff&amp;coffee_colour=FFDD00" alt="Support Plural Star on Buy Me a Coffee" />
  </a>
  &nbsp;
  <a href="https://discord.gg/FFQw33cu8m">
    <img src="https://img.shields.io/badge/Discord-Join%20Us-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Join our Discord" />
  </a>
</p>

---

The desktop companion to [Plural Star](https://github.com/TheHanyou/Plural-Star). Built with Electron — your data stays on your machine, the same way it stays on your phone.

Plural Star is a private, offline-first system management app built for plural individuals — those with DID, OSDD, or any form of plurality.

Made in part with AI assistance, and is one of the main reasons we went Open Source. So that those wishing to, or those with concerns, could examine the code.

Simply Plural and Octocon are being discontinued. Plural Star is the replacement you own entirely — your data stays on your device.

## Features

**◈ Three-Tier Front Tracking**  
Track who's fronting across three distinct tiers: Primary Front, Co-Front, and Co-Conscious — with multiple members supported in every tier, including multiple simultaneous fronters. Each tier has its own member selection, mood, note, and energy level (1–10). Primary Front also tracks location. Members are exclusive to one tier at a time. Set all three tiers from a single unified modal with searchable pickers for both members and Custom Fronts (under Front and Co-Front alike) — type a name to find anyone instantly, even in large systems. Update the front directly from the dashboard tile without opening the full view.

**🔭 Observatory Mode**  
A rebuilt interface for the singlets in our lives — non-plural friends, family, partners, and caretakers. Observatory Mode turns Plural Star into a manual status tracker and journaling app: Front and Members become Status and Profile, statuses (Sleeping, Working, Anxious…) replace fronting, system-only tools are hidden, and all terminology adapts — while keeping access to almost all of the app's features, including History, Statistics, and the Journal. Toggle it anytime in System Settings.

**◇ Member Profiles**  
Build out your system roster with profile pictures, 900×300 banner images, names, pronouns, roles, colors, and rich text bios. Write descriptions with full markdown formatting — bold, italic, strikethrough, headers, links, lists, block quotes, inline code, and more. Organize members with freeform tags and named groups. Create colored named groups and assign members to multiple groups. Filter the member list by group, tag, or search. Sort by 6 different modes: alphabetical, reverse alphabetical, age, color, role, or manual ordering. Members display tier-specific badges (Primary, Co-Front, Co-Con) when fronting. Archive dormant members to keep your active roster clean — the Archive lives in its own dashboard tile, archived members are hidden from the front picker, their history is fully preserved, and they can be restored at any time.

**🗂 System Manager**  
Manage your groups and subsystems from one dedicated screen — create, rename, recolor, nest, and reorganize without digging through individual member profiles.

**✦ Custom Fields**  
Define your own per-member fields beyond the built-in ones. Support for text, number, toggle, date, month/year, month, year, and markdown types. Create fields once from the dashboard; fill them out per-member in the member edit modal. Fields are reorderable, renameable, and fully exportable. Compatible with Simply Plural custom field imports.

**📋 Per-Member Noteboards**  
Each member has their own noteboard — a shared space inside the member profile where any headmate can leave notes for or about them. Notes record author, timestamp, and content; can be pinned to the top; and display chronologically in the member's profile sub-tab. Useful for leaving messages between alters, shared observations, or ongoing context that doesn't fit anywhere else.

**📊 System Polls**  
Create polls the whole system can vote on — decisions, preferences, member opinions. Polls live on the dashboard with options (each with its own vote tallies), voter tracking (who voted for what), and optional closure. Every active member can cast one vote per poll; votes can be changed until the poll is closed.

**◷ History & Insights**  
Front History gives you a complete timestamped log of every switch, organized by day, with co-front and co-conscious tiers displayed inline. Filter by member, time range, or search across names, notes, and moods. Add retroactive history entries manually with full three-tier support, mood, location, and energy, searchable Custom Front pickers for Front and Co-Front, start/end time selection, and a "Current" option for ongoing sessions — the app detects overlaps with existing entries and lets you choose how to handle them.

**⊞ System Statistics**  
System-wide stats at a glance: total fronting time, session count, and message count with time range filtering (All Time, 7 Days, 30 Days). Expandable leaderboards (top 5, up to 25) for fronters, co-fronters, co-conscious, chatters, moods, and locations. Peak Hours and Energy-by-Hour charts show when your system is most active and how energy trends through the day, plus per-member breakdowns of sessions, average energy, top co-members, and top moods.

**⌨ System Chat**  
Local-only IRC-style chat for your system. Create, rename, and organize channels (up to 100) with defaults for General, Venting, and Planning. Select a speaker from your member roster independently of who's fronting — chat activity doesn't affect front or history. Send text messages, share images (stored as base64 — delete the source and the chat copy persists), reply to messages, and react with emoji. Archive channels to free storage with the option to close the channel or continue fresh with a clean slate — archived messages export as `ChannelName_YYYY-MM-DD.json`.

**◉ System Journal**  
Write journal entries with the same editor available in member profiles. Entries open in a clean read-only view with a one-click Edit button. Pin important entries to the top of the list, and start new ones from saved templates with preset titles, bodies, and tags. Tag entries with authors (searchable by name), add topic hashtags (searchable by tag), and optionally lock individual entries or the entire journal behind passwords. Export individual entries or the full journal in `.txt`, `.md`, or `.json`.

**⇅ Import & Export**  
Migrating from another app? Import your full system data — members, history, custom fields, and system info — from Simply Plural, PluralKit, Octocon, Ampersand, Ourcana, HiveMind, or PluralSpace, via API token or export file. Co-fronting sessions from Simply Plural are correctly grouped into combined entries. Profile pictures are imported from avatar URLs. Custom field names and values are mapped automatically with bidirectional ID normalization.

Export your full system data as JSON (reimportable), HTML (opens in Google Docs), or send a formatted summary to any email address. Granular per-category toggles — pick exactly what to export or restore: system info, members, avatars, banners, front history, journal, groups, chat, moods, palettes, settings, custom fields, noteboards, polls. Import `.txt`, `.md`, or `.json` files directly as journal entries.

**🌐 Multilingual**  
Full interface available in English, Español, Français, Deutsch, Português, Suomi, Norsk, Русский, Українська, 中文, and 日本語 — 11 languages total. Auto-detects your device language on first launch. Change anytime via the dropdown in System Settings.

**Other Features**
- Obsidian Blue dark theme and Steel light theme built-in, plus 10 custom palette slots — define your own four-color theme
- System Profile with its own banner, description, and markdown formatting — separate from member profiles
- Profile pictures on member avatars throughout the app; banners shown on member profiles and edit screens
- Adjustable text size — Normal, Large, or Extra Large — plus OpenDyslexic and other font choices
- Mood picker with preset and custom mood support, per tier
- Per-tier energy levels (1–10) for Primary, Co-Front, and Co-Conscious
- Location tagging with preset location chips
- Pinnable journal entries and noteboard notes
- Password protection per journal entry and for the full journal
- Searchable tag and author filters in journal
- Member tags and named groups with multi-group assignment
- Searchable member and Custom Front pickers in front selection
- Custom Fronts (Sleeping, Blurry, etc.) selectable in Update Front and Retro History
- Token and file imports from seven plural apps with co-front grouping
- Full data export and restore with per-category granularity
- Discord community accessible directly from the dashboard

---

## Privacy

Everything lives on your machine. No accounts, no cloud sync, no tracking, no ads. All data is stored locally using `electron-store`.

Full privacy policy: [PRIVACY_POLICY.md](PRIVACY_POLICY.md)

---

## Installation

Download the latest installer from [Releases](https://github.com/TheHanyou/Plural-Star-Desktop/releases):

| Platform | File |
|---|---|
| Windows | `Plural-Star-Setup-x.x.x.exe` (installer) or `Plural-Star-x.x.x-portable.exe` |
| macOS | `Plural-Star-x.x.x.dmg` |
| Linux | `Plural-Star-x.x.x.AppImage` or `.deb` |

**Windows note:** Because the app is not code-signed, Windows Defender SmartScreen may show a warning on first launch. Click "More info" → "Run anyway." The source is fully open and auditable here.

---

## Build from Source

Requirements: Node 22+

```bash
git clone https://github.com/TheHanyou/Plural-Star-Desktop.git
cd Plural-Star-Desktop
npm install
npm run electron:dev       # development
npm run electron:build     # build installer for your platform
```

**Windows:** Run the build as Administrator or enable Developer Mode (Settings → System → For developers) to allow symlink creation during packaging.

---

## Relationship to the Mobile App

This is a separate repository from the [Plural Star mobile app](https://github.com/TheHanyou/Plural-Star). The two apps share the same data model and export format, so JSON exports are cross-compatible — you can move your data between them freely. Features may land on one platform before the other.

---

## License

[GNU Affero General Public License v3.0](LICENSE)

Free and open source. You are free to use, modify, and distribute it under the terms of AGPL-3.0. Any distributed modifications or network-accessible deployments must also be released under AGPL-3.0.

---

## Support

Plural Star is free, always. If it's been useful to you, a contribution helps cover development time.

<a href="https://www.buymeacoffee.com/PluralStar">
  <img src="https://img.buymeacoffee.com/button-api/?text=Support+PS&emoji=%E2%98%95&slug=PluralSpace&button_colour=151929&font_colour=ffffff&font_family=Cookie&outline_colour=ffffff&coffee_colour=FFDD00" alt="Support PS on Buy Me a Coffee" />
</a>

---

## Contact

**The Hanyou System**
[Discord](https://discord.gg/FFQw33cu8m) · [r/PluralStar](https://www.reddit.com/r/PluralStar/) · [GitHub Issues](https://github.com/TheHanyou/Plural-Star-Desktop/issues)
