grammar IntelligentSystemDesignLanguage
entry Entry:
    config=Config documents+=Document*;

// Config ------------------------------------------------------

Config:
    "config" name=ID "{" body+=(ConfigExpression | ConfigFlag | Keywords | Settings | Theme)* "}";

ConfigExpression:
    type=("label" | "id" | "author" | "description" | "globalStyles" | "sheetStyles") "=" value=STRING;

// Boolean system-level switches. `userColors` toggles the per-document
// primary/secondary/tertiary color pickers on the sheet (default on); set it
// false for an art-directed system whose look is fixed by the theme.
ConfigFlag:
    type=("userColors") "=" value=BOOLEAN;

// Theme ------------------------------------------------------
// A small vocabulary of declarative style tokens, structured as a HYBRID:
//   - flat PALETTE roots (`primary`/`secondary`/`tertiary`/`background`/`text`) — the
//     colors used across the whole sheet; the per-field-capable subset overlaps here.
//   - grouped COMPONENT blocks (`border { }`, `font { }`, `heading { }`) — a coherent
//     set of CSS sub-properties on one target, named with the plain CSS sub-prop name.
// Every token compiles to an `--isdl-*` CSS custom property. The theme block sets them
// on the system root; per-field params set them on that field's wrapper (cascade beats
// the root for free). Per-field params stay FLAT and curated (`borderColor:` maps onto
// the same var as global `border { color }`), since nesting a block inside `( … )` is ugly.

// The theme vocabulary is shared by BOTH scopes via one fragment:
//   - global  `config { theme { … } }`        -> defaults on the system root
//   - per-field `attribute Luck(theme: { … })` -> override on that field's wrapper
// Same grouped syntax in both; only the wrapper differs (`theme { }` vs the `theme:` param).
// Entries are COMMA-SEPARATED, like every other param list in the grammar (no trailing comma).
// A group may still be written `border { … }` or `border: { … }` (the colon before the brace
// is optional) — that JSON-ish affordance is independent of the entry separator.
fragment ThemeBodyFrag:
    (params+=ThemeBodyParam ("," params+=ThemeBodyParam)*)?;

ThemeBodyParam:
    (ThemePaletteParam | ThemeBorderGroup | ThemeFontGroup | ThemeHeadingGroup | ThemeDisabledGroup | ThemeWidthGroup | ThemeHeightGroup);

Theme:
    "theme" "{" ThemeBodyFrag "}";

// Per-field override: the SAME body, wrapped in a `theme:` param on a field's `( … )`.
ThemeFieldParam:
    "theme:" "{" ThemeBodyFrag "}";

// Flat palette roots (colors used across the whole sheet / the field).
ThemePaletteParam:
    (ThemePrimaryParam | ThemeSecondaryParam | ThemeTertiaryParam | ThemeBackgroundParam | ThemeTextParam);

// `primary` is the system's lead color: it paints the field highlight edge and is the
// default for the per-document primary picker. Per-field, it recolors just that edge.
ThemePrimaryParam:
    "primary:" value=HEX_COLOR;

// `secondary`/`tertiary` seed the per-document color pickers (a whole-sheet concept). They
// are accepted per-field for symmetry but only the GLOBAL values seed the picker.
ThemeSecondaryParam:
    "secondary:" value=HEX_COLOR;

ThemeTertiaryParam:
    "tertiary:" value=HEX_COLOR;

// `background` (was `surface`) paints the surface; `text` the body text color.
ThemeBackgroundParam:
    "background:" value=HEX_COLOR;

ThemeTextParam:
    "text:" value=HEX_COLOR;

// ── Grouped component blocks ──
// Inner names are the plain CSS sub-property (`color`/`width`/`radius`/`family`/`size`/
// `transform`/`min`/`max`); the block keyword supplies the prefix, so no `borderColor`
// gymnastics and the `color:` collision with the per-field `color:` param is sidestepped.
//
// The inner props are GENERIC, reusable leaf rules (`ThemeColorProp`, `ThemeSizeProp`, …) —
// the SAME `color:`/`size:` rule appears in several groups, and the parent group decides
// which `--isdl-*` var it maps to (border `color` -> --isdl-border, heading `color` ->
// --isdl-heading-color). One rule per CSS sub-property, not one per group×property.
// Size-like props accept `42px` (a PX literal, used verbatim) or a bare `42` (px appended).
ThemeColorProp:     "color:" value=HEX_COLOR;
ThemeSizeProp:      "size:" value=(PX | INT);
ThemeWidthProp:     "width:" value=(PX | INT);
ThemeRadiusProp:    "radius:" value=(PX | INT);
ThemeFamilyProp:    "family:" value=STRING;
ThemeFontFaceProp:  "font:" value=STRING;
ThemeTransformProp: "transform:" value=STRING;
ThemeMinProp:       "min:" value=(PX | INT);
ThemeMaxProp:       "max:" value=(PX | INT);

// Groups accept an optional `:` before the brace (`border { }` or `border: { }`). For
// names that are ALSO a `name:` leaf-prop keyword (`width:`/`font:`/`height:`), the lexer
// glues the colon to the name, so those groups list the `name:` token as an explicit
// alternative; the parser tells group from prop by context (body-level vs inside a group).
ThemeBorderGroup:
    "border" ":"? "{" (props+=(ThemeColorProp | ThemeWidthProp | ThemeRadiusProp) ("," props+=(ThemeColorProp | ThemeWidthProp | ThemeRadiusProp))*)? "}";

