grammar IntelligentSystemDesignLanguage

entry Entry:
    config=Config documents+=Document*;

Config:
    "config" name=ID "{" body+=(ConfigExpression)* "}";

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

fragment ClassBlock:
    "{" body+=(ClassExpression | Section | Page)* "}";

Section:
    "section" name=ID "{" body+=ClassExpression* "}";

Page:
    "page" name=ID ("(" params+=(IconParam|BackgroundParam) ("," params+=(IconParam|BackgroundParam))* ")")? "{" body+=(ClassExpression | Section)* "}";

ConfigExpression:
    type=("label" | "id" | "author" | "description") "=" value=STRING;

ClassExpression:
    (Property | Action | Access | IfStatement | InitiativeProperty | StatusProperty);

Property:
    (StringExp | NumberExp | HtmlExp | BooleanExp | ResourceExp | AttributeExp | DamageTrackExp | PipsExp | DocumentArrayExp | SingleDocumentExp | DateExp | TimeExp | DateTimeExp | PaperDollExp);

fragment Self:
    (( "self." property=[Property:ID] ) | ("self[" "self." propertyLookup=[Property:ID] "]" )) ("." subProperties+=ID)*;

// | ("self." access=("Name" | "Description" | "Image" | "Type" ))

ResourceAccess:
    ("self." property=[ResourceExp:ID]) ("." subProperties+=("min" | "max"))?;

Access:
    Self | ResourceAccess;

FleetingAccess:
    variable=[VariableExpression] (("." subProperty=ID)? | ("[" arrayAccess=Expression "]")?);

VariableAccess:
    (VariableExpression | Parameter);

EachAccess:
    variable=[Each:ID];

ElseIf:
    "else" "if" "(" expression=WhenExpressions ")" method=MethodBlock;

IfStatement:
    "if" "(" expression=WhenExpressions ")" method=MethodBlock
    elseIfs+=(ElseIf)*
    ("else" elseMethod=MethodBlock)?
    ;

Assignment:
    (ExpressionAssignment | IncrementAssignment | DecrementAssignment | IncrementValAssignment | DecrementValAssignment);

ExpressionAssignment:
    Self "=" exp=Expression;

IncrementAssignment:
    Self "++";

DecrementAssignment:
    Self "--";

IncrementValAssignment:
    Self "+=" exp=Expression;

DecrementValAssignment:
    Self "-=" exp=Expression;

fragment Parent:
    "parent" ( "." property=ID | "[" "self." propertyLookup=[Property:ID] "]" ) ("." subProperties+=ID)*;

ParentAccess:
    Parent;

ParentAssignment:
    (ParentExpressionAssignment | ParentIncrementAssignment | ParentDecrementAssignment | ParentIncrementValAssignment | ParentDecrementValAssignment);

ParentExpressionAssignment:
    Parent "=" exp=Expression;

ParentIncrementAssignment:
    Parent "++";

ParentDecrementAssignment:
    Parent "--";

ParentIncrementValAssignment:
    Parent "+=" exp=Expression;

ParentDecrementValAssignment:
    Parent "-=" exp=Expression;

ItemAccess:
    "item" "." property=ID ("." subProperty=ID)?;

VariableAssignment:
    (VariableExpressionAssignment | VariableIncrementAssignment | VariableDecrementAssignment | VariableIncrementValAssignment | VariableDecrementValAssignment);

fragment VariableAccessFrag:
    variable=[VariableAccess:ID] ("." subProperties+=ID)*;

VariableExpressionAssignment:
   VariableAccessFrag "=" exp=Expression;

VariableIncrementAssignment:
    VariableAccessFrag "++";

VariableDecrementAssignment:
    VariableAccessFrag "--";

VariableIncrementValAssignment:
    VariableAccessFrag "+=" exp=Expression;

VariableDecrementValAssignment:
    VariableAccessFrag "-=" exp=Expression;

Action:
    "action" name=ID ("(" conditions+=ActionCondition ("," conditions+=ActionCondition)* ")")? method=MethodBlock;

ActionCondition:
    (DisabledCondition | HiddenCondition | IconParam | ColorParam);

DisabledCondition:
    "disabled:" when=WhenExpressions;

HiddenCondition:
    "hidden:" when=WhenExpressions;

WhenExpressions:
    (ShorthandComparisonExpression | ComparisonExpression);

Each:
    'each' var=Parameter 'in' collection=(Access | FleetingAccess | ParentAccess) method=MethodBlock;

MethodBlock:
    "{" body+=(MethodBlockExpression)* "}";

Roll:
    "roll" "(" parts+=(Expression)* ")";

MethodBlockExpression:
    (VariableExpression | Assignment | ParentAssignment | VariableAssignment | IncrementAssignment | ReturnExpression | IfStatement | JS | ChatCard | SelfMethod | Each | Update );

JS: js=JS_LINE;

SelfMethod:
    "self." method=("delete()" | "update()");

ChatCard:
    "chat" name=ID ("(" "template:" path=STRING ")")? body=ChatBlock;

ChatBlock:
    "{" chatExp+=(ChatBlockExpression)* "}";

ChatBlockExpression:
    type=("tag" | "flavor")? (Access | FleetingAccess | ParentAccess | Expression);

VariableExpression:
    type=("fleeting" | "eternal") name=ID "=" value=(Expression | Roll | Prompt);

ReturnExpression:
    "return" value=Expression;

Prompt: 
    "prompt" ("(" params+=PromptParams ("," params+=PromptParams)* ")")? "{" body+=(ClassExpression)*"}";

PromptParams:
    (TargetParam | LabelParam | IconParam);

TargetParam:
    "target:" value=("user" | "gm");

LabelParam:
    "label:" value=STRING;

