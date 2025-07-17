grammar IntelligentSystemDesignLanguage
entry Entry:
    config=Config documents+=Document*;
     
// Config ------------------------------------------------------ 

Config:
    "config" name=ID "{" body+=(ConfigExpression)* "}";

ConfigExpression:
    type=("label" | "id" | "author" | "description") "=" value=STRING;
 
// Documents ------------------------------------------------------ 

Document:
    Actor | Item;

Actor:
    "actor" name=ID ("(" params+=DocumentParam ("," params+=DocumentParam)* ")")? ClassBlock;
Item:
    "item" name=ID ("(" params+=DocumentParam ("," params+=DocumentParam)* ")")? ClassBlock;
DocumentParam:
    (IconParam | BackgroundParam | DocumentSvgParam | DocumentDescriptionParam | DocumentCreatableParam | DocumentDefaultParam);
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
    (Section | Page | Row | Column | Tab);

Section:
    "section" name=ID "{" body+=(ClassExpression|Row|Column)* "}";
Row:
    "row" "{" body+=(ClassExpression|Section|Row|Column)* "}";
Column:
    "column" "{" body+=(ClassExpression|Section|Row|Column)* "}";
Page:
    "page" name=ID ("(" params+=(IconParam|BackgroundParam) ("," params+=(IconParam|BackgroundParam))* ")")? "{" body+=(ClassExpression | Layout)* "}";
Tab:
    "tab" name=ID ("(" params+=(IconParam|LabelParam) ("," params+=(IconParam|LabelParam))* ")")? "{" body+=(ClassExpression | Layout)* "}";

ClassExpression:
    (Property | Action | InitiativeProperty | StatusProperty | HookHandler | FunctionDefinition);
 
 
// Fields ------------------------------------------------------ 

Property:
    (BasicFields | ComplexFields | DateTimeFields | DiceFields | DocumentFields | ReferenceFields | DeprecatedFields);
BasicFields:
    (StringExp | NumberExp | HtmlExp | BooleanExp);
ComplexFields:
    (ResourceExp | TrackerExp | AttributeExp | DamageTrackExp | MeasuredTemplateField);
DateTimeFields:
    (DateExp | TimeExp | DateTimeExp);
DiceFields:
    (DieField | DiceField);
DocumentFields:
    (DocumentArrayExp | SingleDocumentExp | DocumentChoiceExp | DocumentChoicesExp | PaperDollExp | MacroField | TableField);
ReferenceFields:
    (ParentPropertyRefExp);
DeprecatedFields:
    (PipsExp);
fragment ExpressionModifier:
    (modifier=("unlocked" | "default" | "secret" | "edit" | "gmEdit" | "gmOnly" | "readonly" | "locked" | "hidden"))?;
StandardFieldParams:
    (VisibilityParam | IconParam | ColorParam | LabelParam);
fragment StandardFieldParamsFrag:
    ("(" params+=StandardFieldParams* ("," params+=StandardFieldParams)* ")")?;
NumberFieldParams:
    (NumberParamMin | NumberParamInitial | NumberParamValue | NumberParamMax);
 
 
// String ------------- 

StringExp:
    ExpressionModifier "string" name=ID ("(" params+=StringParameter* ("," params+=StringParameter)* ")")?;
StringParameter:
    (StringParamChoices | StringParamValue | StandardFieldParams);
StringParamValue:
    "value:" value=(STRING | MethodBlock);
StringParamChoices:
    "choices:" "[" (choices+=STRING ("," choices+=STRING)*)? "]";
 
 
// Number -------------

NumberExp:
    ExpressionModifier "number" name=ID ("(" params+=NumberParameter* ("," params+=NumberParameter)* ")")?;
NumberParameter:
    (NumberParamMin | NumberParamInitial | NumberParamValue | NumberParamMax | StandardFieldParams);
 
 
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
    (StandardFieldParams | NumberFieldParams | AttributeParamMod | AttributeStyleParam | AttributeRollParam);
AttributeParamMod:
    "mod:" method=MethodBlock;
AttributeStyleParam:
    "style:" style=("plain" | "box");
AttributeRollParam:
    "roll:" roll=(MethodBlock | Expression);
 
 
// Pips -------------

PipsExp:
    ExpressionModifier "pips" name=ID ("(" params+=PipsParameter ("," params+=PipsParameter)* ")")?;
PipsParameter:
    (NumberParamMin | NumberParamMax | NumberParamInitial | NumberParamValue | PipsStyleParameter);
PipsStyleParameter:
    "style:" style=("squares" | "circles");
 
 
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