ThemeFontGroup:
    ("font:" | "font") "{" (props+=(ThemeFamilyProp | ThemeSizeProp) ("," props+=(ThemeFamilyProp | ThemeSizeProp))*)? "}";

ThemeHeadingGroup:
    "heading" ":"? "{" (props+=(ThemeColorProp | ThemeFontFaceProp | ThemeSizeProp | ThemeTransformProp) ("," props+=(ThemeColorProp | ThemeFontFaceProp | ThemeSizeProp | ThemeTransformProp))*)? "}";

// `width { min, max }` / `height { min, max }` constrain the field wrapper's min/max
// width/height (sizing & density). They share the `min:`/`max:` leaf props.
ThemeWidthGroup:
    ("width:" | "width") "{" (props+=(ThemeMinProp | ThemeMaxProp) ("," props+=(ThemeMinProp | ThemeMaxProp))*)? "}";

ThemeHeightGroup:
    ("height:" | "height") "{" (props+=(ThemeMinProp | ThemeMaxProp) ("," props+=(ThemeMinProp | ThemeMaxProp))*)? "}";

// `disabledText { }` styles the play-mode (read-only) field text. By default ISDL keeps it
// fully readable (body text color, no fade); these tokens let an author recolor/resize it.
// NB: the keyword is `disabledText`, not `disabled`, so `disabled` stays free as an ordinary
// identifier (it's a very common boolean field/param name — reserving it would collide).
ThemeDisabledGroup:
    "disabledText" ":"? "{" (props+=(ThemeColorProp | ThemeSizeProp) ("," props+=(ThemeColorProp | ThemeSizeProp))*)? "}";

Keywords:
    "keywords" "{" body+=Keyword* "}";

// System Settings ------------------------------------------------------
// Declarative game.settings.register entries, grouped by Foundry scope. Reuses
// the field type keywords with a small, setting-specific param set (initial /
// choices / label / hint). Distinct AST nodes keep settings out of the document
// datamodel/sheet/localization generators.

Settings:
    "settings" "{" groups+=SettingScope* "}";
SettingScope:
    scope=("world" | "client") "{" settings+=SettingField* "}";
SettingField:
    (BooleanSetting | NumberSetting | StringSetting | StringChoiceSetting);

fragment SettingParamsFrag:
    ("(" params+=SettingParam ("," params+=SettingParam)* ")")?;
SettingParam:
    (SettingInitial | SettingChoices | LabelParam | SettingHint);
// initial is a static literal (Foundry evaluates default once at init); the
// literal type is validated against the setting keyword.
SettingInitial:
    "initial:" value=(BOOLEAN | INT | STRING);
SettingChoices:
    "choices:" "[" (choices+=STRING ("," choices+=STRING)*)? "]";
SettingHint:
    "hint:" value=STRING;

BooleanSetting:
    "boolean" name=ID SettingParamsFrag;
NumberSetting:
    "number" name=ID SettingParamsFrag;
StringSetting:
    "string" name=ID SettingParamsFrag;
StringChoiceSetting:
    "choice" "<" "string" ">" name=ID SettingParamsFrag;

Keyword:
    name=ID ("(" params+=KeywordParam ("," params+=KeywordParam)* ")")?;

KeywordParam:
    (LabelParam | IconParam | ColorParam | SummaryParam);

SummaryParam:
    "summary:" value=STRING;

// Documents ------------------------------------------------------

Document:
    Actor | Item;

Actor:
    "actor" name=ID ("(" params+=DocumentParam ("," params+=DocumentParam)* ")")? ClassBlock;
Item:
    "item" name=ID ("(" params+=DocumentParam ("," params+=DocumentParam)* ")")? ClassBlock;
DocumentParam:
    (IconParam | BackgroundParam | DocumentSvgParam | DocumentDescriptionParam | DocumentCreatableParam | DocumentDefaultParam | WidthParam | HeightParam);
DocumentSvgParam:
    "svg:" value=STRING;
DocumentDescriptionParam:
    "description:" value=STRING;
DocumentCreatableParam:
    "creatable:" value=BOOLEAN;
DocumentDefaultParam:
    "default:" value=BOOLEAN;


// Document Body ------------------------------------------------------

fragment ClassBlock:
    "{" body+=(ClassExpression | Layout)* "}";

Layout:
    (Section | Page | Row | Column);

// Layout containers can carry a `theme: { }` override like fields, but with a narrower,
// container-specific token set enforced by validation: row/column accept only sizing
// (`width`/`height`); section additionally accepts `border`/`background`/`text`.
Section:
    "section" name=ID ("(" params+=(ThemeFieldParam | HideLabelParam) ("," params+=(ThemeFieldParam | HideLabelParam))* ")")? "{" body+=(ClassExpression|Row|Column)* "}";
Row:
    "row" ("(" params+=ThemeFieldParam ("," params+=ThemeFieldParam)* ")")? "{" body+=(ClassExpression|Section|Row|Column)* "}";
Column:
    "column" ("(" params+=ThemeFieldParam ("," params+=ThemeFieldParam)* ")")? "{" body+=(ClassExpression|Section|Row|Column)* "}";
