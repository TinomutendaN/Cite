# Cite – Claude Code build prompts

How to use:

1. Put the **Cite design rules** (Step 1) in your project's `CLAUDE.md`, or paste them at the start of the Claude Code session.
2. For each screen, paste its prompt (Step 2) and attach that screen's image or HTML.

---

## Step 1: Cite design rules (put in CLAUDE.md)

```
## Cite design rules

Font: 'Helvetica Neue', Helvetica, Arial, sans-serif.

Colors:
- Text: #242424 (main), #3A3532 / #4A4440 (secondary), #6B5B4B (small uppercase labels)
- Orange accent: #CC8D51 (buttons, active tags), #E1A46B (lighter orange), #F0D3B3 (highlights)
- Dark panels: #2B2B2B (answer bubbles, code boxes), #3A3A3A with #4A4A4A border (inner blocks)
- Folder icons: #F5C542. Success chip: #D6EADC background, #1F3D2B text.
- Landing page background: #F2EEE5. Landing top bar: #FBF9F4 with #E4DED2 border.

App background (all screens except landing):
background-color #DDD3CD, with linear-gradient(160deg, #E9E3DE, #D5CAC3) plus two soft white radial highlights (top-left and middle-right) and one faint taupe radial shadow near the bottom.

Glass card (all light cards on app screens):
background: rgba(255,255,255,0.34);
backdrop-filter: blur(18px) saturate(150%);
border: 1px solid rgba(255,255,255,0.65);
box-shadow: 0 8px 24px rgba(60,40,30,0.08), inset 0 1px 0 rgba(255,255,255,0.7);
border-radius: 16-18px.

Buttons: orange buttons have #1F1A16 text (not white, for readability). Secondary buttons are white with radius 12px. Every clickable element is at least 44px tall.

Small labels: 12px, uppercase, letter-spacing 0.06em, color #6B5B4B.

Layout for app screens: 24px page padding and 24px gaps. Three columns: left 230px (Cite card with orange "New chat", menu card with Ask / Documents / Extract / Admin, "Back to home" card, orange "Free demo" card), centre flexible, right 260-300px. Columns stack on narrow screens.

Shared behaviour: the left menu is the same on every app screen and highlights the current page. "Cite" and "Back to home" go to the landing page.
```

---

## Step 2: Screen prompts

### 1. Landing page

```
Build the Cite landing page. Reference attached. Match it exactly on layout, spacing, corner radius, font sizes and weights, and colors, following the Cite design rules.
One screen, no scrolling on desktop: top bar with the Cite logo and GitHub and Portfolio links; left side with a small label, the headline, the subline, an orange "Try it now" button and "No sign-up. Nothing to upload." beside it; right side with a dark 16:9 video box, orange play button, "1:00" tag and caption.
Behaviour: "Try it now" opens the Ask page. The video box plays the demo video (leave a placeholder source for now).
If HTML is attached, use it as the source of truth for exact values.
```

### 2. Ask page, first visit

```
Build the Cite Ask page in its empty state. Reference attached. Match it exactly on layout, spacing, corner radius, font sizes and weights, colors and the frosted-glass cards, following the Cite design rules.
Centre: header bar (chat title, Share, ⋮), a dark welcome bubble, four starter question cards in a 2x2 grid (each with a small document-type label), and the input box with "Company docs" and "Anthropic" chips and an orange send button. Right: "Sample documents" title card, folder list with yellow folders, and a questions-used meter at the bottom.
Behaviour: clicking a starter question sends it as the user's question. The meter shows questions used out of the daily free limit.
If HTML is attached, use it as the source of truth for exact values.
```

### 3. Ask page, answer with sources

```
Build the Cite Ask page with an answer showing. Reference attached. Match it exactly on layout, spacing, corner radius, font sizes and weights, colors and the frosted-glass cards, following the Cite design rules.
Centre: user questions in glass bubbles on the right with an avatar circle; answers in dark (#2B2B2B) bubbles on the left with small numbered source tags inline and an inner quoted-passage block (with open and copy icons); a "not found" reply as a dark bubble with a search icon and the text "I couldn't find this in the documents." Right: source panel with the tag number, document name, section and page, a white passage card with the matching sentence highlighted in #F0D3B3, an "Open full document" button, an "Also cited" card, and the questions-used meter.
Behaviour: clicking a source tag opens that source in the right panel and turns the tag orange; the X closes the panel. "Open full document" opens that document on the Documents page at the right page.
If HTML is attached, use it as the source of truth for exact values.
```