DocumentArrayExp:
    ExpressionModifier document=[Document:ID] "[]" name=ID ("(" params+=(StandardFieldParams|WhereParam|TableFieldsParam) ")")?;
TableField:
    ExpressionModifier "table" "<" document=[Document:ID] ">" name=ID ("(" params+=(StandardFieldParams|WhereParam|TableFieldsParam) ")")?;
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
    (StandardFieldParams | DieValueParam | DieChoicesParam | DieInitialParam);

DieValueParam:
    "value:" value=(DICE | MethodBlock);

DieInitialParam:
    "initial:" value=(DICE | MethodBlock);

DieChoicesParam:
    "choices:" "[" (choices+=DICE ("," choices+=DICE)*)? "]";
 

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


// Field Params ------------------------------------------------------

NumberParamMin:
    "min:" value=(MethodBlock | INT);
NumberParamInitial:
    "initial:" value=(INT);
SizeParam:
    "size:" value=PX;
NumberParamValue:
    "value:" value=(MethodBlock | INT);
NumberParamMax:
    "max:" value=(MethodBlock | INT);
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
    "self." method=ID ("(" params+=Expression ("," params+=Expression)* ")")?;
FunctionDefinition:
    "function" name=ID ("(" params+=FunctionParam ("," params+=FunctionParam)* ")")? ("returns" returnType=(NOTHING | "number" | "boolean" | "string"))? method=MethodBlock;
FunctionParam:
    param=(Property) ("=" defaultValue=Expression)?;
 
 
// Self Access / Modification ------------------------------------------------------

fragment SelfSpecialAccess:
    access=("Name" | "Description" | "Image" | "DocumentType" | "EditMode" | "Effects");
fragment Self:
    (("self." SelfSpecialAccess) | ( "self." property=[Property:ID] ) | ("self[" "self." propertyLookup=[Property:ID] "]" )  ) ("." subProperties+=("Name" | ID))*;
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


// Parent Access / Modification ------------------------------------------------------

fragment Parent:
    "parent" ( "." property=[Property:ID] | "[" "self." propertyLookup=[Property:ID] "]" ) ("." subProperties+=("Name" | ID))*;
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
    "target" ( "." property=[Property:ID] ) ("." subProperties+=("Name" | ID))*;
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
    variable=[VariableExpression] (("." subProperty=("Name" | ID))? | ("[" arrayAccess=Expression "]")?);
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


// Actions ------------------------------------------------------

Action:
    (isQuick?="quick")? (isMacro?="macro")? ExpressionModifier "action" name=ID ("(" params+=ActionParam ("," params+=ActionParam)* ")")? method=MethodBlock;
ActionParam:
    (StandardFieldParams);


// Visibility ------------------------------------------------------

VisibilityParam:
    "visibility:" visibility=(VisibilityValue | MethodBlock);
VisibilityValue:
    "Visibility" "." visibility=("unlocked" | "default" | "secret" | "edit" | "gmEdit" | "gmOnly" | "readonly" | "locked" | "hidden");
 

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
    (MacroExecute | VariableExpression | Assignment | ParentAssignment | TargetAssignment | VariableAssignment | ReturnExpression |
     IfStatement | JS | ChatCard | SelfMethod | Each | Update | LogExpression | Wait | FunctionCall  | PlayAudio | Combat | User );
JS:
    js=JS_LINE;
LogExpression:
    "log" "(" params+=Expression ("," params+=Expression)* ")";
VariableExpression:
    type=("fleeting" | "eternal") name=ID "=" value=(Expression | Roll | Prompt);
ReturnExpression:
    "return" value=Expression;
Roll:
    "roll" "(" parts+=(Expression)* ")";
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
    type=("tag" | "flavor")? (Access | FleetingAccess | ParentAccess | TargetAccess | Expression);


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
    Literal | Ref | Roll | Group | NegExpression | Access | EachAccess | JS | FleetingAccess | ParentAccess | TargetAccess | ItemAccess | ArrayExpression | MathExpression | VisibilityValue | FunctionCall | CombatProperty | UserProperty;
ComparisonExpression:
    e1=Expression term=("<" | ">" | "<=" | ">=" | "equals" | "==" | "!equals" | "!=") e2=Expression;
ShorthandComparisonExpression:
    e1=Expression term=("exists" | "!exists")?;
ParentTypeCheckExpression:
    "parent" "is" document=[Document:ID];
TargetTypeCheckExpression:
    "target" "is" document=[Document:ID];
ArrayExpression:
    "[" items+=Literal ("," items+=Literal)* "]";

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
    val=[VariableAccess:ID] ("." subProperties+=("Name" | "Description" | "Image" | "DocumentType" | "EditMode" | "Effects" | ID))*;
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