Page:
    "page" name=ID ("(" params+=(IconParam|BackgroundParam) ("," params+=(IconParam|BackgroundParam))* ")")? "{" body+=(ClassExpression | Layout)* "}";

ClassExpression:
    (Property | MethodContainer | InitiativeProperty | StatusProperty);

MethodContainer:
    (Action | HookHandler | FunctionDefinition);


// Fields ------------------------------------------------------

Property:
    (BasicFields | ComplexFields | DateTimeFields | DiceFields | DocumentFields | ReferenceFields | WipFields);
BasicFields:
    (StringExp | NumberExp | HtmlExp | BooleanExp | StringChoiceField | DamageTypeChoiceField | StringChoicesField);
ComplexFields:
    (ResourceExp | TrackerExp | AttributeExp | MeasuredTemplateField | DamageBonusesField | DamageResistancesField | PinnedField | DocumentChoicesExp | MoneyField | RollVisualizerField | ImageField);
WipFields:
    (DamageTrackExp);
DateTimeFields:
    (DateExp | TimeExp | DateTimeExp);
DiceFields:
    (DieField | DiceField);
DocumentFields:
    (SingleDocumentExp | DocumentChoiceExp | DocumentChoicesExp | PaperDollExp | MacroField | TableField | InventoryField);
ReferenceFields:
    (ParentPropertyRefExp | SelfPropertyRefExp);
fragment ExpressionModifier:
    (modifier=("unlocked" | "default" | "secret" | "edit" | "play" | "gmEdit" | "gmOnly" | "readonly" | "locked" | "hidden"))?;
StandardFieldParams:
    (VisibilityParam | IconParam | ColorParam | LabelParam | ThemeFieldParam | HideLabelParam);
fragment StandardFieldParamsFrag:
    ("(" params+=StandardFieldParams* ("," params+=StandardFieldParams)* ")")?;
// Suppress a field's label (or a section's title). The field still renders, just without its
// label text -- handy for compact layouts where the value or icon is self-explanatory.
HideLabelParam:
    "hideLabel:" value=BOOLEAN;
NumberFieldParams:
    (NumberParamMin | NumberParamInitial | NumberParamValue | NumberParamMax | NumberParamCalculator);


// String -------------

StringExp:
    ExpressionModifier "string" name=ID ("(" params+=StringParameter* ("," params+=StringParameter)* ")")?;

StringChoiceField:
    ExpressionModifier "choice" "<" "string" ">" name=ID ("(" params+=StringParameter* ("," params+=StringParameter)* ")")?;

DamageTypeChoiceField:
    ExpressionModifier "choice" "<" "damageType" ">" name=ID ("(" params+=StringParameter* ("," params+=StringParameter)* ")")?;

StringChoicesField:
    ExpressionModifier "choices" "<" "string" ">" name=ID ("(" params+=StringChoicesParameter* ("," params+=StringChoicesParameter)* ")")?;

StringParameter:
    (StringParamChoices | StringParamValue | StandardFieldParams);
StringParamValue:
    "value:" value=(STRING | MethodBlock);
StringParamChoices:
    "choices:" "[" (choices+=StringChoice ("," choices+=StringChoice)*)? "]";

StringChoicesParameter:
    (StringChoicesParamChoices | StringChoicesParamMax | StringChoicesParamInitial | StandardFieldParams);
StringChoicesParamChoices:
    "choices:" "[" (choices+=StringChoice ("," choices+=StringChoice)*)? "]";
StringChoicesParamMax:
    "max:" value=INT;
StringChoicesParamInitial:
    "initial:" value=INT;

StringChoice:
    value=(STRING | StringExtendedChoice);

StringExtendedChoice:
    "{" properties+=(ChoiceStringValue | ChoiceProperty) ("," properties+=(ChoiceStringValue | ChoiceProperty))* "}";

ChoiceProperty:
    LabelParam | IconParam |
    ColorParam | SummaryParam | WhenExpressions | ChoiceCustomProperty;

ChoiceStringValue:
    "value:" value=STRING;

// Custom properties for game-specific data
ChoiceCustomProperty:
    key=ID ":" value=(STRING | INT | BOOLEAN | Expression);

// Number -------------

NumberExp:
    ExpressionModifier "number" name=ID ("(" params+=NumberParameter* ("," params+=NumberParameter)* ")")?;
NumberParameter:
    (NumberParamMin | NumberParamInitial | NumberParamValue | NumberParamMax | NumberParamCalculator | StandardFieldParams);


// Boolean -------------

BooleanExp:
    ExpressionModifier "boolean" name=ID ("(" params+=BooleanParameter* ("," params+=BooleanParameter)* ")")?;
BooleanParameter:
    (StandardFieldParams | BooleanParamValue);
BooleanParamValue:
    "value:" value=(BOOLEAN | MethodBlock);
HtmlExp:
    ExpressionModifier "html" name=ID StandardFieldParamsFrag;


// Resource -------------

ResourceExp:
    ExpressionModifier (tag=("health" | "wounds"))? "resource" name=ID ("(" params+=ResourceParameter* ("," params+=ResourceParameter)* ")")?;
ResourceParameter:
    (StandardFieldParams | NumberFieldParams | TrackerStyleParameter | SegmentsParameter);


// Measured Template -------------

MeasuredTemplateField:
    ExpressionModifier "measuredTemplate" name=ID StandardFieldParamsFrag;

