import * as fs from 'node:fs';
import * as path from 'node:path';
import { Entry } from "../../language/generated/ast.js";
import { expandToNode, toString } from 'langium/generate';

export function generateBaseDocumentSheet(entry: Entry, id: string, destination: string) {
    const generatedFileDir = path.join(destination, "system", "sheets");
    const generatedFilePath = path.join(generatedFileDir, `${id}-sheet.mjs`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const fileNode = expandToNode`
        export default class ${entry.config.name}DocumentSheet extends DocumentSheet {
        
            /** @override */
            static get defaultOptions() {
                return foundry.utils.mergeObject(super.defaultOptions, {
                    classes: ["${id}", "sheet"],
                    width: 1000,
                    height: 950,
                    resizable: true,
                    submitOnClose: true,
                    submitOnChange: true,
                    closeOnSubmit: false,
                    tabs: [
                        {navSelector: ".pages", contentSelector: ".pages-container", initial: "main"},
                        {navSelector: ".tabs", contentSelector: ".tabs-container", initial: "description"}
                    ],
                    dragDrop: [
                        {dragSelector: "tr", dropSelector: ".tabs-container"},
                        {dropSelector: ".single-document"},
                        {dragSelector: ".paper-doll-slot", dropSelector: ".paper-doll-slot"}
                    ],
                });
            }

            /* -------------------------------------------- */

            /** @override */
            get title() {
                return \`\${this.object.name} \${game.i18n.localize("Config")}\`;
            }

            /* -------------------------------------------- */

            /** @override */
            async getData() {
                const context = await super.getData();
                context.descriptionHTML = await TextEditor.enrichHTML(
                    this.object.system.description,
                    {async: true, secrets: this.object.isOwner}
                );
                return context;
            }

            /* -------------------------------------------- */

            activatedTables = [];

            /** @override */
            activateListeners(html) {
                super.activateListeners(html);

                this._swapBackground(this.defaultBackground);

                html.find(".pips-container").mousedown(this._onPipsClick.bind(this));
                html.find(".row-action").click(this._onTableRowAction.bind(this));
                html.find(".single-document-remove").click(this._onSingleDocumentRemove.bind(this));

                this.activateDataTables(html);
                this.activateProgressBars(html);
            }

            dbInstance = null;

            // Open IndexedDB (Cached)
            openDB(version=1) {
                return new Promise((resolve, reject) => {
                    if (this.dbInstance) return resolve(this.dbInstance);

                    const request = indexedDB.open("datatableDB", version);
                    
                    request.onupgradeneeded = (event) => {
                        let db = event.target.result;
                        if (!db.objectStoreNames.contains("tableStates")) {
                            db.createObjectStore("tableStates", { keyPath: "id" });
                        }
                    };

                    request.onsuccess = (event) => {
                        this.dbInstance = event.target.result;
                        resolve(this.dbInstance);
                    };
                    
                    request.onerror = () => reject("IndexedDB failed to open.");
                });
            }

            // Save table state
            saveTableState(name, data) {
                this.openDB().then((db) => {
                    const tx = db.transaction("tableStates", "readwrite");
                    const store = tx.objectStore("tableStates");
                    store.put({ id: name, data });

                    tx.oncomplete = () => {};
                    tx.onerror = () => console.error(\`Failed to save state: \${name}\`);
                });
            }

            // Load table state
            loadTableState(name) {
                return new Promise((resolve) => {
                    this.openDB().then((db) => {
                        const tx = db.transaction("tableStates", "readonly");
                        const store = tx.objectStore("tableStates");
                        const request = store.get(name);

                        request.onsuccess = () => resolve(request.result ? request.result.data : null);
                        request.onerror = () => resolve(null);
                    });
                });
            }


            /* -------------------------------------------- */

            activateDataTables(html) {
                for ( let t of this.activatedTables ) {
                    try {
                        t.destroy();
                    } catch { }
                }
                this.activatedTables = [];
                var tables = this._element.find("table");
                for ( let t of tables ) {
                    let table = new DataTable(t, {
                        paging: false,
                        scrollY: 250,
                        stateSave: true,
                        stateSaveCallback: (settings, data) => {
                            const documentName = this.object.name;
                            const documentType = this.object.type;
                            const tableName = settings.nTable.closest(".tab").dataset.tab;
                            const name = \`DataTables_\${documentName}_\${documentType}_\${tableName}\`;
                            try {
                                this.saveTableState(name, data);
                            }
                            catch (e) {
                                console.error("Failed to save state:", e);
                            }
                        },
                        stateLoadCallback: (settings, callback) => {
                            const documentName = this.object.name;
                            const documentType = this.object.type;
                            const tableName = settings.nTable.closest(".tab").dataset.tab;
                            const name = \`DataTables_\${documentName}_\${documentType}_\${tableName}\`;
                        
                        
                            this.loadTableState(name).then((data) => {
                                callback(data);
                            }).catch((error) => {
                                console.error("Failed to load table state:", name, error);
                                callback(null); // Return null on failure
                            });
                        },
                        responsive: true,
                        scrollX: false,
                        colReorder: true,
                        layout: {
                            topStart: {
                                buttons: [
                                    {
                                        text: '<i class="fas fa-plus"></i> Add',
                                        action: (e, dt, node, config) => {
                                            // Find the parent tab so we know what type of Item to create
                                            const tab = e.currentTarget.closest(".tab");
                                            const type = tab.dataset.type;
                                            if ( type == "ActiveEffect" ) {
                                                ActiveEffect.createDocuments([{label: "New Effect"}], {parent: this.object}).then(effect => {
                                                    effect[0].sheet.render(true);
                                                });
                                            }
                                            else {
                                                Item.createDocuments([{type: type, name: "New " + type}], {parent: this.object}).then(item => {
                                                    item[0].sheet.render(true);
                                                });
                                            }
                                        }
                                    },
                                    'colvis'
                                ]
                            }
                        },
                        columnDefs: [
                            {
                                targets: [0, 1, -1], // Image, Name, Actions
                                responsivePriority: 1
                            },
                            {
                                target: 0, // Image
                                width: "40px"
                            },
                            {
                                target: -1, // Actions
                                orderable: false,
                                width: "200px"
                            },
                            {
                                target: 1, // Name 
                                width: "200px"
                            }
                        ],
                        order: [
                            [1, "asc"]
                        ]
                    });

                    // When the table is re-ordered, update the sort attribute of each item
                    table.on('row-reordered', function (e, diff, edit) {
                        for (var i = 0, ien = diff.length; i < ien; i++) {
                            const id = diff[i].node.dataset.id;
                            const item = self.object.items.get(id);
                            if (item) {
                                item.update({sort: diff[i].newPosition});
                            }
                        }
                    });
                    this.activatedTables.push(table);
                }
            }

            /* -------------------------------------------- */

            lastKnownProgressBars = [];
            activateProgressBars(html) {
                const progressBars = html.find(".progress-bar");
                for ( let p of progressBars ) {
                    const fromColor = p.dataset.colorFrom;
                    const toColor = p.dataset.colorTo;

                    // If we don't have a value and max, we can't create a progress bar
                    if (p.dataset.value === undefined || p.dataset.max === undefined) continue;

                    const value = parseFloat(p.dataset.value);
                    const max = parseFloat(p.dataset.max);

                    if ( isNaN(value) || isNaN(max) ) continue;
                    if ( max <= 0 ) continue;

                    const percent = Math.min(Math.max(value / max, 0), 1);
                    const name = p.attributes.name.value;
                    try {
                        var bar = new ProgressBar.Line(p, {
                            strokeWidth: 3,
                            easing: 'easeInOut',
                            duration: 1400,
                            color: '#FFEA82',
                            trailColor: '#eee',
                            trailWidth: 1,
                            svgStyle: {width: '100%', height: '100%'},
                            from: {color: fromColor},
                            to: {color: toColor},
                            step: (state, bar) => {
                                bar.path.setAttribute('stroke', state.color);
                            }
                        });

                        // We store a name: value pair for each progress bar. If there is a last known value, we set that as the non-animated base then update to the new value..
                        const lastKnown = this.lastKnownProgressBars.find(p => p.name === name);
                        if ( lastKnown ) {
                            bar.set(lastKnown.percent);
                            bar.animate(percent);
                            lastKnown.percent = percent;
                        } else {
                            bar.set(percent);
                            this.lastKnownProgressBars.push({name: name, percent: percent});
                        }
                    }
                    catch(err) {
                        // Do nothing
                    }
                }
            }

            /* -------------------------------------------- */

            get defaultBackground() {
                return "topography";
            }

            _currentBackground = null;
            _swapBackground(background) {
                const form = this.form;
                form.classList.remove("topography", "hideout", "graphpaper", "texture", "squares", "dominoes", "temple", "food", "anchors", "bubbles", "diamonds", "circuitboard", "bricks");
                form.classList.add(background);
                this._currentBackground = background;
            }

            /* -------------------------------------------- */

            /** @override */
            _onChangeTab(event, tabs, active) {
                super._onChangeTab(event, tabs, active);

                if ( tabs._content.classList.contains("pages-container") ) {
                    // Get the new active page header
                    const header = tabs._nav.querySelector(\`[data-tab="\${tabs.active}"]\`);
                    if ( !header ) return;

                    // Set the background
                    const background = header.dataset.background;
                    
                    this._swapBackground(background);
                }

                // Redraw any DataTable instances which are active within the form for correct sizing
                for ( let table of this.activatedTables ) {
                    table.draw();
                    table.responsive.rebuild();
                    table.responsive.recalc();
                }

                this.calculateHeight();
            }

            /* -------------------------------------------- */

            firstRender = true;
            /** @override */
            setPosition({left, top, width, height, scale}={}) {
                if ( !this.popOut && !this.options.resizable ) return;
                super.setPosition({left, top, width, height, scale});

                if ( this.firstRender ) {
                    this.firstRender = false;
                    this.calculateHeight();
                }
            }

            /* -------------------------------------------- */

            calculateHeight() {
                // Calculate the height of the drawn content and set the height of the sheet to that value
                const form = this.form;
                let calculatedInnerHeight = 0;
                for ( let c of form.children ) {
                    calculatedInnerHeight += c.offsetHeight;
                }
                const formHeight = calculatedInnerHeight + 75;
                const maxHeight = window.innerHeight * 0.9; // 90% of the viewport height

                this.setPosition({height: Math.min(formHeight, maxHeight)});
            }

            /* -------------------------------------------- */

            /** @override */
            async close(options={}) {

                // Destroy any DataTable instances which are active within the form
                for ( let t of this.activatedTables ) {
                    t.destroy();
                }
                this.activatedTables = [];

                // Call the base close method
                return super.close(options);
            }

            /* -------------------------------------------- */

            /** @override */
            _onResize(event) {
                super._onResize(event);

                // Redraw any DataTable instances which are active within the form for correct sizing
                for ( let table of this.activatedTables ) {
                    table.draw();
                    table.responsive.rebuild();
                    table.responsive.recalc();
                }
            }

            /* -------------------------------------------- */

            async _onDrop(event) {
                super._onDrop(event);
                const data = JSON.parse(event.dataTransfer.getData("text/plain"));

                // If the drop target is a single document, handle it differently
                const linkedClasses = [ "single-document", "paper-doll-slot" ];
                const eventClasses = Array.from(event.currentTarget.classList);
                if (eventClasses.find(c => linkedClasses.includes(c))) {
                    const doc = await fromUuid(data.uuid);
                    if ( !doc ) return;
                    if ( doc.type !== event.currentTarget.dataset.type ) {
                        ui.notifications.error(\`Expected a \${event.currentTarget.dataset.type} type Document, but got a \${doc.type} type one instead. \`);
                        return;
                    }

                    const update = {};
                    update[event.currentTarget.dataset.name] = data.uuid;
                    await this.object.update(update);
                    return;
                }

                const dropTypes = ["Item", "ActiveEffect"];
                if ( !dropTypes.includes(data.type) ) return;
                const item = await fromUuid(data.uuid);
                if ( !item ) return;

                if ( data.type === "ActiveEffect" ) {
                    ActiveEffect.createDocuments([item], {parent: this.object})
                    return;
                }

                await this.handleItemDrop(item);
            }

            /* -------------------------------------------- */

            async handleItemDrop(item) { }

            /* -------------------------------------------- */

            async _onPipsClick(event) {
                event.preventDefault();

                const name = event.currentTarget.dataset.name;
                const update = {};

                // If this is a right click, decrement the value
                if ( event.button === 2 ) {
                    update["system." + name] = Math.max(0, this.object.system[name] - 1);
                }
                // Else, increment
                else {
                    const max = parseInt(event.currentTarget.dataset.max);
                    update["system." + name] = Math.min(max, this.object.system[name] + 1);
                }
                this.object.update(update);
            }

            /* -------------------------------------------- */

            async _onTableRowAction(event) {
                event.preventDefault();

                const action = event.currentTarget.dataset.action;
                const id = event.currentTarget.closest("tr").dataset.id;
                const type = event.currentTarget.closest(".tab").dataset.type;
                const typeAccessor = type === "ActiveEffect" ? "effects" : "items";
                const item = this.object[typeAccessor].get(id);

                // If this is a .item-custom-action, route it to the item sheet handler
                if ( event.currentTarget.classList.contains("item-custom-action") ) {
                    await item.sheet._onAction(event);
                    return;
                }

                switch ( action ) {
                    case "edit":
                        item.sheet.render(true);
                        break;
                    case "delete":
                        const shouldDelete = await Dialog.confirm({
                            title: "Delete Confirmation",
                            content: \`<p>Are you sure you would like to delete \${item.name}?</p>\`,
                            defaultYes: false
                        });
                        if ( shouldDelete ) item.delete();
                        break;
                    case "sendToChat":
                        const chatDescription = item.description ?? item.system.description;
                        const content = await renderTemplate("systems/${id}/system/templates/chat/standard-card.hbs", { 
                            cssClass: "${id}",
                            document: item,
                            hasEffects: item.effects?.size > 0,
                            description: chatDescription,
                            hasDescription: chatDescription != ""
                        });
                        ChatMessage.create({
                            content: content,
                            speaker: ChatMessage.getSpeaker(),
                            type: CONST.CHAT_MESSAGE_TYPES.IC
                        });
                        break;
                    case "toggle":
                        // If we haven't found an effect on the actor, check the actor.items
                        if ( !item ) {
                            const ae = this.object.items.find(i => i.effects.has(id)).effects.get(id);
                            if ( !ae ) return;
                            await ae.update({ "disabled": !ae.disabled });
                            break;
                        }
                        await item.update({ "disabled": !item.disabled });
                        break;
                    default:
                        await this.handleTableRowAction(item, action);
                        break;
                }
            }

            /* -------------------------------------------- */

            async handleTableRowAction(item, action) { }
            
            /* -------------------------------------------- */

            async _onSingleDocumentRemove(event) {
                event.preventDefault();
                const update = {};
                update[event.currentTarget.dataset.name] = null;
                await this.object.update(update);
            }

            /* -------------------------------------------- */

            _onDragStart(event) {
                console.log("Drag Start");

                if (event.currentTarget.classList.contains("paper-doll-slot")) {
                    // Remove the item from the slot
                    const name = event.currentTarget.dataset.name;
                    const update = {};
                    update[name] = null;
                    this.object.update(update);
                }
                else {
                    const tr = event.currentTarget.closest("tr");
                    const data = {
                        type: tr.dataset.type == "ActiveEffect" ? "ActiveEffect" : "Item",
                        uuid: tr.dataset.uuid
                    };

                    event.dataTransfer.setData("text/plain", JSON.stringify(data));
                }
            }
        }
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}