Update:
    (UpdateSelf | UpdateParent);

UpdateSelf:
    "update" Self;

UpdateParent:
    "update" Parent;

Expression: AddOrSubtract;

AddOrSubtract infers Expression:
    MultiplyOrDivide ({infer BinaryExpression.e1=current} op=('+'|'-') e2=MultiplyOrDivide)*;

MultiplyOrDivide infers Expr:
    PrimitiveExpression ({infer BinaryExpression.e1=current} op=('*'|'/') e2=PrimitiveExpression)*;

PrimitiveExpression: Literal | Ref | Roll | Group | NegExpression | Access | EachAccess| JS | FleetingAccess | ParentAccess | ItemAccess | ArrayExpression | MathExpression;

ComparisonExpression:
    e1=Expression term=("<" | ">" | "<=" | ">=" | "equals" | "==") e2=Expression;

ShorthandComparisonExpression:
    e1=Expression term=("exists" | "!exists")?;

ArrayExpression: "[" items+=Literal ("," items+=Literal)* "]";

MathExpression:
    MathSingleExpression | MathParamExpression | MathEmptyExpression;

MathEmptyExpression:
    "Math." operation=("random") "(" ")";

MathSingleExpression:
    "Math." operation=("abs" | "ceil" | "floor" | "round" ) "(" exp=Expression ")";

MathParamExpression:
    "Math." operation=("max" | "min") "(" params+=Expression ("," params+=Expression)* ")";

// literal
Literal:        val=(INT|STRING|DICE|NOTHING|BOOLEAN);
// cross-reference to a parameter
Ref:        val=[VariableAccess:ID] ("." subProperties+=ID)*;
// grouped expression with parentheses
Group:      '(' ge=Expression ')';
// negated expression
NegExpression:    ('-'|'!') ne=Expression;

StringExp: ExpressionModifier "string" name=ID StringParameters;

NumberExp: ExpressionModifier "number" name=ID NumberParameters;

BooleanExp: ExpressionModifier "boolean" name=ID;

HtmlExp: ExpressionModifier "html" name=ID;

ResourceExp: ExpressionModifier (tag=("health" | "wounds"))? "resource" name=ID ("(" ("max:" max=(MethodBlock | INT))? & ("color:" color=HEX_COLOR)? ")")?;

AttributeExp: ExpressionModifier "attribute" name=ID AttributeParameters;

fragment AttributeParameters:
    ("(" params+=AttributeParameter* ("," params+=AttributeParameter)* ")")?;

AttributeParameter:
    (NumberParamMin | NumberParamMax | AttributeParamMod);

AttributeParamMod:
    "mod:" method=MethodBlock;

PipsExp: ExpressionModifier "pips" name=ID "(" "max:" max=(MethodBlock | INT) ("," "initial:" initial=(MethodBlock | INT))? ("," "style:" style=("squares" | "circles"))? ")";

DamageTrackExp: ExpressionModifier "damageTrack" name=ID "(" "max:" max=(MethodBlock | INT) "," "types:" "[" (types+=STRING ("," types+=STRING)*)? "]" ")";

DocumentArrayExp: ExpressionModifier document=[Document:ID] "[]" name=ID ("(" params+=(IconParam|WhereParam) ")")?;

SingleDocumentExp: ExpressionModifier document=[Document:ID] name=ID;

DateExp: ExpressionModifier "date" name=ID;

TimeExp: ExpressionModifier "time" name=ID;

DateTimeExp: ExpressionModifier "datetime" name=ID;

PaperDollExp: ExpressionModifier "paperdoll" name=ID PaperDollParameters PaperDollBlock;

fragment PaperDollParameters:
    ("(" params+=PaperDollParameter* ("," params+=PaperDollParameter)* ")")?;

PaperDollParameter:
    (ImageParam | SizeParam);

fragment PaperDollBlock:
    "{" elements+=(PaperDollElement)* "}";

PaperDollElement:
    (PaperDollDocumentReference);

PaperDollDocumentReference:
    document=[Document:ID] name=ID "(" "left:" left=PX "," "top:" top=PX ")";

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

fragment ExpressionModifier:
    (modifier=("hidden" | "readonly" | "unlocked" | "locked"))?;

fragment StringParameters:
    ("(" params+=StringParameter* ("," params+=StringParameter)* ")")?;

StringParameter:
    (StringParamChoices | StringParamValue);

StringParamValue:
    "value:" value=(STRING | MethodBlock);

StringParamChoices:
    "choices:" "[" (choices+=STRING ("," choices+=STRING)*)? "]";

fragment NumberParameters:
    ("(" params+=NumberParameter* ("," params+=NumberParameter)* ")")?;

NumberParameter:
    (NumberParamMin | NumberParamInitial | NumberParamValue | NumberParamMax | ColorParam | IconParam);

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

Parameter: name=ID;

hidden terminal WS: /\s+/;
terminal NOTHING: "nothing";
terminal BACKGROUND: "topography" | "hideout" | "graphpaper" | "texture" | "squares" | "dominoes" | "temple" | "food" | "anchors" | "bubbles" | "diamonds" | "circuitboard" | "bricks" | "signal" ;
terminal BOOLEAN: "true" | "false";
terminal DICE: /(\d+)?d(\d+)(\w+)?/;
terminal ID: /[_a-zA-Z][\w_]*/;
terminal PX: /(-)?[0-9]+px/;
terminal INT returns number: /(-)?[0-9]+/;
terminal STRING: /"(\\.|[^"\\])*"|'(\\.|[^'\\])*'/;
terminal JS_LINE: /\@js\{.+\}/;
terminal HEX_COLOR: /#[0-9a-fA-F]{6}/;



hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