// Image -------------
// A file-picker image field, placeable anywhere in the layout. By default it stores its own path
// at system.<name>. Mark exactly one `primary: true` to bind it to the document's native `img`
// (the token/portrait) -- placing that makes the portrait movable and auto-hides the drawer image.

ImageField:
    ExpressionModifier "image" name=ID ("(" params+=ImageFieldParam ("," params+=ImageFieldParam)* ")")?;
ImageFieldParam:
    (StandardFieldParams | ImagePrimaryParam);
ImagePrimaryParam:
    "primary:" value=BOOLEAN;

// Damage Bonuses -------------

DamageBonusesField:
    ExpressionModifier "bonuses" name=ID StandardFieldParamsFrag;

// Damage Resistances -------------

DamageResistancesField:
    ExpressionModifier "resistances" name=ID StandardFieldParamsFrag;

// Money -------------

MoneyField:
    ExpressionModifier "money" name=ID ("(" params+=MoneyParameter ("," params+=MoneyParameter)* ")")? ("{" denominations+=MoneyDenomination* "}")?;

MoneyParameter:
    (StandardFieldParams | MoneyFormatParam | MoneyPrecisionParam | MoneyDisplayParam | NumberParamInitial | NumberParamValue);

MoneyFormatParam:
    "format:" value=("compact" | "full" | "auto");

MoneyPrecisionParam:
    "precision:" value=INT;

MoneyDisplayParam:
    "display:" value=("breakdown" | "consolidated" | "primary");

MoneyDenomination:
    name=ID ("(" params+=MoneyDenominationParam ("," params+=MoneyDenominationParam)* ")")?;

MoneyDenominationParam:
    (MoneyDenominationValueParam | IconParam | ColorParam);

MoneyDenominationValueParam:
    "value:" value=INT;

// Pinned Items Display -------------

PinnedField:
    ExpressionModifier "pinned" name=ID StandardFieldParamsFrag;

// Roll Visualizer -------------
// Charts the probability distribution of a dice formula (exact via convolution
// for additive formulas, Monte Carlo fallback otherwise) plus its average and
// min/max. The value: expression uses the same roll-expression syntax as
// attribute roll:, so it can reference other fields and recompute reactively.

RollVisualizerField:
    ExpressionModifier "rollVisualizer" name=ID ("(" params+=RollVisualizerParameter ("," params+=RollVisualizerParameter)* ")")?;
RollVisualizerParameter:
    (StandardFieldParams | RollVisualizerValueParam);
RollVisualizerValueParam:
    "value:" value=(MethodBlock | Expression);

// Tracker -------------

TrackerExp:
    ExpressionModifier "tracker" name=ID ("(" params+=TrackerParameter ("," params+=TrackerParameter)* ")")?;
TrackerParameter:
    (StandardFieldParams | NumberFieldParams | TrackerStyleParameter | SegmentsParameter);
TrackerStyleParameter:
    "style:" style=("bar" | "dial" | "icons" | "slashes" | "segmented" | "clock" | "plain");
SegmentsParameter:
    "segments:" segments=INT;


// Attribute -------------

AttributeExp:
    ExpressionModifier "attribute" name=ID AttributeParameters;
fragment AttributeParameters:
    ("(" params+=AttributeParameter* ("," params+=AttributeParameter)* ")")?;
AttributeParameter:
    (StandardFieldParams | NumberFieldParams | AttributeParamMod | AttributeStyleParam | AttributeRollParam | AttributeFunctionParam);
AttributeParamMod:
    "mod:" method=MethodBlock;
AttributeStyleParam:
    "style:" style=("plain" | "box");
AttributeRollParam:
    "roll:" roll=(MethodBlock | Expression);
AttributeFunctionParam:
    "function:" function=[FunctionDefinition:ID];



// Damage Track -------------

DamageTrackExp:
    ExpressionModifier "damageTrack" name=ID ("(" params+=DamageTrackParams ("," params+=DamageTrackParams)*")")?;
DamageTrackParams:
    (StandardFieldParams | NumberFieldParams | DamageTrackTypesParam);
DamageTrackTypesParam:
    "types:" "[" (types+=STRING ("," types+=STRING)*)? "]";


// Macro Field -------------

MacroField:
    ExpressionModifier "macro" name=ID StandardFieldParamsFrag;

MacroExecute:
    "self." macro=[MacroField:ID] ".execute" "(" ")";

// Document Links -------------

TableField:
    ExpressionModifier "table" "<" document=[Document:ID] ">" name=ID ("(" params+=TableParams ("," params+=TableParams)* ")")?;
TableParams:
    (StandardFieldParams | WhereParam | TableFieldsParam | TableImageParam | TableImageActionParam
     | TableSortableParam | TableSearchableParam | TablePinnableParam);
SingleDocumentExp:
    ExpressionModifier document=[Document:ID] name=ID StandardFieldParamsFrag;
DocumentChoiceExp:
    ExpressionModifier "choice" "<" document=[Document:ID]  ">" name=ID ("(" params+=DocumentChoiceParms ("," params+=DocumentChoiceParms)* ")")?;
DocumentChoicesExp:
    ExpressionModifier "choices" "<" document=[Document:ID]  ">" name=ID ("(" params+=DocumentChoiceParms ("," params+=DocumentChoiceParms)* ")")?;
