<h1 align="center">Plural Star — Desktop</h1>

<p align="center">
  <strong>Front tracking, system journal & history for plural systems.</strong><br>
  Private. Offline-first.
</p>

<p align="center">
  <a href="https://github.com/ByHanyou/Plural-Star-Desktop/releases/latest">
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

The desktop companion to [Plural Star](https://github.com/ByHanyou/Plural-Star). Built with Electron — your data stays on your machine, the same way it stays on your phone.

Plural Star is a private, offline-first system management app built for plural individuals — those with DID, OSDD, or any form of plurality.

Made in part with AI assistance, and is one of the main reasons we went Open Source. So that those wishing to, or those with concerns, could examine the code.

Simply Plural and Octocon are being discontinued. Plural Star is the replacement you own entirely — your data stays on your device.

## Features

**◈ Three-Tier Front Tracking**  
Track who's fronting across three distinct tiers: Primary Front, Co-Front, and Co-Conscious — with multiple members supported in every tier, including multiple simultaneous fronters. Each tier has its own member selection, mood, note, and energy level (1–10). Primary Front also tracks location. Members are exclusive to one tier at a time. Set all three tiers from a single unified modal with one search box per tier that covers members, Facets, and Custom Fronts at once, results grouped under headers — type a name to find anyone instantly, even in large systems. Clicking a fronter on the Front view opens their profile. Update the front directly from the dashboard tile without opening the full view.

**🔭 Observatory Mode**  
A rebuilt interface for the singlets in our lives — non-plural friends, family, partners, and caretakers. Observatory Mode turns Plural Star into a manual status tracker and journaling app: Front and Members become Status and Profile, statuses (Sleeping, Working, Anxious…) replace fronting, system-only tools are hidden, and all terminology adapts — while keeping access to almost all of the app's features, including History, Statistics, and the Journal. Toggle it anytime in System Settings.

**◇ Member Profiles**  
Build out your system roster with profile pictures, 900×300 banner images, names, pronouns, roles, colors, and rich text bios. Write descriptions with full markdown formatting — bold, italic, strikethrough, headers, links, lists, block quotes, inline code, and more. Organize members with freeform tags and named groups. Tags are kept exactly as you type them, and every tag already in your system is offered as a click-to-apply suggestion while you edit. Create colored named groups and assign members to multiple groups; nested groups fold into a tree in the editor so a long list of roles stays out of the way. Filter the member list by group, tag, or search. Sort by 6 different modes: alphabetical, reverse alphabetical, age, color, role, or manual ordering. Select several members at once to group, archive, delete, or move them to Facets and back. Members display tier-specific badges (Primary, Co-Front, Co-Con) when fronting. Archive dormant members to keep your active roster clean — the Archive lives in its own dashboard tile, archived members are hidden from the front picker, their history is fully preserved, and they can be restored at any time. Deleted members appear under Recently Deleted in the Archive and can be restored from there too.

**🗂 System Manager**  
Manage your groups and subsystems from one dedicated screen — create, rename, recolor, nest, and reorganize without digging through individual member profiles.

**✦ Custom Fields**  
Define your own per-member fields beyond the built-in ones. Thirteen field types: Text, Rich Text, Image, Number, Toggle, Color, Date, Date Range, Timestamp, Month, Year, Month + Year, and Month + Day. Create fields once from the dashboard; fill them out per-member in the member edit modal. Text and Rich Text fields render with markdown in the profile's read view, and anything wrapped in `||double bars||` stays covered until clicked, so a trigger list can live on a profile without being read every time it is opened. Fields are reorderable, renameable, and fully exportable. Compatible with Simply Plural custom field imports.

**🕸 System Map**  
Chart the relationships between your headmates on an interactive force-directed graph. Four connection types ship built in — Rival, Friend, Ally, Love — and the Connections manager lets you create unlimited custom types with their own names, colors, and optional directionality with inverse labels. Threads rest grey until you select a member; their web then lights up in connection colors, with a reach selector to extend the glow to friends-of-friends and one ring beyond. Pan, zoom, click any node for their relationship list, and jump straight to their profile.

**⚕ Medical**  
Medication reminders, appointments, medical history, and emergency info in one dashboard tile — available in both system and Observatory modes. Medications support dosage, multiple daily reminder times, notes, and a pause toggle. Appointments take a date and time, location, and a remind-before offset. Keep a dated medical history of conditions, surgeries, and diagnoses, plus an emergency section for conditions, allergies, and blood type. Medical data is deliberately **local-only** — it never syncs and never leaves the machine.

**🖌 Whiteboard**  
A shared system canvas for sketching, mapping, or thinking out loud. Draw freehand with an adjustable brush, drop line, rectangle, ellipse, and Paint-style polygon shapes, fill regions with the bucket tool, erase, undo, and pick colors from the Colors system. Clearing the board triple-confirms before anything is destroyed.

**🗓 Day Planner**  
A month calendar for appointments and recurring reminders. Appointments carry a title, time, optional location and notes, an optional colored mark on the calendar, a reminder at the time or 30 minutes, 1 hour, or 1 day before, and repeat rules from one-time through daily, every other day, weekly, every other week, monthly, every other month, and annually. Separate standing reminders fire at as many times of day as you set. Adding and editing happen on their own screens rather than in a dialog, so long notes have room.

**🎨 Colors**  
A dedicated Colors tile: 92 named presets across four rows (default, darker, pastel, neon) plus 24 custom slots you fill yourself. Every color picker in the app — members, groups, connection types, palettes, whiteboard — draws from the same set, and each preset is named so screen readers announce a color rather than a hex code.

**◈ Facets**  
Split a member into facets — distinct aspects of one headmate that need their own name, color, and profile without becoming separate members. Facets appear in their own member-list tab and stay out of the front picker's main roster.

**🪞 Friend Data Mirrors**  
When a friend shares data with you, their members, front history, and connections appear read-only on your side and refresh as they change — so you can follow a partner or friend system's roster without either of you exporting anything.

**📊 System Polls**  
Create polls the whole system can vote on — decisions, preferences, member opinions. Polls live on the dashboard with options (each with its own vote tallies), voter tracking (who voted for what), and optional closure. Every active member can cast one vote per poll; votes can be changed until the poll is closed.

**🛰 Friends & Syncing**  
Connect with other systems and your own devices over the Plural Star network — fully end-to-end encrypted, with the relay seeing nothing but sealed blobs. Add friends with short shareable codes (mutual by design: both sides must enter each other's code) and see their current front — fronters, mood, location — update live with online status from the Network tile. Link your desktop with your phone using a directed first copy — you choose which device sends and which receives — then everything stays in sync both ways automatically: members, history, journal, chat, polls, settings, even profile pictures and banners. Privacy Buckets decide what each group of friends sees, feature by feature, including whether they see your front at all and whether mood, location, and note travel with it. Networking is fully opt-in and off by default.

**☁ Cloud Services** *(Experimental)*  
An alternative to device-to-device syncing for people who would rather not keep two devices paired and awake. Keep an encrypted copy of your system on the Plural Star cloud and link your other devices to it with one password. Everything is sealed on this machine before it leaves, so the node stores blobs it cannot read; the password is never sent anywhere and there is no reset, which is the price of the node genuinely not being able to open your vault. Optionally include full-size banners, custom-field images, and chat attachments alongside the data and avatars. Unlinking a device deletes nothing, and a vault with no linked device for 30 days is removed. Cloud Services and device syncing never run at once, and the app refuses whichever one you did not pick first. Medical data stays out of the vault, the same way it stays out of sync.

**✉ Mailbox**  
System-wide mail between headmates, right on the dashboard: per-member inboxes with unread badges, compose with From/To pickers, quick replies, pinning, and delete confirmation — and mail syncs across your linked devices.

**◷ History & Insights**  
Front History gives you a complete timestamped log of every switch, organized by day, with co-front and co-conscious tiers displayed inline. Filter by member, time range, or search across names, notes, and moods. Add retroactive history entries manually with full three-tier support, mood, location, and energy, searchable Custom Front pickers for Front and Co-Front, start/end time selection, and a "Current" option for ongoing sessions — the app detects overlaps with existing entries and lets you choose how to handle them.

**⊞ System Statistics**  
System-wide stats at a glance: total fronting time, session count, and message count with time range filtering (All Time, 7 Days, 30 Days). Expandable leaderboards (top 5, up to 25) for fronters, co-fronters, co-conscious, chatters, moods, and locations. Peak Hours and Energy-by-Hour charts show when your system is most active and how energy trends through the day, plus per-member breakdowns of sessions, average energy, top co-members, and top moods.

**⌨ System Chat**  
Local-only IRC-style chat for your system. Create, rename, and organize channels (up to 100) with defaults for General, Venting, and Planning. Group channels into named categories and drag them into the order you want. Messages take the same markdown the journal and profiles use. Select a speaker from your member roster independently of who's fronting — chat activity doesn't affect front or history. Send text messages, share images (stored as base64 — delete the source and the chat copy persists), reply to messages, and react with emoji. Archive channels to free storage with the option to close the channel or continue fresh with a clean slate — archived messages export as `ChannelName_YYYY-MM-DD.json`.

**◉ System Journal**  
Write journal entries with the same editor available in member profiles. Entries open in a clean read-only view with a one-click Edit button. Pin important entries to the top of the list, and start new ones from saved templates with preset titles, bodies, and tags. Tag entries with authors (searchable by name), add topic hashtags (searchable by tag), and optionally lock individual entries or the entire journal behind passwords. Export individual entries or the full journal in `.txt`, `.md`, or `.json`.

**⇅ Import & Export**  
Migrating from another app? Import your full system data — members, history, custom fields, and system info — from Simply Plural, PluralKit, Octocon, Ampersand, Ourcana, HiveMind, Tupperbox, Parallax, PluralLog, or PluralSpace, via API token or export file. One file picker handles most of them: drop in the export and the format is detected for you. Co-fronting sessions from Simply Plural are correctly grouped into combined entries. Profile pictures are imported from avatar URLs. Custom field names and values are mapped automatically with bidirectional ID normalization.

Every format these apps currently produce is read directly, including the awkward ones:

- **PluralSpace** — both the older `data.json` export and the current account-scoped **OpenPlural** bundle (`manifest.json` + `systems/<name>/openplural.json` + per-system media). Whoever was fronting when the export was taken stays fronting after the import.
- **Ampersand** — both their JSON export and the binary **`.ampar`** archive, read natively. Profile pictures and banners travel inside that archive and come across with everything else; their member tags become groups, and journal posts and board messages (polls included) land in your journal.
- **PluralKit** — front history is paginated properly rather than stopping at the first hundred switches.

Export your full system data as JSON (reimportable), HTML (opens in Google Docs), or send a formatted summary to any email address. Granular per-category toggles — pick exactly what to export or restore: system info, members, profile pictures, banners, front history, journal, member groups, chat, custom moods, theme palettes, app settings, custom fields, mailbox, planner, polls, and journal templates. Medical is never included: it is local-only by design. Import `.txt`, `.md`, or `.json` files directly as journal entries.

**🌐 Multilingual**  
Full interface available in English, Español, Français, Deutsch, Nederlands, Português, Suomi, Svenska, Norsk, Íslenska, Italiano, Polski, Türkçe, Bahasa Melayu, Tiếng Việt, ไทย, हिन्दी, Afrikaans, 简体中文, 繁體中文, 日本語, 한국어, Русский, and Українська — 24 languages total. Auto-detects your device language on first launch. Change anytime via the dropdown in System Settings.

**Other Features**
- Obsidian Blue dark theme and Steel light theme built-in, plus 10 custom palette slots — define your own four-color theme
- System Profile with its own banner, description, and markdown formatting — separate from member profiles
- Profile pictures on member avatars throughout the app; banners shown on member profiles and edit screens
- Adjustable text size — Normal, Large, or Extra Large — plus OpenDyslexic and other font choices
- Mood picker with preset and custom mood support, per tier
- Per-tier energy levels (1–10) for Primary, Co-Front, and Co-Conscious
- Location tagging with preset location chips, on every tier
- Pinnable journal entries and mailbox messages
- Password protection per journal entry and for the full journal
- Searchable tag and author filters in journal
- Member tags and named groups with multi-group assignment
- Searchable member and Custom Front pickers in front selection
- Custom Fronts (Sleeping, Blurry, etc.) selectable in Update Front and Retro History
- Token and file imports from ten plural apps with co-front grouping
- Terminology picker: rename Fronter, Member, Group, Facet, Front, System, Journal, Hub, History, and Archive, plus the three fronting tier names, to your system's own words
- Full data export and restore with per-category granularity
- Discord community accessible directly from the dashboard

---

## Accessibility

Screen reader support is treated as a feature, not a checkbox. Every control carries a programmatic name, role, and state.

- **Every input is named**, whether or not it has a visible label — the name stays put once you start typing rather than vanishing with the placeholder.
- **State is never colour-only** — selected chips, toggles, and tabs report their state to assistive tech as well as showing it.
- **Everything is reachable from the keyboard**; no interactive element is a bare clickable `div`.
- **Adjustable text size** (Normal, Large, Extra Large) with an OpenDyslexic option.
- **Destructive actions confirm** before removing stored data or media; clearing the whiteboard triple-confirms.

Dates, times, and number formatting follow your selected app language across all 24 locales rather than defaulting to US English, and plural forms follow proper CLDR rules — including the separate few/many forms Russian, Ukrainian, and Polish require.

---

## Privacy

Everything lives on your machine. No accounts, no tracking, no ads. All data is stored locally using `electron-store`, and nothing leaves the machine unless you turn on one of the optional features below.

Medical data is local-only by design — it is excluded from sync and from the cloud vault entirely, and never leaves the machine. Friends and syncing are opt-in and off by default; when enabled they are end-to-end encrypted, and the relay only ever sees sealed blobs it cannot read. Cloud Services is opt-in, off by default, and experimental: the vault is encrypted here with a key derived from a password that is never transmitted, so the node stores objects it has no way to open. There is no account and no password reset.

Full privacy policy: https://byhanyou.github.io/Plural-Star/

---

## Installation

Download the latest installer from [Releases](https://github.com/ByHanyou/Plural-Star-Desktop/releases):

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
git clone https://github.com/ByHanyou/Plural-Star-Desktop.git
cd Plural-Star-Desktop
npm install
npm run electron:dev       # development
npm run electron:build     # build installer for your platform
```

**Windows:** Run the build as Administrator or enable Developer Mode (Settings → System → For developers) to allow symlink creation during packaging.

---

## Relationship to the Mobile App

This is a separate repository from the [Plural Star mobile app](https://github.com/ByHanyou/Plural-Star). The two apps share the same data model and export format, so JSON exports are cross-compatible — you can move your data between them freely. Features may land on one platform before the other.

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
[Discord](https://discord.gg/FFQw33cu8m) · [r/PluralStar](https://www.reddit.com/r/PluralStar/) · [GitHub Issues](https://github.com/ByHanyou/Plural-Star-Desktop/issues)