### 4. Documents page, reading a document

```
Build the Cite Documents page in reading mode. Reference attached. Match it exactly on layout, spacing, corner radius, font sizes and weights, colors and the frosted-glass cards, following the Cite design rules.
Centre: header bar with the title and a white search field with an orange "Search" button; a viewer card with folder icon, document title and type, previous/next page buttons and page number, and the document text on a white page. Right: "Sample documents" folder list with the open document highlighted.
Behaviour: clicking a document in the list opens it in the viewer. Searching opens the search results view.
If HTML is attached, use it as the source of truth for exact values.
```

### 5. Documents page, search results

```
Build the Cite Documents search results. Reference attached. Match it exactly on layout, spacing, corner radius, font sizes and weights, colors and the frosted-glass cards, following the Cite design rules.
Centre: search field with the query and a clear button; a results count with a small key for the two labels; a list of glass result cards, each with folder icon, document name, page, a label chip and a snippet. "Exact match" uses a charcoal chip and charcoal highlights on the matched words; "Matched by meaning" uses a #F0D3B3 chip and highlights. Right: the sample documents folder list.
Behaviour: each result shows the label returned by the search (keyword match vs meaning match). Clicking a result opens that document at that page. The clear button returns to reading mode.
If HTML is attached, use it as the source of truth for exact values.
```

### 6. Extract page, table view

```
Build the Cite Extract page in table view. Reference attached. Match it exactly on layout, spacing, corner radius, font sizes and weights, colors and the frosted-glass cards, following the Cite design rules.
Centre: header bar with a Table / JSON switch; contract name with folder icon; a white table with Detail, Value and Found on columns for Parties, Start date, End date, Payment terms and Renewal clause, with small page tags. Right: "Sample contracts" picker in a yellow folder, with the selected contract highlighted, and a short helper note.
Behaviour: picking a contract fills the table with that contract's extracted details. The switch changes to the JSON view.
If HTML is attached, use it as the source of truth for exact values.
```

### 7. Extract page, JSON view

```
Build the Cite Extract page in JSON view. Reference attached. Match it exactly on layout, spacing, corner radius, font sizes and weights, colors and the frosted-glass cards, following the Cite design rules.
Same layout as the table view, with JSON selected in the switch and a "Copy JSON" button in the header. Centre shows a dark (#2B2B2B) box with an inner #3A3A3A panel labelled "JSON" with download and copy icons, and the JSON in a monospace font: keys #E1A46B, strings #F2EEE5, numbers and true/false #9BC9A8, punctuation #9A918A.
Behaviour: "Copy JSON" and the copy icon copy the JSON to the clipboard; the download icon saves it as a .json file. The JSON matches the table view's data.
If HTML is attached, use it as the source of truth for exact values.
```

### 8. Admin page

```
Build the Cite Admin page. Reference attached. Match it exactly on layout, spacing, corner radius, font sizes and weights, colors and the frosted-glass cards, following the Cite design rules.
Centre: header bar with a "Today" label; three glass summary cards in a row (Questions today, Average response time, Total cost today) with large numbers and small icons; a white "Recent questions" table with Time, Question, Model, Speed and Cost columns and colored model chips (Anthropic #F0D3B3, OpenAI #E3E7E5, Local model #E9E1D3; local cost shows "Free"). Right: "Settings" title card; a "Model" switch with three radio options (selected option has a 2px #CC8D51 border); a "Daily usage cap" card with a progress bar, count, percentage and a green "Under limit" chip.
Behaviour: the model switch sets which model answers new questions. The cap card reflects questions used today against the daily cap and shows a different status when the cap is reached.
If HTML is attached, use it as the source of truth for exact values.
```