DocumentChoiceParms:
    (StandardFieldParams | WhereParam | GlobalParam);
TableFieldsParam:
    "fields:" "[" fields+=ID ("," fields+=ID)* "]";
TableImageParam:
    "image:" value=BOOLEAN;
TableImageActionParam:
    "imageAction:" action=[Action:ID];
TableSortableParam:
    "sortable:" value=BOOLEAN;
TableSearchableParam:
    "searchable:" value=BOOLEAN;
TablePinnableParam:
    "pinnable:" value=BOOLEAN;

// Inventory -------------

InventoryField:
    ExpressionModifier "inventory" "<" document=[Document:ID] ">" name=ID ("(" params+=InventoryParams ("," params+=InventoryParams)* ")")?;

InventoryParams:
    (StandardFieldParams | WhereParam | GlobalParam |
     InventorySlotsParam | InventoryRowsParam | InventoryColumnsParam | InventorySlotSizeParam |
     InventoryQuantityParam | InventoryMoneyParam |
     InventorySumParam | InventorySumMaxParam | InventorySortParam |
     InventoryEmptySlotsParam | InventorySummaryParam);

InventorySlotsParam:
    "slots:" value=INT;

InventoryRowsParam:
    "rows:" value=INT;

InventoryColumnsParam:
    "columns:" value=INT;

InventorySlotSizeParam:
    "slotSize:" value=PX;

InventoryQuantityParam:
    "quantity:" field=[Property:ID];

InventoryMoneyParam:
    "money:" field=[MoneyField:ID];

InventorySumParam:
    "sum:" properties=InventorySumProperties;

InventorySumProperties:
    property=[Property:ID] | "[" properties+=[Property:ID] ("," properties+=[Property:ID])* "]";

InventorySumMaxParam:
    // `values` (a [..] list) must precede `expression`, because Expression now includes
    // ArrayExpression and would otherwise swallow the list as a single (mis-generated) expression.
    "sumMax:" (value=INT | values=InventorySumMaxValues | expression=Expression);

InventorySumMaxValues:
    "[" values+=(INT | Expression) ("," values+=(INT | Expression))* "]";

InventorySortParam:
    "sort:" property=[Property:ID] order=("asc" | "desc")?;

InventoryEmptySlotsParam:
    "emptySlots:" value=("show" | "hide" | "collapse");

InventorySummaryParam:
    "summary:" value=("full" | "compact" | "minimal");

// Datetime -------------

DateExp:
    ExpressionModifier "date" name=ID StandardFieldParamsFrag;
TimeExp:
    ExpressionModifier "time" name=ID StandardFieldParamsFrag;
DateTimeExp:
    ExpressionModifier "datetime" name=ID StandardFieldParamsFrag;


// Dice -------------

DieField:
    ExpressionModifier "die" name=ID ("(" params+=DieParams ("," params+=DieParams)* ")")?;

DiceField:
    ExpressionModifier "dice" name=ID ("(" params+=DieParams ("," params+=DieParams)* ")")?;

DieParams:
    (StandardFieldParams | DieValueParam | DieChoicesParam | DieInitialParam | DieNoneParam);

DieValueParam:
    "value:" value=(DICE | MethodBlock);

DieInitialParam:
    "initial:" value=(DICE | MethodBlock);

DieChoicesParam:
    "choices:" "[" (choices+=DICE ("," choices+=DICE)*)? "]";

DieNoneParam:
    "none:" value=BOOLEAN;


// Paperdoll -------------

PaperDollExp:
    ExpressionModifier "paperdoll" name=ID ("(" params+=PaperDollParameter* ("," params+=PaperDollParameter)* ")")? "{" elements+=(PaperDollElement)* "}";
PaperDollParameter:
    (StandardFieldParams | ImageParam | SizeParam);
PaperDollElement:
    (PaperDollDocumentReference);
PaperDollDocumentReference:
    document=[Document:ID] name=ID "(" "left:" left=PX "," "top:" top=PX ")";


// ParentPropertyRef -------------

ParentPropertyRefExp:
    ExpressionModifier "parent" "<" propertyType=("attribute" | "resource" | "number" | "boolean" | "date" | "time" | "datetime" | "die" | "dice" | "string" | "tracker" | "choice" | "paperdoll" | "html" ) ">"
    name=ID ( "(" params+=ParentPropertyRefParams ("," params+=ParentPropertyRefParams)* ")")?;
ParentPropertyRefParams:
    (StandardFieldParams | ParentPropertyRefChoiceParam);
ParentPropertyRefChoiceParam:
    "choices:" "[" choices+=ParentPropertyRefChoice ("," choices+=ParentPropertyRefChoice)* "]";
ParentPropertyRefChoice:
    document=[Document:ID] ("." property=[Property:ID])?;

// SelfPropertyRef -------------

SelfPropertyRefExp:
    ExpressionModifier "self" "<" propertyType=("attribute" | "resource" | "number" | "boolean" | "date" | "time" | "datetime" | "die" | "dice" | "string" | "tracker" | "choice" | "paperdoll" | "html" ) ">"
    name=ID ( "(" params+=SelfPropertyRefParams ("," params+=SelfPropertyRefParams)* ")")?;
SelfPropertyRefParams:
    (StandardFieldParams | SelfPropertyRefChoiceParam);
