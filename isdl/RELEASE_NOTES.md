# Release Notes

## Latest Changes

### Inventory Field Improvements
**Grid Layout Control**
- Added `columns` parameter to control grid width independently (default: 5)
- Updated `rows` parameter to have a default value of 3
- Grid size is now calculated as `rows × columns`, capped by `slots` if specified
- Default configuration creates a 3×5 grid (15 slots) with a maximum of 20 items

**Breaking Change:**
- Previous inventory grids defaulted to 7 columns with dynamic rows
- New default is 3 rows × 5 columns (15 slots)
- To maintain previous behavior, explicitly set `columns: 7` in your inventory definitions

**Example:**
```isdl
// Default: 3 rows × 5 columns = 15 slots
inventory<Item> backpack

// Custom grid: 4 rows × 6 columns = 24 slots, capped at 30
inventory<Item> storage (rows: 4, columns: 6, slots: 30)

// Single row hotbar: 1 row × 10 columns = 10 slots
inventory<Item> quickbar (rows: 1, columns: 10)
```

### Bug Fixes
**Drag-and-Drop Duplicate Prevention**
- Fixed issue where dragging an item from inventory/table and dropping it back into the same inventory/table would create a duplicate
- Now correctly detects when an item already belongs to the document and prevents duplication
- Applies to all sheet types: Vue sheets, datatable sheets, base sheets, and prompt sheets
- Items can still be copied from other sources (compendiums, other actors, global items)

## Previous Features

### Inventory Field Type
Added a new `inventory` field type for displaying collections of items in a visual grid layout.

**Basic Inventory:**
```isdl
inventory<Equipment> Backpack(slots: 20, slotSize: 60px)
```
- Renders items as a grid of image boxes
- Hover shows item summary (like `choice<item>`)
- Empty slots are shown when items don't fill all slots
- Click to open item sheets

**Advanced Features:**
```isdl
inventory<Equipment> BackpackInventory(
    rows: 4, columns: 6,         // 4 rows × 6 columns = 24 slots
    slots: 30,                   // Cap at 30 max items
    slotSize: 50px,              // 50×50 pixel slots
    quantity: Quantity,          // Show quantity badges
    money: Wealth,               // Link to money field at bottom
    sum: [Weight, Value],        // Aggregate item properties
    sumMax: self.CarryCapacity,  // Show capacity (e.g., "45/100")
    sort: Weight asc,            // Sort items by property
    where: {item.system.equipped == false}, // Filter items
    global: true,                // Include compendium items
    emptySlots: show,            // show/hide empty slots
    summary: full                // full/compact hover info
)
```

**Layout Options:**
- **Top-level**: Renders as a tab alongside other document tabs
- **Section-level**: Renders inline within a section

**Parameters:**
- `slots`: Maximum number of items allowed (default: 20)
- `rows`: Number of grid rows (default: 3)
- `columns`: Number of grid columns (default: 5)
- `slotSize`: Slot dimensions in pixels (default: 60px)
- `quantity`: Reference to item's quantity field for stacking badges
- `money`: Link to a money field to display at bottom of inventory
- `sum`: Array of item properties to aggregate (shows totals with progress bars)
- `sumMax`: Maximum capacity value (number or expression like `self.CarryCapacity`)
- `sort`: Property to sort by, with `asc` or `desc` order
- `where`: Filter expression to show/hide items
- `global`: Include items from compendiums (default: false)
- `emptySlots`: `show` or `hide` empty inventory slots
- `summary`: `full` or `compact` hover tooltip format

**Scope Resolution:**
- Inventory parameters like `quantity`, `sum`, and `sort` reference properties on the item type
- `money` parameter references money fields on the actor
- Expression parameters like `sumMax` and `where` have access to actor properties

### Money Field Type
Added a new `money` field type with support for both single currency and multi-denomination systems.

**Single Currency:**
```isdl
money Credits(icon: "fa-solid fa-coins", format: compact, precision: 1)
```
- Displays as a standard number input
- Supports formatting: `auto`, `compact`, or `full`
- Auto-format shows large numbers with k/M/B suffixes
- Includes calculator support in edit mode

**Multi-Denomination:**
```isdl
money Wealth(icon: "fa-solid fa-sack-dollar", display: breakdown) {
    Gold   (value: 10000, icon: "fa-solid fa-coins", color: #FFD700)
    Silver (value: 100,   icon: "fa-solid fa-coins", color: #C0C0C0)
    Bronze (value: 1,     icon: "fa-solid fa-coins", color: #CD7F32)
}
```
- Collapsible field showing summary or breakdown view
- Display modes: `breakdown`, `primary`, or `consolidated`
- Each denomination can have custom icon and color
- Built-in currency conversion with live preview
- Calculator support for each denomination in edit mode

### Currency Conversion
- Click conversion icon next to any denomination
- Select target denomination and amount
- Live preview shows before/after values
- Validates sufficient funds
- Automatically calculates exchange rates based on denomination values

### Data Structure
- Single currency: Stored as simple number (`system.credits`)
- Multi-denomination: Stored as object (`system.wealth.gold`, `system.wealth.silver`, etc.)
- All denominations are lowercase in the data model
- Full integration with Foundry VTT's data persistence

### Scripting Support
Access and modify money fields in actions:
```isdl
action AddMoney {
    self.Credits += 100
    self.Wealth.Gold += 1
    self.Wealth.Silver += 5
}
```