SelfPropertyRefChoiceParam:
    "choices:" "[" choices+=SelfPropertyRefChoice ("," choices+=SelfPropertyRefChoice)* "]";
SelfPropertyRefChoice:
    property=[Property:ID];


// Field Params ------------------------------------------------------

NumberParamMin:
    "min:" value=(MethodBlock | INT);
NumberParamInitial:
    "initial:" value=(MethodBlock | INT);
SizeParam:
    "size:" value=PX;
NumberParamValue:
    "value:" value=(MethodBlock | INT);
NumberParamMax:
    "max:" value=(MethodBlock | INT);
NumberParamCalculator:
    "calculator:" value=BOOLEAN;
ColorParam:
    "color:" value=HEX_COLOR;
BackgroundParam:
    "background:" background=BACKGROUND;
IconParam:
    "icon:" value=STRING;
ImageParam:
    "image:" value=STRING;
WhereParam:
    "where:" value=WhenExpressions;
GlobalParam:
    "global:" value=BOOLEAN;
LabelParam:
    "label:" value=STRING;
LocationParam:
    "location:" x=(INT | Expression) "," y=(INT | Expression);
WidthParam:
    "width:" value=(INT | "auto");
HeightParam:
    "height:" value=(INT | "auto");

// Document Special ------------------------------------------------------

InitiativeProperty:
    "initiative" "(" "value:" value=Expression ")";
StatusProperty:
    (tag="death")? "status" name=ID StatusPropertyParameters;
fragment StatusPropertyParameters:
    ("(" params+=StatusPropertyParameter* ("," params+=StatusPropertyParameter)* ")")?;
StatusPropertyParameter:
    (DocumentSvgParam | StatusParamWhen);
StatusParamWhen:
    "when:" when=(WhenExpressions | MethodBlock);
HookHandler:
    "on" name=('combatStart' | 'combatEnd'
        | 'turnIsNext' | 'turnStart' | 'turnEnd'
        | 'roundStart' | 'roundEnd'
        | 'death'
        | 'preApplyDamage' | 'preApplyTemp' | 'preApplyHealing'
        | 'appliedDamage' | 'appliedTemp' | 'appliedHealing'
        | ID) ("(" params+=MethodParam ("," params+=MethodParam)* ")")? "{" body+=(MethodBlockExpression)* "}";
MethodParam:
    name=ID;


// Functions -----------

FunctionCall:
    "self." method=[FunctionDefinition:ID] ("(" (params+=Expression ("," params+=Expression)*)? ")")?;
FunctionDefinition:
    "function" name=ID ("(" (params+=FunctionParam ("," params+=FunctionParam)*)? ")")? ("returns" returnType=(NOTHING | "number" | "boolean" | "string"))? method=MethodBlock;
FunctionParam:
    param=(Property) ("=" defaultValue=Expression)?;


// Self Access / Modification ------------------------------------------------------

fragment SelfSpecialAccess:
    access=("Name" | "Description" | "Image" | "DocumentType" | "EditMode" | "Effects");
fragment Self:
    (("self." SelfSpecialAccess) | ( "self." property=[Property:ID] ) | ("self[" "self." propertyLookup=[Property:ID] "]" )  ) ("." subProperties+=("Name" | "number" | "die" | ID))*;
Access:
    Self;
Assignment:
    (ExpressionAssignment | IncrementDecrementAssignment | QuickModifyAssignment);
ExpressionAssignment:
    Self "=" exp=Expression;
IncrementDecrementAssignment:
    Self term=("++"|"--");
QuickModifyAssignment:
    Self term=("+="|"-="|"*="|"/=") exp=Expression;


// Prompt Input Access ---------------------------------------------------------------
// Inside a prompt, `input.X` references a sibling prompt input field (resolved against
// the containing prompt's body). Distinct from `self.X` (the document). Used by
// rollVisualizer to chart a formula that reacts to the user's prompt inputs live.

PromptInputAccess:
    "input." property=[Property:ID] ("." subProperties+=("Name" | "number" | "die" | ID))*;

// Parent Access / Modification ------------------------------------------------------

fragment Parent:
    "parent" ( "." property=[Property:ID] | "[" "self." propertyLookup=[Property:ID] "]" ) ("." subProperties+=("Name" | "number" | "die" | ID))*;
ParentAccess:
    Parent;
ParentAssignment:
    (ParentExpressionAssignment | ParentIncrementDecrementAssignment | ParentQuickModifyAssignment);
ParentExpressionAssignment:
    Parent "=" exp=Expression;
ParentIncrementDecrementAssignment:
    Parent term=("++"|"--");
ParentQuickModifyAssignment:
    Parent term=("+="|"-="|"*="|"/=") exp=Expression;


// Target Access / Modification ------------------------------------------------------

fragment Target:
    "target" ( "." property=[Property:ID] ) ("." subProperties+=("Name" | "number" | "die" | ID))*;
TargetAccess:
    Target;
TargetAssignment:
    (TargetExpressionAssignment | TargetIncrementDecrementAssignment | TargetQuickModifyAssignment);
TargetExpressionAssignment:
    Target "=" exp=Expression;
TargetIncrementDecrementAssignment:
    Target term=("++"|"--");
TargetQuickModifyAssignment:
    Target term=("+="|"-="|"*="|"/=") exp=Expression;


// Variable Access / Modification ------------------------------------------------------

FleetingAccess:
    variable=[VariableExpression] (("." subProperty=("Name" | "dice" | ID))? | ("[" arrayAccess=Expression "]")?);
VariableAccess:
    (VariableExpression | Parameter);
VariableAssignment:
    (VariableExpressionAssignment | VariableIncrementDecrementAssignment | VariableQuickModifyAssignment);
fragment VariableAccessFrag:
    variable=[VariableAccess:ID] ("." subProperties+=ID)*;
VariableExpressionAssignment:
    VariableAccessFrag "=" exp=Expression;
VariableIncrementDecrementAssignment:
    VariableAccessFrag term=("++"|"--");
VariableQuickModifyAssignment:
    VariableAccessFrag term=("+="|"-="|"*="|"/=") exp=Expression;
ItemAccess:
    "item" "." property=ID ("." subProperty=("Name" | ID))?;

// Roll result method access: r.count(1) / r.contains(die => die >= 3).
// Property accessors (r.crit, r.successes, r.dice, ...) flow through Ref/FleetingAccess
// plus getters on the generated Roll class; only the method-call forms need grammar.
// The method name is validated (must be count/contains) rather than reserved as a keyword.
RollResultAccess:
    variable=[VariableExpression:ID] "." method=ID "(" arg=RollPredicateArg ")";
RollPredicateArg:
    (param=Parameter "=>" body=Expression) | value=Expression;


// Actions ------------------------------------------------------

Action:
    (isQuick?="quick")? (isMacro?="macro")? (isSecondary?="secondary")? ExpressionModifier "action" name=ID ("(" params+=ActionParam ("," params+=ActionParam)* ")")? method=MethodBlock;
ActionParam:
    (StandardFieldParams);


// Visibility ------------------------------------------------------

VisibilityParam:
    "visibility:" visibility=(VisibilityValue | MethodBlock);
VisibilityValue:
    "Visibility" "." visibility=("unlocked" | "default" | "secret" | "edit" | "play" | "gmEdit" | "gmOnly" | "readonly" | "locked" | "hidden");


// Methods ------------------------------------------------------

WhenExpressions:
    (ShorthandComparisonExpression | ComparisonExpression | TargetTypeCheckExpression | ParentTypeCheckExpression);
IfStatement:
    "if" "(" expression=WhenExpressions ")" method=MethodBlock     elseIfs+=(ElseIf)*     ("else" elseMethod=MethodBlock)?;
ElseIf:
    "else" "if" "(" expression=WhenExpressions ")" method=MethodBlock;
Each:
    'each' var=Parameter 'in' collection=(Access | FleetingAccess | ParentAccess | TargetAccess | NumberRange) method=MethodBlock;
EachAccess:
    variable=[Each:ID];
NumberRange:
    "[" start=Expression "to" end=Expression "]";

MethodBlock:
    ("{" body+=(MethodBlockExpression)* "}") | (body+=MethodBlockExpression);
MethodBlockExpression:
    (MacroExecute | VariableExpression | Assignment | ParentAssignment | TargetAssignment | VariableAssignment | SystemSettingAssignment | ReturnExpression |
     IfStatement | JS | ChatCard | SelfMethod | Each | Update | LogExpression | Wait | FunctionCall  | PlayAudio | Combat | User );
JS:
    js=JS_LINE;
LogExpression:
    "log" "(" params+=Expression ("," params+=Expression)* ")";
VariableExpression:
    type=("fleeting" | "eternal") name=ID "=" value=(Expression | Roll | DamageRoll | Prompt);
ReturnExpression:
    "return" value=Expression;
Roll:
    "roll" "(" parts+=(Expression)* ("," params+=RollParameter ("," params+=RollParameter)*)? ")";
RollParameter:
    CritParam | FumbleParam | SuccessParam | FailureParam;
// crit/fumble compare the natural face of the first die term. Bare value (crit: 20) means
// equality; an operator form (crit: >= 19) uses that operator. For total-based crit, branch
// manually on the roll's .total.
CritParam:
    "crit:" (op=RollCompareOp)? value=Expression;
FumbleParam:
    "fumble:" (op=RollCompareOp)? value=Expression;
// success/failure: per-die natural-face comparison. failure: subtracts from the success count.
SuccessParam:
    "success:" (op=RollCompareOp)? value=Expression;
FailureParam:
    "failure:" (op=RollCompareOp)? value=Expression;
RollCompareOp returns string:
    "<=" | ">=" | "==" | "!=" | "<" | ">";
DamageRoll:
    "damage" "(" params+=DamageRollParam ("," params+=DamageRollParam)* ")";
DamageRollParam:
    (RollParam | TypeParam);
RollParam:
    "roll:" value=Expression;
TypeParam:
    "type:" value=(Access | ParentAccess | TargetAccess | Literal);
SelfMethod:
    "self." method=("delete()" | "update()");
Wait:
    "wait" duration=(INT | Expression) unit=("ms" | "seconds" | "minutes");

// Play Audio -----------

PlayAudio:
    "play" "(" params+=PlayAudioParams ("," params+=PlayAudioParams)* ")";
PlayAudioParams:
    PlayAudioFile | PlayAudioVolume;
PlayAudioFile:
    "file:" value=(STRING | Expression);
PlayAudioVolume:
    "volume:" value=(INT | Expression);


// User --------

User:
    (UserProperty);

UserProperty:
    "User." property=("isGM" | "name");


// System Settings access --------
// `System.X` reads a declared setting; `System.X = expr` writes it
// (await game.settings.set). World-scoped writes must be GM-gated (validated).

SystemSettingAccess:
    "System" "." setting=[SettingField:ID];
SystemSettingAssignment:
    "System" "." setting=[SettingField:ID] "=" exp=Expression;


// Combat

Combat:
    (CombatMethods | CombatProperty);

CombatProperty:
    "Combat." property=("isMyTurn" | "isNotMyTurn");

CombatMethods:
    "Combat." method=("nextTurn" | "end") "(" ")";


// Chat Card -----------

ChatCard:
    "chat" name=ID ("(" "template:" path=STRING ")")? body=ChatBlock;
ChatBlock:
    "{" chatExp+=(ChatBlockExpression)* "}";
ChatBlockExpression:
    type=("tag" | "flavor" | "wide")? (Access | FleetingAccess | ParentAccess | TargetAccess | Expression);


// Prompt -----------

Prompt:
    "prompt" ("(" params+=PromptParams ("," params+=PromptParams)* ")")? "{" body+=(ClassExpression)*"}";
PromptParams:
    (TargetParam | LabelParam | IconParam | LocationParam | WidthParam | HeightParam | TimeLimitParam);
TimeLimitParam:
    "limit:" value=(INT | Expression) unit=("ms" | "seconds" | "minutes");
TargetParam:
    "target:" value=("user" | "gm" | "target");
Update:
    (UpdateSelf | UpdateParent);
UpdateSelf:
    "update" Self;
UpdateParent:
    "update" Parent;


// Expressions ------------------------------------------------------

Expression:
    AddOrSubtract;
AddOrSubtract infers Expression:
    MultiplyOrDivide ({infer BinaryExpression.e1=current} op=('+'|'-') e2=MultiplyOrDivide)*;
MultiplyOrDivide infers Expr:
    Logical ({infer BinaryExpression.e1=current} op=('*'|'/') e2=Logical)*;
Logical infers Expr:
    Comparison ({infer BinaryExpression.e1=current} op=('and' | 'or') e2=Comparison)*;
Comparison infers Expr:
    PrimitiveExpression ({infer BinaryExpression.e1=current} op=('<' | '<=' | '>' | '>=' | '==' | '!=' | 'equals' | '!equals') e2=PrimitiveExpression)*;
PrimitiveExpression:
    Literal | RollResultAccess | Ref | Roll | DamageRoll | Group | NegExpression | Access | EachAccess | JS | FleetingAccess | ParentAccess | TargetAccess | PromptInputAccess | ItemAccess | ArrayExpression | MathExpression | VisibilityValue | FunctionCall | CombatProperty | UserProperty | SystemSettingAccess;
ComparisonExpression:
    e1=Expression term=("<" | ">" | "<=" | ">=" | "equals" | "==" | "!equals" | "!=" | "has" | "excludes" | "startsWith" | "endsWith") e2=Expression;
ShorthandComparisonExpression:
    e1=Expression term=("exists" | "!exists" | "isEmpty" | "isNotEmpty")?;
ParentTypeCheckExpression:
    "parent" "is" document=[Document:ID];
TargetTypeCheckExpression:
    "target" "is" document=[Document:ID];
ArrayExpression:
    "[" (items+=Expression ("," items+=Expression)*)? "]";

// Math Expressions ------
MathExpression:
    MathSingleExpression | MathParamExpression | MathEmptyExpression;
MathEmptyExpression:
    "Math." operation=("random") "(" ")";
MathSingleExpression:
    "Math." operation=("abs" | "ceil" | "floor" | "round" ) "(" exp=Expression ")";
MathParamExpression:
    "Math." operation=("max" | "min") "(" params+=Expression ("," params+=Expression)* ")";

// literal
Literal:
    val=(INT|STRING|DICE|NOTHING|BOOLEAN);
// cross-reference to a parameter
Ref:
    val=[VariableAccess:ID] ("." subProperties+=("Name" | "Description" | "Image" | "DocumentType" | "EditMode" | "Effects" | "dice" | ID))*;
// grouped expression with parentheses
Group:
    '(' ge=Expression ')';
// negated expression
NegExpression:
    ('-'|'!') ne=Expression;
Parameter:
    name=ID;


hidden terminal WS: /\s+/;
terminal NOTHING: "nothing";
terminal BACKGROUND: "topography" | "hideout" | "graphpaper" | "texture" | "squares" | "dominoes" | "temple" | "food" | "anchors" | "bubbles" | "diamonds" | "circuitboard" | "bricks" | "signal";
terminal BOOLEAN returns boolean: "true" | "false";
terminal DICE: /(\d+)?d(\d+)(\w+)?/;
terminal ID: /[_a-zA-Z][\w_]*/;
terminal PX: /(-)?[0-9]+px/;
terminal INT returns number: /(-)?[0-9]+(\.[0-9]+)?/;
terminal STRING: /"(\\.|[^"\\])*"|'(\\.|[^'\\])*'/;
terminal JS_LINE: /\@js\{.+\}/;
terminal HEX_COLOR: /#[0-9a-fA-F]{6}/;
hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
